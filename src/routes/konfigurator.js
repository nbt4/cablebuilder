const express = require('express');
const db = require('../db');
const { aggregateConfigurations } = require('../shopping-list');
const {
  createDefaultSet,
  loadSetConfigurations,
  selectConfigurationSet,
} = require('../configuration-sets');
const { combinedCsv, combinedPdf } = require('../export');
const { buildAutomaticName } = require('../configurations');

const router = express.Router();

function redirectToSet(res, setId, suffix = '') {
  res.redirect(`/konfigurator?set=${setId}${suffix}`);
}

function readConfigurationInput(body) {
  const connectorA = db.prepare('SELECT * FROM connectors WHERE id = ?').get(body.connector_a_id);
  const connectorB = db.prepare('SELECT * FROM connectors WHERE id = ?').get(body.connector_b_id);
  const cable = db.prepare('SELECT * FROM cables WHERE id = ?').get(body.cable_id);
  const lengthM = Number(body.length_m);
  const quantity = Number(body.quantity);
  if (
    !connectorA
    || !connectorB
    || !cable
    || !Number.isFinite(lengthM)
    || lengthM <= 0
    || !Number.isSafeInteger(quantity)
    || quantity < 1
  ) return null;

  const requestedName = String(body.name || '').trim();
  const automaticName = buildAutomaticName({
    cable_name: cable.name,
    length_m: lengthM,
    connector_a_name: connectorA.name,
    connector_b_name: connectorB.name,
  });
  return {
    connectorA,
    connectorB,
    cable,
    lengthM,
    quantity,
    name: requestedName || automaticName,
    nameIsCustom: requestedName ? 1 : 0,
  };
}

router.get('/', (req, res) => {
  const connectors = db.prepare('SELECT id, name, price FROM connectors ORDER BY name').all();
  const cables = db.prepare(`
    SELECT c.id, c.name, c.price_per_meter, cc.name AS category_name
    FROM cables c
    LEFT JOIN cable_categories cc ON cc.id = c.category_id
    ORDER BY c.name
  `).all();
  const { sets, selectedSet } = selectConfigurationSet(req.query.set);
  const configurations = loadSetConfigurations(selectedSet?.id);
  const editId = Number(req.query.edit);
  const editingConfiguration = configurations.find((item) => item.id === editId) || null;

  const messages = {
    saved: 'Kabelposition gespeichert und die Einkaufsliste aktualisiert.',
    renamed: 'Konfiguration umbenannt.',
  };
  const error = req.query.error === 'invalid'
    ? 'Die Angaben konnten nicht gespeichert werden. Bitte prüfe Auswahl, Länge und Menge.'
    : '';

  res.render('konfigurator', {
    connectors,
    cables,
    sets,
    selectedSet,
    configurations,
    editingConfiguration,
    showNewSetForm: req.query.neue_sammlung === '1',
    showRenameSetForm: req.query.sammlungsname === '1',
    message: messages[req.query.message] || '',
    error,
    active: 'konfigurator',
  });
});

router.get('/export.csv', (req, res) => {
  const { selectedSet } = selectConfigurationSet(req.query.set);
  const configurations = loadSetConfigurations(selectedSet?.id);
  combinedCsv(
    res,
    configurations,
    aggregateConfigurations(configurations),
    new Date().toISOString().slice(0, 10),
    selectedSet?.name,
  );
});

router.get('/export.pdf', (req, res) => {
  const { selectedSet } = selectConfigurationSet(req.query.set);
  const configurations = loadSetConfigurations(selectedSet?.id);
  combinedPdf(
    res,
    configurations,
    aggregateConfigurations(configurations),
    new Date().toISOString().slice(0, 10),
    selectedSet?.name,
  );
});

router.post('/sammlungen', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.redirect('/konfigurator?error=invalid');
  const result = db.prepare('INSERT INTO configuration_sets (name) VALUES (?)').run(name);
  return redirectToSet(res, result.lastInsertRowid);
});

router.post('/sammlungen/:id/edit', (req, res) => {
  const name = String(req.body.name || '').trim();
  const set = db.prepare('SELECT id FROM configuration_sets WHERE id = ?').get(req.params.id);
  if (!set || !name) return res.redirect('/konfigurator?error=invalid');
  db.prepare(`
    UPDATE configuration_sets SET name = ?, updated_at = datetime('now') WHERE id = ?
  `).run(name, set.id);
  return redirectToSet(res, set.id, '&message=renamed');
});

router.post('/sammlungen/:id/delete', (req, res) => {
  db.prepare('DELETE FROM configuration_sets WHERE id = ?').run(req.params.id);
  const nextSetId = createDefaultSet();
  redirectToSet(res, nextSetId);
});

router.post('/', (req, res) => {
  const set = db.prepare('SELECT id FROM configuration_sets WHERE id = ?').get(req.body.set_id);
  const input = readConfigurationInput(req.body);
  if (!set || !input) {
    return redirectToSet(res, set?.id || createDefaultSet(), '&error=invalid');
  }

  db.transaction(() => {
    db.prepare(`
      INSERT INTO cable_configurations (
        name, name_is_custom, set_id,
        connector_a_id, connector_a_name, connector_a_website, connector_a_price,
        connector_b_id, connector_b_name, connector_b_website, connector_b_price,
        cable_id, cable_name, cable_website, cable_price_per_meter,
        length_m, quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.name, input.nameIsCustom, set.id,
      input.connectorA.id, input.connectorA.name, input.connectorA.website, input.connectorA.price,
      input.connectorB.id, input.connectorB.name, input.connectorB.website, input.connectorB.price,
      input.cable.id, input.cable.name, input.cable.website, input.cable.price_per_meter,
      input.lengthM, input.quantity,
    );
    db.prepare(`UPDATE configuration_sets SET updated_at = datetime('now') WHERE id = ?`).run(set.id);
  })();
  return redirectToSet(res, set.id, '&message=saved');
});

router.post('/:id/edit', (req, res) => {
  const configuration = db.prepare(`
    SELECT id, set_id FROM cable_configurations WHERE id = ?
  `).get(req.params.id);
  const input = readConfigurationInput(req.body);
  if (!configuration || !input) {
    return redirectToSet(res, configuration?.set_id || createDefaultSet(), '&error=invalid');
  }

  db.transaction(() => {
    db.prepare(`
      UPDATE cable_configurations SET
        name = ?, name_is_custom = ?,
        connector_a_id = ?, connector_a_name = ?, connector_a_website = ?, connector_a_price = ?,
        connector_b_id = ?, connector_b_name = ?, connector_b_website = ?, connector_b_price = ?,
        cable_id = ?, cable_name = ?, cable_website = ?, cable_price_per_meter = ?,
        length_m = ?, quantity = ?
      WHERE id = ?
    `).run(
      input.name, input.nameIsCustom,
      input.connectorA.id, input.connectorA.name, input.connectorA.website, input.connectorA.price,
      input.connectorB.id, input.connectorB.name, input.connectorB.website, input.connectorB.price,
      input.cable.id, input.cable.name, input.cable.website, input.cable.price_per_meter,
      input.lengthM, input.quantity, configuration.id,
    );
    db.prepare(`UPDATE configuration_sets SET updated_at = datetime('now') WHERE id = ?`)
      .run(configuration.set_id);
  })();
  return redirectToSet(res, configuration.set_id, '&message=saved');
});

router.post('/:id/delete', (req, res) => {
  const configuration = db.prepare(`
    SELECT id, set_id FROM cable_configurations WHERE id = ?
  `).get(req.params.id);
  if (!configuration) return res.redirect('/konfigurator');
  db.transaction(() => {
    db.prepare('DELETE FROM cable_configurations WHERE id = ?').run(configuration.id);
    db.prepare(`UPDATE configuration_sets SET updated_at = datetime('now') WHERE id = ?`)
      .run(configuration.set_id);
  })();
  return redirectToSet(res, configuration.set_id);
});

module.exports = router;
