from app import app, Remedy
with app.app_context():
    remedies = Remedy.query.all()
    if not remedies:
        print("No remedies found in the database.")
    for r in remedies:
        print(f"ID: {r.remedy_id}, Type: {r.body_type}")
        print(f"Recommended: {r.recommended_food[:50]}...")
        print(f"Prohibited: {r.prohibited_food[:50]}...")
        print("-" * 20)
