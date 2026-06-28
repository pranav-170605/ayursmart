from app import app, db, User

def list_users():
    with app.app_context():
        users = User.query.all()
        if not users:
            print("The User table is empty.")
            return
            
        print(f"{'ID':<5} | {'Username':<20} | {'Email':<30}")
        print("-" * 60)
        for u in users:
            print(f"{u.id:<5} | {u.username:<20} | {u.email:<30}")

if __name__ == "__main__":
    list_users()
