"""Synthetic PDF and two-teacher checks for the shared textbook catalog."""
import asyncio
import hashlib

from fastapi.testclient import TestClient
import pymupdf
import pytest

from hyper_dimension.assessment_runtime import AssessmentError, AssessmentService
from hyper_dimension.local_education_api import create_local_education_app
from hyper_dimension.no_backend_model import NoBackendModel
from hyper_dimension.student_records import StudentRecords
from hyper_dimension.teacher_mcp import create_teacher_mcp
from hyper_dimension.textbook_catalog import TextbookCatalog


def teacher(tmp_path, index, shared):
    assessment = AssessmentService(tmp_path / f"teacher-{index}.sqlite3", NoBackendModel())
    teacher_id = f"teacher-{index}"
    tenant_id = f"island-{index}"
    class_id = f"class-{index}"
    assessment.authorize_policy(
        tenant_id=tenant_id, class_id=class_id, teacher_id=teacher_id,
        policy_id=f"policy-{index}",
        weights={"reading": 0.5, "content": 0.125, "communication": 0.125,
                 "organisation": 0.125, "language": 0.125},
    )
    records = StudentRecords(assessment, tmp_path / f"archive-{index}", teacher_id=teacher_id)
    catalog = TextbookCatalog(shared, assessment, teacher_id=teacher_id)
    token = f"synthetic-teacher-token-{index}-very-long"
    client = TestClient(create_local_education_app(
        assessment, records, tenant_id=tenant_id,
        teacher_id=teacher_id, teacher_token=token,
        catalog=catalog, agent_native=True,
    ))
    server = create_teacher_mcp(
        assessment, records, tenant_id=tenant_id,
        teacher_id=teacher_id, catalog=catalog,
    )
    return catalog, client, server, {"tenant": tenant_id, "class": class_id,
                                    "headers": {"Authorization": "Bearer " + token}}


def test_two_teachers_share_one_versioned_catalog_with_rights_gate(tmp_path):
    shared = tmp_path / "shared-catalog.sqlite3"
    c1, api1, mcp1, t1 = teacher(tmp_path, 1, shared)
    c2, api2, mcp2, t2 = teacher(tmp_path, 2, shared)
    editions = []
    for printing in ("first", "second"):
        editions.append(c1.register_edition(
            publisher="Synthetic Press", series="Synthetic English",
            school_system="六三制", grade=7, volume="上册",
            revision_year=2025, printing=printing,
            source_ref="synthetic-publisher-" + printing,
            source_kind="publisher_copyright_page",
            identity_evidence_ref="synthetic-identity-" + printing,
            verified_by="synthetic-reviewer",
        ))
    pending = c1.register_edition(
        publisher="Synthetic Press", series="Synthetic English",
        school_system="unknown", grade=7, volume="上册",
        revision_year=2025, source_ref="synthetic-third-party-index",
        source_kind="third_party_index",
    )
    assert pending["catalog_status"] == "pending"
    with pytest.raises(AssessmentError):
        c1.bind_class(
            tenant_id=t1["tenant"], class_id=t1["class"],
            edition_ref=pending["edition_ref"], section_ref="unknown",
        )
    edition = editions[0]["edition_ref"]
    other_edition = editions[1]["edition_ref"]
    assert edition != other_edition

    def call(server, name, **args):
        return asyncio.run(server._tool_manager.call_tool(name, args))

    ambiguous = call(
        mcp1, "resolve_textbook_edition",
        class_ref=t1["class"], publisher="Synthetic Press",
        grade=7, volume="上册",
    )
    assert ambiguous["status"] == "needs_teacher_confirmation"
    exact = call(
        mcp1, "resolve_textbook_edition",
        class_ref=t1["class"], publisher="Synthetic Press",
        grade=7, volume="上册", school_system="六三制",
        series="Synthetic English", printing="first",
    )
    assert exact["status"] == "resolved"
    assert exact["candidates"][0]["edition_ref"] == edition
    with pytest.raises(AssessmentError):
        c1.register_edition(
            publisher="Changed Press", series="Synthetic English",
            school_system="六三制", grade=7, volume="上册",
            source_ref="synthetic-publisher-first",
            source_kind="publisher_copyright_page",
        )

    pdf_path = tmp_path / "synthetic.pdf"
    with pymupdf.open() as doc:
        doc.new_page()
        doc.save(pdf_path)
    asset = c1.verify_asset_file(
        edition_ref=edition, path=pdf_path,
        source_evidence_ref="synthetic-pdf-copy",
        verified_by="synthetic-reviewer",
    )
    assert asset["asset_hash"] == hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    assert asset["pages"] == 1
    toc = c1.register_section(
        edition_ref=edition, ordinal=1, title="Synthetic Unit",
        review_level="E1", review_evidence_ref="synthetic-toc",
        reviewed_by="synthetic-reviewer",
    )
    detail = c1.register_section(
        edition_ref=edition, ordinal=2, title="Synthetic communication task",
        review_level="E2", page_start=1, page_end=1,
        review_evidence_ref="synthetic-page-review",
        summary="An original summary about inviting a classmate.",
        summary_status="approved", reviewed_by="synthetic-reviewer",
    )
    with pytest.raises(AssessmentError):
        c1.register_section(
            edition_ref=edition, ordinal=3, title="Fake page",
            review_level="E2", page_start=2, page_end=2,
            review_evidence_ref="synthetic-bad-page",
            summary="Should not pass", summary_status="approved",
            reviewed_by="synthetic-reviewer",
        )
    assert call(mcp1, "list_textbook_sections",
                class_ref=t1["class"], edition_ref=edition)["sections"][1]["section_ref"] == detail["section_ref"]

    bind_path1 = f"/api/v1/teacher/classes/{t1['class']}/textbook-binding"
    body = {"edition_ref": edition, "section_ref": toc["section_ref"]}
    assert api1.put(bind_path1, json=body).status_code == 401
    assert api1.put(bind_path1, headers=t1["headers"], json=body).json()["version"] == 1
    assert call(mcp1, "class_textbook_binding_read", class_ref=t1["class"])["edition_ref"] == edition
    blocked = call(
        mcp1, "search_textbook_evidence", class_ref=t1["class"],
        edition_ref=edition, section_ref=detail["section_ref"], query="inviting",
    )
    assert blocked == {"status": "rights_not_cleared", "evidence": []}
    c1.set_rights(
        edition_ref=edition, scope="metadata_only",
        rights_evidence_ref="synthetic-rights-metadata",
        reviewed_by="synthetic-rights-reviewer",
    )
    assert call(
        mcp1, "search_textbook_evidence", class_ref=t1["class"],
        edition_ref=edition, section_ref=detail["section_ref"], query="inviting",
    )["status"] == "rights_not_cleared"
    c1.set_rights(
        edition_ref=edition, scope="summary_allowed",
        rights_evidence_ref="synthetic-rights-summary",
        reviewed_by="synthetic-rights-reviewer",
    )
    found = call(
        mcp1, "search_textbook_evidence", class_ref=t1["class"],
        edition_ref=edition, section_ref=detail["section_ref"], query="inviting",
    )
    assert found["status"] == "found"
    assert found["evidence"][0]["asset_hash"] == asset["asset_hash"]
    assert found["evidence"][0]["page_start"] == 1
    assert "path" not in str(found)
    assert call(
        mcp1, "search_textbook_evidence", class_ref=t1["class"],
        edition_ref=edition, section_ref=toc["section_ref"], query="",
    )["status"] == "content_unreviewed"
    with pytest.raises(Exception):
        call(mcp1, "search_textbook_evidence", class_ref=t1["class"],
             edition_ref=other_edition, section_ref=detail["section_ref"], query="")
    with pytest.raises(Exception):
        call(mcp2, "search_textbook_evidence", class_ref=t2["class"],
             edition_ref=edition, section_ref=detail["section_ref"], query="")

    bind_path2 = f"/api/v1/teacher/classes/{t2['class']}/textbook-binding"
    assert api2.put(bind_path2, headers=t2["headers"], json=body).json()["version"] == 1
    assert call(
        mcp2, "search_textbook_evidence", class_ref=t2["class"],
        edition_ref=edition, section_ref=detail["section_ref"], query="inviting",
    )["status"] == "found"
    with c1._db() as db:
        assert db.execute("SELECT COUNT(*) FROM textbook_assets").fetchone()[0] == 1

    revised = c1.register_section(
        edition_ref=edition, ordinal=2, revision=2,
        title="Synthetic communication task", review_level="E3",
        page_start=1, page_end=1,
        review_evidence_ref="synthetic-full-book-review",
        summary="A revised original summary about invitations.",
        summary_status="approved", reviewed_by="synthetic-reviewer",
    )
    with pytest.raises(Exception):
        call(mcp1, "search_textbook_evidence", class_ref=t1["class"],
             edition_ref=edition, section_ref=detail["section_ref"], query="")
    assert call(
        mcp1, "search_textbook_evidence", class_ref=t1["class"],
        edition_ref=edition, section_ref=revised["section_ref"], query="revised",
    )["status"] == "found"
    c1.set_rights(
        edition_ref=edition, scope="metadata_only",
        rights_evidence_ref="synthetic-rights-withdrawal",
        reviewed_by="synthetic-rights-reviewer",
    )
    assert call(
        mcp2, "search_textbook_evidence", class_ref=t2["class"],
        edition_ref=edition, section_ref=revised["section_ref"], query="",
    )["status"] == "rights_not_cleared"
    with c1._db() as db:
        assert db.execute("SELECT COUNT(*) FROM textbook_rights_reviews").fetchone()[0] == 3
        assert db.execute(
            "SELECT COUNT(*) FROM textbook_sections WHERE edition_ref=? AND ordinal=2",
            (edition,),
        ).fetchone()[0] == 2


def test_binding_revision_requires_teacher_confirmation(tmp_path):
    shared = tmp_path / "catalog.sqlite3"
    catalog, api, server, teacher_context = teacher(tmp_path, 1, shared)
    refs = []
    for printing in ("a", "b"):
        edition = catalog.register_edition(
            publisher="Synthetic", series="Series", school_system="六三制",
            grade=7, volume="上册", printing=printing,
            source_ref="source-" + printing, source_kind="synthetic",
            identity_evidence_ref="proof-" + printing, verified_by="reviewer",
        )
        section = catalog.register_section(
            edition_ref=edition["edition_ref"], ordinal=1, title="Unit One",
            review_level="E1", review_evidence_ref="toc-" + printing,
            reviewed_by="reviewer",
        )
        refs.append((edition["edition_ref"], section["section_ref"]))
    path = f"/api/v1/teacher/classes/{teacher_context['class']}/textbook-binding"
    first = {"edition_ref": refs[0][0], "section_ref": refs[0][1]}
    second = {"edition_ref": refs[1][0], "section_ref": refs[1][1]}
    assert api.put(path, headers=teacher_context["headers"], json=first).json()["version"] == 1
    assert api.put(path, headers=teacher_context["headers"], json=second).status_code == 422
    assert api.put(path, headers=teacher_context["headers"],
                   json={**second, "expected_version": 0}).status_code == 422
    updated = api.put(path, headers=teacher_context["headers"],
                      json={**second, "expected_version": 1})
    assert updated.status_code == 200
    assert updated.json()["version"] == 2
    with catalog._db() as db:
        assert db.execute(
            "SELECT COUNT(*) FROM textbook_binding_revisions",
        ).fetchone()[0] == 2
    assert asyncio.run(server._tool_manager.call_tool(
        "class_textbook_binding_read", {"class_ref": teacher_context["class"]},
    ))["edition_ref"] == refs[1][0]



def test_third_party_index_import_stays_pending_and_content_free(tmp_path):
    import json
    from scripts.import_textbook_index import import_index

    source = tmp_path / "third-party-index.json"
    source.write_text(json.dumps({
        "books": [{
            "publisher_label": "Synthetic Index Label",
            "series_label": "Unknown",
            "grade": 7, "volume": "Upper",
            "version_year": 2026,
            "book_url": "https://example.invalid/book",
            "verification_status": "pending_source",
            "toc": [{"title": "Unit A"}, {"title": "Unit B"}],
        }],
    }), encoding="utf-8")
    catalog = TextbookCatalog(
        tmp_path / "catalog.sqlite3", None, teacher_id="catalog-importer",
    )
    assert import_index(source, catalog) == {"books": 1, "toc_headings": 2}
    assert import_index(source, catalog) == {"books": 1, "toc_headings": 2}
    with catalog._db() as db:
        edition = db.execute("SELECT * FROM textbook_editions").fetchone()
        assert edition["catalog_status"] == "pending"
        assert edition["school_system"] == "unknown"
        assert db.execute("SELECT COUNT(*) FROM textbook_sections").fetchone()[0] == 2
        assert db.execute(
            "SELECT COUNT(*) FROM textbook_assets"
        ).fetchone()[0] == 0
    with pytest.raises(AssessmentError):
        catalog.resolve_edition(
            tenant_id="island", class_id="class",
            publisher="Synthetic Index Label", grade=7, volume="Upper",
        )



def test_student_book_ref_tracks_confirmed_class_binding_without_changing_identity(tmp_path):
    catalog, api, server, ctx = teacher(tmp_path, 1, tmp_path / "catalog.sqlite3")
    refs = []
    for printing in ("old", "new"):
        edition = catalog.register_edition(
            publisher="Synthetic", series="Series", school_system="六三制",
            grade=7, volume="上册", printing=printing,
            source_ref="identity-" + printing, source_kind="synthetic",
            identity_evidence_ref="proof-" + printing,
            verified_by="reviewer",
        )
        section = catalog.register_section(
            edition_ref=edition["edition_ref"], ordinal=1, title="Unit One",
            review_level="E1", review_evidence_ref="toc-" + printing,
            reviewed_by="reviewer",
        )
        refs.append((edition["edition_ref"], section["section_ref"]))
    class_path = f"/api/v1/teacher/classes/{ctx['class']}/textbook-binding"
    assert api.put(class_path, headers=ctx["headers"], json={
        "edition_ref": refs[0][0], "section_ref": refs[0][1],
    }).status_code == 200
    enrollment = {
        "class_id": ctx["class"], "display_name": "Synthetic Learner",
        "public_alias": "Star", "age": 12, "grade": 7,
    }
    assert api.post(
        "/api/v1/teacher/students", headers=ctx["headers"],
        json={**enrollment, "book_id": refs[1][0]},
    ).status_code == 422
    created = api.post(
        "/api/v1/teacher/students", headers=ctx["headers"], json=enrollment,
    )
    assert created.status_code == 200
    student_ref = created.json()["student_ref"]
    profile_path = f"/api/v1/teacher/students/{student_ref}"
    profile = api.get(profile_path, headers=ctx["headers"]).json()
    assert (profile["book_id"], profile["school_progress"]) == refs[0]
    assert profile["version"] == 1

    def call(name, **args):
        return asyncio.run(server._tool_manager.call_tool(name, args))

    assert call("assessment_generation_context_read",
                student_ref=student_ref)["textbook_alignment_status"] == "aligned"
    assert api.put(class_path, headers=ctx["headers"], json={
        "edition_ref": refs[1][0], "section_ref": refs[1][1],
        "expected_version": 1,
    }).status_code == 200
    assert call("assessment_generation_context_read",
                student_ref=student_ref)["textbook_alignment_status"] == "mismatch"
    sample_bundle = {
        "agent_version": "synthetic-agent",
        "questions": [
            {"id": "r", "kind": "mcq", "prompt": "Where?", "options": ["A", "B"]},
            {"id": "w", "kind": "writing", "prompt": "Write an invitation."},
        ],
        "answer_key": {"r": "A"},
        "rubric": {key: "Synthetic rubric" for key in
                   ("content", "communication", "organisation", "language")},
    }
    with pytest.raises(Exception):
        call("assessment_bundle_submit", student_ref=student_ref,
             idempotency_key="after-class-change", bundle=sample_bundle)
    student_binding_path = profile_path + "/textbook-binding"
    assert api.put(student_binding_path, headers=ctx["headers"], json={
        "expected_version": 1, "edition_ref": refs[0][0],
        "section_ref": refs[0][1],
    }).status_code == 422
    assert api.put(student_binding_path, headers=ctx["headers"], json={
        "expected_version": 2, "edition_ref": refs[1][0],
        "section_ref": refs[1][1],
    }).status_code == 422
    rebound = api.put(student_binding_path, headers=ctx["headers"], json={
        "expected_version": 1, "edition_ref": refs[1][0],
        "section_ref": refs[1][1],
    })
    assert rebound.status_code == 200
    assert rebound.json()["student_id"] == student_ref
    assert rebound.json()["version"] == 2
    assert call("assessment_generation_context_read",
                student_ref=student_ref)["textbook_alignment_status"] == "aligned"
    assert call("assessment_bundle_submit", student_ref=student_ref,
                idempotency_key="after-class-change",
                bundle=sample_bundle)["bundle_id"]
    with catalog.assessment._db() as db:
        assert db.execute(
            """SELECT COUNT(*) FROM audit_events WHERE tenant_id=? AND student_id=?
               AND event_type='student.textbook_rebound'""",
            (ctx["tenant"], student_ref),
        ).fetchone()[0] == 1
    artifacts = call("student_archive_list", student_ref=student_ref)["artifacts"]
    assert len([a for a in artifacts if a["kind"] == "profile"]) == 2
