const express = require('express');
const db = require('../db');
const { sanitizeWebsite } = require('../sanitize');
const { VAT_RATE, grossToNet, resolveGrossPrice } = require('../prices');
const { refreshAutomaticNames } = require('../configurations');

const router = express.Router();

function redirectTo(res, area, suffix = '') {
  res.redirect(`/stammdaten?bereich=${area}${suffix}`);
}

function getConnectorCategory(categoryId) {
  if (!categoryId) return null;
  return db.prepare('SELECT id FROM connector_categories WHERE id = ?').get(categoryId) || null;
}

function getCableCategory(categoryId) {
  return db.prepare('SELECT id FROM cable_categories WHERE id = ?').get(categoryId) || null;
}

function saveCableFieldValues(cableId, categoryId, body) {
  const definitions = db.prepare(`
    SELECT id FROM cable_category_fields WHERE category_id = ?
  `).all(categoryId);
  const insertValue = db.prepare(`
    INSERT INTO cable_field_values (cable_id, field_id, value)
    VALUES (?, ?, ?)
  `);
  definitions.forEach((definition) => {
    const value = String(body[`field_${definition.id}`] || '').trim();
    if (value) insertValue.run(cableId, definition.id, value);
  });
}

router.get('/', (req, res) => {
  const selectedArea = req.query.bereich === 'stecker' ? 'stecker' : 'kabel';
  const connectors = db.prepare(`
    SELECT c.*, cc.name AS category_name
    FROM connectors c
    LEFT JOIN connector_categories cc ON cc.id = c.category_id
    ORDER BY c.name
  `).all().map((connector) => ({ ...connector, net_price: grossToNet(connector.price) }));
  const connectorCategories = db.prepare(`
    SELECT cc.id, cc.name, COUNT(c.id) AS connector_count
    FROM connector_categories cc
    LEFT JOIN connectors c ON c.category_id = cc.id
    GROUP BY cc.id
    ORDER BY cc.name
  `).all();
  const categoryFields = db.prepare(`
    SELECT id, category_id, name
    FROM cable_category_fields
    ORDER BY name
  `).all();
  const categories = db.prepare(`
    SELECT cc.id, cc.name, COUNT(c.id) AS cable_count
    FROM cable_categories cc
    LEFT JOIN cables c ON c.category_id = cc.id
    GROUP BY cc.id
    ORDER BY cc.name
  `).all().map((category) => ({
    ...category,
    fields: categoryFields.filter((field) => field.category_id === category.id),
  }));
  const fieldValues = db.prepare(`
    SELECT cfv.cable_id, cfv.field_id, ccf.name, cfv.value
    FROM cable_field_values cfv
    JOIN cable_category_fields ccf ON ccf.id = cfv.field_id
    ORDER BY ccf.name
  `).all();
  const cables = db.prepare(`
    SELECT c.*, cc.name AS category_name
    FROM cables c
    LEFT JOIN cable_categories cc ON cc.id = c.category_id
    ORDER BY c.name
  `).all().map((cable) => ({
    ...cable,
    net_price_per_meter: grossToNet(cable.price_per_meter),
    custom_fields: fieldValues.filter((field) => field.cable_id === cable.id),
  }));

  const editId = Number(req.query.edit);
  const editCable = selectedArea === 'kabel'
    ? cables.find((cable) => cable.id === editId) || null
    : null;
  const editConnector = selectedArea === 'stecker'
    ? connectors.find((connector) => connector.id === editId) || null
    : null;
  const errors = {
    'category-in-use': 'Die Kabelkategorie kann erst gelöscht werden, wenn ihr keine Kabel mehr zugeordnet sind.',
    'connector-category-in-use': 'Die Steckerkategorie kann erst gelöscht werden, wenn ihr keine Stecker mehr zugeordnet sind.',
    invalid: 'Die Angaben konnten nicht gespeichert werden. Bitte prüfe alle Pflichtfelder.',
  };

  res.render('stammdaten', {
    connectors,
    connectorCategories,
    cables,
    categories,
    selectedArea,
    showCreateForm: req.query.neu === '1',
    editCable,
    editConnector,
    error: errors[req.query.error] || '',
    vatRate: VAT_RATE,
    active: 'stammdaten',
  });
});

router.post('/stecker', (req, res) => {
  const { name, website, net_price, gross_price, price_basis, category_id } = req.body;
  const trimmedName = name?.trim();
  const price = resolveGrossPrice({ net: net_price, gross: gross_price, basis: price_basis });
  const category = getConnectorCategory(category_id);
  if (trimmedName && price !== null) {
    db.prepare('INSERT INTO connectors (name, website, price, category_id) VALUES (?, ?, ?, ?)')
      .run(trimmedName, sanitizeWebsite(website), price, category?.id || null);
    return redirectTo(res, 'stecker');
  }
  return redirectTo(res, 'stecker', '&error=invalid');
});

router.post('/stecker/:id/edit', (req, res) => {
  const connector = db.prepare('SELECT id FROM connectors WHERE id = ?').get(req.params.id);
  const name = req.body.name?.trim();
  const price = resolveGrossPrice({
    net: req.body.net_price,
    gross: req.body.gross_price,
    basis: req.body.price_basis,
  });
  const category = getConnectorCategory(req.body.category_id);
  if (connector && name && price !== null) {
    const website = sanitizeWebsite(req.body.website);
    db.transaction(() => {
      db.prepare(`
        UPDATE connectors SET name = ?, website = ?, price = ?, category_id = ? WHERE id = ?
      `).run(name, website, price, category?.id || null, connector.id);
      db.prepare(`
        UPDATE cable_configurations
        SET connector_a_name = ?, connector_a_website = ?, connector_a_price = ?
        WHERE connector_a_id = ?
      `).run(name, website, price, connector.id);
      db.prepare(`
        UPDATE cable_configurations
        SET connector_b_name = ?, connector_b_website = ?, connector_b_price = ?
        WHERE connector_b_id = ?
      `).run(name, website, price, connector.id);
      refreshAutomaticNames(db);
    })();
    return redirectTo(res, 'stecker');
  }
  return redirectTo(res, 'stecker', '&error=invalid');
});

router.post('/stecker/:id/delete', (req, res) => {
  db.prepare('DELETE FROM connectors WHERE id = ?').run(req.params.id);
  redirectTo(res, 'stecker');
});

router.post('/stecker-kategorie', (req, res) => {
  const name = req.body.name?.trim();
  if (name) {
    db.prepare('INSERT OR IGNORE INTO connector_categories (name) VALUES (?)').run(name);
  }
  redirectTo(res, 'stecker');
});

router.post('/stecker-kategorie/:id/delete', (req, res) => {
  const usage = db.prepare('SELECT COUNT(*) AS count FROM connectors WHERE category_id = ?')
    .get(req.params.id);
  if (usage.count > 0) {
    return redirectTo(res, 'stecker', '&error=connector-category-in-use');
  }
  db.prepare('DELETE FROM connector_categories WHERE id = ?').run(req.params.id);
  return redirectTo(res, 'stecker');
});

router.post('/kategorie', (req, res) => {
  const name = req.body.name?.trim();
  if (name) {
    db.prepare('INSERT OR IGNORE INTO cable_categories (name) VALUES (?)').run(name);
  }
  redirectTo(res, 'kabel');
});

router.post('/kategorie/:id/feld', (req, res) => {
  const name = req.body.name?.trim();
  const category = getCableCategory(req.params.id);
  if (name && category) {
    db.prepare(`
      INSERT OR IGNORE INTO cable_category_fields (category_id, name)
      VALUES (?, ?)
    `).run(category.id, name);
  }
  redirectTo(res, 'kabel');
});

router.post('/kategorie/:id/delete', (req, res) => {
  const usage = db.prepare('SELECT COUNT(*) AS count FROM cables WHERE category_id = ?')
    .get(req.params.id);
  if (usage.count > 0) {
    return redirectTo(res, 'kabel', '&error=category-in-use');
  }
  db.prepare('DELETE FROM cable_categories WHERE id = ?').run(req.params.id);
  return redirectTo(res, 'kabel');
});

router.post('/kategorie/:categoryId/feld/:fieldId/delete', (req, res) => {
  db.prepare(`
    DELETE FROM cable_category_fields
    WHERE id = ? AND category_id = ?
  `).run(req.params.fieldId, req.params.categoryId);
  redirectTo(res, 'kabel');
});

router.post('/kabel', (req, res) => {
  const name = req.body.name?.trim();
  const category = getCableCategory(req.body.category_id);
  const pricePerMeter = resolveGrossPrice({
    net: req.body.net_price_per_meter,
    gross: req.body.gross_price_per_meter,
    basis: req.body.price_basis,
  });
  if (!name || !category || pricePerMeter === null) {
    return redirectTo(res, 'kabel', '&error=invalid');
  }

  db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO cables (name, website, price_per_meter, category_id)
      VALUES (?, ?, ?, ?)
    `).run(name, sanitizeWebsite(req.body.website), pricePerMeter, category.id);
    saveCableFieldValues(result.lastInsertRowid, category.id, req.body);
  })();
  return redirectTo(res, 'kabel');
});

router.post('/kabel/:id/edit', (req, res) => {
  const cable = db.prepare('SELECT id FROM cables WHERE id = ?').get(req.params.id);
  const name = req.body.name?.trim();
  const category = getCableCategory(req.body.category_id);
  const pricePerMeter = resolveGrossPrice({
    net: req.body.net_price_per_meter,
    gross: req.body.gross_price_per_meter,
    basis: req.body.price_basis,
  });
  if (!cable || !name || !category || pricePerMeter === null) {
    return redirectTo(res, 'kabel', '&error=invalid');
  }

  const website = sanitizeWebsite(req.body.website);
  db.transaction(() => {
    db.prepare(`
      UPDATE cables SET name = ?, website = ?, price_per_meter = ?, category_id = ? WHERE id = ?
    `).run(name, website, pricePerMeter, category.id, cable.id);
    db.prepare(`
      UPDATE cable_configurations
      SET cable_name = ?, cable_website = ?, cable_price_per_meter = ?
      WHERE cable_id = ?
    `).run(name, website, pricePerMeter, cable.id);
    refreshAutomaticNames(db);
    db.prepare('DELETE FROM cable_field_values WHERE cable_id = ?').run(cable.id);
    saveCableFieldValues(cable.id, category.id, req.body);
  })();
  return redirectTo(res, 'kabel');
});

router.post('/kabel/:id/delete', (req, res) => {
  db.prepare('DELETE FROM cables WHERE id = ?').run(req.params.id);
  redirectTo(res, 'kabel');
});

module.exports = router;
