from flask import Flask, request, jsonify, render_template, send_file
import io
import json
import os
import redactor

import sqlite3

app = Flask(__name__)
# Allow larger files
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

def get_db():
    conn = sqlite3.connect('profiles.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                redactions TEXT NOT NULL
            )
        ''')

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDFs are supported"}), 400
        
    pdf_bytes = file.read()
    
    # Generate previews
    pages = redactor.generate_previews(pdf_bytes)
    
    # Propose redactions
    regexes_json = request.form.get('regexes')
    regexes = json.loads(regexes_json) if regexes_json else None
    
    image_redact_str = request.form.get('image_redaction')
    image_redact = True if image_redact_str is None else str(image_redact_str).lower() == 'true'
    
    proposals = redactor.propose_redactions(pdf_bytes, regex_config=regexes, propose_images=image_redact)
    
    return jsonify({
        "pages": pages,
        "proposals": proposals,
        "filename": file.filename
    })

@app.route('/api/redact', methods=['POST'])
def redact_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    redactions_json = request.form.get('redactions')
    
    redactions = json.loads(redactions_json) if redactions_json else []
    
    pdf_bytes = file.read()
    
    redacted_bytes = redactor.apply_redactions(pdf_bytes, redactions)
    
    return send_file(
        io.BytesIO(redacted_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f"redacted_{file.filename}"
    )

@app.route('/api/profiles', methods=['GET'])
def get_profiles():
    with get_db() as conn:
        profiles = conn.execute('SELECT * FROM profiles').fetchall()
        result = []
        for p in profiles:
            try:
                data = json.loads(p["redactions"])
                if isinstance(data, list):
                    data = {"boxes": data, "regexes": []}
            except:
                data = {"boxes": [], "regexes": []}
            result.append({"id": p["id"], "name": p["name"], "data": data})
        return jsonify(result)

@app.route('/api/profiles', methods=['POST'])
def save_profile():
    data = request.json
    name = data.get('name')
    profile_data = data.get('data')
    with get_db() as conn:
        cursor = conn.execute('INSERT INTO profiles (name, redactions) VALUES (?, ?)', (name, json.dumps(profile_data)))
        return jsonify({"id": cursor.lastrowid, "name": name, "data": profile_data})

@app.route('/api/profiles/<int:profile_id>', methods=['DELETE'])
def delete_profile(profile_id):
    with get_db() as conn:
        conn.execute('DELETE FROM profiles WHERE id = ?', (profile_id,))
        return jsonify({"success": True})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    debug = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
    app.run(debug=debug, host='0.0.0.0', port=port)
