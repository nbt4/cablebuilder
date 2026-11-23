const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { looksLikeAutomaticName, refreshAutomaticNames } = require('./configurations');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'cablebuilder.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS connectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    website TEXT,
    price REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cable_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    website TEXT,
    price_per_meter REAL NOT NULL,
    category_id INTEGER REFERENCES cable_categories(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shopping_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    website TEXT,
    price REAL NOT NULL,
    length_m REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cable_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    connector_a_id INTEGER REFERENCES connectors(id) ON DELETE SET NULL,
    connector_a_name TEXT NOT NULL,
    connector_a_website TEXT,
    connector_a_price REAL NOT NULL,
    connector_b_id INTEGER REFERENCES connectors(id) ON DELETE SET NULL,
    connector_b_name TEXT NOT NULL,
    connector_b_website TEXT,
    connector_b_price REAL NOT NULL,
    cable_id INTEGER REFERENCES cables(id) ON DELETE SET NULL,
    cable_name TEXT NOT NULL,
    cable_website TEXT,
    cable_price_per_meter REAL NOT NULL,
    length_m REAL NOT NULL CHECK (length_m > 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    name_is_custom INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_cable_configurations_connector_a_id
    ON cable_configurations(connector_a_id);
  CREATE INDEX IF NOT EXISTS idx_cable_configurations_connector_b_id
    ON cable_configurations(connector_b_id);
  CREATE INDEX IF NOT EXISTS idx_cable_configurations_cable_id
    ON cable_configurations(cable_id);
`);

const cableColumns = db.pragma('table_info(cables)');
if (!cableColumns.some((column) => column.name === 'category_id')) {
  db.exec(`
    ALTER TABLE cables
    ADD COLUMN category_id INTEGER REFERENCES cable_categories(id) ON DELETE SET NULL;
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS connector_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const connectorColumns = db.pragma('table_info(connectors)');
if (!connectorColumns.some((column) => column.name === 'category_id')) {
  db.exec(`
    ALTER TABLE connectors
    ADD COLUMN category_id INTEGER REFERENCES connector_categories(id) ON DELETE SET NULL;
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS configuration_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const setColumns = db.pragma('table_info(configuration_sets)');
if (!setColumns.some((column) => column.name === 'reserve_percent')) {
  db.exec(`
    ALTER TABLE configuration_sets
    ADD COLUMN reserve_percent REAL NOT NULL DEFAULT 0;
  `);
}

const configurationColumns = db.pragma('table_info(cable_configurations)');
if (!configurationColumns.some((column) => column.name === 'set_id')) {
  db.exec(`
    ALTER TABLE cable_configurations
    ADD COLUMN set_id INTEGER REFERENCES configuration_sets(id) ON DELETE CASCADE;
  `);
}

const addsConfigurationNameTracking = !configurationColumns.some(
  (column) => column.name === 'name_is_custom',
);
if (addsConfigurationNameTracking) {
  db.exec(`
    ALTER TABLE cable_configurations
    ADD COLUMN name_is_custom INTEGER NOT NULL DEFAULT 1;
  `);
  const configurations = db.prepare(`
    SELECT id, name, cable_name, length_m, connector_a_name, connector_b_name
    FROM cable_configurations
  `).all();
  const markAutomatic = db.prepare(`
    UPDATE cable_configurations SET name_is_custom = 0 WHERE id = ?
  `);
  configurations.forEach((configuration) => {
    if (looksLikeAutomaticName(configuration)) {
      markAutomatic.run(configuration.id);
    }
  });
  refreshAutomaticNames(db);
}

let defaultConfigurationSet = db.prepare(`
  SELECT id FROM configuration_sets ORDER BY id LIMIT 1
`).get();
if (!defaultConfigurationSet) {
  const existingConfigurationCount = db.prepare(`
    SELECT COUNT(*) AS count FROM cable_configurations
  `).get().count;
  const result = db.prepare(`
    INSERT INTO configuration_sets (name) VALUES (?)
  `).run(existingConfigurationCount > 0 ? 'Bisherige Konfigurationen' : 'Meine Konfiguration');
  defaultConfigurationSet = { id: result.lastInsertRowid };
}
db.prepare(`
  UPDATE cable_configurations SET set_id = ? WHERE set_id IS NULL
`).run(defaultConfigurationSet.id);

db.exec(`
  CREATE TABLE IF NOT EXISTS cable_category_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES cable_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (category_id, name)
  );

  CREATE TABLE IF NOT EXISTS cable_field_values (
    cable_id INTEGER NOT NULL REFERENCES cables(id) ON DELETE CASCADE,
    field_id INTEGER NOT NULL REFERENCES cable_category_fields(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    PRIMARY KEY (cable_id, field_id)
  );

  CREATE INDEX IF NOT EXISTS idx_cables_category_id ON cables(category_id);
  CREATE INDEX IF NOT EXISTS idx_connectors_category_id ON connectors(category_id);
  CREATE INDEX IF NOT EXISTS idx_cable_configurations_set_id
    ON cable_configurations(set_id);
  CREATE INDEX IF NOT EXISTS idx_cable_category_fields_category_id
    ON cable_category_fields(category_id);
`);

module.exports = db;
