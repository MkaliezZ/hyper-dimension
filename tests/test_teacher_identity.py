"""Synthetic signed-token tests for the optional teacher API credential mode."""
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from hyper_dimension.assessment_runtime import AssessmentService
from hyper_dimension.local_education_api import create_local_education_app
from hyper_dimension.student_records import StudentRecords
from hyper_dimension.teacher_identity import (
    TeacherAuthenticationError, TeacherOIDCVerifier,
)


class NoModel:
    pass


@pytest.fixture
def identity(tmp_path):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(
        private_key.public_key(), as_dict=True,
    )
    public_jwk.update({"kid": "key-1", "use": "sig", "alg": "RS256"})
    keys = {"keys": [public_jwk]}
    membership = {"active": True}
    verifier = TeacherOIDCVerifier(
        issuer="https://id.example.test/realms/demo",
        audience="hd-teacher-api", client_id="teacher-web",
        jwks_supplier=lambda: keys,
        active_membership=lambda iss, sub, tenant, teacher: (
            membership["active"]
            and iss == "https://id.example.test/realms/demo"
            and sub == "idp-teacher-1"
            and tenant == "island-1"
            and teacher == "teacher-1"
        ),
    )
    assessment = AssessmentService(tmp_path / "demo.sqlite3", NoModel())
    records = StudentRecords(assessment, tmp_path / "archive", teacher_id="teacher-1")
    student = records.create_student(
        tenant_id="island-1", class_id="class-1", display_name="Synthetic Learner",
        public_alias="Learner", age=12, grade=7, book_id="demo",
        school_progress="Unit 1", guardian_consent_ref="synthetic-consent",
    )
    app = create_local_education_app(
        assessment, records, tenant_id="island-1", teacher_id="teacher-1",
        teacher_verifier=verifier,
    )
    return private_key, keys, membership, verifier, student, TestClient(app)


def signed(private_key, **overrides):
    now = datetime.now(timezone.utc)
    claims = {
        "iss": "https://id.example.test/realms/demo",
        "sub": "idp-teacher-1", "aud": "hd-teacher-api",
        "azp": "teacher-web", "scope": "hd.teacher",
        "iat": now, "nbf": now, "exp": now + timedelta(minutes=5),
        "jti": "test-jti-1",
    }
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "key-1"})


def get_profile(client, student_ref, token=None):
    headers = {} if token is None else {"Authorization": "Bearer " + token}
    return client.get("/api/v1/teacher/students/" + student_ref, headers=headers)


def test_signed_teacher_token_requires_live_membership(identity):
    private_key, _, membership, _, student, client = identity
    ref = student["student_ref"]
    token = signed(private_key)
    assert get_profile(client, ref).status_code == 401
    assert get_profile(client, ref, token).status_code == 200
    membership["active"] = False
    assert get_profile(client, ref, token).status_code == 401


@pytest.mark.parametrize("change", [
    {"iss": "https://wrong.example.test"},
    {"aud": "other-api"},
    {"aud": ["hd-teacher-api", "other-api"]},
    {"azp": "other-client"},
    {"scope": "openid profile"},
    {"sub": "other-teacher"},
    {"exp": datetime(2020, 1, 1, tzinfo=timezone.utc)},
    {"nbf": datetime(2099, 1, 1, tzinfo=timezone.utc)},
    {"jti": ""},
    {"scope": "hd.teacherish"},
    {"azp": None},
    {"exp": datetime(2099, 1, 1, tzinfo=timezone.utc)},
])
def test_rejects_invalid_signed_claims(identity, change):
    private_key, _, _, verifier, _, _ = identity
    with pytest.raises(TeacherAuthenticationError):
        verifier.verify(signed(private_key, **change), tenant_id="island-1", teacher_id="teacher-1")


def test_wrong_island_key_rotation_and_unavailable_sources_fail_closed(identity):
    private_key, keys, membership, verifier, _, _ = identity
    token = signed(private_key)
    with pytest.raises(TeacherAuthenticationError):
        verifier.verify(token, tenant_id="island-2", teacher_id="teacher-1")
    keys["keys"] = []
    with pytest.raises(TeacherAuthenticationError):
        verifier.verify(token, tenant_id="island-1", teacher_id="teacher-1")
    keys["keys"] = [jwt.algorithms.RSAAlgorithm.to_jwk(
        private_key.public_key(), as_dict=True,
    ) | {"kid": "key-1", "use": "sig", "alg": "RS256"}]
    membership["active"] = False
    with pytest.raises(TeacherAuthenticationError):
        verifier.verify(token, tenant_id="island-1", teacher_id="teacher-1")
    unavailable = TeacherOIDCVerifier(
        issuer=verifier.issuer, audience=verifier.audience, client_id=verifier.client_id,
        jwks_supplier=lambda: (_ for _ in ()).throw(RuntimeError("down")),
        active_membership=lambda *_: True,
    )
    with pytest.raises(TeacherAuthenticationError):
        unavailable.verify(token, tenant_id="island-1", teacher_id="teacher-1")


def test_wrong_algorithm_rejected(identity):
    _, _, _, verifier, student, client = identity
    hs_token = jwt.encode(
        {"sub": "idp-teacher-1"}, "untrusted-key-material-with-32-bytes", algorithm="HS256",
        headers={"kid": "key-1"},
    )
    with pytest.raises(TeacherAuthenticationError):
        verifier.verify(hs_token, tenant_id="island-1", teacher_id="teacher-1")
    assert get_profile(client, student["student_ref"], hs_token).status_code == 401


def test_same_kid_wrong_signature_is_rejected(identity):
    _, _, _, verifier, student, client = identity
    attacker_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    forged = signed(attacker_key)
    with pytest.raises(TeacherAuthenticationError):
        verifier.verify(forged, tenant_id="island-1", teacher_id="teacher-1")
    assert get_profile(client, student["student_ref"], forged).status_code == 401


def test_mutually_exclusive_credential_modes(tmp_path, identity):
    _, _, _, verifier, _, _ = identity
    assessment = AssessmentService(tmp_path / "other.sqlite3", NoModel())
    records = StudentRecords(assessment, tmp_path / "archive-2", teacher_id="teacher-1")
    with pytest.raises(ValueError, match="Exactly one"):
        create_local_education_app(
            assessment, records, tenant_id="island-1", teacher_id="teacher-1",
            teacher_token="synthetic-secret-token-32-characters",
            teacher_verifier=verifier,
        )
    with pytest.raises(ValueError, match="Exactly one"):
        create_local_education_app(
            assessment, records, tenant_id="island-1", teacher_id="teacher-1",
        )
