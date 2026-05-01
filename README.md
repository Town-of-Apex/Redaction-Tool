# Redaction Tool

A secure, local-first tool for semi-autonomously redacting sensitive information from PDF documents. Designed for high-volume document management in government and institutional workflows.

## Key Accomplishments (v2.0)

### 🚀 Multi-File Batch Processing
- **Batch Upload**: Process multiple PDF documents simultaneously.
- **Carousel Review**: Seamlessly switch between files using an integrated carousel to review and adjust redactions before finalization.
- **Bulk Download**: Confirm and download all redacted files in a single action.

### 📋 Advanced Profile System
- **Hybrid Profiles**: Combine spatial bounding boxes (for consistent layouts like building plans) and dynamic regex rules (for variable text patterns) in a single profile.
- **Live Regex Previews**: View regex matches in real-time on a template document during profile creation to verify accuracy.
- **Persistence**: Replaced the hard-coded configuration system with a persistent SQLite database, allowing profiles to be managed and reused across different sessions.

### 🔍 Enhanced Detection & Scalability
- **Dynamic Analysis**: The detection engine is now fully parameterized by the selected profile, eliminating hard-coded regex dependencies.
- **Image Redaction Toggle**: Granular control over embedded image auto-redaction (logos, signatures, seals) available both globally and per-profile.
- **Pixel-Perfect Scaling**: Implemented a sophisticated zoomable/scrollable interface that ensures accurate coordinate mapping between the browser preview and the final PDF output.
- **Rotational Awareness**: Correctly handles and preserves coordinates for rotated PDF pages.

### 🎨 Apex Modern v2 UI
- **Professional Standard**: Upgraded to the Apex Modern v2 design system, providing a clean, structured, and government-grade aesthetic.
- **Unified Creation Flow**: A non-intrusive profile management interface that expands inline, preserving user context while defining complex rules.

## Features
- **Smart Proposals**: Automatically detects signatures, seals, and specific text patterns.
- **Manual Control**: Click-and-drag to add custom redaction zones or right-click to remove proposed ones.
- **Security First**: Irreversible burn-in of redactions (text/images are physically removed, not just covered) and complete metadata scrubbing.
- **Local-Only**: No data leaves your machine; all processing happens within your local environment.

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
- `profiles.db`: SQLite database for persistent redaction profiles.
- `static/`: Frontend assets (JavaScript, CSS).
- `templates/`: HTML templates.
- `Dockerfile` & `docker-compose.yml`: Containerization configuration.
