import Database from "better-sqlite3";
import path from "path";

const rawDatabasePath = process.env.DATABASE_PATH || "./family-tree.db";
const apiRoot = path.resolve(__dirname, "..");
const databasePath = path.isAbsolute(rawDatabasePath)
  ? rawDatabasePath
  : path.resolve(apiRoot, rawDatabasePath);

export const db = new Database(databasePath);

db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT,
  date_of_birth TEXT,
  date_of_death TEXT,
  photo_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parent_child_relations (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(parent_id, child_id),
  FOREIGN KEY(parent_id) REFERENCES persons(id) ON DELETE CASCADE,
  FOREIGN KEY(child_id) REFERENCES persons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS spouse_relations (
  id TEXT PRIMARY KEY,
  person_a_id TEXT NOT NULL,
  person_b_id TEXT NOT NULL,
  married_at TEXT,
  divorced_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(person_a_id, person_b_id),
  FOREIGN KEY(person_a_id) REFERENCES persons(id) ON DELETE CASCADE,
  FOREIGN KEY(person_b_id) REFERENCES persons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parent_child_parent_id ON parent_child_relations(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_child_id ON parent_child_relations(child_id);
CREATE INDEX IF NOT EXISTS idx_spouse_a_id ON spouse_relations(person_a_id);
CREATE INDEX IF NOT EXISTS idx_spouse_b_id ON spouse_relations(person_b_id);
`);
