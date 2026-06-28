"""
Migration script to fix database schema issues:
1. Add user_id column to prakriti_quiz_result table
2. Fix patient.dosha column size from varchar(10) to varchar(20)
3. Fix prakriti_quiz_result.quiz_date from date to datetime
"""
import pymysql

conn = pymysql.connect(host='localhost', user='root', password='', db='ayursmart')
cur = conn.cursor()

print("=== AyurSmart Database Migration ===")
print()

# 1. Check and add user_id to prakriti_quiz_result
cur.execute("SHOW COLUMNS FROM prakriti_quiz_result LIKE 'user_id'")
if not cur.fetchone():
    print("[+] Adding 'user_id' column to prakriti_quiz_result...")
    cur.execute("ALTER TABLE prakriti_quiz_result ADD COLUMN user_id INT NULL AFTER quiz_id")
    print("    Done!")
else:
    print("[=] 'user_id' column already exists in prakriti_quiz_result")

# 2. Fix patient.dosha column size
cur.execute("SHOW COLUMNS FROM patient LIKE 'dosha'")
col = cur.fetchone()
if col:
    current_type = col[1]
    if 'varchar(10)' in current_type:
        print("[+] Expanding patient.dosha from varchar(10) to varchar(20)...")
        cur.execute("ALTER TABLE patient MODIFY COLUMN dosha VARCHAR(20)")
        print("    Done!")
    else:
        print("[=] patient.dosha is already %s" % current_type)
else:
    print("[!] patient.dosha column not found - adding it...")
    cur.execute("ALTER TABLE patient ADD COLUMN dosha VARCHAR(20)")
    print("    Done!")

# 3. Fix quiz_date column type
cur.execute("SHOW COLUMNS FROM prakriti_quiz_result LIKE 'quiz_date'")
col = cur.fetchone()
if col:
    current_type = col[1]
    if 'datetime' not in current_type:
        print("[+] Changing prakriti_quiz_result.quiz_date from %s to DATETIME..." % current_type)
        cur.execute("ALTER TABLE prakriti_quiz_result MODIFY COLUMN quiz_date DATETIME DEFAULT CURRENT_TIMESTAMP")
        print("    Done!")
    else:
        print("[=] prakriti_quiz_result.quiz_date is already %s" % current_type)

conn.commit()

# Verify final state
print()
print("=== Verification ===")
cur.execute("SHOW COLUMNS FROM prakriti_quiz_result")
print()
print("prakriti_quiz_result columns:")
for r in cur.fetchall():
    print("  %s: %s" % (r[0], r[1]))

cur.execute("SHOW COLUMNS FROM patient")
print()
print("patient columns:")
for r in cur.fetchall():
    print("  %s: %s" % (r[0], r[1]))

conn.close()
print()
print("Migration complete!")
