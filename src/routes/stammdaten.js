const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const connectors = db.prepare('SELECT * FROM connectors ORDER BY name').all();
  const cables = db.prepare('SELECT * FROM cables ORDER BY name').all();
  res.render('stammdaten', { connectors, cables, active: 'stammdaten' });
});

router.post('/stecker', (req, res) => {
  const { name, website, price } = req.body;
  if (name && price) {
    db.prepare('INSERT INTO connectors (name, website, price) VALUES (?, ?, ?)')
      .run(name.trim(), (website || '').trim(), parseFloat(price));
  }
  res.redirect('/stammdaten');
});

router.post('/stecker/:id/delete', (req, res) => {
  db.prepare('DELETE FROM connectors WHERE id = ?').run(req.params.id);
  res.redirect('/stammdaten');
});

router.post('/kabel', (req, res) => {
  const { name, website, price_per_meter } = req.body;
  if (name && price_per_meter) {
    db.prepare('INSERT INTO cables (name, website, price_per_meter) VALUES (?, ?, ?)')
      .run(name.trim(), (website || '').trim(), parseFloat(price_per_meter));
  }
  res.redirect('/stammdaten');
});

router.post('/kabel/:id/delete', (req, res) => {
  db.prepare('DELETE FROM cables WHERE id = ?').run(req.params.id);
  res.redirect('/stammdaten');
});

module.exports = router;
