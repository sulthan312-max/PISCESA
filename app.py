#!/usr/bin/env python3
"""
Admin Panel Server - Flask
CV Karya Perikanan Indonesia
Database: SQLite3
Features: Product CRUD, Image Upload, Company Info
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import sqlite3
import os
import json
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import hashlib
import secrets

app = Flask(__name__)
CORS(app)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB max upload
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
UPLOAD_FOLDER = 'public/images'

# Create upload folder if not exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

DATABASE = 'data.db'

def add_column_if_missing(cursor, table, column_name, column_def):
    """Add column if not exists. If default is non-constant (e.g. CURRENT_TIMESTAMP), add without default then backfill."""
    cursor.execute(f"PRAGMA table_info({table})")
    existing = [row[1] for row in cursor.fetchall()]
    if column_name in existing:
        return

    # SQLite cannot add column with non-constant default; strip it when needed
    ddl = column_def
    backfill_current_ts = False
    if 'CURRENT_TIMESTAMP' in column_def.upper():
        ddl = column_def.split()[0]  # use the type only
        backfill_current_ts = True

    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column_name} {ddl}")

    if backfill_current_ts:
        cursor.execute(f"UPDATE {table} SET {column_name} = CURRENT_TIMESTAMP WHERE {column_name} IS NULL")

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with tables"""
    conn = get_db()
    c = conn.cursor()
    
    # Products table
    c.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            image_path TEXT,
            price REAL DEFAULT 0,
            stock INTEGER DEFAULT 0,
            available BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Admins table
    c.execute('''
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            otp_code TEXT,
            otp_expires TIMESTAMP,
            verified INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Ensure new columns exist (for older DBs)
    add_column_if_missing(c, 'admins', 'phone', 'TEXT')
    add_column_if_missing(c, 'admins', 'otp_code', 'TEXT')
    add_column_if_missing(c, 'admins', 'otp_expires', 'TIMESTAMP')
    add_column_if_missing(c, 'admins', 'verified', 'INTEGER DEFAULT 0')
    add_column_if_missing(c, 'admins', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')

    # Admin sessions table
    c.execute('''
        CREATE TABLE IF NOT EXISTS admin_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            active INTEGER DEFAULT 1,
            FOREIGN KEY(admin_id) REFERENCES admins(id)
        )
    ''')
    
    # Company info table
    c.execute('''
        CREATE TABLE IF NOT EXISTS company (
            id INTEGER PRIMARY KEY,
            name TEXT DEFAULT 'CV Karya Perikanan Indonesia',
            logo_path TEXT,
            description TEXT,
            phone TEXT,
            whatsapp TEXT,
            email TEXT,
            address TEXT,
            operating_hours TEXT DEFAULT 'Buka 24 Jam',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Orders table
    c.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            whatsapp TEXT NOT NULL,
            email TEXT,
            product TEXT NOT NULL,
            quantity REAL NOT NULL,
            address TEXT NOT NULL,
            note TEXT,
            status TEXT DEFAULT 'baru',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    
    # Check if admin exists
    admin_count = c.execute('SELECT COUNT(*) FROM admins').fetchone()[0]
    if admin_count == 0:
        # Insert default admin
        password_hash = hashlib.sha256('admin123'.encode()).hexdigest()
        c.execute('''
            INSERT INTO admins (username, password, email, phone, verified)
            VALUES (?, ?, ?, ?, 1)
        ''', ('admin', password_hash, 'admin@cvindonesia.com', '+6200000000'))
        conn.commit()
        print("✓ Default admin created: admin/admin123")
    
    # Check if company info exists
    company_count = c.execute('SELECT COUNT(*) FROM company').fetchone()[0]
    if company_count == 0:
        c.execute('''
            INSERT INTO company (id, name, description, phone, whatsapp, email, address)
            VALUES (1, 'CV Karya Perikanan Indonesia', 'Supplier ikan berkualitas', '+62-XXX-XXX', '+62-XXX-XXX', 'info@cvindonesia.com', 'Gunung Calincing, Kuripan, Kec. Ciseeng, Kabupaten Bogor, Jawa Barat 16120')
        ''')
        conn.commit()
        print("✓ Default company info created")
    
    # Check if products exist
    product_count = c.execute('SELECT COUNT(*) FROM products').fetchone()[0]
    if product_count == 0:
        products = [
            ('Sisik Ikan', 'Sisik ikan berkualitas premium', '/images/sample1.jpg', 50000, 100, 1),
            ('Kakap Merah', 'Kakap merah segar dari laut', '/images/sample2.jpg', 45000, 150, 1),
            ('Kulit Ikan', 'Kulit ikan untuk berbagai kebutuhan', '/images/sample3.jpg', 35000, 200, 1),
        ]
        for product in products:
            c.execute('''
                INSERT INTO products (name, description, image_path, price, stock, available)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', product)
        conn.commit()
        print(f"✓ {len(products)} sample products created")
    
    conn.close()
    print("✓ Database initialized successfully!")

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def hash_password(password):
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_session(admin_id, conn=None):
    """Create auth session token"""
    local_conn = conn or get_db()
    c = local_conn.cursor()
    token = secrets.token_hex(32)
    expires_at = (datetime.utcnow() + timedelta(days=30)).isoformat()
    c.execute('''
        INSERT INTO admin_sessions (admin_id, token, expires_at, active)
        VALUES (?, ?, ?, 1)
    ''', (admin_id, token, expires_at))
    if conn is None:
        local_conn.commit()
        local_conn.close()
    return token, expires_at

def require_auth(func):
    """Decorator to require valid session token"""
    from functools import wraps
    @wraps(func)
    def wrapper(*args, **kwargs):
        token = request.headers.get('Authorization', '').strip()
        if not token:
            return jsonify({'error': 'Unauthorized'}), 401
        conn = get_db()
        c = conn.cursor()
        session = c.execute('''
            SELECT s.id, s.admin_id, s.expires_at, s.active, a.username
            FROM admin_sessions s
            JOIN admins a ON a.id = s.admin_id
            WHERE s.token = ? AND s.active = 1
        ''', (token,)).fetchone()
        if not session:
            conn.close()
            return jsonify({'error': 'Session tidak valid'}), 401
        expires_at = session['expires_at']
        if expires_at and datetime.fromisoformat(expires_at) < datetime.utcnow():
            conn.close()
            return jsonify({'error': 'Session kedaluwarsa'}), 401
        request.admin_id = session['admin_id']
        request.admin_username = session['username']
        return func(*args, **kwargs)
    return wrapper

# ============================================================================
# API ROUTES
# ============================================================================

# Health check
@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'Admin API is running',
        'timestamp': datetime.now().isoformat()
    })

# ============================================================================
# AUTHENTICATION
# ============================================================================

@app.route('/api/admin/request-otp', methods=['POST'])
def request_otp():
    """Request OTP using phone + username"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        phone = data.get('phone', '').strip()

        if not username or not phone:
            return jsonify({'error': 'Username dan nomor telepon wajib diisi'}), 400

        otp_code = f"{secrets.randbelow(1000000):06d}"
        expires = (datetime.utcnow() + timedelta(minutes=10)).isoformat()

        conn = get_db()
        c = conn.cursor()

        existing = c.execute('SELECT id, phone FROM admins WHERE username = ?', (username,)).fetchone()
        if existing:
            if existing['phone'] and existing['phone'] != phone:
                conn.close()
                return jsonify({'error': 'Nomor telepon tidak cocok dengan akun ini'}), 400
            c.execute('''
                UPDATE admins SET phone = ?, otp_code = ?, otp_expires = ?, verified = 0, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (phone, otp_code, expires, existing['id']))
        else:
            c.execute('''
                INSERT INTO admins (username, password, email, phone, otp_code, otp_expires, verified)
                VALUES (?, ?, ?, ?, ?, ?, 0)
            ''', (username, hash_password(secrets.token_hex(8)), None, phone, otp_code, expires))

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Kode OTP dikirim (simulasi)', 'otp': otp_code, 'expires_at': expires})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/verify-otp', methods=['POST'])
def verify_otp():
    """Verify OTP and set password"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        otp = data.get('otp', '').strip()
        password = data.get('password', '').strip()

        if not all([username, otp, password]):
            return jsonify({'error': 'Username, OTP, dan password wajib diisi'}), 400

        conn = get_db()
        c = conn.cursor()
        admin = c.execute('SELECT id, otp_code, otp_expires FROM admins WHERE username = ?', (username,)).fetchone()
        if not admin or not admin['otp_code']:
            conn.close()
            return jsonify({'error': 'OTP tidak ditemukan, silakan minta ulang'}), 400

        if admin['otp_code'] != otp:
            conn.close()
            return jsonify({'error': 'Kode OTP salah'}), 400

        if admin['otp_expires'] and datetime.fromisoformat(admin['otp_expires']) < datetime.utcnow():
            conn.close()
            return jsonify({'error': 'OTP kedaluwarsa'}), 400

        c.execute('''
            UPDATE admins SET password = ?, verified = 1, otp_code = NULL, otp_expires = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (hash_password(password), admin['id']))
        conn.commit()

        token, expires_at = create_session(admin['id'], conn)
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Password berhasil diatur', 'token': token, 'expires_at': expires_at, 'username': username})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/login', methods=['POST'])
def login():
    """Admin login with session persistence"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        if not username or not password:
            return jsonify({'error': 'Username dan password harus diisi'}), 400
        
        conn = get_db()
        c = conn.cursor()
        
        password_hash = hash_password(password)
        admin = c.execute(
            'SELECT id, username, email, verified FROM admins WHERE username = ? AND password = ?',
            (username, password_hash)
        ).fetchone()
        
        if not admin:
            conn.close()
            return jsonify({'error': 'Username atau password salah'}), 401
        if not admin['verified']:
            conn.close()
            return jsonify({'error': 'Akun belum diverifikasi. Selesaikan OTP terlebih dahulu.'}), 403

        token, expires_at = create_session(admin['id'], conn)
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'token': token,
            'expires_at': expires_at,
            'admin': {
                'id': admin['id'],
                'username': admin['username'],
                'email': admin['email']
            }
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# PRODUCTS CRUD
# ============================================================================

@app.route('/api/products', methods=['GET'])
def get_products():
    """Get all products"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        products = c.execute('''
            SELECT id, name, description, image_path, price, stock, available, created_at, updated_at
            FROM products
            ORDER BY id DESC
        ''').fetchall()
        
        conn.close()
        
        products_list = []
        for p in products:
            products_list.append({
                'id': p['id'],
                'name': p['name'],
                'description': p['description'],
                'image_path': p['image_path'],
                'price': p['price'],
                'stock': p['stock'],
                'available': bool(p['available']),
                'created_at': p['created_at'],
                'updated_at': p['updated_at']
            })
        
        return jsonify({
            'success': True,
            'data': products_list,
            'count': len(products_list)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """Get single product"""
    try:
        conn = get_db()
        c = conn.cursor()
        p = c.execute('''
            SELECT id, name, description, image_path, price, stock, available, created_at, updated_at
            FROM products WHERE id = ?
        ''', (product_id,)).fetchone()
        conn.close()
        if not p:
            return jsonify({'error': 'Produk tidak ditemukan'}), 404
        return jsonify({
            'id': p['id'],
            'name': p['name'],
            'description': p['description'],
            'image_path': p['image_path'],
            'price': p['price'],
            'stock': p['stock'],
            'available': bool(p['available']),
            'created_at': p['created_at'],
            'updated_at': p['updated_at']
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/products', methods=['POST'])
@require_auth
def create_product():
    """Create new product with optional image upload"""
    try:
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        price = request.form.get('price', 0, type=float)
        stock = request.form.get('stock', 0, type=int)
        available = request.form.get('available', 'true') == 'true'
        
        if not name:
            return jsonify({'error': 'Nama produk harus diisi'}), 400
        
        image_path = '/images/default.jpg'
        
        # Handle file upload
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename and allowed_file(file.filename):
                # Generate unique filename
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = f"product_{int(datetime.now().timestamp())}_{secrets.token_hex(4)}.{ext}"
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                image_path = f'/images/{filename}'
        
        conn = get_db()
        c = conn.cursor()
        
        c.execute('''
            INSERT INTO products (name, description, image_path, price, stock, available)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (name, description, image_path, price, stock, available))
        
        conn.commit()
        product_id = c.lastrowid
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Produk berhasil ditambahkan',
            'product_id': product_id,
            'image_path': image_path
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@require_auth
def update_product(product_id):
    """Update product"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        # Check if product exists
        product = c.execute('SELECT id FROM products WHERE id = ?', (product_id,)).fetchone()
        if not product:
            return jsonify({'error': 'Produk tidak ditemukan'}), 404
        
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        price = request.form.get('price', type=float)
        stock = request.form.get('stock', type=int)
        available = request.form.get('available', 'true') == 'true'
        
        if not name:
            return jsonify({'error': 'Nama produk harus diisi'}), 400
        
        # Get existing image
        existing = c.execute('SELECT image_path FROM products WHERE id = ?', (product_id,)).fetchone()
        image_path = existing['image_path']
        
        # Handle new image upload
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = f"product_{int(datetime.now().timestamp())}_{secrets.token_hex(4)}.{ext}"
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                image_path = f'/images/{filename}'
        
        c.execute('''
            UPDATE products 
            SET name = ?, description = ?, image_path = ?, price = ?, stock = ?, 
                available = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (name, description, image_path, price, stock, available, product_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Produk berhasil diupdate',
            'image_path': image_path
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@require_auth
def delete_product(product_id):
    """Delete product"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        # Check if exists
        product = c.execute('SELECT id FROM products WHERE id = ?', (product_id,)).fetchone()
        if not product:
            return jsonify({'error': 'Produk tidak ditemukan'}), 404
        
        c.execute('DELETE FROM products WHERE id = ?', (product_id,))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Produk berhasil dihapus'
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/<int:product_id>/availability', methods=['PATCH'])
@require_auth
def toggle_availability(product_id):
    """Toggle product availability"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        # Get current status
        product = c.execute('SELECT available FROM products WHERE id = ?', (product_id,)).fetchone()
        if not product:
            return jsonify({'error': 'Produk tidak ditemukan'}), 404
        
        new_status = not bool(product['available'])
        
        c.execute(
            'UPDATE products SET available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (new_status, product_id)
        )
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Produk {"diaktifkan" if new_status else "dinonaktifkan"}',
            'available': new_status
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/<int:product_id>/stock', methods=['PATCH'])
@require_auth
def update_stock(product_id):
    """Update product stock"""
    try:
        data = request.get_json()
        stock = data.get('stock')
        
        if stock is None or stock < 0:
            return jsonify({'error': 'Stok harus angka positif'}), 400
        
        conn = get_db()
        c = conn.cursor()
        
        product = c.execute('SELECT id FROM products WHERE id = ?', (product_id,)).fetchone()
        if not product:
            return jsonify({'error': 'Produk tidak ditemukan'}), 404
        
        c.execute(
            'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (stock, product_id)
        )
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Stok berhasil diupdate',
            'stock': stock
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# COMPANY INFO
# ============================================================================

@app.route('/api/company', methods=['GET'])
def get_company():
    """Get company information"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        company = c.execute('SELECT * FROM company WHERE id = 1').fetchone()
        conn.close()
        
        if company:
            return jsonify({
                'success': True,
                'data': {
                    'name': company['name'],
                    'logo_path': company['logo_path'],
                    'description': company['description'],
                    'phone': company['phone'],
                    'whatsapp': company['whatsapp'],
                    'email': company['email'],
                    'address': company['address'],
                    'operating_hours': company['operating_hours']
                }
            }), 200
        else:
            return jsonify({'error': 'Info perusahaan tidak ditemukan'}), 404
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/company', methods=['PUT'])
@require_auth
def update_company():
    """Update company information"""
    try:
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        phone = request.form.get('phone', '').strip()
        whatsapp = request.form.get('whatsapp', '').strip()
        email = request.form.get('email', '').strip()
        address = request.form.get('address', '').strip()
        operating_hours = request.form.get('operating_hours', 'Buka 24 Jam').strip()
        
        conn = get_db()
        c = conn.cursor()
        
        # Get existing logo
        existing = c.execute('SELECT logo_path FROM company WHERE id = 1').fetchone()
        logo_path = existing['logo_path'] if existing else '/images/logo.png'
        
        # Handle logo upload
        if 'logo' in request.files:
            file = request.files['logo']
            if file and file.filename and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = f"logo_{int(datetime.now().timestamp())}.{ext}"
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                logo_path = f'/images/{filename}'
        
        # Update company info
        c.execute('''
            UPDATE company 
            SET name = ?, description = ?, phone = ?, whatsapp = ?, email = ?, 
                address = ?, operating_hours = ?, logo_path = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        ''', (name, description, phone, whatsapp, email, address, operating_hours, logo_path))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Informasi perusahaan berhasil diupdate',
            'logo_path': logo_path
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ORDERS
# ============================================================================

@app.route('/api/orders', methods=['POST'])
def create_order():
    """Public endpoint to create order"""
    try:
        data = request.get_json() or {}
        customer_name = data.get('customer_name', '').strip()
        whatsapp = data.get('whatsapp', '').strip()
        email = data.get('email', '').strip()
        product = data.get('product', '').strip()
        quantity = float(data.get('quantity', 0) or 0)
        address = data.get('address', '').strip()
        note = data.get('note', '').strip()

        if not all([customer_name, whatsapp, product, quantity, address]):
            return jsonify({'error': 'Nama, WhatsApp, produk, jumlah, dan alamat wajib diisi'}), 400

        conn = get_db()
        c = conn.cursor()
        c.execute('''
            INSERT INTO orders (customer_name, whatsapp, email, product, quantity, address, note, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'baru')
        ''', (customer_name, whatsapp, email, product, quantity, address, note))
        conn.commit()
        order_id = c.lastrowid
        conn.close()

        return jsonify({'success': True, 'message': 'Pesanan tersimpan', 'order_id': order_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/orders', methods=['GET'])
@require_auth
def list_orders():
    try:
        conn = get_db()
        c = conn.cursor()
        rows = c.execute('''
            SELECT id, customer_name, whatsapp, email, product, quantity, address, note, status, created_at, updated_at
            FROM orders
            ORDER BY created_at DESC
        ''').fetchall()
        conn.close()
        data = []
        for r in rows:
            data.append({
                'id': r['id'],
                'customer_name': r['customer_name'],
                'whatsapp': r['whatsapp'],
                'email': r['email'],
                'product': r['product'],
                'quantity': r['quantity'],
                'address': r['address'],
                'note': r['note'],
                'status': r['status'],
                'created_at': r['created_at'],
                'updated_at': r['updated_at']
            })
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/orders/<int:order_id>/status', methods=['PATCH'])
@require_auth
def update_order_status(order_id):
    try:
        data = request.get_json() or {}
        status = data.get('status', '').strip().lower()
        if status not in ['baru', 'proses', 'dikirim', 'selesai', 'batal']:
            return jsonify({'error': 'Status tidak valid'}), 400

        conn = get_db()
        c = conn.cursor()
        exists = c.execute('SELECT id FROM orders WHERE id = ?', (order_id,)).fetchone()
        if not exists:
            conn.close()
            return jsonify({'error': 'Pesanan tidak ditemukan'}), 404
        c.execute('''
            UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        ''', (status, order_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Status diperbarui', 'status': status}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# STATIC FILES
# ============================================================================

@app.route('/images/<filename>')
def serve_image(filename):
    """Serve uploaded images"""
    try:
        return send_file(os.path.join(UPLOAD_FOLDER, filename))
    except:
        return jsonify({'error': 'File tidak ditemukan'}), 404

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint tidak ditemukan'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Server error'}), 500

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    print("=" * 60)
    print("🐟 Admin Panel Server - CV Karya Perikanan Indonesia")
    print("=" * 60)
    
    # Initialize database
    print("\n📊 Initializing database...")
    init_db()
    
    print("\n" + "=" * 60)
    print("✅ Server siap dijalankan!")
    print("=" * 60)
    print("\n🌐 Akses admin panel:")
    print("   URL: http://localhost:5000/admin.html")
    print("   Username: admin")
    print("   Password: admin123")
    print("\n📡 API Base: http://localhost:5000/api/")
    print("=" * 60 + "\n")
    
    # Run Flask server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )
