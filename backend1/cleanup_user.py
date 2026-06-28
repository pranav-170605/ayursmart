import sys
from app import app, db, User, Patient, Appointment

def cleanup_user(email):
    with app.app_context():
        email = email.strip()
        print(f"Attempting to delete all records for: {email}")
        
        # 1. Delete from Appointment
        appointments = Appointment.query.filter_by(email=email).all()
        for appt in appointments:
            db.session.delete(appt)
        print(f"Deleted {len(appointments)} appointments.")

        # 2. Delete from Patient
        patients = Patient.query.filter_by(email=email).all()
        for p in patients:
            db.session.delete(p)
        print(f"Deleted {len(patients)} patient records.")

        # 3. Delete from User
        user = User.query.filter_by(email=email).first()
        if user:
            db.session.delete(user)
            print(f"Deleted user account: {user.username}")
        else:
            print("No record found in 'User' table.")

        db.session.commit()
        print("Cleanup successful.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cleanup_user(sys.argv[1])
    else:
        email = input("Enter the email to delete: ")
        cleanup_user(email)
