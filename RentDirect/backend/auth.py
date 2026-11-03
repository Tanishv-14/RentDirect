"""Authentication routes for students and PG owners.

OTP 123456 is prototype-only simulated verification. This module does not
send SMS or email. It never stores passwords, and it never lets a normal
profile update change a user's role.
"""

from functools import wraps

from flask import Blueprint, g, jsonify, request, session
import sqlite3

from database import get_connection
from validation import (
    clean_text,
    normalize_email,
    normalize_mobile,
    parse_college_id,
    parse_college_id_list,
    validate_gmail,
    validate_mobile,
    validate_name,
    validate_pg_name,
    validate_preferred_area,
)

auth_bp = Blueprint("auth", __name__)

# Prototype-only. This is not a real one-time password and is not delivered
# by SMS or email. Replace this entire flow before any production use.
PROTOTYPE_OTP = "123456"
PROTOTYPE_OTP_NOTICE = (
    "PROTOTYPE ONLY: verification is simulated. Use OTP 123456. "
    "No SMS or email is sent."
)

ROLE_FIELDS_FORBIDDEN = {"role", "account_status", "id", "user_id"}


def json_error(message, status_code):
    return jsonify({"status": "error", "message": message}), status_code


def json_success(message, data=None, status_code=200):
    payload = {"status": "success", "message": message}
    if data is not None:
        payload["data"] = data
    return jsonify(payload), status_code


def read_json_body():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return None
    return body


def college_exists(connection, college_id):
    row = connection.execute(
        "SELECT id FROM colleges WHERE id = ?",
        (college_id,),
    ).fetchone()
    return row is not None


def all_colleges_exist(connection, college_ids):
    placeholders = ",".join("?" * len(college_ids))
    rows = connection.execute(
        f"SELECT id FROM colleges WHERE id IN ({placeholders})",
        college_ids,
    ).fetchall()
    return len(rows) == len(college_ids)


def find_user_by_email_or_mobile(connection, email=None, mobile_number=None):
    if email:
        row = connection.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,),
        ).fetchone()
        if row:
            return row
    if mobile_number:
        return connection.execute(
            "SELECT * FROM users WHERE mobile_number = ?",
            (mobile_number,),
        ).fetchone()
    return None


def duplicate_conflict_message(connection, email, mobile_number, exclude_user_id=None):
    query = "SELECT email, mobile_number FROM users WHERE (email = ? OR mobile_number = ?)"
    params = [email, mobile_number]
    if exclude_user_id is not None:
        query += " AND id != ?"
        params.append(exclude_user_id)
    row = connection.execute(query, params).fetchone()
    if not row:
        return None
    if row["email"] == email and row["mobile_number"] == mobile_number:
        return "An account with this Gmail address and mobile number already exists."
    if row["email"] == email:
        return "An account with this Gmail address already exists."
    return "An account with this mobile number already exists."


def fetch_user(connection, user_id):
    return connection.execute(
        "SELECT * FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()


def student_profile(connection, user_id):
    row = connection.execute(
        """
        SELECT students.college_id, students.preferred_area, colleges.name AS college_name
        FROM students
        LEFT JOIN colleges ON colleges.id = students.college_id
        WHERE students.user_id = ?
        """,
        (user_id,),
    ).fetchone()
    if not row:
        return None
    return {
        "college_id": row["college_id"],
        "college_name": row["college_name"],
        "preferred_area": row["preferred_area"],
    }


def owner_profile(connection, user_id):
    owner = connection.execute(
        "SELECT id, pg_name, owner_information FROM owners WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if not owner:
        return None
    colleges = connection.execute(
        """
        SELECT colleges.id, colleges.name, colleges.location
        FROM owner_colleges
        JOIN colleges ON colleges.id = owner_colleges.college_id
        WHERE owner_colleges.owner_id = ?
        ORDER BY colleges.name
        """,
        (owner["id"],),
    ).fetchall()
    return {
        "pg_name": owner["pg_name"],
        "owner_information": owner["owner_information"],
        "nearby_colleges": [
            {"id": row["id"], "name": row["name"], "location": row["location"]}
            for row in colleges
        ],
    }


def public_user_payload(connection, user):
    payload = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "mobile_number": user["mobile_number"],
        "role": user["role"],
        "account_status": user["account_status"],
    }
    if user["role"] == "student":
        payload["student"] = student_profile(connection, user["id"])
    elif user["role"] == "owner":
        payload["owner"] = owner_profile(connection, user["id"])
    return payload


def start_login_session(user):
    """Remember who is logged in. Role is re-read from the database on each request."""
    session.clear()
    session["user_id"] = user["id"]
    session.permanent = True


def login_required(view):
    """Block the route unless a valid logged-in user is in the session."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        user_id = session.get("user_id")
        if not user_id:
            return json_error("Please log in to continue.", 401)
        connection = get_connection()
        try:
            user = fetch_user(connection, user_id)
        finally:
            connection.close()
        if user is None:
            session.clear()
            return json_error("Please log in to continue.", 401)
        g.user = user
        return view(*args, **kwargs)

    return wrapped


def roles_required(*allowed_roles):
    """Allow only the listed roles through. Role always comes from the database."""

    def decorator(view):
        @wraps(view)
        @login_required
        def wrapped(*args, **kwargs):
            if g.user["role"] not in allowed_roles:
                return json_error("You do not have permission to use this resource.", 403)
            return view(*args, **kwargs)

        return wrapped

    return decorator


def identifier_from_body(body):
    email = normalize_email(body.get("email"))
    mobile_number = normalize_mobile(body.get("mobile_number"))
    errors = []
    if email:
        email_error = validate_gmail(email)
        if email_error:
            errors.append(email_error)
    if body.get("mobile_number") not in (None, "") and not mobile_number:
        errors.append("Mobile number must be a 10-digit Indian number starting with 6-9.")
    elif mobile_number:
        mobile_error = validate_mobile(mobile_number)
        if mobile_error:
            errors.append(mobile_error)
    if not email and not mobile_number:
        errors.append("Provide a Gmail address or a mobile number.")
    return email or None, mobile_number or None, errors


@auth_bp.route("/api/auth/register/student", methods=["POST"])
def register_student():
    body = read_json_body()
    if body is None:
        return json_error("Send JSON with the student registration fields.", 400)

    name = clean_text(body.get("full_name") or body.get("name"))
    email = normalize_email(body.get("email"))
    mobile_number = normalize_mobile(body.get("mobile_number"))
    preferred_area = clean_text(body.get("preferred_area"))
    college_id = parse_college_id(body.get("college_id"))

    for error in (
        validate_name(name, "Full name"),
        validate_gmail(email),
        validate_mobile(mobile_number),
        validate_preferred_area(preferred_area),
    ):
        if error:
            return json_error(error, 400)
    if college_id is None:
        return json_error("A valid college_id is required.", 400)

    connection = get_connection()
    try:
        if not college_exists(connection, college_id):
            return json_error("That college was not found.", 400)
        conflict = duplicate_conflict_message(connection, email, mobile_number)
        if conflict:
            return json_error(conflict, 409)
        try:
            cursor = connection.execute(
                """
                INSERT INTO users (name, email, mobile_number, role, account_status)
                VALUES (?, ?, ?, 'student', 'pending')
                """,
                (name, email, mobile_number),
            )
            user_id = cursor.lastrowid
            connection.execute(
                """
                INSERT INTO students (user_id, college_id, preferred_area)
                VALUES (?, ?, ?)
                """,
                (user_id, college_id, preferred_area),
            )
            connection.commit()
        except sqlite3.IntegrityError:
            connection.rollback()
            return json_error(
                "An account with this Gmail address or mobile number already exists.",
                409,
            )
        user = fetch_user(connection, user_id)
        return json_success(
            "Student account created. It stays pending until prototype OTP verification.",
            public_user_payload(connection, user),
            201,
        )
    finally:
        connection.close()


@auth_bp.route("/api/auth/register/owner", methods=["POST"])
def register_owner():
    body = read_json_body()
    if body is None:
        return json_error("Send JSON with the owner registration fields.", 400)

    name = clean_text(body.get("owner_name") or body.get("name"))
    email = normalize_email(body.get("email"))
    mobile_number = normalize_mobile(body.get("mobile_number"))
    pg_name = clean_text(body.get("pg_name"))
    nearby_college_ids, college_list_error = parse_college_id_list(
        body.get("nearby_college_ids")
    )

    for error in (
        validate_name(name, "Owner name"),
        validate_gmail(email),
        validate_mobile(mobile_number),
        validate_pg_name(pg_name),
        college_list_error,
    ):
        if error:
            return json_error(error, 400)

    connection = get_connection()
    try:
        if not all_colleges_exist(connection, nearby_college_ids):
            return json_error("One or more nearby colleges were not found.", 400)
        conflict = duplicate_conflict_message(connection, email, mobile_number)
        if conflict:
            return json_error(conflict, 409)
        try:
            cursor = connection.execute(
                """
                INSERT INTO users (name, email, mobile_number, role, account_status)
                VALUES (?, ?, ?, 'owner', 'pending')
                """,
                (name, email, mobile_number),
            )
            user_id = cursor.lastrowid
            owner_cursor = connection.execute(
                """
                INSERT INTO owners (user_id, pg_name)
                VALUES (?, ?)
                """,
                (user_id, pg_name),
            )
            owner_id = owner_cursor.lastrowid
            connection.executemany(
                "INSERT INTO owner_colleges (owner_id, college_id) VALUES (?, ?)",
                [(owner_id, college_id) for college_id in nearby_college_ids],
            )
            connection.commit()
        except sqlite3.IntegrityError:
            connection.rollback()
            return json_error(
                "An account with this Gmail address or mobile number already exists.",
                409,
            )
        user = fetch_user(connection, user_id)
        return json_success(
            "Owner account created. It stays pending until prototype OTP verification.",
            public_user_payload(connection, user),
            201,
        )
    finally:
        connection.close()


@auth_bp.route("/api/auth/otp/request", methods=["POST"])
def request_otp():
    """Pretend to request an OTP. Nothing is sent by SMS or email."""
    body = read_json_body()
    if body is None:
        return json_error("Send JSON with email or mobile_number.", 400)

    email, mobile_number, errors = identifier_from_body(body)
    if errors:
        return json_error(errors[0], 400)

    connection = get_connection()
    try:
        user = find_user_by_email_or_mobile(connection, email, mobile_number)
        if user is None:
            return json_error("No account was found for that Gmail or mobile number.", 404)
        if user["account_status"] in ("suspended", "rejected"):
            return json_error("This account cannot request verification.", 403)
        return json_success(
            PROTOTYPE_OTP_NOTICE,
            {
                "prototype_only": True,
                "simulated_otp": PROTOTYPE_OTP,
                "delivery": "none",
                "account_status": user["account_status"],
            },
        )
    finally:
        connection.close()


def verify_otp_and_login():
    body = read_json_body()
    if body is None:
        return json_error("Send JSON with email or mobile_number, and otp.", 400)

    email, mobile_number, errors = identifier_from_body(body)
    if errors:
        return json_error(errors[0], 400)

    otp = clean_text(body.get("otp"))
    if otp != PROTOTYPE_OTP:
        return json_error(
            "Invalid OTP. PROTOTYPE ONLY: use 123456. No real SMS or email verification is used.",
            401,
        )

    connection = get_connection()
    try:
        user = find_user_by_email_or_mobile(connection, email, mobile_number)
        if user is None:
            return json_error("No account was found for that Gmail or mobile number.", 404)
        if user["account_status"] in ("suspended", "rejected"):
            return json_error("This account is not allowed to log in.", 403)
        if user["account_status"] == "pending":
            connection.execute(
                "UPDATE users SET account_status = 'active' WHERE id = ?",
                (user["id"],),
            )
            connection.commit()
            user = fetch_user(connection, user["id"])
        start_login_session(user)
        return json_success(
            "Logged in with prototype OTP 123456. This is simulated verification only.",
            {
                "prototype_only": True,
                "user": public_user_payload(connection, user),
            },
        )
    finally:
        connection.close()


@auth_bp.route("/api/auth/otp/verify", methods=["POST"])
def verify_otp():
    return verify_otp_and_login()


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    """Log in with the same prototype OTP used for verification."""
    return verify_otp_and_login()


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return json_success("You have been logged out.")


@auth_bp.route("/api/auth/me", methods=["GET"])
@login_required
def current_user():
    connection = get_connection()
    try:
        user = fetch_user(connection, g.user["id"])
        return json_success("Current user loaded.", public_user_payload(connection, user))
    finally:
        connection.close()


@auth_bp.route("/api/auth/student/home", methods=["GET"])
@roles_required("student")
def student_home():
    return json_success(
        "Student-only area. Role was read from the database, not from the request body.",
        {"role": g.user["role"]},
    )


@auth_bp.route("/api/auth/owner/home", methods=["GET"])
@roles_required("owner")
def owner_home():
    return json_success(
        "Owner-only area. Role was read from the database, not from the request body.",
        {"role": g.user["role"]},
    )


def replace_owner_colleges(connection, owner_id, college_ids):
    connection.execute("DELETE FROM owner_colleges WHERE owner_id = ?", (owner_id,))
    connection.executemany(
        "INSERT INTO owner_colleges (owner_id, college_id) VALUES (?, ?)",
        [(owner_id, college_id) for college_id in college_ids],
    )


@auth_bp.route("/api/auth/me", methods=["PATCH"])
@login_required
def update_current_user():
    body = read_json_body()
    if body is None:
        return json_error("Send JSON with the fields you want to update.", 400)

    forbidden = ROLE_FIELDS_FORBIDDEN.intersection(body.keys())
    if forbidden:
        return json_error("Role and account status cannot be changed on this endpoint.", 400)
    if "email" in body:
        return json_error("Email cannot be changed on a normal profile update.", 400)

    user = g.user
    connection = get_connection()
    try:
        if user["role"] == "student":
            error = update_student_profile(connection, user, body)
        elif user["role"] == "owner":
            error = update_owner_profile(connection, user, body)
        else:
            error = update_basic_profile(connection, user, body)
        if error:
            return json_error(error["message"], error["status"])
        connection.commit()
        updated = fetch_user(connection, user["id"])
        return json_success(
            "Profile updated.",
            public_user_payload(connection, updated),
        )
    except sqlite3.IntegrityError:
        connection.rollback()
        return json_error(
            "An account with this Gmail address or mobile number already exists.",
            409,
        )
    finally:
        connection.close()


def update_basic_profile(connection, user, body):
    name = user["name"]
    mobile_number = user["mobile_number"]
    if "full_name" in body or "owner_name" in body or "name" in body:
        name = clean_text(body.get("full_name") or body.get("owner_name") or body.get("name"))
        name_error = validate_name(name, "Name")
        if name_error:
            return {"message": name_error, "status": 400}
    if "mobile_number" in body:
        mobile_number = normalize_mobile(body.get("mobile_number"))
        mobile_error = validate_mobile(mobile_number)
        if mobile_error:
            return {"message": mobile_error, "status": 400}
        conflict = duplicate_conflict_message(
            connection, user["email"], mobile_number, exclude_user_id=user["id"]
        )
        if conflict:
            return {"message": conflict, "status": 409}
    connection.execute(
        "UPDATE users SET name = ?, mobile_number = ? WHERE id = ?",
        (name, mobile_number, user["id"]),
    )
    return None


def update_student_profile(connection, user, body):
    if "pg_name" in body or "nearby_college_ids" in body or "owner_name" in body:
        return {
            "message": "Student profiles cannot use owner-only fields.",
            "status": 400,
        }
    error = update_basic_profile(connection, user, body)
    if error:
        return error

    college_id = None
    preferred_area = None
    if "college_id" in body:
        college_id = parse_college_id(body.get("college_id"))
        if college_id is None:
            return {"message": "A valid college_id is required.", "status": 400}
        if not college_exists(connection, college_id):
            return {"message": "That college was not found.", "status": 400}
    if "preferred_area" in body:
        preferred_area = clean_text(body.get("preferred_area"))
        area_error = validate_preferred_area(preferred_area)
        if area_error:
            return {"message": area_error, "status": 400}

    if college_id is not None:
        connection.execute(
            "UPDATE students SET college_id = ? WHERE user_id = ?",
            (college_id, user["id"]),
        )
    if preferred_area is not None:
        connection.execute(
            "UPDATE students SET preferred_area = ? WHERE user_id = ?",
            (preferred_area, user["id"]),
        )
    return None


def update_owner_profile(connection, user, body):
    if "preferred_area" in body or "college_id" in body or "full_name" in body:
        return {
            "message": "Owner profiles cannot use student-only fields.",
            "status": 400,
        }
    error = update_basic_profile(connection, user, body)
    if error:
        return error

    owner = connection.execute(
        "SELECT id FROM owners WHERE user_id = ?",
        (user["id"],),
    ).fetchone()
    if owner is None:
        return {"message": "Owner profile was not found.", "status": 404}

    if "pg_name" in body:
        pg_name = clean_text(body.get("pg_name"))
        pg_error = validate_pg_name(pg_name)
        if pg_error:
            return {"message": pg_error, "status": 400}
        connection.execute(
            "UPDATE owners SET pg_name = ? WHERE id = ?",
            (pg_name, owner["id"]),
        )
    if "nearby_college_ids" in body:
        college_ids, college_list_error = parse_college_id_list(body.get("nearby_college_ids"))
        if college_list_error:
            return {"message": college_list_error, "status": 400}
        if not all_colleges_exist(connection, college_ids):
            return {"message": "One or more nearby colleges were not found.", "status": 400}
        replace_owner_colleges(connection, owner["id"], college_ids)
    return None
