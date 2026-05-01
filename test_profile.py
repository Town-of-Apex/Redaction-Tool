import sqlite3
try:
    conn = sqlite3.connect('profiles.db')
    print("DB OK")
except Exception as e:
    print(e)
