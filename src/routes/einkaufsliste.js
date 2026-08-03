const express = require('express');
const db = require('../db');
const { sanitizeWebsite } = require('../sanitize');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM shopping_list').all();
  const items = rows
    .map((item) => ({ ...item, price_per_meter: item.price / item.length_m }))
    .sort((a, b) => a.price_per_meter - b.price_per_meter);
  const cheapestId = items.length > 0 ? items[0].id : null;
  res.render('einkaufsliste', { items, cheapestId, active: 'einkaufsliste' });
});

router.post('/', (req, res) => {
  const { name, website, price, length_m } = req.body;
  if (name && price && length_m) {
    db.prepare('INSERT INTO shopping_list (name, website, price, length_m) VALUES (?, ?, ?, ?)')
      .run(name.trim(), sanitizeWebsite(website), parseFloat(price), parseFloat(length_m));
  }
  res.redirect('/einkaufsliste');
});

router.post('/:id/delete', (req, res) => {
  db.prepare('DELETE FROM shopping_list WHERE id = ?').run(req.params.id);
  res.redirect('/einkaufsliste');
});

module.exports = router;
