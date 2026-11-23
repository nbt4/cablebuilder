const db = require('./db');
const { withCalculatedPrices } = require('./configurations');
const { aggregateConfigurations } = require('./shopping-list');

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
    ORDER BY cable_name COLLATE NOCASE, length_m DESC, connector_a_name COLLATE NOCASE, id
  `).all(setId));
}

function createDefaultSet() {
  const existing = db.prepare('SELECT id FROM configuration_sets ORDER BY id LIMIT 1').get();
  if (existing) return existing.id;
  return db.prepare('INSERT INTO configuration_sets (name) VALUES (?)')
    .run('Meine Konfiguration').lastInsertRowid;
}

// Konfiguration samt Kabelpositionen kopieren (Produktdaten als Snapshot übernehmen)
function duplicateSet(setId) {
  const source = db.prepare('SELECT * FROM configuration_sets WHERE id = ?').get(setId);
  if (!source) return null;

  return db.transaction(() => {
    const newId = db.prepare(`
      INSERT INTO configuration_sets (name, reserve_percent) VALUES (?, ?)
    `).run(`${source.name} (Kopie)`, source.reserve_percent).lastInsertRowid;

    db.prepare(`
      INSERT INTO cable_configurations (
        name, name_is_custom, set_id,
        connector_a_id, connector_a_name, connector_a_website, connector_a_price,
        connector_b_id, connector_b_name, connector_b_website, connector_b_price,
        cable_id, cable_name, cable_website, cable_price_per_meter,
        length_m, quantity, created_at
      )
      SELECT
        name, name_is_custom, ?,
        connector_a_id, connector_a_name, connector_a_website, connector_a_price,
        connector_b_id, connector_b_name, connector_b_website, connector_b_price,
        cable_id, cable_name, cable_website, cable_price_per_meter,
        length_m, quantity, created_at
      FROM cable_configurations
      WHERE set_id = ?
      ORDER BY id
    `).run(newId, source.id);

    return newId;
  })();
}

// Positionen und Einkaufsliste einer Konfiguration – gemeinsam genutzt von Seiten und Exporten
function loadSetWithShoppingList(requestedId) {
  const { sets, selectedSet } = selectConfigurationSet(requestedId);
  const configurations = loadSetConfigurations(selectedSet?.id);
  return {
    sets,
    selectedSet,
    configurations,
    shoppingList: aggregateConfigurations(configurations, {
      reservePercent: selectedSet?.reserve_percent,
    }),
  };
}

module.exports = {
  createDefaultSet,
  duplicateSet,
  loadSetWithShoppingList,
  listConfigurationSets,
  loadSetConfigurations,
  selectConfigurationSet,
};
