from flask import Flask, request, jsonify, render_template, send_file
import io
import json
import os
import redactor

app = Flask(__name__)
# Allow larger files
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

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
    proposals = redactor.propose_redactions(pdf_bytes)
    
    return jsonify({
        "pages": pages,
        "proposals": proposals
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    debug = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
    app.run(debug=debug, host='0.0.0.0', port=port)
