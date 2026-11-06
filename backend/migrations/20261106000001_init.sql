-- AgentOps Control Center — initial schema

CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('OPERATOR', 'REVIEWER')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_username_format CHECK (username ~ '^[A-Za-z0-9_.-]{3,32}$')
);
CREATE UNIQUE INDEX users_username_lower_uq ON users (lower(username));

CREATE TABLE refresh_tokens (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

CREATE TABLE messages (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content      TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT messages_not_self CHECK (sender_id <> recipient_id)
);
-- Conversation lookups in both directions, ordered by id.
CREATE INDEX messages_pair_idx ON messages (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), id);

CREATE TABLE cases (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    input_data  JSONB NOT NULL,
    status      TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FLAGGED_FOR_REVIEW', 'CLOSED')),
    created_by  BIGINT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cases_created_by_idx ON cases (created_by, id DESC);

CREATE TABLE agent_runs (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id          BIGINT NOT NULL REFERENCES cases(id),
    status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN
                       ('PENDING','RUNNING','AWAITING_APPROVAL','APPROVED','REJECTED','COMPLETED','CANCELLED','FAILED')),
    model_identifier TEXT NOT NULL,
    llm_mode         TEXT NOT NULL CHECK (llm_mode IN ('real', 'mock')),
    input_snapshot   JSONB NOT NULL,
    output           JSONB,
    error            TEXT,
    attempts         INT NOT NULL DEFAULT 0,
    created_by       BIGINT NOT NULL REFERENCES users(id),
    reviewer_id      BIGINT NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT agent_runs_reviewer_not_creator CHECK (reviewer_id <> created_by)
);
CREATE INDEX agent_runs_created_by_idx ON agent_runs (created_by, id DESC);
CREATE INDEX agent_runs_reviewer_idx ON agent_runs (reviewer_id, id DESC);
CREATE INDEX agent_runs_case_idx ON agent_runs (case_id);
CREATE INDEX agent_runs_status_idx ON agent_runs (status);

CREATE TABLE approvals (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agent_run_id    BIGINT NOT NULL UNIQUE REFERENCES agent_runs(id),  -- one approval per run
    reviewer_id     BIGINT NOT NULL REFERENCES users(id),
    proposed_action TEXT NOT NULL CHECK (proposed_action IN ('flag_invoice_for_review')),
    status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    decision_reason TEXT CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 1000),
    decided_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at      TIMESTAMPTZ,
    CONSTRAINT approvals_decision_consistency CHECK (
        (status = 'PENDING' AND decided_by IS NULL AND decided_at IS NULL)
        OR (status <> 'PENDING' AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE INDEX approvals_reviewer_idx ON approvals (reviewer_id, status, id DESC);

-- Protected business action ledger: guarantees exactly-once execution per approval.
CREATE TABLE action_executions (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    approval_id  BIGINT NOT NULL UNIQUE REFERENCES approvals(id),
    agent_run_id BIGINT NOT NULL REFERENCES agent_runs(id),
    action       TEXT NOT NULL,
    result       JSONB NOT NULL,
    executed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agent_run_id BIGINT REFERENCES agent_runs(id),
    actor_id     BIGINT REFERENCES users(id),
    event_type   TEXT NOT NULL,
    payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_run_idx ON audit_events (agent_run_id, id);
