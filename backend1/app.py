from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, datetime, timedelta
import re
import uuid

app = Flask(__name__)
app.secret_key = 'ayursmart_secret_key_2026'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True  # Required for SameSite=None
# Note: localhost/127.0.0.1 is considered a secure context by browsers even on HTTP

CORS(app, supports_credentials=True, origins=["*"])

import os

# Load environment variables from .env file if it exists
env_file_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_file_path):
    with open(env_file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                parts = line.split('=', 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = parts[1].strip().strip('\'"')
                    os.environ[key] = val

# ── DATABASE ──
db_user = os.environ.get('DB_USER', 'root')
db_password = os.environ.get('DB_PASSWORD', '')
db_host = os.environ.get('DB_HOST', 'localhost')
db_port = os.environ.get('DB_PORT', '3306')
db_name = os.environ.get('DB_NAME', 'ayursmart')

default_db_uri = f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('SQLALCHEMY_DATABASE_URI', default_db_uri)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

def validate_db_uri(uri):
    """Validates if SQLALCHEMY_DATABASE_URI conforms to mysql+pymysql format."""
    if not uri:
        return False
    # Expected format: mysql+pymysql://username:password@localhost:3306/your_db_name
    pattern = r'^mysql\+pymysql://([^:]*)(:([^@]*))?@([^:/]+)(:(\d+))?/([^?]+)$'
    return bool(re.match(pattern, uri))

if not validate_db_uri(app.config['SQLALCHEMY_DATABASE_URI']):
    print("\n" + "!" * 80)
    print(" WARNING: SQLALCHEMY_DATABASE_URI does not seem to match the expected format:")
    print(" mysql+pymysql://username:password@localhost:3306/your_db_name")
    print("!" * 80 + "\n")

db = SQLAlchemy(app)


# ════════════════════════════════════════
# TABLE 1 — USER (Register/Login)
# Stores: name, username, email, password, age, gender, phone
# ════════════════════════════════════════
class User(db.Model):
    id       = db.Column(db.Integer, primary_key=True)
    name     = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(80),  unique=True, nullable=False)
    email    = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    age      = db.Column(db.Integer)
    gender   = db.Column(db.String(20))
    phone    = db.Column(db.String(20))
    security_question = db.Column(db.String(200), nullable=True)
    security_answer   = db.Column(db.String(200), nullable=True)
    reset_token = db.Column(db.String(100), nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name,
            'username': self.username, 'email': self.email,
            'age': self.age, 'gender': self.gender, 'phone': self.phone
        }


# ════════════════════════════════════════
# TABLE 2 — PATIENT (patientdash.html)
# Stores: name, age, gender, phone, email, dosha, last_visit, notes
# ════════════════════════════════════════
class Patient(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(100), nullable=False)
    age        = db.Column(db.Integer)
    gender     = db.Column(db.String(20))
    phone      = db.Column(db.String(20))
    email      = db.Column(db.String(120))
    dosha      = db.Column(db.String(20))
    last_visit = db.Column(db.String(50))
    joined     = db.Column(db.DateTime, default=db.func.now())
    notes      = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'age': self.age,
            'gender': self.gender, 'phone': self.phone, 'email': self.email,
            'dosha': self.dosha, 'last_visit': self.last_visit, 'notes': self.notes,
            'joined': self.joined.strftime('%Y-%m-%d') if self.joined else None
        }


# ════════════════════════════════════════
# TABLE 3 — APPOINTMENT (appointment.html)
# Stores: name, phone, email, date, time, mode, payment, status
# ════════════════════════════════════════
class Appointment(db.Model):
    id             = db.Column(db.Integer, primary_key=True)
    name           = db.Column(db.String(100), nullable=False)
    phone          = db.Column(db.String(20))
    email          = db.Column(db.String(120))
    appt_date      = db.Column(db.String(50))
    appt_time      = db.Column(db.String(20))
    consult_mode   = db.Column(db.String(30))
    payment_method = db.Column(db.String(30))
    status         = db.Column(db.String(20), default='Booked')
    booked_on      = db.Column(db.String(50))
    meeting_link   = db.Column(db.String(255))
    doctor_id      = db.Column(db.Integer, nullable=True)

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'phone': self.phone,
            'email': self.email, 'appt_date': self.appt_date,
            'appt_time': self.appt_time, 'consult_mode': self.consult_mode,
            'payment_method': self.payment_method, 'status': self.status,
            'booked_on': self.booked_on, 'meeting_link': self.meeting_link,
            'doctor_id': self.doctor_id,
            'payment': self.payment[0].to_dict() if self.payment else None
        }

# ════════════════════════════════════════
# TABLE 3.5 — PAYMENT
# Stores: transaction_id, amount, method, status
# ════════════════════════════════════════
class Payment(db.Model):
    id             = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointment.id'), nullable=False)
    transaction_id = db.Column(db.String(100), unique=True, nullable=False)
    amount         = db.Column(db.Integer, default=50)
    payment_method = db.Column(db.String(30))
    status         = db.Column(db.String(20), default='Completed')
    created_at     = db.Column(db.DateTime, default=db.func.now())

    # Relationship back to Appointment
    appointment = db.relationship('Appointment', backref=db.backref('payment', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'appointment_id': self.appointment_id,
            'transaction_id': self.transaction_id,
            'amount': self.amount,
            'payment_method': self.payment_method,
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

# ════════════════════════════════════════
# TABLE 4 — REMEDY (quiz results)
# Stores: body_type, recommended_food, prohibited_food, summary
# ════════════════════════════════════════
class Remedy(db.Model):
    __tablename__ = 'remedy'
    remedy_id       = db.Column(db.Integer, primary_key=True)
    body_type       = db.Column(db.String(20), nullable=False)
    recommended_food = db.Column(db.Text)
    prohibited_food  = db.Column(db.Text)
    summary         = db.Column(db.String(255))

    def to_dict(self):
        return {
            'remedy_id': self.remedy_id, 'body_type': self.body_type,
            'recommended_food': self.recommended_food,
            'prohibited_food': self.prohibited_food, 'summary': self.summary
        }


# ════════════════════════════════════════
# TABLE 5 — PRAKRITI QUIZ RESULT (Guest/User results)
# Stores: vata, pitta, kapha scores, body_type, date
# ════════════════════════════════════════
class PrakritiQuizResult(db.Model):
    __tablename__ = 'prakriti_quiz_result'
    quiz_id        = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, nullable=True)
    vata_score     = db.Column(db.Integer)
    pitta_score    = db.Column(db.Integer)
    kapha_score    = db.Column(db.Integer)
    body_type      = db.Column(db.String(20))
    quiz_date      = db.Column(db.DateTime, default=db.func.now())

    def to_dict(self):
        return {
            'quiz_id': self.quiz_id,
            'user_id': self.user_id,
            'vata_score': self.vata_score,
            'pitta_score': self.pitta_score,
            'kapha_score': self.kapha_score,
            'body_type': self.body_type,
            'quiz_date': self.quiz_date.strftime('%Y-%m-%d %H:%M:%S') if self.quiz_date else None
        }

# ════════════════════════════════════════
# TABLE 6 — HEALTH JOURNAL (user dashboard notes)
# ════════════════════════════════════════
class HealthJournal(db.Model):
    __tablename__ = 'health_journal'
    id        = db.Column(db.Integer, primary_key=True)
    user_id   = db.Column(db.Integer, nullable=False)
    note      = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'note': self.note,
            'date': self.created_at.strftime('%d %b %Y') if self.created_at else ''
        }


# ── SEED DATA ──
def seed_remedies():
    defaults = [
        {'type': 'Vata',  'sum': 'Air/Space, dry, cold. Favor sweet, sour, salty.', 'rec': 'Ashwagandha, Sesame oil, Warm soups', 'pro': 'Coffee, dry snacks, cold salads'},
        {'type': 'Pitta', 'sum': 'Fire/Water, warm, sharp. Favor sweet, bitter, astringent.', 'rec': 'Brahmi, Shatavari, Cooling coconut water', 'pro': 'Red chilli, caffeine, spicy foods'},
        {'type': 'Kapha', 'sum': 'Earth/Water, cool, steady. Favor pungent, bitter, astringent.', 'rec': 'Ginger, Trikatu, Light steamed vegetables', 'pro': 'Dairy, sweet fruits, heavy fried foods'}
    ]
    for d in defaults:
        if not Remedy.query.filter_by(body_type=d['type']).first():
            r = Remedy(body_type=d['type'], summary=d['sum'], recommended_food=d['rec'], prohibited_food=d['pro'])
            db.session.add(r)
    db.session.commit()


def check_db_health(uri):
    """Verifies that the database is reachable using a raw pymysql connection."""
    import pymysql
    pattern = r'^mysql\+pymysql://([^:]*)(:([^@]*))?@([^:/]+)(:(\d+))?/([^?]+)$'
    match = re.match(pattern, uri)
    if not match:
        return False, "Invalid database URI format. Expected format: mysql+pymysql://username:password@localhost:3306/your_db_name"
    
    user = match.group(1)
    password = match.group(3) or ''
    host = match.group(4)
    port = int(match.group(6)) if match.group(6) else 3306
    db_name = match.group(7)
    
    try:
        conn = pymysql.connect(
            host=host,
            user=user,
            password=password,
            port=port,
            connect_timeout=3
        )
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}`")
            conn.select_db(db_name)
        except Exception as db_err:
            return False, f"Connected to MySQL server at {host}:{port}, but database '{db_name}' could not be accessed/created: {db_err}"
        finally:
            conn.close()
        return True, "Reachable"
    except Exception as server_err:
        return False, f"Cannot connect to MySQL server at {host}:{port}: {server_err}"

# ── CREATE ALL TABLES AUTOMATICALLY ──
with app.app_context():
    db_uri = app.config['SQLALCHEMY_DATABASE_URI']
    db_ok, db_err = check_db_health(db_uri)
    if not db_ok:
        print("\n" + "!" * 80)
        print(" DATABASE CONNECTION / INITIALIZATION ERROR:")
        print(f" {db_err}")
        print(" MySQL is not running or connection settings are incorrect. Please start MySQL and retry.")
        print("!" * 80 + "\n")
    else:
        try:
            db.create_all()
            seed_remedies()
        except Exception as e:
            print("\n" + "!" * 80)
            print(" DATABASE TABLE CREATION FAILED:")
            print(f" {e}")
            print(" MySQL is not running or connection settings are incorrect. Please start MySQL and retry.")
            print("!" * 80 + "\n")

# ── HELPERS ──
def valid_email(email):
    return re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email)

def valid_password(password):
    return re.match(r'^(?=.*[A-Z])(?=.*\d).{8,}$', password)

def generate_meet_link():
    """Generates a realistic-looking Google Meet link."""
    # format: meet.google.com/xxx-xxxx-xxx
    import random, string
    part1 = ''.join(random.choices(string.ascii_lowercase, k=3))
    part2 = ''.join(random.choices(string.ascii_lowercase, k=4))
    part3 = ''.join(random.choices(string.ascii_lowercase, k=3))
    return f"https://meet.google.com/{part1}-{part2}-{part3}"

def get_current_patient():
    """Returns the currently logged-in Patient object or None."""
    user_id = session.get('user_id')
    if not user_id:
        return None
    user = db.session.get(User, user_id)
    if not user:
        return None
    # Find patient by email or phone
    patient = Patient.query.filter((Patient.email == user.email) | (Patient.phone == user.phone)).first()
    return patient


# ════════════════════════════════════════
# REGISTER — saves to USER table
# Also saves to PATIENT table automatically
# ════════════════════════════════════════
@app.route('/api/register', methods=['POST'])
def register():
    data     = request.get_json()
    name     = data.get('name',     '').strip()
    username = data.get('username', '').strip()
    email    = data.get('email',    '').strip()
    password = data.get('password', '').strip()
    age      = data.get('age')
    gender   = data.get('gender', '').strip()
    phone    = data.get('phone',  '').strip()
    security_question = data.get('security_question', '').strip()
    security_answer   = data.get('security_answer',   '').strip()

    # Validation
    if not name or not username or not email or not password or not security_question or not security_answer:
        return jsonify({'success': False, 'message': 'All fields including security question/answer required.'}), 400
    if not valid_email(email):
        return jsonify({'success': False, 'message': 'Enter valid email.'}), 400
    if not valid_password(password):
        return jsonify({'success': False, 'message': 'Password needs 1 uppercase, 1 number, 8+ chars.'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'Email already registered.'}), 409
    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'message': 'Username already taken.'}), 409

    today = date.today().strftime('%d %b %Y')

    # Save to USER table
    new_user = User(
        name=name, username=username, email=email,
        password=generate_password_hash(password),
        age=age, gender=gender, phone=phone,
        security_question=security_question,
        security_answer=security_answer
    )
    db.session.add(new_user)

    # Also save to PATIENT table automatically
    new_patient = Patient(
        name=name, age=age, gender=gender,
        phone=phone, email=email,
        last_visit=today, notes='Registered user',
        joined=datetime.now()
    )
    db.session.add(new_patient)
    db.session.commit()

    return jsonify({'success': True, 'message': f'Account created! Welcome, {name}.'}), 201


# ════════════════════════════════════════
# LOGIN — checks USER table
# ════════════════════════════════════════
@app.route('/api/login', methods=['POST'])
def login():
    data     = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required.'}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({'success': False, 'message': 'Invalid username or password.'}), 401

    session.permanent = True
    session['user_id']  = user.id
    session['username'] = user.username

    return jsonify({
        'success': True,
        'message': f'Welcome back, {user.username}!',
        'user': user.to_dict()
    }), 200


# ════════════════════════════════════════
# ADMIN LOGIN — hardcoded credentials
# Used in index.html Admin Login modal
# ════════════════════════════════════════
@app.route('/api/admin-login', methods=['POST'])
def admin_login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    admin_creds = {"username": "ayursmart", "password": "ayursmart@14"}

    if username == admin_creds['username'] and password == admin_creds['password']:
        session.permanent = True
        session['is_admin'] = True
        return jsonify({'success': True, 'message': 'Admin login successful.'}), 200

    return jsonify({'success': False, 'message': 'Invalid admin credentials.'}), 401


# ════════════════════════════════════════
# LOGOUT
# ════════════════════════════════════════
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out.'}), 200


# ════════════════════════════════════════
# FORGOT PASSWORD
# ════════════════════════════════════════
@app.route('/api/get-security-question', methods=['POST'])
def get_security_question():
    data = request.get_json()
    phone = data.get('phone', '').strip()
    if not phone:
        return jsonify({'success': False, 'message': 'Phone number required.'}), 400
    
    user = User.query.filter_by(phone=phone).first()
    if not user:
        return jsonify({'success': False, 'message': 'No account found with this phone number.'}), 404
        
    if not user.security_question:
        return jsonify({'success': False, 'message': 'No security question set for this account.'}), 400
        
    return jsonify({'success': True, 'question': user.security_question}), 200

@app.route('/api/verify-security-answer', methods=['POST'])
def verify_security_answer():
    data = request.get_json()
    phone = data.get('phone', '').strip()
    answer = data.get('answer', '').strip()
    
    if not phone or not answer:
        return jsonify({'success': False, 'message': 'Phone and answer required.'}), 400
        
    user = User.query.filter_by(phone=phone).first()
    if not user:
        return jsonify({'success': False, 'message': 'User not found.'}), 404
        
    if user.security_answer.lower() != answer.lower():
        return jsonify({'success': False, 'message': 'Incorrect answer.'}), 400
        
    # Valid answer, generate a temporary reset token
    token = uuid.uuid4().hex
    user.reset_token = token
    user.reset_token_expiry = datetime.now() + timedelta(minutes=15)
    db.session.commit()
    
    return jsonify({'success': True, 'token': token}), 200

@app.route('/api/reset-password-final', methods=['POST'])
def reset_password_final():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')
    
    if not token or not new_password:
        return jsonify({'success': False, 'message': 'Token and new password required.'}), 400
        
    user = User.query.filter_by(reset_token=token).first()
    if not user or (user.reset_token_expiry and user.reset_token_expiry < datetime.now()):
        return jsonify({'success': False, 'message': 'Invalid or expired session. Please start over.'}), 400
        
    if not valid_password(new_password):
        return jsonify({'success': False, 'message': 'Password needs 1 uppercase, 1 number, 8+ chars.'}), 400
        
    user.password = generate_password_hash(new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Password reset successful!'}), 200

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    from datetime import datetime, timedelta
    data  = request.get_json()
    email = data.get('email', '').strip()
    if not email:
        return jsonify({'success': False, 'message': 'Enter your email.'}), 400
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'success': False, 'message': 'Email not found.'}), 404
    
    # Generate token
    token = uuid.uuid4().hex
    user.reset_token = token
    user.reset_token_expiry = datetime.now() + timedelta(hours=1)
    db.session.commit()
    
    # In a real app, send email. Here we just return it for testing.
    reset_link = f"http://127.0.0.1:5500/frontend1/index.html?token={token}#reset"
    print(f"DEBUG: Password reset link for {email}: {reset_link}")
    
    return jsonify({
        'success': True, 
        'message': f'Reset link generated (it will be printed in the server logs). Please check your email.',
        'debug_link': reset_link # Returning it for ease of use in development
    }), 200

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    from datetime import datetime
    data = request.get_json()
    token = data.get('token')
    new_pass = data.get('new_password')
    
    if not token or not new_pass:
        return jsonify({'success': False, 'message': 'Token and new password required.'}), 400
        
    user = User.query.filter_by(reset_token=token).first()
    if not user or user.reset_token_expiry < datetime.now():
        return jsonify({'success': False, 'message': 'Invalid or expired token.'}), 400
        
    if not valid_password(new_pass):
        return jsonify({'success': False, 'message': 'Password needs 1 uppercase, 1 number, 8+ chars.'}), 400
        
    user.password = generate_password_hash(new_pass)
    user.reset_token = None # Clear token
    user.reset_token_expiry = None
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Password reset successful! Please sign in.'}), 200


# ════════════════════════════════════════
# WHO IS LOGGED IN
# ════════════════════════════════════════
@app.route('/api/me', methods=['GET'])
def me():
    # ... existing logic ...
    is_admin = session.get('is_admin', False)
    user_id  = session.get('user_id')
    
    if is_admin:
        return jsonify({'success': True, 'is_admin': True, 'user': {'name': 'Admin', 'username': 'ayursmart'}}), 200
        
    if not user_id:
        return jsonify({'success': False, 'message': 'Not logged in.'}), 401
        
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found.'}), 404
        
    return jsonify({'success': True, 'is_admin': False, 'user': user.to_dict()}), 200

# ════════════════════════════════════════
# SAVE QUIZ RESULT TO PROFILE
# ════════════════════════════════════════
@app.route('/api/save-prakriti', methods=['POST'])
def save_prakriti():
    data = request.get_json()
    # Get counts for Vata (A), Pitta (B), Kapha (C)
    vata  = data.get('vata', 0)
    pitta = data.get('pitta', 0)
    kapha = data.get('kapha', 0)
    
    # 1. Identify Highest Score
    scores_map = {'Vata': vata, 'Pitta': pitta, 'Kapha': kapha}
    # In case of ties, the order in keys determines (Vata > Pitta > Kapha)
    body_type = max(scores_map, key=scores_map.get)
    
    # 2. Get logged-in user
    user_id = session.get('user_id')
    print(f"DEBUG: save_prakriti called. user_id: {user_id}, body_type: {body_type}")
    
    # 3. Save to prakriti_quiz_result Table
    new_result = PrakritiQuizResult(
        user_id=user_id,
        vata_score=vata,
        pitta_score=pitta,
        kapha_score=kapha,
        body_type=body_type
    )
    db.session.add(new_result)
    
    # 4. Update Patient record if logged in
    save_msg = f"Your Prakriti result ({body_type}) has been recorded."
    
    if user_id:
        user = db.session.get(User, user_id)
        if user:
            print(f"DEBUG: Found user: {user.email}")
            # Try email first, then phone
            patient = None
            if user.email:
                patient = Patient.query.filter_by(email=user.email).first()
            if not patient and user.phone:
                patient = Patient.query.filter_by(phone=user.phone).first()
            
            if not patient:
                print(f"DEBUG: Patient not found for {user.email}, creating new record.")
                patient = Patient(
                    name=user.name, age=user.age, gender=user.gender,
                    email=user.email, phone=user.phone, dosha=body_type,
                    last_visit=date.today().strftime('%d %b %Y'),
                    notes='Auto-created from quiz'
                )
                db.session.add(patient)
            else:
                print(f"DEBUG: Updating existing patient {patient.id} with dosha {body_type}")
                patient.dosha = body_type
                # Also update contact info if missing
                if not patient.email: patient.email = user.email
                if not patient.phone: patient.phone = user.phone
                
            save_msg = f"Your Prakriti ({body_type}) has been saved to your clinical record."
        else:
            print(f"DEBUG: User ID {user_id} in session but not in DB!")

    try:
        db.session.commit()
        print("DEBUG: DB commit successful.")
    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: DB commit failed: {e}")
        return jsonify({'success': False, 'message': 'Database error.'}), 500
    
    # 4. Recommendation Mapping (Logic only, no remedy table change)
    # Treatments mapping:
    # Vata: Vidhakarma, Panchakarma
    # Pitta: Leech Therapy, Shastrokta Aushad
    # Kapha: Agnikarma, Panchakarma
    # General: Suvarnaprashan, Garbhsanskar
    
    base_treatments = [
        {"name": "Vidhakarma",     "desc": "Effective pricking therapy for instant pain relief.", "target": "Vata"},
        {"name": "Panchakarma",    "desc": "Deep detoxification for balanced mind and body.",     "target": ["Vata", "Kapha"]},
        {"name": "Leech Therapy",  "desc": "Ancient blood purification for skin & inflammation.", "target": "Pitta"},
        {"name": "Shastrokta Aushad", "desc": "Classical Ayurvedic formulations for precision care.", "target": "Pitta"},
        {"name": "Agnikarma",      "desc": "Thermal therapy for chronic muscular disorders.",     "target": "Kapha"},
        {"name": "Suvarnaprashan", "desc": "Potent immunity booster for lifelong health.",        "target": "General"},
        {"name": "Garbhsanskar",   "desc": "Holistic prenatal guidance for a healthy future.",    "target": "General"}
    ]
    
    recommendations = []
    for t in base_treatments:
        is_rec = False
        if t['target'] == "General":
            is_rec = True
        elif isinstance(t['target'], list):
            if body_type in t['target']: is_rec = True
        elif t['target'] == body_type:
            is_rec = True
            
        recommendations.append({
            "name": t['name'],
            "desc": t['desc'],
            "is_recommended": is_rec
        })

    return jsonify({
        'success': True,
        'message': save_msg,
        'body_type': body_type,
        'scores': scores_map,
        'treatments': recommendations
    }), 200

# ════════════════════════════════════════
# MY RECORD — for Patient View
# ════════════════════════════════════════
@app.route('/api/my-record', methods=['GET'])
def get_my_record():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Please login as patient.'}), 401
    user = db.session.get(User, user_id)
    # Find patient record matching email or phone
    patient = Patient.query.filter((Patient.email == user.email) | (Patient.phone == user.phone)).first()
    if not patient:
         return jsonify({'success': False, 'message': 'Record not found.'}), 404
    return jsonify({'success': True, 'patient': patient.to_dict()}), 200

# ════════════════════════════════════════
# GET MY APPOINTMENTS — for Patient View
# ════════════════════════════════════════
@app.route('/api/my-appointments', methods=['GET'])
def get_my_appointments():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Please login as patient.'}), 401
    user = db.session.get(User, user_id)
    appointments = Appointment.query.filter((Appointment.email == user.email) | (Appointment.phone == user.phone)).all()
    return jsonify({'success': True, 'appointments': [a.to_dict() for a in appointments]}), 200


# ════════════════════════════════════════
# GET ALL PATIENTS — patientdash.html
# ════════════════════════════════════════
@app.route('/api/patients', methods=['GET'])
def get_patients():
    patients = Patient.query.all()
    return jsonify({'success': True, 'patients': [p.to_dict() for p in patients]}), 200


# ════════════════════════════════════════
# ADD PATIENT — patientdash.html Add button
# ════════════════════════════════════════
@app.route('/api/patients', methods=['POST'])
def add_patient():
    data  = request.get_json()
    name  = data.get('name',  '').strip()
    phone = data.get('phone', '').strip()

    if not name or not phone:
        return jsonify({'success': False, 'message': 'Name and phone required.'}), 400

    today = date.today().strftime('%d %b %Y')
    p = Patient(
        name=name, age=data.get('age'),
        gender=data.get('gender', '').strip(),
        phone=phone, email=data.get('email', '').strip(),
        dosha=data.get('dosha', '').strip(),
        last_visit=today, notes=data.get('notes', '').strip(),
        joined=datetime.now()
    )
    db.session.add(p)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Patient added!', 'patient': p.to_dict()}), 201


# ════════════════════════════════════════
# UPDATE PATIENT — patientdash.html Edit button
# ════════════════════════════════════════
@app.route('/api/patients/<int:pid>', methods=['PUT'])
def update_patient(pid):
    p = db.session.get(Patient, pid)
    if not p:
        return jsonify({'success': False, 'message': 'Patient not found.'}), 404
    data = request.get_json()
    p.name   = data.get('name',   p.name).strip()
    p.age    = data.get('age',    p.age)
    p.gender = data.get('gender', p.gender)
    p.phone  = data.get('phone',  p.phone).strip()
    p.email  = data.get('email',  p.email or '').strip()
    p.dosha  = data.get('dosha',  p.dosha or '').strip()
    p.notes  = data.get('notes',  p.notes)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Patient updated!', 'patient': p.to_dict()}), 200


# ════════════════════════════════════════
# DELETE PATIENT — patientdash.html Delete button
# ════════════════════════════════════════
@app.route('/api/patients/<int:pid>', methods=['DELETE'])
def delete_patient(pid):
    p = db.session.get(Patient, pid)
    if not p:
        return jsonify({'success': False, 'message': 'Patient not found.'}), 404
    db.session.delete(p)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Patient deleted.'}), 200


# ════════════════════════════════════════
# BOOK APPOINTMENT — appointment.html
# Saves to APPOINTMENT table
# Also updates patient last_visit
# ════════════════════════════════════════
@app.route('/api/appointments', methods=['POST'])
def book_appointment():
    data           = request.get_json()
    name           = data.get('name',           '').strip()
    phone          = data.get('phone',          '').strip()
    email          = data.get('email',          '').strip()
    appt_date      = data.get('appt_date',      '').strip()
    appt_time      = data.get('appt_time',      '').strip()
    consult_mode   = data.get('consult_mode',   '').strip()
    payment_method = data.get('payment_method', '').strip()
    transaction_id = data.get('transaction_id', '').strip()
    amount         = data.get('amount', 50)

    if not name or not appt_date or not appt_time:
        return jsonify({'success': False, 'message': 'Name, date and time required.'}), 400

    # Transaction ID check for UPI payments
    if payment_method == 'upi':
        if not transaction_id:
            return jsonify({'success': False, 'message': 'Transaction ID is required for UPI payments.'}), 400
        
        # Check if transaction ID already exists
        existing_payment = Payment.query.filter_by(transaction_id=transaction_id).first()
        if existing_payment:
            return jsonify({'success': False, 'message': 'This Transaction ID has already been used. Please enter a valid ID.'}), 400

    today = date.today().strftime('%d %b %Y')

    # Generate meeting link if Call Consultation
    m_link = None
    if consult_mode == 'Call Consultation':
        if not phone:
            return jsonify({'success': False, 'message': 'Phone number is required for Call Consultation.'}), 400
        m_link = generate_meet_link()

    # Save appointment
    appt = Appointment(
        name=name, phone=phone, email=email,
        appt_date=appt_date, appt_time=appt_time,
        consult_mode=consult_mode, payment_method=payment_method,
        status='Booked', booked_on=today,
        meeting_link=m_link
    )
    db.session.add(appt)
    db.session.flush() # Get the appt ID before commit

    # Save payment record if transaction_id is provided
    if transaction_id:
        pay_record = Payment(
            appointment_id=appt.id,
            transaction_id=transaction_id,
            amount=amount,
            payment_method=payment_method
        )
        db.session.add(pay_record)

    # Update patient last_visit if exists
    # Check by email or phone
    patient = None
    if email:
        patient = Patient.query.filter_by(email=email).first()
    if not patient and phone:
        patient = Patient.query.filter_by(phone=phone).first()
        
    if patient:
        patient.last_visit = today
        # If patient has no dosha, maybe we can try to find their last quiz result?
        # (Optional but helpful)

    db.session.commit()
    return jsonify({'success': True, 'message': 'Appointment booked!',
                    'appointment': appt.to_dict()}), 201


# ════════════════════════════════════════
# GET ALL APPOINTMENTS — appointmentdash.html
# ════════════════════════════════════════
@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    appointments = Appointment.query.all()
    return jsonify({'success': True,
                    'appointments': [a.to_dict() for a in appointments]}), 200


# ════════════════════════════════════════
# UPDATE APPOINTMENT STATUS — appointmentdash.html
# ════════════════════════════════════════
@app.route('/api/appointments/<int:aid>', methods=['PUT'])
def update_appointment(aid):
    appt = db.session.get(Appointment, aid)
    if not appt:
        return jsonify({'success': False, 'message': 'Appointment not found.'}), 404
    data = request.get_json()
    appt.status = data.get('status', appt.status)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Appointment updated!'}), 200

# ════════════════════════════════════════
    # CANCEL APPOINTMENT — User Dashboard
# ════════════════════════════════════════
@app.route('/api/appointments/cancel/<int:aid>', methods=['POST'])
def cancel_appointment(aid):
    user_id = session.get('user_id')
    is_admin = session.get('is_admin', False)
    
    if not user_id and not is_admin:
        return jsonify({'success': False, 'message': 'Not logged in.'}), 401
    
    appt = db.session.get(Appointment, aid)
    if not appt:
        return jsonify({'success': False, 'message': 'Appointment not found.'}), 404
    
    # Check ownership only if NOT admin
    if not is_admin:
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User not found.'}), 404
            
        is_owner = (appt.email == user.email) or (appt.phone == user.phone)
        if not is_owner:
            return jsonify({'success': False, 'message': 'Unauthorized.'}), 403
        
    if appt.status == 'Cancelled':
        return jsonify({'success': False, 'message': 'Already cancelled.'}), 400
        
    appt.status = 'Cancelled'
    db.session.commit()
    return jsonify({'success': True, 'message': 'Appointment cancelled successfully.'}), 200

# ════════════════════════════════════════
# GET REMEDY BY BODY TYPE — quiz results
# ════════════════════════════════════════
@app.route('/api/remedies/<body_type>', methods=['GET'])
def get_remedy(body_type):
    remedy = Remedy.query.filter_by(body_type=body_type).first()
    if not remedy:
        return jsonify({'success': False, 'message': 'Remedy not found for this body type.'}), 404
    return jsonify({'success': True, 'remedy': remedy.to_dict()}), 200

# ════════════════════════════════════════
# GET ALL REMEDIES — for Doctor Dashboard
# ════════════════════════════════════════
@app.route('/api/remedies', methods=['GET'])
def get_all_remedies():
    remedies = Remedy.query.all()
    return jsonify({'success': True, 'remedies': [r.to_dict() for r in remedies]}), 200

# ════════════════════════════════════════
# UPDATE REMEDY — for Doctor Dashboard
# ════════════════════════════════════════
@app.route('/api/remedies/<body_type>', methods=['PUT'])
def update_remedy(body_type):
        
    # Case-insensitive lookup (Pitta vs pitta)
    remedy = Remedy.query.filter(Remedy.body_type.ilike(body_type)).first()
    if not remedy:
        # Create new if not exists
        remedy = Remedy(body_type=body_type)
        db.session.add(remedy)
        
    data = request.get_json()
    remedy.recommended_food = data.get('recommended_food', remedy.recommended_food)
    remedy.prohibited_food  = data.get('prohibited_food',  remedy.prohibited_food)
    remedy.summary          = data.get('summary',          remedy.summary)
    
    db.session.commit()
    return jsonify({'success': True, 'message': f'{body_type} remedy updated!'}), 200


# ════════════════════════════════════════
# DASHBOARD: GET PROFILE
# ════════════════════════════════════════
@app.route('/api/dashboard/profile', methods=['GET'])
def dashboard_profile():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Not logged in.'}), 401
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found.'}), 404

    # Build initials
    parts = user.name.strip().split() if user.name else []
    initials = (parts[0][0] + (parts[1][0] if len(parts) > 1 else '')).upper() if parts else '?'

    return jsonify({
        'success': True,
        'name': user.name,
        'initials': initials,
        'joined': 'AyurSmart Member',
        'email': user.email,
        'phone': user.phone
    }), 200


# ════════════════════════════════════════
# DASHBOARD: GET PRAKRITI (dosha info)
# ════════════════════════════════════════
@app.route('/api/dashboard/prakriti', methods=['GET'])
def dashboard_prakriti():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False}), 401
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False}), 404

    # Find patient record
    patient = None
    if user.email:
        patient = Patient.query.filter_by(email=user.email).first()
    if not patient and user.phone:
        patient = Patient.query.filter_by(phone=user.phone).first()

    if not patient or not patient.dosha:
        return jsonify({'success': False, 'dosha': None}), 200

    dosha = patient.dosha
    descriptions = {
        'Vata': 'Your nature is creative, quick, and light. Stay balanced with warm nourishing meals and grounding routines.',
        'Pitta': 'Your nature is sharp, driven, and purposeful. Stay balanced with cooling foods and regular relaxation.',
        'Kapha': 'Your nature is calm, steady, and nurturing. Stay energised with light foods and vigorous movement.'
    }

    # Get quiz scores for percentage
    quiz = PrakritiQuizResult.query.filter_by(user_id=user_id).order_by(PrakritiQuizResult.quiz_id.desc()).first()
    pct = ''
    if quiz:
        total = (quiz.vata_score or 0) + (quiz.pitta_score or 0) + (quiz.kapha_score or 0)
        if total > 0:
            score_map = {'Vata': quiz.vata_score, 'Pitta': quiz.pitta_score, 'Kapha': quiz.kapha_score}
            dominant_score = score_map.get(dosha, 0) or 0
            pct = f"{round(dominant_score / total * 100)}% dominant"

    return jsonify({
        'success': True,
        'dosha': dosha,
        'description': descriptions.get(dosha, ''),
        'percentage': pct
    }), 200


# ════════════════════════════════════════
# DASHBOARD: GET REMEDIES (food recommendations)
# ════════════════════════════════════════
@app.route('/api/dashboard/remedies', methods=['GET'])
def dashboard_remedies():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False}), 401
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False}), 404

    # Find patient dosha
    patient = None
    if user.email:
        patient = Patient.query.filter_by(email=user.email).first()
    if not patient and user.phone:
        patient = Patient.query.filter_by(phone=user.phone).first()

    if not patient or not patient.dosha:
        return jsonify({'success': False, 'message': 'No dosha found'}), 404

    # Get remedy for this dosha
    remedy = Remedy.query.filter_by(body_type=patient.dosha).first()
    if not remedy:
        return jsonify({'success': False}), 404

    rec_foods = [f.strip() for f in (remedy.recommended_food or '').split(',') if f.strip()]
    pro_foods = [f.strip() for f in (remedy.prohibited_food or '').split(',') if f.strip()]

    return jsonify({
        'success': True,
        'recommended_foods': rec_foods,
        'prohibited_foods': pro_foods,
        'summary': remedy.summary
    }), 200


# ════════════════════════════════════════
# DASHBOARD: GET APPOINTMENTS (with call-ready flag)
# ════════════════════════════════════════
@app.route('/api/dashboard/appointments', methods=['GET'])
def dashboard_appointments():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False}), 401
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False}), 404

    # Find appointments by email or phone
    filters = []
    if user.email:
        filters.append(Appointment.email == user.email)
    if user.phone:
        filters.append(Appointment.phone == user.phone)
    if not filters:
        return jsonify([]), 200

    from sqlalchemy import or_
    appointments = Appointment.query.filter(or_(*filters)).order_by(Appointment.id.desc()).all()

    now = datetime.now()
    result = []
    for a in appointments:
        # Parse appointment datetime for call-ready check
        call_ready = False
        appt_datetime = None
        try:
            # Parse date like "24 Apr 2026"
            appt_date_obj = datetime.strptime(a.appt_date, '%d %b %Y')
            # Parse time like "10:00 AM" or "10:00AM" or "10:00"
            time_str = a.appt_time.strip().upper()
            
            # Try multiple time formats
            time_obj = None
            for fmt in ('%I:%M %p', '%I:%M%p', '%H:%M'):
                try:
                    time_obj = datetime.strptime(time_str, fmt)
                    break
                except ValueError:
                    continue
            
            if time_obj:
                appt_datetime = appt_date_obj.replace(
                    hour=time_obj.hour, minute=time_obj.minute
                )
                # Call is ready 5 minutes before until 60 min after
                diff_minutes = (appt_datetime - now).total_seconds() / 60
                if -60 <= diff_minutes <= 5:
                    call_ready = True
        except Exception as e:
            print(f"DEBUG: Error parsing appointment {a.id}: {e}")
            pass

        result.append({
            'id': a.id,
            'type': a.consult_mode or 'Consultation',
            'date': a.appt_date,
            'time': a.appt_time,
            'doctor': 'Dr. AyurSmart',
            'status': a.status,
            'utr_verified': a.status == 'Booked',
            'utr_number': a.payment[0].transaction_id if a.payment else '',
            'meeting_link': a.meeting_link,
            'call_ready': call_ready,
            'appt_datetime': appt_datetime.isoformat() if appt_datetime else None,
            'payment': a.payment[0].to_dict() if a.payment else None
        })

    return jsonify(result), 200


# ════════════════════════════════════════
# DASHBOARD: BOOK APPOINTMENT (from user dashboard)
# ════════════════════════════════════════
# GET BOOKED SLOTS
# ════════════════════════════════════════
@app.route('/api/appointments/booked-slots', methods=['GET'])
def get_booked_slots():
    doctor_id = request.args.get('doctor_id')
    if doctor_id:
        try:
            doctor_id = int(doctor_id)
        except ValueError:
            pass # keep as is if not a number, but filter will likely return nothing
    
    appt_date = request.args.get('date') # Format: YYYY-MM-DD
    
    if not doctor_id or not appt_date:
        return jsonify({'booked': [], 'date': appt_date}), 200

    try:
        # Convert YYYY-MM-DD to DD Mon YYYY for DB lookup
        d = datetime.strptime(appt_date, '%Y-%m-%d')
        formatted_date = d.strftime('%d %b %Y')
    except Exception:
        formatted_date = appt_date

    booked_appts = Appointment.query.filter(
        Appointment.doctor_id == doctor_id,
        Appointment.appt_date == formatted_date,
        Appointment.status != 'Cancelled'
    ).all()

    # Convert "I:M p" back to "H:M" for frontend logic
    booked_times = []
    for a in booked_appts:
        try:
            t = datetime.strptime(a.appt_time, '%I:%M %p')
            booked_times.append(t.strftime('%H:%M'))
        except Exception:
            booked_times.append(a.appt_time)

    return jsonify({
        'booked': booked_times,
        'date': appt_date
    }), 200


# ════════════════════════════════════════
@app.route('/api/appointments/book', methods=['POST'])
def dashboard_book_appointment():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'Not logged in.'}), 401
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found.'}), 404

    data = request.get_json()
    appt_date = data.get('date', '').strip()
    appt_time = data.get('time', '').strip()
    mode = data.get('mode', 'Offline').strip()
    doctor_id = data.get('doctor_id')
    utr_number = data.get('utr_number', '').strip()
    notes = data.get('notes', '').strip()

    if not appt_date or not appt_time:
        return jsonify({'success': False, 'error': 'Date and time required.'}), 400

    # Normalize appt_time to HH:MM
    try:
        if len(appt_time) > 5: # likely has seconds
            appt_time = datetime.strptime(appt_time, '%H:%M:%S').strftime('%H:%M')
        else:
            appt_time = datetime.strptime(appt_time, '%H:%M').strftime('%H:%M')
    except Exception:
        pass # keep as is if weird format

    # 1. Past Date Check
    try:
        selected_date = datetime.strptime(appt_date, '%Y-%m-%d').date()
        if selected_date < date.today():
            return jsonify({'success': False, 'error': 'Cannot book appointments for past dates'}), 400
    except Exception:
        pass

    # Format the date properly for DB
    try:
        d = datetime.strptime(appt_date, '%Y-%m-%d')
        formatted_date = d.strftime('%d %b %Y')
    except Exception:
        formatted_date = appt_date

    # 2. Past Time Check (if today)
    now = datetime.now()
    if selected_date == date.today():
        try:
            t_obj = datetime.strptime(appt_time, '%H:%M')
            selected_time = now.replace(hour=t_obj.hour, minute=t_obj.minute, second=0, microsecond=0)
            if selected_time < now:
                return jsonify({'success': False, 'error': 'This time slot has already passed'}), 400
        except Exception:
            pass

    # Format time to 12-hour for DB
    try:
        t = datetime.strptime(appt_time, '%H:%M')
        formatted_time = t.strftime('%I:%M %p')
    except Exception:
        formatted_time = appt_time

    # 3. Time slot validation (Allowed slots only)
    ALLOWED_SLOTS = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", 
                     "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"]
    if appt_time not in ALLOWED_SLOTS:
        return jsonify({'success': False, 'error': 'Invalid time slot selected'}), 400

    # 4. Slot already booked check
    if doctor_id:
        existing = Appointment.query.filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appt_date == formatted_date,
            Appointment.appt_time == formatted_time,
            Appointment.status != 'Cancelled'
        ).first()
        if existing:
            return jsonify({'success': False, 'error': 'This slot is already booked. Please choose another time'}), 400

    # Map mode
    consult_mode = 'Call Consultation' if mode == 'Call' else 'Offline Visit'

    # Generate meeting link for Call mode
    m_link = None
    if consult_mode == 'Call Consultation':
        # Phone check
        phone_to_use = data.get('phone', user.phone)
        if not phone_to_use:
            return jsonify({'success': False, 'error': 'Phone number is required for Call Consultation.'}), 400
        m_link = generate_meet_link()
    else:
        phone_to_use = user.phone or ''

    today = date.today().strftime('%d %b %Y')

    appt = Appointment(
        name=user.name,
        phone=phone_to_use,
        email=user.email or '',
        appt_date=formatted_date,
        appt_time=formatted_time,
        consult_mode=consult_mode,
        doctor_id=doctor_id,
        payment_method='UPI' if utr_number else 'Free',
        status='Pending Approval' if utr_number else 'Booked',
        booked_on=today,
        meeting_link=m_link
    )
    db.session.add(appt)
    db.session.flush()

    # Save payment record if UTR is provided
    if utr_number:
        pay_record = Payment(
            appointment_id=appt.id,
            transaction_id=utr_number,
            amount=50,
            payment_method='UPI'
        )
        db.session.add(pay_record)

    # Update patient last_visit
    patient = Patient.query.filter_by(email=user.email).first()
    if patient:
        patient.last_visit = today

    db.session.commit()
    return jsonify({
        'success': True,
        'message': 'Appointment booked!',
        'appointment': appt.to_dict()
    }), 201


# ════════════════════════════════════════
# DASHBOARD: HEALTH JOURNAL
# ════════════════════════════════════════
@app.route('/api/dashboard/journal', methods=['GET'])
def get_journal():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False}), 401
    entries = HealthJournal.query.filter_by(user_id=user_id).order_by(HealthJournal.id.desc()).limit(20).all()
    return jsonify([e.to_dict() for e in entries]), 200


@app.route('/api/dashboard/journal', methods=['POST'])
def add_journal():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False}), 401
    data = request.get_json()
    note = data.get('note', '').strip()
    if not note:
        return jsonify({'success': False, 'error': 'Note is empty'}), 400
    entry = HealthJournal(user_id=user_id, note=note)
    db.session.add(entry)
    db.session.commit()
    return jsonify({'success': True, 'entry': entry.to_dict()}), 201


# ════════════════════════════════════════
# DOCTORS LIST (single clinic — hardcoded)
# ════════════════════════════════════════
@app.route('/api/doctors', methods=['GET'])
def get_doctors():
    return jsonify([
        {'id': 1, 'name': 'Dr. AyurSmart', 'specialty': 'Ayurvedic Physician'}
    ]), 200


# ════════════════════════════════════════
# ADMIN ANALYTICS ROUTES
# ════════════════════════════════════════
@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    if not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    total_appts = Appointment.query.count()
    total_patients = Patient.query.count()
    pending = Appointment.query.filter_by(status='Pending Approval').count()
    confirmed = Appointment.query.filter_by(status='Booked').count()
    
    return jsonify({
        "total_appointments": total_appts,
        "total_patients": total_patients,
        "pending_appointments": pending,
        "confirmed_appointments": confirmed
    }), 200

@app.route('/api/admin/appointments-chart', methods=['GET'])
def admin_appointments_chart():
    if not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    labels = []
    counts = []
    now_dt = datetime.now()
    
    # Last 30 days
    for i in range(29, -1, -1):
        d = now_dt - timedelta(days=i)
        lbl = d.strftime('%d %b')
        # We store appt_date in YYYY-MM-DD format usually, 
        # but let's check for both YYYY-MM-DD and DD Mon YYYY
        fmt1 = d.strftime('%Y-%m-%d')
        fmt2 = d.strftime('%d %b %Y')
        
        count = Appointment.query.filter((Appointment.appt_date == fmt1) | (Appointment.appt_date == fmt2)).count()
        labels.append(lbl)
        counts.append(count)
        
    return jsonify({"labels": labels, "counts": counts}), 200

@app.route('/api/admin/patients-chart', methods=['GET'])
def admin_patients_chart():
    if not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    labels = []
    counts = []
    now_dt = datetime.now()
    
    # Last 30 days cumulative
    for i in range(29, -1, -1):
        d = now_dt - timedelta(days=i)
        lbl = d.strftime('%d %b')
        
        # End of this day (next day start)
        end_of_day = (d + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            
        # Count patients joined before or during this day
        count = Patient.query.filter(Patient.joined < end_of_day).count()
        
        labels.append(lbl)
        counts.append(count)
        
    return jsonify({"labels": labels, "counts": counts}), 200


def run_migrations():
    """Ensure DB schema is up to date."""
    with app.app_context():
        # Check if 'joined' column exists in patient table
        try:
            result = db.session.execute(db.text("SHOW COLUMNS FROM patient LIKE 'joined'")).fetchone()
            if not result:
                print("Migration: Adding 'joined' column to patient table...")
                db.session.execute(db.text("ALTER TABLE patient ADD COLUMN joined DATETIME DEFAULT CURRENT_TIMESTAMP"))
                db.session.commit()
                print("Migration: Success!")
        except Exception as e:
            print(f"Migration error: {e}")

if __name__ == '__main__':
    # Ensure tables and initial data are ready
    with app.app_context():
        db.create_all()
        seed_remedies()
        run_migrations() # Add our migration helper
    app.run(debug=True, port=5100, host='0.0.0.0')
