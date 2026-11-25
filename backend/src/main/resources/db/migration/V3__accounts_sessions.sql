-- Accounts: email + password login, display name.
ALTER TABLE users ADD COLUMN email VARCHAR(254);
ALTER TABLE users ADD COLUMN password_hash VARCHAR(100);
ALTER TABLE users ADD COLUMN name VARCHAR(40);
CREATE UNIQUE INDEX ux_users_email ON users (email);

-- One row per signed-in device. The token itself is never stored, only its SHA-256.
CREATE TABLE sessions (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

-- Keep existing pilot users signed in.
INSERT INTO sessions (token_hash, user_id, created_at) SELECT token_hash, id, created_at FROM users;
ALTER TABLE users DROP COLUMN token_hash;
