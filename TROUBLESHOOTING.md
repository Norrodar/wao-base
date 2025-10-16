# Fehlerbehebung - WAO Base

## Datenbankfehler (SQLITE_CANTOPEN)

### Problem
Der Container startet nicht und zeigt folgende Fehlermeldung:
```
SqliteError: unable to open database file
```

### Ursache
Dieser Fehler tritt auf, wenn der Container keine Berechtigung hat, auf das Datenverzeichnis zuzugreifen oder Dateien zu erstellen.

### Lösung

#### 1. Berechtigungen prüfen
Stellen Sie sicher, dass das Datenverzeichnis die richtigen Berechtigungen hat:

```bash
# Prüfen Sie die Berechtigungen des Datenverzeichnisses
ls -la ./data

# Setzen Sie die richtigen Berechtigungen (falls nötig)
chmod 755 ./data
chown -R 1000:1000 ./data
```

#### 2. Docker-Volume-Konfiguration prüfen
Überprüfen Sie die `docker-compose.yaml`:

```yaml
volumes:
  - ./data:/app/data  # Stellen Sie sicher, dass der Pfad korrekt ist
```

#### 3. Benutzer-ID anpassen
Passen Sie die Benutzer-IDs in der `.env` Datei an:

```env
WAOBASE_PUID=1000
WAOBASE_PGID=1000
```

#### 4. Verzeichnis manuell erstellen
Erstellen Sie das Datenverzeichnis manuell:

```bash
mkdir -p ./data
chmod 755 ./data
chown 1000:1000 ./data
```

#### 5. Container neu starten
Nach den Änderungen starten Sie den Container neu:

```bash
docker-compose down
docker-compose up -d
```

### Fehlerseite
Wenn die Datenbank nicht initialisiert werden kann, zeigt WAO Base automatisch eine Fehlerseite mit:
- Detaillierte Fehlerinformationen
- Lösungsvorschläge
- Automatisches Neuladen alle 30 Sekunden

### Logs prüfen
Überprüfen Sie die Container-Logs für weitere Details:

```bash
docker-compose logs wao-base
```

### Häufige Fehlermeldungen

#### "Data directory is not writable"
- **Ursache**: Unzureichende Schreibrechte
- **Lösung**: Berechtigungen mit `chmod 755 ./data` setzen

#### "Database not initialized"
- **Ursache**: Datenbank konnte nicht erstellt werden
- **Lösung**: Verzeichnis manuell erstellen und Berechtigungen prüfen

#### "SQLITE_CANTOPEN"
- **Ursache**: SQLite kann die Datenbankdatei nicht öffnen
- **Lösung**: Vollständigen Pfad und Berechtigungen überprüfen

### Präventive Maßnahmen

1. **Konsistente Benutzer-IDs**: Verwenden Sie immer die gleichen PUID/PGID Werte
2. **Regelmäßige Backups**: Sichern Sie das `./data` Verzeichnis regelmäßig
3. **Monitoring**: Überwachen Sie die Container-Logs auf Fehler
4. **Health Checks**: Nutzen Sie den `/health` Endpoint für Monitoring

### Support
Bei weiteren Problemen:
1. Prüfen Sie die Container-Logs
2. Überprüfen Sie die Systemberechtigungen
3. Testen Sie mit einem neuen Datenverzeichnis
4. Erstellen Sie ein Issue im GitHub Repository
