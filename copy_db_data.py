import os
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker

render_url = 'postgresql://hotel_sathi_postgres_user:4MOEJq57GRgBEu5g80aNBNJ5D0w1dafk@dpg-d6c5knemcj7s73afrlpg-a.oregon-postgres.render.com/hotel_sathi_postgres'
supabase_url = 'postgresql://postgres.cpudidmdzrnsecxuhqcr:kytzDa2Zmxp3rfmR@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'

print("Connecting to Render Data Source...")
render_engine = create_engine(render_url)

print("Connecting to Supabase Destination...")
supabase_engine = create_engine(supabase_url)

metadata = MetaData()
metadata.reflect(bind=render_engine)

# To avoid foreign key constraint errors during insert, we will disable triggers or delete all first (in correct order), or just do sorted insertions
with supabase_engine.begin() as conn:
    print("Clearing existing data in Supabase if any to prevent conflicts...")
    # Be careful with the order; truncate cascade is easier on Postgres
    for table in reversed(metadata.sorted_tables):
        try:
            conn.execute(table.delete())
        except Exception as e:
            print(f"Delete error: {e}")

with render_engine.connect() as source_conn:
    with supabase_engine.begin() as dest_conn: # inside a transaction
        print("Copying tables...")
        for table in metadata.sorted_tables:
            print(f"Reading {table.name}...")
            # Note: Fetch all rows from Render
            result = source_conn.execute(table.select()).fetchall()
            if result:
                print(f"  Copying {len(result)} rows to {table.name} in Supabase...")
                # execute doesn't like bulk insert of raw rows directly sometimes, need dictionaries
                records = [dict(zip(result[0]._mapping.keys(), row)) for row in result]
                dest_conn.execute(table.insert(), records)
                print(f"  Done copying {table.name}.")
            else:
                print(f"  {table.name} is empty, skipping.")

print("Migration fully completed! Supabase now seamlessly mirrors Render's database.")
