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

CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  motto TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ui_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_tab TEXT NOT NULL,
  active_page TEXT NOT NULL,
  selected_theme_id TEXT NOT NULL,
  primary_color_input TEXT NOT NULL,
  secondary_color_input TEXT NOT NULL,
  show_customize_toolbar INTEGER NOT NULL,
  sidebar_enabled INTEGER NOT NULL,
  layout_mode TEXT NOT NULL DEFAULT 'TOOLBAR',
  show_member_photos INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parent_child_parent_id ON parent_child_relations(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_child_id ON parent_child_relations(child_id);
CREATE INDEX IF NOT EXISTS idx_spouse_a_id ON spouse_relations(person_a_id);
CREATE INDEX IF NOT EXISTS idx_spouse_b_id ON spouse_relations(person_b_id);
CREATE INDEX IF NOT EXISTS idx_families_name ON families(name);
`);

type TableInfoRow = {
  name: string;
};

const tableInfo = db.prepare("PRAGMA table_info(ui_settings)").all() as TableInfoRow[];
const hasColumn = (name: string) => tableInfo.some((column) => column.name === name);

if (!hasColumn("layout_mode")) {
  db.exec("ALTER TABLE ui_settings ADD COLUMN layout_mode TEXT NOT NULL DEFAULT 'TOOLBAR'");
  db.exec(
    `UPDATE ui_settings
     SET layout_mode = CASE WHEN sidebar_enabled = 1 THEN 'SIDEBAR' ELSE 'TOOLBAR' END`,
  );
}

if (!hasColumn("show_member_photos")) {
  db.exec("ALTER TABLE ui_settings ADD COLUMN show_member_photos INTEGER NOT NULL DEFAULT 1");
}

db.exec(
  `INSERT OR IGNORE INTO ui_settings (
     id,
     active_tab,
     active_page,
     selected_theme_id,
     primary_color_input,
     secondary_color_input,
     show_customize_toolbar,
     sidebar_enabled,
     layout_mode,
     show_member_photos,
     updated_at
   ) VALUES (
     1,
     'TREE',
     'HOME',
     'FOREST',
     '#2e5f4f',
     '#d9e6de',
     1,
     0,
     'TOOLBAR',
     1,
     CURRENT_TIMESTAMP
   )`,
);
