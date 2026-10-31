import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../crypto.service';

describe('CryptoService (AES-256-GCM Encryption at Rest) (AC: 2)', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'PAYOUT_ENCRYPTION_KEY') return 'test-payout-secret-key-32chars!!';
              if (key === 'SESSION_SECRET') return 'test-session-secret';
              return defaultValue;
            })
          }
        }
      ]
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt plaintext into iv:authTag:ciphertext format', () => {
    const plaintext = 'SA0380000000608010167519';
    const encrypted = service.encrypt(plaintext);

    expect(encrypted).toBeDefined();
    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);

    const [ivHex, authTagHex, cipherHex] = parts;
    // 12 bytes IV = 24 hex characters
    expect(ivHex.length).toBe(24);
    // 16 bytes GCM auth tag = 32 hex characters
    expect(authTagHex.length).toBe(32);
    expect(cipherHex.length).toBeGreaterThan(0);
  });

  it('should successfully decrypt back to original plaintext', () => {
    const original = 'SA0380000000608010167519';
    const encrypted = service.encrypt(original);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(original);
  });

  it('should generate distinct ciphertexts for identical plaintext due to random IVs', () => {
    const original = 'SA0380000000608010167519';
    const encrypted1 = service.encrypt(original);
    const encrypted2 = service.encrypt(original);

    expect(encrypted1).not.toBe(encrypted2);
    expect(service.decrypt(encrypted1)).toBe(original);
    expect(service.decrypt(encrypted2)).toBe(original);
  });

  it('should throw an error when ciphertext is tampered with', () => {
    const original = 'SA0380000000608010167519';
    const encrypted = service.encrypt(original);
    const parts = encrypted.split(':');

    // Tamper with ciphertext by flipping characters
    const tamperedCipher = parts[2].substring(0, parts[2].length - 2) + (parts[2].endsWith('a') ? 'b' : 'a');
    const tampered = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('should throw an error when auth tag is tampered with', () => {
    const original = 'SA0380000000608010167519';
    const encrypted = service.encrypt(original);
    const parts = encrypted.split(':');

    const tamperedAuthTag = '00' + parts[1].substring(2);
    const tampered = `${parts[0]}:${tamperedAuthTag}:${parts[2]}`;

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('should throw an error for malformed cipher string', () => {
    expect(() => service.decrypt('invalid-cipher-string')).toThrow('Invalid encrypted data format');
    expect(() => service.decrypt('only:two:parts:here:extra')).toThrow('Invalid encrypted data format');
  });
});

