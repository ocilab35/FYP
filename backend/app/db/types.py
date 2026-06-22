import enum

from sqlalchemy import Enum


def resolve_enum_member(enum_cls: type[enum.Enum], elem: object) -> enum.Enum | None:
    if elem is None:
        return None
    if isinstance(elem, enum_cls):
        return elem
    s = str(elem)
    for member in enum_cls:
        if member.name == s or member.value == s:
            return member
        if member.name.lower() == s.lower() or member.value.lower() == s.lower():
            return member
    raise LookupError(f"{elem!r} is not a valid {enum_cls.__name__}")


def enum_to_pg_label(member: enum.Enum) -> str:
    """Map Python enum members to labels stored in PostgreSQL (mixed legacy uppercase + new lowercase)."""
    cls = type(member)

    if cls.__name__ == "UserRole":
        return member.name

    if cls.__name__ == "DoctorApprovalStatus":
        return member.name

    if cls.__name__ == "RiskLevel":
        return member.name

    if cls.__name__ == "NotificationType":
        if member.name in ("APPOINTMENT", "PRESCRIPTION", "SYSTEM", "AI", "REMINDER"):
            return member.name
        return member.value

    if cls.__name__ == "AppointmentStatus":
        if member.name in ("PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"):
            return member.name
        return member.value

    # slotstatus, consultationsessionstatus, videocallstatus — lowercase in PG
    return member.value


class PgEnum(Enum):
    """PostgreSQL native enum with legacy uppercase + modern lowercase label support."""

    def _object_value_for_elem(self, elem: str | None):
        if elem is None:
            return None
        return resolve_enum_member(self.enum_class, elem)

    def bind_processor(self, dialect):
        enum_cls = self.enum_class

        def process(value):
            if value is None:
                return None
            if isinstance(value, enum_cls):
                return enum_to_pg_label(value)
            if isinstance(value, str):
                return enum_to_pg_label(resolve_enum_member(enum_cls, value))
            return value

        return process


def pg_enum(enum_cls: type[enum.Enum], *, name: str) -> PgEnum:
    # Preserve Python enum definition order — must match PostgreSQL enum sort order.
    # Never sort: SQLAlchemy zips these labels with enum members by position for
    # _object_lookup, and sorted labels cause PATIENT↔ADMIN / APPROVED↔PENDING swaps.
    labels = [enum_to_pg_label(m) for m in enum_cls]
    return PgEnum(enum_cls, name=name, values_callable=lambda _: labels)
