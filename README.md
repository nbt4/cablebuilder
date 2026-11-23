# cablebuilder

Kleines Tool zur Kabelkalkulation:

- **Stecker & Kabel**: Stammdaten mit Name, Website sowie Netto- oder Bruttopreis (Kabel: Preis/m) pflegen; der jeweils andere Preis wird mit 19 % MwSt. berechnet
- **Kabelkategorien**: Eigene Kategorien mit individuellen Zusatzfeldern anlegen, z.B. „Strom“ mit „Querschnitt“ und „Aderanzahl“
- **Konfigurator**: Benannte Konfigurationen wie „Strom“ oder „Audio“ anlegen und darin mehrere Kabelpositionen speichern und bearbeiten
- **Einkaufsliste**: benötigte Kabelmeter und Stecker der ausgewählten Konfiguration automatisch zusammenfassen – inklusive direkter Links zu den Produkten
- **Export**: Konfigurationsliste und daraus berechnete Einkaufsliste gemeinsam als CSV oder PDF herunterladen

Änderungen an Namen, Preisen und Produktlinks von Kabeln oder Steckern werden automatisch in alle verknüpften Konfigurationen übernommen.

Dark Theme mit roten Akzenten.

## Betrieb per Docker

```bash
cp .env.example .env
docker compose up -d
```

Läuft danach auf `http://localhost:3000` (Port über `PORT` in `.env` anpassbar). Die SQLite-Datenbank wird im Ordner `./data` persistiert.

## Lokale Entwicklung ohne Docker

```bash
npm install
npm start
```

## Image bauen

```bash
docker build -t nobentie/cablebuilder:latest .
docker push nobentie/cablebuilder:latest
```
