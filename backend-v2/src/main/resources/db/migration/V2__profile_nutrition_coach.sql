ALTER TABLE users ADD COLUMN sex VARCHAR(8);
ALTER TABLE users ADD COLUMN birth_year INTEGER;
ALTER TABLE users ADD COLUMN height_cm INTEGER;
ALTER TABLE users ADD COLUMN weight_kg NUMERIC(5, 1);
ALTER TABLE users ADD COLUMN calorie_target INTEGER;

CREATE TABLE food_entries (
    id         UUID          PRIMARY KEY,
    user_id    UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    eaten_on   DATE          NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    meal       VARCHAR(16)   NOT NULL,
    name       VARCHAR(120)  NOT NULL,
    grams      INTEGER,
    kcal       INTEGER       NOT NULL CHECK (kcal BETWEEN 0 AND 10000),
    protein_g  NUMERIC(6, 1) NOT NULL DEFAULT 0,
    fat_g      NUMERIC(6, 1) NOT NULL DEFAULT 0,
    carbs_g    NUMERIC(6, 1) NOT NULL DEFAULT 0,
    source     VARCHAR(8)    NOT NULL
);

CREATE INDEX idx_food_entries_user_day ON food_entries (user_id, eaten_on);

CREATE TABLE coach_messages (
    id         UUID        PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role       VARCHAR(10) NOT NULL,
    content    TEXT        NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_coach_messages_user_time ON coach_messages (user_id, created_at);
