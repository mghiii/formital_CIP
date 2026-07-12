from app.schemas.auth import Profile, Role
from app.services.supabase_auth import SupabaseAuthService


def test_profile_supports_required_roles_and_fields() -> None:
    profile = Profile(
        id="00000000-0000-0000-0000-000000000000",
        full_name="Operator Test",
        username="operator.test",
        email="operator@example.com",
        role=Role.operator,
        rfid_badge_id="RFID-001",
        is_active=True,
    )

    assert profile.role == Role.operator
    assert profile.rfid_badge_id == "RFID-001"


def test_build_user_attaches_profile_without_trusting_frontend_role() -> None:
    user = SupabaseAuthService.build_user(
        {"id": "user-1", "email": "engineer@example.com"},
        {
            "id": "user-1",
            "full_name": "Engineer",
            "username": "engineer",
            "email": "engineer@example.com",
            "role": "engineer",
            "rfid_badge_id": None,
            "is_active": True,
        },
    )

    assert user.profile is not None
    assert user.profile.role == Role.engineer
    assert user.profile.is_active is True
