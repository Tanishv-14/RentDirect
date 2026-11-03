"""Shared input checks for registration and profile updates.

These helpers return an error message string when something is wrong,
or None when the value is acceptable. They never write to the database.
"""

import re

GMAIL_PATTERN = re.compile(r"^[a-z0-9._%+\-]+@gmail\.com$")
MOBILE_PATTERN = re.compile(r"^[6-9]\d{9}$")
MAX_NAME_LENGTH = 120
MAX_AREA_LENGTH = 120
MAX_PG_NAME_LENGTH = 160


def clean_text(value):
    """Turn the value into stripped text, or empty string if it is missing."""
    if value is None:
        return ""
    return str(value).strip()


def normalize_email(value):
    """Store emails in lowercase so duplicates are caught consistently."""
    return clean_text(value).lower()


def normalize_mobile(value):
    """Accept 10 digits, or +91 / 91 followed by 10 digits. Store 10 digits."""
    digits = re.sub(r"\D", "", clean_text(value))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits


def validate_gmail(email):
    if not email:
        return "A Gmail address is required."
    if not GMAIL_PATTERN.fullmatch(email):
        return "Email must be a Gmail address ending with @gmail.com."
    return None


def validate_mobile(mobile_number):
    if not mobile_number:
        return "A mobile number is required."
    if not MOBILE_PATTERN.fullmatch(mobile_number):
        return "Mobile number must be a 10-digit Indian number starting with 6-9."
    return None


def validate_name(name, field_label="Name"):
    if not name:
        return f"{field_label} is required."
    if len(name) > MAX_NAME_LENGTH:
        return f"{field_label} must be {MAX_NAME_LENGTH} characters or fewer."
    return None


def validate_preferred_area(preferred_area):
    if not preferred_area:
        return "Preferred area is required."
    if len(preferred_area) > MAX_AREA_LENGTH:
        return f"Preferred area must be {MAX_AREA_LENGTH} characters or fewer."
    return None


def validate_pg_name(pg_name):
    if not pg_name:
        return "PG name is required."
    if len(pg_name) > MAX_PG_NAME_LENGTH:
        return f"PG name must be {MAX_PG_NAME_LENGTH} characters or fewer."
    return None


def parse_college_id(value):
    """Return an integer college id, or None if the value is not a whole number."""
    try:
        college_id = int(value)
    except (TypeError, ValueError):
        return None
    if college_id <= 0:
        return None
    return college_id


def parse_college_id_list(value):
    """Return unique college ids from a JSON list, or an error message."""
    if not isinstance(value, list) or len(value) == 0:
        return None, "Choose at least one nearby college."
    college_ids = []
    seen = set()
    for item in value:
        college_id = parse_college_id(item)
        if college_id is None:
            return None, "Each nearby college must be a valid college id."
        if college_id in seen:
            continue
        seen.add(college_id)
        college_ids.append(college_id)
    return college_ids, None
