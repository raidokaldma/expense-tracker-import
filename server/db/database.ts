import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export type Db = DatabaseSync;

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations/', import.meta.url));

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return db;
}

export function transaction<T>(db: Db, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function schemaVersion(db: Db) {
  return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

/**
 * Brings the schema up to date from numbered files (001_init.sql, 002_….sql), each applied once and in order.
 * The version lives in PRAGMA user_version; a newer database is refused.
 */
export function migrate(db: Db) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();
  files.forEach((file, index) => {
    if (Number(file.slice(0, 3)) !== index + 1)
      throw new Error(`Migrations must be numbered 001, 002, …; found ${file}`);
  });
  const current = schemaVersion(db);
  if (current > files.length)
    throw new Error(`The database is at version ${current}, this app knows up to ${files.length}: use a newer app`);
  for (let version = current + 1; version <= files.length; version++) {
    const sql = readFileSync(join(MIGRATIONS_DIR, files[version - 1]), 'utf8');
    transaction(db, () => {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
    });
  }
}
