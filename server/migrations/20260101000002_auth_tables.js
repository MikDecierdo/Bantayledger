// ===========================================================================
// BantayLedger — auth tables
//
// Supabase Auth managed `auth.users` (identity, password, sessions) and
// mirrored it into public.profiles via the handle_new_user trigger in
// 0002_functions_triggers.sql. There is no such managed identity provider on
// MySQL, so this migration introduces the equivalent tables ourselves:
//
//   users            - authentication identity (id, email). One row per
//                      account, analogous to Supabase's auth.users.
//   credentials      - password hash, ported from src/lib/crypto.ts's
//                      PBKDF2 scheme (see server/src/auth/password.ts).
//   refresh_tokens   - hashed refresh tokens, so a session can be revoked
//                      (sign-out-everywhere, password change) the same way
//                      Supabase Auth's session table let us do for free.
//
// profiles.id previously had no foreign key (Phase 0 note). It now
// references users.id, mirroring how it referenced auth.users.id in
// Postgres.
// ===========================================================================

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const raw = (sql) => knex.raw(sql);

  await raw(`
    CREATE TABLE users (
      id          CHAR(36) NOT NULL PRIMARY KEY,
      email       VARCHAR(255) NOT NULL,
      created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT users_email_key UNIQUE (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await raw(`
    CREATE TABLE credentials (
      user_id        CHAR(36) NOT NULL PRIMARY KEY,
      password_hash  CHAR(64) NOT NULL,
      salt           CHAR(32) NOT NULL,
      iterations     INT NOT NULL,
      created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_credentials_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await raw(`
    CREATE TABLE refresh_tokens (
      id          CHAR(36) NOT NULL PRIMARY KEY,
      user_id     CHAR(36) NOT NULL,
      -- SHA-256 hex digest of the token, never the token itself — same
      -- reasoning as credentials.password_hash.
      token_hash  CHAR(64) NOT NULL,
      expires_at  DATETIME(3) NOT NULL,
      revoked_at  DATETIME(3),
      created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash),
      CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await raw(`CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);`);

  // profiles already exists (Phase 0) with no FK on id. Populate `users`
  // first would be needed for existing rows, but this schema starts empty in
  // every environment so far, so it is safe to add the constraint directly.
  await raw(`
    ALTER TABLE profiles
      ADD CONSTRAINT fk_profiles_user FOREIGN KEY (id) REFERENCES users (id) ON DELETE CASCADE;
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE profiles DROP FOREIGN KEY fk_profiles_user;`);
  await knex.raw(`DROP TABLE IF EXISTS refresh_tokens;`);
  await knex.raw(`DROP TABLE IF EXISTS credentials;`);
  await knex.raw(`DROP TABLE IF EXISTS users;`);
};
