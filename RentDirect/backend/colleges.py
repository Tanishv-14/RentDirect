"""College list used by student and owner registration forms."""

from flask import Blueprint, jsonify

from database import get_connection

colleges_bp = Blueprint("colleges", __name__)


@colleges_bp.route("/api/colleges", methods=["GET"])
def list_colleges():
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT id, name, location
            FROM colleges
            ORDER BY name
            """
        ).fetchall()
        colleges = [
            {"id": row["id"], "name": row["name"], "location": row["location"]}
            for row in rows
        ]
        return jsonify({
            "status": "success",
            "message": (
                "College list loaded. Entries labelled sample/demo data are "
                "prototype placeholders, not a live college directory."
            ),
            "data": {"colleges": colleges},
        }), 200
    finally:
        connection.close()
