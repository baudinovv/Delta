-- What the AI coach did for a message (logged sets/food/water, saved a plan), shown as chips with undo.
ALTER TABLE coach_messages ADD COLUMN actions TEXT;

-- The user's current weekly workout plan (one per user; a new plan replaces the old one).
CREATE TABLE workout_plans (
    user_id    UUID          PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    title      VARCHAR(120)  NOT NULL,
    plan_json  TEXT          NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
