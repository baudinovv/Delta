-- Apple Health / Health Connect sync. Health data is sensitive: nothing is accepted without consent,
-- and revoking consent deletes everything synced.
ALTER TABLE users ADD COLUMN health_consent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN health_synced_at TIMESTAMP WITH TIME ZONE;

-- One row per workout, or per day for steps / active energy / heart rate.
-- external_id is the HealthKit UUID or Health Connect record id for workouts,
-- and "<kind>:<yyyy-mm-dd>" for daily totals, so re-syncing updates instead of duplicating.
CREATE TABLE health_samples (
    id           UUID          PRIMARY KEY,
    user_id      UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform     VARCHAR(8)    NOT NULL,       -- IOS, ANDROID
    kind         VARCHAR(16)   NOT NULL,       -- WORKOUT, STEPS, ACTIVE_ENERGY, HEART_RATE
    external_id  VARCHAR(128)  NOT NULL,
    start_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    amount       NUMERIC(10, 1),              -- steps, kcal or average bpm
    workout_type VARCHAR(40),
    energy_kcal  NUMERIC(7, 1),
    avg_hr       INTEGER,
    source_name  VARCHAR(80),
    from_delta   BOOLEAN       NOT NULL DEFAULT FALSE,
    synced_at    TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE UNIQUE INDEX ux_health_samples_dedupe ON health_samples (user_id, platform, external_id);
CREATE INDEX idx_health_samples_user_time ON health_samples (user_id, kind, start_at);
