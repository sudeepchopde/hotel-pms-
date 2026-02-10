"""
Database Migration: Add Payment Gateway Tables

This migration adds the following tables:
- payment_settings: Stores payment gateway configuration
- payment_logs: Audit trail for payment events

Also adds payment-related columns to bookings table.

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
    """Run the migration to add payment gateway tables"""
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
        # 1. Create payment_settings table
        # ====================================================================
        print("💳 Creating payment_settings table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS payment_settings (
                id SERIAL PRIMARY KEY,
                gateway_type VARCHAR(50) NOT NULL DEFAULT 'none',
                merchant_id VARCHAR(200),
                api_key VARCHAR(500),
                api_secret VARCHAR(500),
                webhook_secret VARCHAR(500),
                environment VARCHAR(20) DEFAULT 'sandbox',
                is_active BOOLEAN DEFAULT TRUE,
                created_at VARCHAR(50),
                updated_at VARCHAR(50)
            );
        """)
        print("   ✅ payment_settings table created")
        
        # ====================================================================
        # 2. Create payment_logs table
        # ====================================================================
        print("📋 Creating payment_logs table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS payment_logs (
                id SERIAL PRIMARY KEY,
                booking_id VARCHAR(100),
                event_type VARCHAR(50) NOT NULL,
                transaction_id VARCHAR(200),
                status VARCHAR(50),
                amount DECIMAL(10, 2),
                message TEXT,
                raw_data JSONB,
                created_at VARCHAR(50) NOT NULL
            );
        """)
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_payment_logs_booking 
            ON payment_logs(booking_id);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_payment_logs_txn 
            ON payment_logs(transaction_id);
        """)
        print("   ✅ payment_logs table created")
        
        # ====================================================================
        # 3. Add payment columns to bookings table if not exist
        # ====================================================================
        print("📝 Checking bookings table for payment columns...")
        
        # Check and add payment_status
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'payment_status';
        """)
        if cur.fetchone() is None:
            cur.execute("""
                ALTER TABLE bookings 
                ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
            """)
            print("   ✅ Added payment_status to bookings")
        else:
            print("   ℹ️ payment_status already exists")
        
        # Check and add payment_transaction_id
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'payment_transaction_id';
        """)
        if cur.fetchone() is None:
            cur.execute("""
                ALTER TABLE bookings 
                ADD COLUMN payment_transaction_id VARCHAR(200);
            """)
            print("   ✅ Added payment_transaction_id to bookings")
        else:
            print("   ℹ️ payment_transaction_id already exists")
        
        # Check and add payment_gateway
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'payment_gateway';
        """)
        if cur.fetchone() is None:
            cur.execute("""
                ALTER TABLE bookings 
                ADD COLUMN payment_gateway VARCHAR(50);
            """)
            print("   ✅ Added payment_gateway to bookings")
        else:
            print("   ℹ️ payment_gateway already exists")
        
        # Check and add payment_amount
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'payment_amount';
        """)
        if cur.fetchone() is None:
            cur.execute("""
                ALTER TABLE bookings 
                ADD COLUMN payment_amount DECIMAL(10, 2);
            """)
            print("   ✅ Added payment_amount to bookings")
        else:
            print("   ℹ️ payment_amount already exists")
        
        # Commit all changes
        conn.commit()
        cur.close()
        conn.close()
        
        print("\n" + "=" * 60)
        print("✅ PAYMENT GATEWAY MIGRATION COMPLETED!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Go to Settings → Payments in your PMS")
        print("2. Select Easebuzz or Razorpay")
        print("3. Enter your API credentials")
        print("4. Test with sandbox environment first")
        print("5. Register webhook URLs:")
        print("   - Easebuzz: /api/payments/webhooks/easebuzz")
        print("   - Razorpay: /api/payments/webhooks/razorpay")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("   PAYMENT GATEWAY DATABASE MIGRATION")
    print("=" * 60 + "\n")
    
    success = run_migration()
    sys.exit(0 if success else 1)
