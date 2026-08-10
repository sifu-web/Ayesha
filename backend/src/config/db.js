/**
 * Database configuration & bootstrap.
 *
 * Uses PostgreSQL via `pg`, so the app can be deployed to a free Node host
 * (e.g. Render) with the actual data living in a free, persistent Postgres
 * database (e.g. Neon, Supabase, or Render's own Postgres) rather than a
 * local file. A local file only survives on disk as long as the process's
 * container isn't recycled — free web hosts routinely wipe local disk on
 * every restart/redeploy, which silently deletes accounts, media records,
 * and access keys. An external Postgres database survives all of that.
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to your .env (see .env.example).');
}

// Hosted Postgres providers (Neon, Render, Supabase, etc.) require SSL and
// use certificates not in Node's default trust store; only skip TLS when
// explicitly pointed at a local/dev database.
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

/** Runs a parameterized query. Use $1, $2, ... placeholders. */
function query(text, params = []) {
  return pool.query(text, params);
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')) DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      public_id TEXT NOT NULL UNIQUE,
      resource_type TEXT NOT NULL CHECK(resource_type IN ('image', 'video')),
      format TEXT,
      url TEXT NOT NULL,
      secure_url TEXT NOT NULL,
      thumbnail_url TEXT,
      original_filename TEXT,
      quality_mode TEXT NOT NULL DEFAULT 'original' CHECK(quality_mode IN ('original', 'hd')),
      bytes BIGINT NOT NULL DEFAULT 0,
      width INTEGER,
      height INTEGER,
      duration REAL,
      uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_media_resource_type ON media(resource_type);
    CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at);
    CREATE INDEX IF NOT EXISTS idx_media_filename ON media(original_filename);

    CREATE TABLE IF NOT EXISTS access_keys (
      id SERIAL PRIMARY KEY,
      key_value TEXT NOT NULL UNIQUE,
      duration_type TEXT NOT NULL CHECK(duration_type IN ('one_time', '1_hour', '1_day', '1_week', '1_month')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'used', 'expired', 'revoked')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ,
      used_at TIMESTAMPTZ,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_access_keys_key_value ON access_keys(key_value);
    CREATE INDEX IF NOT EXISTS idx_access_keys_created_at ON access_keys(created_at);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
  `);

  await seedDefaultAdmin();
}

async function seedDefaultAdmin() {
  const { rows } = await pool.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
  if (rows.length) return;

  const username = process.env.DEFAULT_ADMIN_USERNAME || 'Ayesha';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || '143';
  const hash = await bcrypt.hash(password, 12);

  await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [
    username,
    hash,
    'admin',
  ]);

  // eslint-disable-next-line no-console
  console.log(`✔ Default administrator account created: ${username}`);
}

module.exports = { query, initSchema, pool };
