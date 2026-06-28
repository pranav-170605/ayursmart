from app import app, db, Appointment
with app.app_context():
    print("Columns:", [c.name for c in Appointment.__table__.columns])
