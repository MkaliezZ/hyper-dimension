CREATE TABLE identity_classes (
    island_id TEXT NOT NULL REFERENCES identity_islands(island_id),
    class_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (island_id, class_id)
);

CREATE TABLE teacher_class_assignments (
    island_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('active', 'revoked')),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    PRIMARY KEY (island_id, class_id, teacher_id),
    FOREIGN KEY (island_id, class_id)
        REFERENCES identity_classes(island_id, class_id),
    FOREIGN KEY (island_id, teacher_id)
        REFERENCES teacher_memberships(island_id, teacher_id),
    CHECK ((state = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE INDEX teacher_class_active_lookup
    ON teacher_class_assignments (island_id, teacher_id, class_id)
    WHERE state = 'active';

ALTER TABLE auth_audit_events ADD COLUMN class_id TEXT;

CREATE INDEX auth_audit_class_time
    ON auth_audit_events (island_id, class_id, occurred_at DESC)
    WHERE class_id IS NOT NULL;
