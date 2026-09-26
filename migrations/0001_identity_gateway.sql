CREATE TABLE identity_islands (
    island_id TEXT PRIMARY KEY,
    state TEXT NOT NULL CHECK (state IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE identity_principals (
    principal_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('teacher', 'guardian', 'student')),
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (issuer, subject)
);

CREATE TABLE teacher_memberships (
    island_id TEXT NOT NULL REFERENCES identity_islands(island_id),
    teacher_id TEXT NOT NULL REFERENCES identity_principals(principal_id),
    state TEXT NOT NULL CHECK (state IN ('active', 'revoked')),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    PRIMARY KEY (island_id, teacher_id),
    CHECK ((state = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE TABLE agent_instances (
    agent_id TEXT PRIMARY KEY,
    issuer TEXT NOT NULL,
    client_id TEXT NOT NULL,
    island_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (island_id, teacher_id)
        REFERENCES teacher_memberships(island_id, teacher_id),
    UNIQUE (agent_id, island_id, teacher_id)
);

CREATE TABLE agent_delegations (
    delegation_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    island_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope = 'hd.teacher.mcp'),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (agent_id, island_id, teacher_id)
        REFERENCES agent_instances(agent_id, island_id, teacher_id),
    CHECK (valid_until > valid_from)
);

CREATE INDEX agent_delegations_active_lookup
    ON agent_delegations (agent_id, island_id, teacher_id, delegation_id)
    WHERE revoked_at IS NULL;

CREATE TABLE auth_audit_events (
    event_id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    outcome TEXT NOT NULL,
    actor_ref TEXT NOT NULL,
    island_id TEXT,
    teacher_id TEXT,
    agent_id TEXT,
    delegation_id TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auth_audit_island_time
    ON auth_audit_events (island_id, occurred_at DESC);
