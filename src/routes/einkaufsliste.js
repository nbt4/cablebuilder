const express = require('express');
const db = require('../db');
const { sanitizeWebsite } = require('../sanitize');
const { aggregateConfigurations } = require('../shopping-list');
const { loadSetConfigurations, selectConfigurationSet } = require('../configuration-sets');
const { combinedCsv, combinedPdf } = require('../export');

const router = express.Router();

function loadShoppingList(requestedSetId) {
  const { sets, selectedSet } = selectConfigurationSet(requestedSetId);
  const configurations = loadSetConfigurations(selectedSet?.id);
  return {
    sets,
    selectedSet,
    configurations,
    shoppingList: aggregateConfigurations(configurations),
  };
}

router.get('/', (req, res) => {
  const {
    sets, selectedSet, configurations, shoppingList,
  } = loadShoppingList(req.query.set);
  const offers = db.prepare('SELECT * FROM shopping_list').all()
    .map((offer) => ({ ...offer, price_per_meter: offer.price / offer.length_m }))
    .sort((a, b) => a.price_per_meter - b.price_per_meter);
  res.render('einkaufsliste', {
    ...shoppingList,
    sets,
    selectedSet,
    configurationCount: configurations.length,
    offers,
    cheapestOfferId: offers.length > 0 ? offers[0].id : null,
    active: 'einkaufsliste',
  });
});

router.get('/export.csv', (req, res) => {
  const { configurations, shoppingList, selectedSet } = loadShoppingList(req.query.set);
  combinedCsv(
    res,
    configurations,
    shoppingList,
    new Date().toISOString().slice(0, 10),
    selectedSet?.name,
  );
});

router.get('/export.pdf', (req, res) => {
  const { configurations, shoppingList, selectedSet } = loadShoppingList(req.query.set);
  combinedPdf(
    res,
    configurations,
    shoppingList,
    new Date().toISOString().slice(0, 10),
    selectedSet?.name,
  );
});

router.post('/', (req, res) => {
  const name = String(req.body.name || '').trim();
  const price = Number(req.body.price);
  const lengthM = Number(req.body.length_m);
  if (name && Number.isFinite(price) && price >= 0 && Number.isFinite(lengthM) && lengthM > 0) {
    db.prepare('INSERT INTO shopping_list (name, website, price, length_m) VALUES (?, ?, ?, ?)')
      .run(name, sanitizeWebsite(req.body.website), price, lengthM);
  }
  const setId = Number(req.body.set_id);
  res.redirect(Number.isSafeInteger(setId) ? `/einkaufsliste?set=${setId}` : '/einkaufsliste');
});

router.post('/:id/delete', (req, res) => {
  db.prepare('DELETE FROM shopping_list WHERE id = ?').run(req.params.id);
  const setId = Number(req.body.set_id);
  res.redirect(Number.isSafeInteger(setId) ? `/einkaufsliste?set=${setId}` : '/einkaufsliste');
});

module.exports = router;
