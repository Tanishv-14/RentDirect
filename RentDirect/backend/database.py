"""SQLite helpers for RentDirect.

This file connects to the database and creates all tables automatically.
Existing tables and rows are never dropped. New columns are added only
when they are missing.
"""

import os
import sqlite3
from pathlib import Path

# Store the database file next to this Python file unless a test
# (or another environment) points RENTDIRECT_DATABASE at a different file.
DEFAULT_DATABASE_PATH = Path(__file__).parent / "rentdirect.db"

# CREATE TABLE IF NOT EXISTS keeps this safe to run every time the app starts.
CREATE_TABLES_SQL = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        mobile_number TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('student', 'owner', 'admin')),
        account_status TEXT NOT NULL DEFAULT 'pending'
            CHECK (account_status IN ('pending', 'active', 'suspended', 'rejected')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS colleges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        college_id INTEGER,
        preferred_area TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (college_id) REFERENCES colleges(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS owners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        owner_information TEXT,
        pg_name TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS owner_colleges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        college_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (owner_id, college_id),
        FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
        FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        pg_name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT,
        locality TEXT,
        property_type TEXT CHECK (property_type IN ('PG', 'hostel', 'flat')),
        description TEXT,
        rent REAL NOT NULL,
        deposit REAL,
        monthly_maintenance REAL,
        electricity_charges REAL,
        food_charges REAL,
        brokerage REAL,
        amenities TEXT,
        gender_preference TEXT CHECK (gender_preference IN ('male', 'female', 'any')),
        owner_contact_number TEXT,
        verification_status TEXT NOT NULL DEFAULT 'pending'
            CHECK (verification_status IN ('pending', 'approved', 'rejected')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS property_colleges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        college_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (property_id, college_id),
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
        FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS property_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        image_path TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        property_id INTEGER,
        document_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        property_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        review_text TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, property_id),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        property_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS verification (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        property_id INTEGER,
        document_id INTEGER,
        decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
        comments TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id),
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
    )
    """,
]

# Existing databases already have a properties table, so CREATE TABLE IF NOT EXISTS
# will not add new columns. These ALTER TABLE statements run only when a column
# is missing and they do not delete or rewrite existing rows.
PROPERTY_COLUMN_MIGRATIONS = [
    ("city", "TEXT"),
    ("locality", "TEXT"),
    ("property_type", "TEXT CHECK (property_type IN ('PG', 'hostel', 'flat'))"),
    ("description", "TEXT"),
    ("monthly_maintenance", "REAL"),
    ("electricity_charges", "REAL"),
    ("food_charges", "REAL"),
    ("brokerage", "REAL"),
    ("gender_preference", "TEXT CHECK (gender_preference IN ('male', 'female', 'any'))"),
    ("owner_contact_number", "TEXT"),
]

# Same idea as properties: old owner rows stay in place; pg_name is added
# only if the column is missing.
OWNER_COLUMN_MIGRATIONS = [
    ("pg_name", "TEXT"),
]

# These names are clearly labelled so nobody mistakes them for a live college list.
SAMPLE_COLLEGES = [
    ("Manav Rachna (MRIIRS & MRU)", "Sector 43, Surajkund Road"),
    ("J.C. Bose UST (YMCA)", "Sector 6, Mathura Road"),
    ("Lingaya's Vidyapeeth", "Nachauli, Jasana Road"),
    ("Echelon Institute of Tech", "Kabulpur, Greater Faridabad"),
    ("DAV Institute of Management", "NH-3, NIT Faridabad"),
    ("Al-Falah University", "Dhauj, Faridabad"),
]


def get_database_path():
    """Return the SQLite file path, honoring RENTDIRECT_DATABASE for tests."""
    override = os.environ.get("RENTDIRECT_DATABASE")
    if override:
        return Path(override)
    return DEFAULT_DATABASE_PATH


def get_connection():
    """Open a new connection to the SQLite database."""
    connection = sqlite3.connect(get_database_path())
    connection.row_factory = sqlite3.Row
    # SQLite does not enforce foreign keys unless this is turned on.
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def get_table_columns(connection, table_name):
    """Return the column names that already exist on a table."""
    rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    return [row["name"] for row in rows]


def migrate_properties_table(connection):
    """Add new property columns without dropping the table or its data."""
    existing_columns = get_table_columns(connection, "properties")
    for column_name, column_definition in PROPERTY_COLUMN_MIGRATIONS:
        if column_name not in existing_columns:
            connection.execute(
                f"ALTER TABLE properties ADD COLUMN {column_name} {column_definition}"
            )


def migrate_owners_table(connection):
    """Add owners.pg_name without dropping the owners table or its data."""
    existing_columns = get_table_columns(connection, "owners")
    for column_name, column_definition in OWNER_COLUMN_MIGRATIONS:
        if column_name not in existing_columns:
            connection.execute(
                f"ALTER TABLE owners ADD COLUMN {column_name} {column_definition}"
            )


def seed_sample_colleges(connection):
    """Insert clearly labelled sample colleges only when the table is empty."""
    count = connection.execute("SELECT COUNT(*) AS total FROM colleges").fetchone()["total"]
    if count > 0:
        return
    connection.executemany(
        "INSERT INTO colleges (name, location) VALUES (?, ?)",
        SAMPLE_COLLEGES,
    )


def init_database():
    """Create tables if needed, migrate missing columns, then seed demo colleges."""
    connection = get_connection()
    try:
        for create_table_sql in CREATE_TABLES_SQL:
            connection.execute(create_table_sql)
        migrate_properties_table(connection)
        migrate_owners_table(connection)
        seed_sample_colleges(connection)
        connection.commit()
    finally:
        connection.close()


def check_connection():
    """Return True when the database can be reached."""
    connection = get_connection()
    try:
        connection.execute("SELECT 1")
        return True
    finally:
        connection.close()
