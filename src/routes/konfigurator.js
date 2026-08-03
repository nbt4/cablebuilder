const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const connectors = db.prepare('SELECT id, name, price FROM connectors ORDER BY name').all();
  const cables = db.prepare('SELECT id, name, price_per_meter FROM cables ORDER BY name').all();
  res.render('konfigurator', { connectors, cables, active: 'konfigurator' });
});

module.exports = router;
