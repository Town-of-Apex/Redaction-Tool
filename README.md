# Redaction Tool

A secure, local-first tool for semi-autonomously redacting sensitive information from PDF documents.

## Features
- Automatic detection of signatures, P.E. seals, and engineer information.
- Manual redaction selection for edge cases.
- Irreversible burn-in of redactions (removes underlying text/images).
- Metadata scrubbing (author, title, etc. are cleared).
- "Apex Modern" design system for a clean, professional interface.

## Quick Start (Docker)

To run the tool in a containerized manner (recommended for deployment):

1. **Build and start the container:**
   ```bash
   docker compose up -d --build
   ```

2. **Access the tool:**
   Open your browser and navigate to `http://localhost:9000`.

## Quick Start (Local Development)

If you have `uv` installed:

1. **Install dependencies:**
   ```bash
   uv sync
   ```

2. **Run the application:**
   ```bash
   uv run python app.py
   ```
   The tool will be available at `http://localhost:8000`.

## Project Structure
- `app.py`: Flask backend and API endpoints.
- `redactor.py`: Core redaction logic using PyMuPDF.
- `static/`: Frontend assets (JavaScript, CSS).
- `templates/`: HTML templates.
- `Dockerfile` & `docker-compose.yml`: Containerization configuration.
