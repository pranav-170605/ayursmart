from app import app, db
from sqlalchemy import inspect

with app.app_context():
    inspector = inspect(db.engine)
    columns = inspector.get_columns('remedy')
    for column in columns:
        print(f"Column: {column['name']}, Type: {column['type']}")
