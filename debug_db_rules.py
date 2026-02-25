
import sqlite3
import json
import os

db_path = 'pms.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    print(f"Tables found: {tables}")
    
    if 'rate_rules' in tables:
        cursor.execute("SELECT * FROM rate_rules")
        rows = cursor.fetchall()
        print(f"Number of rows in rate_rules: {len(rows)}")
        for i, row in enumerate(rows):
            print(f"Row {i}: {row}")
    else:
        print("Table 'rate_rules' DOES NOT EXIST in this database!")
    
    conn.close()
else:
    print(f"Database file '{db_path}' not found at {os.getcwd()}")
