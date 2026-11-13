CREATE TABLE users (
    id                  UUID         PRIMARY KEY,
    token_hash          VARCHAR(64)  NOT NULL UNIQUE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    consent_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    goal                VARCHAR(32)  NOT NULL,
    days_per_week       INTEGER      NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
    minutes_per_session INTEGER      NOT NULL CHECK (minutes_per_session BETWEEN 15 AND 180)
);

CREATE TABLE set_logs (
    id           UUID          PRIMARY KEY,
    user_id      UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    exercise     VARCHAR(60)   NOT NULL,
    weight_kg    NUMERIC(6, 2) NOT NULL CHECK (weight_kg >= 0),
    reps         INTEGER       NOT NULL CHECK (reps BETWEEN 1 AND 100),
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_set_logs_user_time ON set_logs (user_id, performed_at);
