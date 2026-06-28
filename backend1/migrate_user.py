from app import app, db
from sqlalchemy import text

with app.app_context():
    try:
        db.session.execute(text("ALTER TABLE user ADD COLUMN reset_token VARCHAR(100) NULL"))
        db.session.execute(text("ALTER TABLE user ADD COLUMN reset_token_expiry DATETIME NULL"))
        db.session.commit()
        print("Columns added successfully.")
    except Exception as e:
        print(f"Error: {e}")
        db.session.rollback()
