import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits for GCM

// ENCRYPTION_KEY must be a 32-byte hex string or exactly 32 chars
function getEncryptionKey(): Buffer {
  const keyStr = process.env.ENCRYPTION_KEY;
  if (!keyStr) {
    throw new Error('ENCRYPTION_KEY environment variable is not set.');
  }
  
  const key = Buffer.from(keyStr, 'utf-8');
  if (key.length !== KEY_LENGTH) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes long.');
  }
  
  return key;
}

export function encrypt(text: string): { encryptedText: string; iv: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // We return the iv so it can be saved in the database
  // We append the authTag to the encrypted text (format: authTag:encryptedText)
  // because GCM needs the authTag for decryption
  return {
    encryptedText: `${authTag}:${encrypted}`,
    iv: iv.toString('hex')
  };
}

export function decrypt(encryptedData: string, ivHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  
  const parts = encryptedData.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format. Expected authTag:encryptedText');
  }
  
  const authTag = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
