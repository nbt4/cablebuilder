# cablebuilder

Kleines Tool zur Kabelkalkulation:

- **Stecker & Kabel**: Stammdaten mit Name, Website und Preis (Kabel: Preis/m) pflegen
- **Konfigurator**: Stecker A + Stecker B + Kabeltyp + Länge + Menge auswählen, Preis wird sofort berechnet
- **Einkaufsliste**: gefundene Kabel-Angebote sammeln, automatisch nach Preis/m sortiert und verglichen

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
