const db = require('./db');
const { withCalculatedPrices } = require('./configurations');

function listConfigurationSets() {
  return db.prepare(`
    SELECT cs.*, COUNT(cc.id) AS item_count
    FROM configuration_sets cs
    LEFT JOIN cable_configurations cc ON cc.set_id = cs.id
    GROUP BY cs.id
    ORDER BY cs.updated_at DESC, cs.id DESC
  `).all();
}

function selectConfigurationSet(requestedId) {
  const sets = listConfigurationSets();
  const requested = Number(requestedId);
  return {
    sets,
    selectedSet: sets.find((set) => set.id === requested) || sets[0] || null,
  };
}

function loadSetConfigurations(setId) {
  if (!setId) return [];
  return withCalculatedPrices(db.prepare(`
    SELECT *
    FROM cable_configurations
    WHERE set_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(setId));
}

function createDefaultSet() {
  const existing = db.prepare('SELECT id FROM configuration_sets ORDER BY id LIMIT 1').get();
  if (existing) return existing.id;
  return db.prepare('INSERT INTO configuration_sets (name) VALUES (?)')
    .run('Meine Konfiguration').lastInsertRowid;
}

module.exports = {
  createDefaultSet,
  listConfigurationSets,
  loadSetConfigurations,
  selectConfigurationSet,
};
