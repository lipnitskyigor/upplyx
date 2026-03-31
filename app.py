import os
import uuid

from flask import Flask, render_template, request, jsonify

from audit_engine import analyze_icon

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20 MB

UPLOAD_FOLDER = os.path.join('static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def save_upload(file, prefix=''):
    ext = os.path.splitext(file.filename)[1].lower()
    filename = f"{prefix}{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    return filename, filepath


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    if not f or f.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    if not allowed_file(f.filename):
        return jsonify({'error': 'Invalid file type. Use PNG, JPG, or WebP.'}), 400

    filename, filepath = save_upload(f)
    file_size = os.path.getsize(filepath)
    analysis = analyze_icon(filepath, file_size)

    return jsonify({
        'filename': filename,
        'url': f'/static/uploads/{filename}',
        'analysis': analysis,
    })


@app.route('/upload-competitor', methods=['POST'])
def upload_competitor():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    if not f or f.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    if not allowed_file(f.filename):
        return jsonify({'error': 'Invalid file type.'}), 400

    filename, filepath = save_upload(f, prefix='comp_')
    file_size = os.path.getsize(filepath)
    analysis = analyze_icon(filepath, file_size)
    return jsonify({
        'filename': filename,
        'url': f'/static/uploads/{filename}',
        'scores': {
            'contrast': analysis['visibility']['contrast'],
            'simplicity': analysis['visibility']['simplicity'],
            'overall': analysis['overall_score'],
        },
    })




if __name__ == '__main__':
    app.run(debug=True, port=5001)
