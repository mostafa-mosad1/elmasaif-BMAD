import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12; // 12 bytes recommended for GCM

  constructor(private readonly configService: ConfigService) {}

  private getKey(): Buffer {
    const rawKey =
      this.configService.get<string>('PAYOUT_ENCRYPTION_KEY') ||
      this.configService.get<string>('SESSION_SECRET') ||
      'elmasaif-dev-default-encryption-secret-key-32b';
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext string using AES-256-GCM.
   * Returns format: iv:authTag:ciphertext (all in hex).
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const key = this.getKey();
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts iv:authTag:ciphertext string using AES-256-GCM.
   * Validates integrity via GCM authTag. Throws if corrupted/tampered.
   */
  decrypt(cipherString: string): string {
    if (!cipherString) {
      throw new Error('Invalid encrypted data format');
    }

    const parts = cipherString.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = this.getKey();

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

