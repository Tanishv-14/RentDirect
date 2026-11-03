"""RentDirect Flask application.

Run this file from the backend folder:
    python app.py

Set SECRET_KEY in the environment before deploying. The fallback value is
for local development only.
"""

import os
from datetime import timedelta

from flask import Flask, jsonify

from auth import auth_bp
from colleges import colleges_bp
from properties import properties_bp
from database import check_connection, init_database




def session_cookie_secure():
    """Use Secure cookies only when explicitly enabled or in production."""
    flag = os.environ.get("SESSION_COOKIE_SECURE", "").lower()
    if flag in ("1", "true", "yes"):
        return True
    if flag in ("0", "false", "no"):
        return False
    return os.environ.get("FLASK_ENV") == "production"


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024

    app.config["UPLOAD_FOLDER"] = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "uploads",
        "property_images"
    )

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Flask signs the session cookie with this key. Keep it out of source control.
    app.secret_key = os.environ.get("SECRET_KEY", "dev-only-insecure-secret-change-me")
    app.config.update(
        PERMANENT_SESSION_LIFETIME=timedelta(days=7),
        SESSION_COOKIE_NAME="rentdirect_session",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=session_cookie_secure(),
    )

    # Create tables as soon as the app starts, including when using the test client.
    init_database()

    app.register_blueprint(auth_bp)
    app.register_blueprint(colleges_bp)
    app.register_blueprint(properties_bp)

    @app.route("/api/health", methods=["GET"])
    def health():
        """Simple endpoint that shows the API and database are working."""
        try:
            check_connection()
            return jsonify({
                "status": "success",
                "message": "RentDirect API is running"
            }), 200
        except Exception:
            return jsonify({
                "status": "error",
                "message": "The API could not connect to the database"
            }), 500

    @app.errorhandler(404)
    def not_found(_error):
        """Return JSON when a route does not exist."""
        return jsonify({
            "status": "error",
            "message": "The requested resource was not found"
        }), 404

    @app.errorhandler(500)
    def server_error(_error):
        """Return JSON when an unexpected server error happens."""
        return jsonify({
            "status": "error",
            "message": "An unexpected error occurred"
        }), 500

    return app


app = create_app()


if __name__ == "__main__":
    init_database()
    app.run(debug=True)
