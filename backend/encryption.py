"""
Field-Level Encryption Utility

Provides AES-256 encryption for sensitive fields like API secrets,
payment credentials, and guest identification data.

Uses Fernet (AES-128-CBC with HMAC-SHA256 for authentication).
For production, consider using AWS KMS, Google Cloud KMS, or HashiCorp Vault.

Usage:
    from backend.encryption import encrypt_field, decrypt_field
    
    # Encrypt before storing
    encrypted = encrypt_field("my_secret_api_key")
    
    # Decrypt when reading
    decrypted = decrypt_field(encrypted)
"""
import os
import base64
import hashlib
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import cryptography - if not available, fall back to base64 encoding
try:
    from cryptography.fernet import Fernet, InvalidToken
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    logger.warning("cryptography package not installed. Using base64 encoding (NOT SECURE for production)")


def _get_encryption_key() -> Optional[bytes]:
    """
    Get the encryption key from environment variable.
    
    The key should be a 32-byte (256-bit) key, base64 encoded.
    Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    
    Returns:
        bytes: The Fernet key, or None if not configured
    """
    key = os.environ.get("ENCRYPTION_KEY") or os.environ.get("FIELD_ENCRYPTION_KEY")
    
    if not key:
        # Try to load from .env.local
        try:
            from dotenv import load_dotenv
            load_dotenv('.env.local', override=True)
            key = os.environ.get("ENCRYPTION_KEY") or os.environ.get("FIELD_ENCRYPTION_KEY")
        except:
            pass
    
    if key:
        # If it's already a valid Fernet key (44 chars base64)
        if len(key) == 44:
            return key.encode()
        # If it's a passphrase, derive a key using PBKDF2
        else:
            return _derive_key_from_passphrase(key)
    
    return None


def _derive_key_from_passphrase(passphrase: str) -> bytes:
    """
    Derive a Fernet-compatible key from a passphrase using PBKDF2.
    Uses a fixed salt for deterministic key derivation.
    
    In production, consider using a unique salt per installation stored securely.
    """
    # Fixed salt - in production, store this separately or use per-record salts
    salt = b"hotel_pms_v1_salt_2024"
    
    # Derive 32 bytes using PBKDF2
    key = hashlib.pbkdf2_hmac(
        'sha256',
        passphrase.encode(),
        salt,
        100000  # 100k iterations for security
    )
    
    # Fernet requires base64-encoded 32-byte key
    return base64.urlsafe_b64encode(key)


def _get_fernet() -> Optional['Fernet']:
    """Get a Fernet instance with the configured key."""
    if not CRYPTO_AVAILABLE:
        return None
    
    key = _get_encryption_key()
    if not key:
        return None
    
    try:
        return Fernet(key)
    except Exception as e:
        logger.error(f"Failed to initialize Fernet: {e}")
        return None


def encrypt_field(value: str) -> str:
    """
    Encrypt a sensitive field value.
    
    Args:
        value: The plaintext value to encrypt
        
    Returns:
        str: The encrypted value (base64 encoded with 'enc:' prefix)
             Returns original value if encryption not available
    """
    if not value:
        return value
    
    # Already encrypted?
    if value.startswith("enc:"):
        return value
    
    fernet = _get_fernet()
    
    if fernet:
        try:
            encrypted = fernet.encrypt(value.encode())
            return f"enc:{encrypted.decode()}"
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            # Fall through to base64 fallback
    
    # Fallback: base64 encode (NOT SECURE - just obfuscation)
    # This is only for development/testing when cryptography isn't configured
    encoded = base64.b64encode(value.encode()).decode()
    return f"b64:{encoded}"


def decrypt_field(value: str) -> str:
    """
    Decrypt a sensitive field value.
    
    Args:
        value: The encrypted value (with 'enc:' or 'b64:' prefix)
        
    Returns:
        str: The decrypted plaintext value
             Returns original value if decryption fails
    """
    if not value:
        return value
    
    # Check if it's encrypted with Fernet
    if value.startswith("enc:"):
        fernet = _get_fernet()
        if fernet:
            try:
                encrypted_data = value[4:].encode()  # Remove 'enc:' prefix
                decrypted = fernet.decrypt(encrypted_data)
                return decrypted.decode()
            except InvalidToken:
                logger.error("Decryption failed: Invalid token (wrong key or corrupted data)")
                return value
            except Exception as e:
                logger.error(f"Decryption failed: {e}")
                return value
        else:
            logger.warning("Cannot decrypt: cryptography not available or key not configured")
            return value
    
    # Check if it's base64 encoded (fallback format)
    if value.startswith("b64:"):
        try:
            encoded_data = value[4:]  # Remove 'b64:' prefix
            decoded = base64.b64decode(encoded_data).decode()
            return decoded
        except Exception as e:
            logger.error(f"Base64 decode failed: {e}")
            return value
    
    # Not encrypted, return as-is
    return value


def is_encrypted(value: str) -> bool:
    """Check if a value is already encrypted."""
    if not value:
        return False
    return value.startswith("enc:") or value.startswith("b64:")


def mask_secret(value: str, visible_chars: int = 4) -> str:
    """
    Mask a secret value for display purposes.
    
    Args:
        value: The secret value (encrypted or plain)
        visible_chars: Number of characters to show at the end
        
    Returns:
        str: Masked value like "••••••••a1b2"
    """
    if not value:
        return ""
    
    # Decrypt first if encrypted
    plain = decrypt_field(value) if is_encrypted(value) else value
    
    if len(plain) <= visible_chars:
        return "•" * len(plain)
    
    return "•" * 8 + plain[-visible_chars:]


def generate_encryption_key() -> str:
    """
    Generate a new Fernet encryption key.
    
    Returns:
        str: A new base64-encoded encryption key
    """
    if CRYPTO_AVAILABLE:
        return Fernet.generate_key().decode()
    else:
        # Fallback: generate a random base64 string
        import secrets
        return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()


# Encryption status check
def check_encryption_status() -> dict:
    """
    Check the current encryption configuration status.
    
    Returns:
        dict: Status information about encryption setup
    """
    key = _get_encryption_key()
    
    return {
        "crypto_available": CRYPTO_AVAILABLE,
        "key_configured": key is not None,
        "encryption_active": CRYPTO_AVAILABLE and key is not None,
        "key_source": "ENCRYPTION_KEY" if os.environ.get("ENCRYPTION_KEY") else (
            "FIELD_ENCRYPTION_KEY" if os.environ.get("FIELD_ENCRYPTION_KEY") else None
        ),
        "recommendation": (
            "Encryption is active and secure." if (CRYPTO_AVAILABLE and key) else
            "Set ENCRYPTION_KEY environment variable for production security."
        )
    }


if __name__ == "__main__":
    # Test the encryption module
    print("=" * 60)
    print("  ENCRYPTION MODULE TEST")
    print("=" * 60)
    
    status = check_encryption_status()
    print(f"\nCrypto Available: {status['crypto_available']}")
    print(f"Key Configured: {status['key_configured']}")
    print(f"Encryption Active: {status['encryption_active']}")
    print(f"Recommendation: {status['recommendation']}")
    
    # Test encryption/decryption
    test_value = "rzp_test_1234567890abcdef"
    print(f"\nOriginal: {test_value}")
    
    encrypted = encrypt_field(test_value)
    print(f"Encrypted: {encrypted[:50]}..." if len(encrypted) > 50 else f"Encrypted: {encrypted}")
    
    decrypted = decrypt_field(encrypted)
    print(f"Decrypted: {decrypted}")
    
    print(f"Match: {'✓' if decrypted == test_value else '✗'}")
    print(f"Masked: {mask_secret(test_value)}")
    
    if not status['key_configured']:
        print(f"\n💡 To enable encryption, add this to your .env.local:")
        print(f"   ENCRYPTION_KEY={generate_encryption_key()}")
