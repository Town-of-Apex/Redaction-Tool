# Redaction Tool (Apex Redact)

Manual point-and-click PDF redaction for Town of Apex. Upload a PDF, draw boxes, burn in redactions (PyMuPDF), scrub metadata, download.

**Current basic-prod mode:** autodetection / regex proposals / image proposals / profiles are **off** by default (`ENABLE_AUTO_REDACT=false`). Set that env var to `true` only if you intentionally want those features back.

## Deploy on apex-box (Docker)

Host port **9004** → container **8000**.

```bash
cd /path/to/Redaction-Tool
docker compose up -d --build
```

Open: `http://<apex-box-host>:9004`

Health check: `http://<apex-box-host>:9004/api/health`

Stop:

```bash
docker compose down
```

### Compose defaults

| Setting | Value |
|--------|--------|
| Port | `9004:8000` |
| Process | gunicorn (Dockerfile CMD) |
| `FLASK_DEBUG` | `false` |
| `ENABLE_AUTO_REDACT` | `false` |
| Source bind-mount | none |
| Restart | `always` |

No app auth in this deploy — rely on Town network ACL / whitelist.

## Local development

```bash
uv sync
ENABLE_AUTO_REDACT=false uv run python app.py
```

App listens on `http://localhost:8000` by default.

To exercise profiles / regex / image proposals locally:

```bash
ENABLE_AUTO_REDACT=true uv run python app.py
```

## How it works

1. Browser uploads PDF to `/api/analyze` → server returns page preview images (no proposal boxes when auto is off).
2. User draws redaction rectangles in the UI.
3. `/api/redact` applies burn-in redactions + metadata scrub and returns the PDF.

Processing happens **on the server**, not in the browser.

## Project structure

- `app.py` — Flask API
- `redactor.py` — PyMuPDF preview / propose / apply
- `static/` — UI assets
- `templates/index.html` — UI
- `Dockerfile` / `docker-compose.yml` — container deploy

## Re-enabling auto features

Set `ENABLE_AUTO_REDACT=true` in compose (or the environment). The Profiles tab and image toggles return; `/api/analyze` will emit proposal boxes again. Auto code is gated, not deleted.
