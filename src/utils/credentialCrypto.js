import crypto from 'crypto';
import config from '../config/environment.js';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const keyHex = config.security.configEncryptionKey;
  if (!keyHex) {
    throw new Error('CONFIG_ENCRYPTION_KEY is not set - cannot encrypt/decrypt stored credentials');
  }

  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('CONFIG_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }

  return key;
}

// Encrypts a plaintext string into an { iv, authTag, data } blob suitable for JSON
// storage. Returns null for empty input so "no password set" round-trips cleanly.
export function encrypt(plaintext) {
  if (!plaintext) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted.toString('hex'),
  };
}

export function decrypt(blob) {
  if (!blob) return '';

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(blob.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(blob.data, 'hex')), decipher.final()]);

  return decrypted.toString('utf8');
}
