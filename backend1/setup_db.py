import pymysql

# Connection details
host = 'localhost'
user = 'root'
password = ''
db_name = 'ayursmart'

try:
    # Connect to MySQL (without specifying DB)
    connection = pymysql.connect(host=host, user=user, password=password)
    
    with connection.cursor() as cursor:
        # Create database if it doesn't exist
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        print(f"Database '{db_name}' checked/created successfully.")
        
    connection.close()
except Exception as e:
    print(f"Error creating database: {e}")
