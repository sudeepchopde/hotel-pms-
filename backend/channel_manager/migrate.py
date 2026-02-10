"""
Database Migration: Add Channel Manager Tables

This migration adds the following tables:
- sync_history: Tracks all sync operations to OTA channels
- channel_credentials: Stores API credentials for OTA connections
- room_type_mappings: Maps internal room types to OTA-specific codes

Run this script to add the new tables to your database.
"""
import os
import sys

# Add parent directory to path for imports
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

# Load environment variables from .env.local
try:
    from dotenv import load_dotenv
    env_file = os.path.join(project_root, '.env.local')
    if os.path.exists(env_file):
        load_dotenv(env_file)
        print(f"📄 Loaded environment from {env_file}")
    else:
        # Try .env as fallback
        env_file = os.path.join(project_root, '.env')
        if os.path.exists(env_file):
            load_dotenv(env_file)
            print(f"📄 Loaded environment from {env_file}")
except ImportError:
    print("⚠️ python-dotenv not installed, using system environment variables")


def get_db_url():
    """Get database URL from environment"""
    return (
        os.environ.get("DATABASE_URL") or 
        os.environ.get("POSTGRES_URL") or 
        os.environ.get("NEON_DATABASE_URL")
    )


def run_migration():
    """Run the migration to add channel manager tables"""
    import psycopg2
    
    db_url = get_db_url()
    if not db_url:
        print("❌ No database URL found. Set DATABASE_URL environment variable.")
        return False
    
    print(f"🔗 Connecting to database...")
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # ====================================================================
        # 1. Create sync_history table
        # ====================================================================
        print("📊 Creating sync_history table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sync_history (
                id SERIAL PRIMARY KEY,
                channel_id VARCHAR(50) NOT NULL,
                sync_type VARCHAR(50) NOT NULL,
                room_type_id VARCHAR(100),
                date_range_start VARCHAR(20),
                date_range_end VARCHAR(20),
                status VARCHAR(50) NOT NULL,
                message TEXT,
                error_code VARCHAR(50),
                retry_count INTEGER DEFAULT 0,
                request_payload JSONB,
                response_payload TEXT,
                created_at VARCHAR(50) NOT NULL,
                completed_at VARCHAR(50)
            );
        """)
        
        # Add index for faster queries
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_sync_history_channel 
            ON sync_history(channel_id);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_sync_history_status 
            ON sync_history(status);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_sync_history_created 
            ON sync_history(created_at DESC);
        """)
        print("   ✅ sync_history table created")
        
        # ====================================================================
        # 2. Create channel_credentials table
        # ====================================================================
        print("🔐 Creating channel_credentials table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS channel_credentials (
                id SERIAL PRIMARY KEY,
                channel_id VARCHAR(50) UNIQUE NOT NULL,
                hotel_id VARCHAR(100) NOT NULL,
                api_key VARCHAR(500) NOT NULL,
                api_secret VARCHAR(500),
                username VARCHAR(100),
                password VARCHAR(500),
                environment VARCHAR(20) DEFAULT 'sandbox',
                endpoint_url VARCHAR(500),
                is_active BOOLEAN DEFAULT TRUE,
                created_at VARCHAR(50),
                updated_at VARCHAR(50)
            );
        """)
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_channel_credentials_active 
            ON channel_credentials(is_active);
        """)
        print("   ✅ channel_credentials table created")
        
        # ====================================================================
        # 3. Create room_type_mappings table
        # ====================================================================
        print("🏨 Creating room_type_mappings table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS room_type_mappings (
                id SERIAL PRIMARY KEY,
                internal_room_type_id VARCHAR(100) NOT NULL,
                internal_name VARCHAR(200) NOT NULL,
                mmt_code VARCHAR(100),
                booking_com_code VARCHAR(100),
                expedia_code VARCHAR(100),
                goibibo_code VARCHAR(100),
                agoda_code VARCHAR(100),
                created_at VARCHAR(50),
                updated_at VARCHAR(50)
            );
        """)
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_room_mappings_internal 
            ON room_type_mappings(internal_room_type_id);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_room_mappings_mmt 
            ON room_type_mappings(mmt_code);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_room_mappings_bcom 
            ON room_type_mappings(booking_com_code);
        """)
        print("   ✅ room_type_mappings table created")
        
        # ====================================================================
        # 4. Add external_reference_id to bookings if not exists
        # ====================================================================
        print("📝 Checking bookings table for external_reference_id column...")
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'external_reference_id';
        """)
        if cur.fetchone() is None:
            cur.execute("""
                ALTER TABLE bookings 
                ADD COLUMN external_reference_id VARCHAR(200);
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_bookings_external_ref 
                ON bookings(external_reference_id);
            """)
            print("   ✅ Added external_reference_id to bookings")
        else:
            print("   ℹ️ external_reference_id already exists")
        
        # Commit all changes
        conn.commit()
        cur.close()
        conn.close()
        
        print("\n" + "=" * 60)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Configure OTA credentials via API or Settings page")
        print("2. Set up room type mappings for each connected OTA")
        print("3. Test connection using /api/channels/test-connection/{channel_id}")
        print("4. Register webhook URLs with OTAs:")
        print("   - MMT: /api/channels/webhooks/mmt/booking")
        print("   - Booking.com: /api/channels/webhooks/booking/booking")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("   CHANNEL MANAGER DATABASE MIGRATION")
    print("=" * 60 + "\n")
    
    success = run_migration()
    sys.exit(0 if success else 1)
