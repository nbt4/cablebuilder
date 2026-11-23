require('dotenv').config();
const path = require('path');
const express = require('express');

require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/konfigurator'));

app.use('/stammdaten', require('./src/routes/stammdaten'));
app.use('/konfigurator', require('./src/routes/konfigurator'));
app.use('/einkaufsliste', require('./src/routes/einkaufsliste'));

app.listen(PORT, () => {
  console.log(`cablebuilder läuft auf Port ${PORT}`);
});
