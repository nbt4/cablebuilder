# Projektweite Arbeitsanweisungen

Nach jeder Änderung am Projekt:

1. Die Anwendung vollständig bauen und die relevanten Prüfungen ausführen.
2. Die Version gemäß Semantic Versioning in `package.json` und `package-lock.json` erhöhen.
3. Das Docker-Image mit beiden Tags bauen:
   - `nobentie/cablebuilder:latest`
   - `nobentie/cablebuilder:<version>`
4. Beide Docker-Tags in die Registry pushen.

Eine Änderung ist erst abgeschlossen, wenn Build und Push erfolgreich waren. Falls der Push wegen fehlender Anmeldung, Netzwerkproblemen oder Registry-Rechten nicht möglich ist, den Fehler deutlich melden.
