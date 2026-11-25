-- Food catalog: built-in foods, products cached from Open Food Facts, users' own foods and recipes.
-- Nutrition is stored per 100 g; servings is a JSON array [{"ru": "1 шт", "en": "1 piece", "g": 55}].
CREATE TABLE foods (
    id          UUID          PRIMARY KEY,
    source      VARCHAR(8)    NOT NULL,            -- BUILTIN, OFF, CUSTOM, RECIPE
    external_id VARCHAR(64),                       -- built-in key or OFF barcode
    owner_id    UUID          REFERENCES users (id) ON DELETE CASCADE, -- null = visible to everyone
    barcode     VARCHAR(14),
    name_ru     VARCHAR(160)  NOT NULL,
    name_en     VARCHAR(160)  NOT NULL,
    brand       VARCHAR(120),
    kcal        NUMERIC(6, 1) NOT NULL CHECK (kcal >= 0),
    protein_g   NUMERIC(6, 2) NOT NULL DEFAULT 0,
    fat_g       NUMERIC(6, 2) NOT NULL DEFAULT 0,
    carbs_g     NUMERIC(6, 2) NOT NULL DEFAULT 0,
    fiber_g     NUMERIC(6, 2),
    sugar_g     NUMERIC(6, 2),
    servings    TEXT          NOT NULL DEFAULT '[]',
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE UNIQUE INDEX ux_foods_source_external ON foods (source, external_id);
CREATE INDEX idx_foods_owner ON foods (owner_id);
CREATE INDEX idx_foods_barcode ON foods (barcode);

CREATE TABLE recipe_ingredients (
    recipe_id UUID          NOT NULL REFERENCES foods (id) ON DELETE CASCADE,
    position  INTEGER       NOT NULL,
    food_id   UUID          NOT NULL REFERENCES foods (id),
    grams     NUMERIC(7, 1) NOT NULL CHECK (grams > 0),
    PRIMARY KEY (recipe_id, position)
);

CREATE TABLE food_favorites (
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    food_id    UUID NOT NULL REFERENCES foods (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (user_id, food_id)
);

-- Diary entries remember which food and portion they came from (for "recent" and reports).
ALTER TABLE food_entries ADD COLUMN food_id UUID REFERENCES foods (id) ON DELETE SET NULL;
ALTER TABLE food_entries ADD COLUMN serving_label VARCHAR(60);
ALTER TABLE food_entries ADD COLUMN servings_count NUMERIC(6, 2);
ALTER TABLE food_entries ADD COLUMN fiber_g NUMERIC(6, 1);
ALTER TABLE food_entries ADD COLUMN sugar_g NUMERIC(6, 1);
CREATE INDEX idx_food_entries_food ON food_entries (user_id, food_id);

CREATE TABLE water_days (
    user_id UUID    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    log_date DATE   NOT NULL,
    ml      INTEGER NOT NULL CHECK (ml BETWEEN 0 AND 20000),
    PRIMARY KEY (user_id, log_date)
);
