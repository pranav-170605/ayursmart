from app import app, db
from sqlalchemy import text

with app.app_context():
    try:
        db.session.execute(text("ALTER TABLE user ADD COLUMN security_question VARCHAR(200) NULL"))
        db.session.execute(text("ALTER TABLE user ADD COLUMN security_answer VARCHAR(200) NULL"))
        db.session.commit()
        print("Security columns added successfully.")
    except Exception as e:
        print(f"Error: {e}")
        db.session.rollback()
