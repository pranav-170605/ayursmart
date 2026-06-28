import pymysql

conn = pymysql.connect(host='localhost', user='root', password='', db='ayursmart')
cur = conn.cursor()

print("=== AyurSmart Appointment Table Migration ===")

# Check if doctor_id exists
cur.execute("SHOW COLUMNS FROM appointment LIKE 'doctor_id'")
if not cur.fetchone():
    print("[+] Adding 'doctor_id' column to appointment...")
    cur.execute("ALTER TABLE appointment ADD COLUMN doctor_id INT NULL")
    print("    Done!")
else:
    print("[=] 'doctor_id' column already exists in appointment")

conn.commit()
conn.close()
print("Migration complete!")
