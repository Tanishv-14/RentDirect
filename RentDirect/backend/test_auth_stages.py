"""Stage-by-stage API tests for RentDirect authentication.

Run from the backend folder:
    python -m unittest test_auth_stages.py -v
"""

import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

# Point the app at a throwaway database before importing Flask code.
_FD, _TEST_DB = tempfile.mkstemp(suffix=".db")
os.close(_FD)
os.environ["RENTDIRECT_DATABASE"] = _TEST_DB
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["SESSION_COOKIE_SECURE"] = "0"

from app import app  # noqa: E402
from database import (  # noqa: E402
    SAMPLE_COLLEGES,
    get_connection,
    get_table_columns,
    init_database,
)


EXPECTED_TABLES = {
    "users",
    "colleges",
    "students",
    "owners",
    "owner_colleges",
    "properties",
    "property_colleges",
    "property_images",
    "documents",
    "reviews",
    "inquiries",
    "verification",
}


def college_ids():
    connection = get_connection()
    try:
        rows = connection.execute("SELECT id FROM colleges ORDER BY id").fetchall()
        return [row["id"] for row in rows]
    finally:
        connection.close()


def count_users():
    connection = get_connection()
    try:
        return connection.execute("SELECT COUNT(*) AS total FROM users").fetchone()["total"]
    finally:
        connection.close()


class BaseApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_database()
        cls.client = app.test_client()
        cls.ids = college_ids()

    def setUp(self):
        self.client.post("/api/auth/logout")
        connection = get_connection()
        try:
            connection.execute("DELETE FROM users")
            connection.commit()
        finally:
            connection.close()

    def register_student(self, **overrides):
        body = {
            "full_name": "Asha Student",
            "email": "asha.student@gmail.com",
            "mobile_number": "9876543210",
            "college_id": self.ids[0],
            "preferred_area": "Koramangala",
        }
        body.update(overrides)
        return self.client.post("/api/auth/register/student", json=body)

    def register_owner(self, **overrides):
        body = {
            "owner_name": "Ravi Owner",
            "email": "ravi.owner@gmail.com",
            "mobile_number": "9123456780",
            "pg_name": "Sunrise PG",
            "nearby_college_ids": [self.ids[0], self.ids[1]],
        }
        body.update(overrides)
        return self.client.post("/api/auth/register/owner", json=body)

    def verify(self, email, otp="123456"):
        return self.client.post(
            "/api/auth/otp/verify",
            json={"email": email, "otp": otp},
        )


class Stage1DatabaseTest(BaseApiTest):
    def test_health_check_still_works(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "success")

    def test_all_original_tables_still_exist(self):
        connection = get_connection()
        try:
            rows = connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
            names = {row["name"] for row in rows}
        finally:
            connection.close()
        self.assertTrue(EXPECTED_TABLES.issubset(names))

    def test_owner_colleges_has_unique_owner_and_college(self):
        connection = get_connection()
        try:
            indexes = connection.execute("PRAGMA index_list(owner_colleges)").fetchall()
            unique_indexes = [row for row in indexes if row["unique"]]
            self.assertTrue(unique_indexes)
            sql = connection.execute(
                "SELECT sql FROM sqlite_master WHERE name = 'owner_colleges'"
            ).fetchone()["sql"]
        finally:
            connection.close()
        self.assertIn("UNIQUE", sql.upper())
        self.assertIn("owner_id", sql)
        self.assertIn("college_id", sql)

    def test_owners_pg_name_column_exists(self):
        connection = get_connection()
        try:
            columns = get_table_columns(connection, "owners")
        finally:
            connection.close()
        self.assertIn("pg_name", columns)

    def test_sample_colleges_are_labelled_when_table_was_empty(self):
        response = self.client.get("/api/colleges")
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["status"], "success")
        self.assertIn("sample", body["message"].lower())
        names = [row["name"] for row in body["data"]["colleges"]]
        self.assertEqual(len(names), len(SAMPLE_COLLEGES))
        self.assertTrue(all("sample" in name.lower() or "demo" in name.lower() for name in names))

    def test_sample_colleges_are_not_duplicated_on_second_init(self):
        init_database()
        connection = get_connection()
        try:
            total = connection.execute("SELECT COUNT(*) AS total FROM colleges").fetchone()["total"]
        finally:
            connection.close()
        self.assertEqual(total, len(SAMPLE_COLLEGES))

    def test_owner_colleges_rejects_duplicate_pairs(self):
        connection = get_connection()
        try:
            connection.execute(
                """
                INSERT INTO users (name, email, mobile_number, role, account_status)
                VALUES ('Temp Owner', 'temp.owner@gmail.com', '9000000001', 'owner', 'pending')
                """
            )
            owner_id = connection.execute(
                "INSERT INTO owners (user_id, pg_name) VALUES (last_insert_rowid(), 'Demo PG')"
            ).lastrowid
            connection.execute(
                "INSERT INTO owner_colleges (owner_id, college_id) VALUES (?, ?)",
                (owner_id, self.ids[0]),
            )
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute(
                    "INSERT INTO owner_colleges (owner_id, college_id) VALUES (?, ?)",
                    (owner_id, self.ids[0]),
                )
            connection.rollback()
        finally:
            connection.close()


class Stage2RegistrationTest(BaseApiTest):
    def test_student_registration_creates_pending_student(self):
        response = self.register_student()
        self.assertEqual(response.status_code, 201, response.get_json())
        data = response.get_json()["data"]
        self.assertEqual(data["role"], "student")
        self.assertEqual(data["account_status"], "pending")
        self.assertEqual(data["email"], "asha.student@gmail.com")
        self.assertEqual(data["student"]["preferred_area"], "Koramangala")
        self.assertNotIn("password", data)

    def test_owner_registration_saves_pg_name_and_colleges(self):
        response = self.register_owner()
        self.assertEqual(response.status_code, 201, response.get_json())
        data = response.get_json()["data"]
        self.assertEqual(data["role"], "owner")
        self.assertEqual(data["owner"]["pg_name"], "Sunrise PG")
        self.assertEqual(len(data["owner"]["nearby_colleges"]), 2)

    def test_duplicate_email_is_rejected(self):
        self.assertEqual(self.register_student().status_code, 201)
        response = self.register_owner(
            email="asha.student@gmail.com",
            mobile_number="9000000002",
        )
        self.assertEqual(response.status_code, 409)

    def test_duplicate_mobile_is_rejected(self):
        self.assertEqual(self.register_student().status_code, 201)
        response = self.register_owner(
            email="other.owner@gmail.com",
            mobile_number="9876543210",
        )
        self.assertEqual(response.status_code, 409)

    def test_non_gmail_is_rejected(self):
        response = self.register_student(email="asha@yahoo.com")
        self.assertEqual(response.status_code, 400)

    def test_invalid_mobile_is_rejected(self):
        response = self.register_student(mobile_number="12345")
        self.assertEqual(response.status_code, 400)

    def test_client_cannot_choose_admin_role_during_registration(self):
        response = self.client.post(
            "/api/auth/register/student",
            json={
                "full_name": "Asha Student",
                "email": "asha.admin@gmail.com",
                "mobile_number": "9876543211",
                "college_id": self.ids[0],
                "preferred_area": "Indiranagar",
                "role": "admin",
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["data"]["role"], "student")

    def test_unknown_college_is_rejected(self):
        response = self.register_student(college_id=99999)
        self.assertEqual(response.status_code, 400)


class Stage3OtpTest(BaseApiTest):
    def test_otp_request_is_labelled_prototype_and_does_not_claim_delivery(self):
        self.register_student()
        response = self.client.post(
            "/api/auth/otp/request",
            json={"email": "asha.student@gmail.com"},
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertIn("PROTOTYPE", body["message"])
        self.assertIn("123456", body["message"])
        self.assertIn("no sms or email is sent", body["message"].lower())
        self.assertEqual(body["data"]["delivery"], "none")
        self.assertTrue(body["data"]["prototype_only"])

    def test_wrong_otp_is_rejected(self):
        self.register_student()
        response = self.verify("asha.student@gmail.com", otp="000000")
        self.assertEqual(response.status_code, 401)
        self.assertIn("PROTOTYPE", response.get_json()["message"])

    def test_correct_prototype_otp_activates_account(self):
        self.register_student()
        response = self.verify("asha.student@gmail.com")
        self.assertEqual(response.status_code, 200, response.get_json())
        user = response.get_json()["data"]["user"]
        self.assertEqual(user["account_status"], "active")
        self.assertTrue(response.get_json()["data"]["prototype_only"])


class Stage4SessionTest(BaseApiTest):
    def test_session_cookie_is_set_after_verify(self):
        self.register_student()
        response = self.verify("asha.student@gmail.com")
        self.assertEqual(response.status_code, 200)
        self.assertIn("rentdirect_session", response.headers.get("Set-Cookie", ""))
        cookie_header = response.headers.get("Set-Cookie", "").lower()
        self.assertIn("httponly", cookie_header)
        self.assertIn("samesite=lax", cookie_header)

    def test_me_requires_login(self):
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_me_returns_logged_in_user(self):
        self.register_student()
        self.verify("asha.student@gmail.com")
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["data"]["email"], "asha.student@gmail.com")

    def test_login_alias_uses_the_same_prototype_otp(self):
        self.register_owner()
        response = self.client.post(
            "/api/auth/login",
            json={"email": "ravi.owner@gmail.com", "otp": "123456"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["data"]["user"]["role"], "owner")

    def test_logout_clears_session(self):
        self.register_student()
        self.verify("asha.student@gmail.com")
        logout = self.client.post("/api/auth/logout")
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_health_still_works_after_auth_routes(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)


class Stage5ProfileAndRolesTest(BaseApiTest):
    def test_student_can_update_preferred_area_but_not_role(self):
        self.register_student()
        self.verify("asha.student@gmail.com")
        response = self.client.patch(
            "/api/auth/me",
            json={"preferred_area": "HSR Layout", "role": "admin"},
        )
        self.assertEqual(response.status_code, 400)
        me = self.client.get("/api/auth/me").get_json()["data"]
        self.assertEqual(me["role"], "student")
        self.assertEqual(me["student"]["preferred_area"], "Koramangala")

        allowed = self.client.patch("/api/auth/me", json={"preferred_area": "HSR Layout"})
        self.assertEqual(allowed.status_code, 200, allowed.get_json())
        self.assertEqual(allowed.get_json()["data"]["student"]["preferred_area"], "HSR Layout")
        self.assertEqual(allowed.get_json()["data"]["role"], "student")

    def test_owner_can_update_pg_name_and_nearby_colleges(self):
        self.register_owner()
        self.verify("ravi.owner@gmail.com")
        response = self.client.patch(
            "/api/auth/me",
            json={
                "pg_name": "Moonlight PG",
                "nearby_college_ids": [self.ids[2]],
            },
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        owner = response.get_json()["data"]["owner"]
        self.assertEqual(owner["pg_name"], "Moonlight PG")
        self.assertEqual(len(owner["nearby_colleges"]), 1)
        self.assertEqual(owner["nearby_colleges"][0]["id"], self.ids[2])

    def test_student_cannot_open_owner_home(self):
        self.register_student()
        self.verify("asha.student@gmail.com")
        response = self.client.get("/api/auth/owner/home")
        self.assertEqual(response.status_code, 403)

    def test_owner_can_open_owner_home_but_not_student_home(self):
        self.register_owner()
        self.verify("ravi.owner@gmail.com")
        self.assertEqual(self.client.get("/api/auth/owner/home").status_code, 200)
        self.assertEqual(self.client.get("/api/auth/student/home").status_code, 403)

    def test_student_cannot_patch_owner_fields(self):
        self.register_student()
        self.verify("asha.student@gmail.com")
        response = self.client.patch("/api/auth/me", json={"pg_name": "Hacked PG"})
        self.assertEqual(response.status_code, 400)


def tearDownModule():
    try:
        Path(_TEST_DB).unlink(missing_ok=True)
    except OSError:
        pass


if __name__ == "__main__":
    unittest.main()
