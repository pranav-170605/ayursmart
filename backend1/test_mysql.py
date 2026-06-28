import pymysql

conn = pymysql.connect(host='localhost', user='root', password='', db='ayursmart')

try:
    with conn.cursor() as cursor:
        cursor.execute("SELECT VERSION()")
        version = cursor.fetchone()
        print("MySQL version:", version)
finally:
    conn.close()