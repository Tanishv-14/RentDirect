
"""Property management APIs for RentDirect."""

import os
from flask import Blueprint

import uuid

from flask import (
    Blueprint,
    jsonify,
    request,
    current_app,
    send_from_directory
)
from werkzeug.utils import secure_filename
from auth import roles_required
from database import get_connection

properties_bp = Blueprint("properties", __name__)


def error(message, status=400):
    return jsonify({"status": "error", "message": message}), status


def success(message, data=None, status=200):
    return jsonify({
        "status": "success",
        "message": message,
        "data": data
    }), status


def get_owner_id(connection, user_id):
    owner = connection.execute(
        "SELECT id FROM owners WHERE user_id = ?",
        (user_id,)
    ).fetchone()

    return owner["id"] if owner else None


def property_payload(row):
    return dict(row)


@properties_bp.route("/api/properties", methods=["POST"])
@roles_required("owner")
def create_property():
    body = request.get_json(silent=True) or {}

    pg_name = str(body.get("pg_name", "")).strip()
    address = str(body.get("address", "")).strip()

    if not pg_name or not address:
        return error("PG name and address are required.")

    try:
        rent = float(body.get("rent"))
        if rent <= 0:
            return error("Rent must be greater than zero.")
    except (TypeError, ValueError):
        return error("Please provide a valid rent amount.")

    property_type = body.get("property_type", "PG")
    if property_type not in ("PG", "hostel", "flat"):
        return error("Invalid property type.")

    gender = body.get("gender_preference", "any")
    if gender not in ("male", "female", "any"):
        return error("Invalid gender preference.")

    optional_fields = {
        "city": body.get("city"),
        "locality": body.get("locality"),
        "description": body.get("description"),
        "deposit": body.get("deposit"),
        "monthly_maintenance": body.get("monthly_maintenance"),
        "electricity_charges": body.get("electricity_charges"),
        "food_charges": body.get("food_charges"),
        "brokerage": body.get("brokerage"),
        "amenities": body.get("amenities"),
        "owner_contact_number": body.get("owner_contact_number"),
    }

    connection = get_connection()
    try:
        owner_id = get_owner_id(connection, request_user_id())

        if owner_id is None:
            return error("Owner profile not found.", 404)

        cursor = connection.execute(
            """
            INSERT INTO properties (
                owner_id, pg_name, address, city, locality,
                property_type, description, rent, deposit,
                monthly_maintenance, electricity_charges,
                food_charges, brokerage, amenities,
                gender_preference, owner_contact_number
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                owner_id, pg_name, address,
                optional_fields["city"],
                optional_fields["locality"],
                property_type,
                optional_fields["description"],
                rent,
                optional_fields["deposit"],
                optional_fields["monthly_maintenance"],
                optional_fields["electricity_charges"],
                optional_fields["food_charges"],
                optional_fields["brokerage"],
                optional_fields["amenities"],
                gender,
                optional_fields["owner_contact_number"],
            )
        )

        connection.commit()

        return success(
            "Property submitted for verification.",
            {"property_id": cursor.lastrowid, "verification_status": "pending"},
            201
        )
    except Exception:
        connection.rollback()
        return error("Could not create property.", 500)
    finally:
        connection.close()


def request_user_id():
    from flask import g
    return g.user["id"]


@properties_bp.route("/api/properties/my", methods=["GET"])
@roles_required("owner")
def my_properties():
    connection = get_connection()
    try:
        owner_id = get_owner_id(connection, request_user_id())

        if owner_id is None:
            return error("Owner profile not found.", 404)

        rows = connection.execute(
            """
            SELECT * FROM properties
            WHERE owner_id = ?
            ORDER BY created_at DESC
            """,
            (owner_id,)
        ).fetchall()

        return success("Your properties retrieved.", [
            property_payload(row) for row in rows
        ])
    finally:
        connection.close()


@properties_bp.route("/api/properties/<int:property_id>", methods=["PATCH"])
@roles_required("owner")
def update_property(property_id):
    body = request.get_json(silent=True) or {}

    allowed = {
        "pg_name", "address", "city", "locality",
        "property_type", "description", "rent", "deposit",
        "monthly_maintenance", "electricity_charges",
        "food_charges", "brokerage", "amenities",
        "gender_preference", "owner_contact_number"
    }

    updates = {key: value for key, value in body.items() if key in allowed}

    if not updates:
        return error("No valid property fields supplied.")

    if "rent" in updates:
        try:
            updates["rent"] = float(updates["rent"])
            if updates["rent"] <= 0:
                return error("Rent must be greater than zero.")
        except (TypeError, ValueError):
            return error("Invalid rent amount.")

    if "property_type" in updates and updates["property_type"] not in ("PG", "hostel", "flat"):
        return error("Invalid property type.")

    if "gender_preference" in updates and updates["gender_preference"] not in ("male", "female", "any"):
        return error("Invalid gender preference.")

    connection = get_connection()
    try:
        owner_id = get_owner_id(connection, request_user_id())

        if owner_id is None:
            return error("Owner profile not found.", 404)

        existing = connection.execute(
            "SELECT id FROM properties WHERE id = ? AND owner_id = ?",
            (property_id, owner_id)
        ).fetchone()

        if existing is None:
            return error("Property not found or access denied.", 404)

        fields = ", ".join(f"{key} = ?" for key in updates)
        values = list(updates.values()) + [property_id, owner_id]

        connection.execute(
            f"UPDATE properties SET {fields}, verification_status = 'pending' "
            "WHERE id = ? AND owner_id = ?",
            values
        )
        connection.commit()

        return success("Property updated and sent for verification.")
    except Exception:
        connection.rollback()
        return error("Could not update property.", 500)
    finally:
        connection.close()


@properties_bp.route("/api/properties", methods=["GET"])
@roles_required("student")
def browse_properties():
    connection = get_connection()
    try:
        query = """
            SELECT * FROM properties
            WHERE verification_status = 'approved'
        """
        params = []

        locality = request.args.get("locality")
        city = request.args.get("city")
        min_rent = request.args.get("min_rent")
        max_rent = request.args.get("max_rent")
        gender = request.args.get("gender_preference")
        property_type = request.args.get("property_type")

        if locality:
            query += " AND locality LIKE ?"
            params.append(f"%{locality.strip()}%")

        if city:
            query += " AND city LIKE ?"
            params.append(f"%{city.strip()}%")

        if min_rent:
            try:
                query += " AND rent >= ?"
                params.append(float(min_rent))
            except ValueError:
                return error("Invalid minimum rent.")

        if max_rent:
            try:
                query += " AND rent <= ?"
                params.append(float(max_rent))
            except ValueError:
                return error("Invalid maximum rent.")

        if gender:
            if gender not in ("male", "female", "any"):
                return error("Invalid gender preference.")
            query += " AND gender_preference IN (?, 'any')"
            params.append(gender)

        if property_type:
            if property_type not in ("PG", "hostel", "flat"):
                return error("Invalid property type.")
            query += " AND property_type = ?"
            params.append(property_type)

        query += " ORDER BY created_at DESC"

        rows = connection.execute(query, params).fetchall()

        return success("Approved properties retrieved.", [
            property_payload(row) for row in rows
        ])
    finally:
        connection.close()


@properties_bp.route("/api/properties/<int:property_id>", methods=["GET"])
@roles_required("student")
def property_details(property_id):
    connection = get_connection()
    try:
        row = connection.execute(
            """
            SELECT * FROM properties
            WHERE id = ? AND verification_status = 'approved'
            """,
            (property_id,)
        ).fetchone()

        if row is None:
            return error("Approved property not found.", 404)

        return success("Property details retrieved.", property_payload(row))
    finally:
        connection.close()
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_IMAGES_PER_PROPERTY = 10


def allowed_image(filename):
    if "." not in filename:
        return False

    extension = filename.rsplit(".", 1)[1].lower()
    return extension in ALLOWED_IMAGE_EXTENSIONS


# OWNER: Upload multiple property images
@properties_bp.route(
    "/api/properties/<int:property_id>/images",
    methods=["POST"]
)
@roles_required("owner")
def upload_property_images(property_id):

    files = request.files.getlist("images")

    if not files or all(not file.filename for file in files):
        return error("Please select at least one image.")

    files = [file for file in files if file.filename]

    if len(files) > MAX_IMAGES_PER_PROPERTY:
        return error("Maximum 10 images are allowed.")

    for file in files:
        if not allowed_image(file.filename):
            return error("Only JPG, JPEG, PNG and WEBP images are allowed.")

    connection = get_connection()
    saved_files = []

    try:
        owner_id = get_owner_id(connection, request_user_id())

        if owner_id is None:
            return error("Owner profile not found.", 404)

        existing = connection.execute(
            """
            SELECT id FROM properties
            WHERE id = ? AND owner_id = ?
            """,
            (property_id, owner_id)
        ).fetchone()

        if existing is None:
            return error("Property not found or access denied.", 404)

        image_count = connection.execute(
            """
            SELECT COUNT(*) AS total
            FROM property_images
            WHERE property_id = ?
            """,
            (property_id,)
        ).fetchone()["total"]

        if image_count + len(files) > MAX_IMAGES_PER_PROPERTY:
            return error("A property can have a maximum of 10 images.")

        upload_folder = current_app.config["UPLOAD_FOLDER"]
        os.makedirs(upload_folder, exist_ok=True)

        uploaded_images = []

        for file in files:
            original_name = secure_filename(file.filename)
            extension = original_name.rsplit(".", 1)[1].lower()

            filename = f"{uuid.uuid4().hex}.{extension}"
            filepath = os.path.join(upload_folder, filename)

            file.save(filepath)
            saved_files.append(filepath)

            cursor = connection.execute(
                """
                INSERT INTO property_images (property_id, image_path)
                VALUES (?, ?)
                """,
                (property_id, filename)
            )

            uploaded_images.append({
                "image_id": cursor.lastrowid,
                "image_url": f"/api/property-images/{filename}"
            })

        connection.commit()

        return success(
            "Property images uploaded successfully.",
            {"images": uploaded_images},
            201
        )

    except Exception:
        connection.rollback()

        for filepath in saved_files:
            if os.path.exists(filepath):
                os.remove(filepath)

        current_app.logger.exception("Property image upload failed.")
        return error("Could not upload property images.", 500)

    finally:
        connection.close()


# STUDENT: Retrieve images of an approved property
@properties_bp.route(
    "/api/properties/<int:property_id>/images",
    methods=["GET"]
)
@roles_required("student")
def get_property_images(property_id):

    connection = get_connection()

    try:
        property_row = connection.execute(
            """
            SELECT id FROM properties
            WHERE id = ? AND verification_status = 'approved'
            """,
            (property_id,)
        ).fetchone()

        if property_row is None:
            return error("Approved property not found.", 404)

        rows = connection.execute(
            """
            SELECT id, image_path, created_at
            FROM property_images
            WHERE property_id = ?
            ORDER BY id ASC
            """,
            (property_id,)
        ).fetchall()

        images = [
            {
                "image_id": row["id"],
                "image_url": f"/api/property-images/{row['image_path']}",
                "created_at": row["created_at"]
            }
            for row in rows
        ]

        return success("Property images retrieved.", images)

    finally:
        connection.close()


# STUDENT: Serve images belonging to approved properties
@properties_bp.route(
    "/api/property-images/<filename>",
    methods=["GET"]
)
@roles_required("student")
def serve_property_image(filename):

    connection = get_connection()

    try:
        image = connection.execute(
            """
            SELECT pi.image_path
            FROM property_images pi
            JOIN properties p ON p.id = pi.property_id
            WHERE pi.image_path = ?
            AND p.verification_status = 'approved'
            """,
            (filename,)
        ).fetchone()

        if image is None:
            return error("Image not found.", 404)

        return send_from_directory(
            current_app.config["UPLOAD_FOLDER"],
            image["image_path"]
        )

    finally:
        connection.close()


# OWNER: Delete a property image
@properties_bp.route(
    "/api/properties/<int:property_id>/images/<int:image_id>",
    methods=["DELETE"]
)
@roles_required("owner")
def delete_property_image(property_id, image_id):

    connection = get_connection()

    try:
        owner_id = get_owner_id(connection, request_user_id())

        if owner_id is None:
            return error("Owner profile not found.", 404)

        image = connection.execute(
            """
            SELECT pi.image_path
            FROM property_images pi
            JOIN properties p ON p.id = pi.property_id
            WHERE pi.id = ?
            AND pi.property_id = ?
            AND p.owner_id = ?
            """,
            (image_id, property_id, owner_id)
        ).fetchone()

        if image is None:
            return error("Image not found or access denied.", 404)

        connection.execute(
            "DELETE FROM property_images WHERE id = ?",
            (image_id,)
        )

        connection.commit()

        filepath = os.path.join(
            current_app.config["UPLOAD_FOLDER"],
            image["image_path"]
        )

        if os.path.isfile(filepath):
            os.remove(filepath)

        return success("Property image deleted successfully.")

    except Exception:
        connection.rollback()
        current_app.logger.exception("Property image deletion failed.")
        return error("Could not delete property image.", 500)

    finally:
        connection.close()