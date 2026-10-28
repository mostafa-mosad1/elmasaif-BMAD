import { Injectable, Logger } from '@nestjs/common';
import { ScanEngineResult } from '@elmasaif/shared';
import { IMalwareScannerEngine } from '../scanner-engine.interface';

const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

@Injectable()
export class MockMalwareScannerEngine implements IMalwareScannerEngine {
  readonly engineName = 'MockMalwareScanner';
  private readonly logger = new Logger(MockMalwareScannerEngine.name);

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async scanBuffer(buffer: Buffer, filename: string): Promise<ScanEngineResult> {
    const lowerFilename = filename.toLowerCase();

    // 1. Deterministic failure filename for simulating engine downtime / failures
    if (lowerFilename.includes('scanner-fail')) {
      this.logger.warn(`Simulating scanner failure for test filename: ${filename}`);
      throw new Error(`Scanner simulated failure for test filename: ${filename}`);
    }

    // 2. Deterministic zero-byte check
    if (!buffer || buffer.length === 0) {
      return {
        isClean: false,
        isInfected: true,
        threatName: 'Corrupted.ZeroByte',
        engineName: this.engineName,
        details: { reason: 'Payload length is zero bytes' },
      };
    }

    // 3. Deterministic filenames
    if (lowerFilename.includes('eicar')) {
      return {
        isClean: false,
        isInfected: true,
        threatName: 'EICAR-Test-Signature',
        engineName: this.engineName,
        details: { matchedOn: 'deterministic-filename' },
      };
    }

    if (lowerFilename.includes('malware-test')) {
      return {
        isClean: false,
        isInfected: true,
        threatName: 'Malware.Test.Signature',
        engineName: this.engineName,
        details: { matchedOn: 'deterministic-filename' },
      };
    }

    if (lowerFilename.includes('corrupt')) {
      return {
        isClean: false,
        isInfected: true,
        threatName: 'Corrupted.Payload',
        engineName: this.engineName,
        details: { matchedOn: 'deterministic-filename' },
      };
    }

    // 4. Inspection for EICAR signature in buffer
    const bufferString = buffer.toString('utf-8', 0, Math.min(buffer.length, 4096));
    if (bufferString.includes(EICAR_SIGNATURE)) {
      return {
        isClean: false,
        isInfected: true,
        threatName: 'EICAR-Test-Signature',
        engineName: this.engineName,
        details: { signature: 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE' },
      };
    }

    // 5. Inspect magic bytes for Windows PE executable (MZ: 0x4D, 0x5A)
    if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
      return {
        isClean: false,
        isInfected: true,
        threatName: 'Disguised.Executable.PE',
        engineName: this.engineName,
        details: { magicBytes: 'MZ (4D 5A)' },
      };
    }

    // 6. Inspect magic bytes for Linux ELF executable (\x7fELF: 0x7F, 0x45, 0x4C, 0x46)
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x7f &&
      buffer[1] === 0x45 &&
      buffer[2] === 0x4c &&
      buffer[3] === 0x46
    ) {
      return {
        isClean: false,
        isInfected: true,
        threatName: 'Disguised.Executable.ELF',
        engineName: this.engineName,
        details: { magicBytes: '\\x7fELF' },
      };
    }

    // 7. Inspect script headers (e.g. #!/bin/sh, #!/bin/bash)
    if (buffer.length >= 8 && bufferString.startsWith('#!/bin/')) {
      return {
        isClean: false,
        isInfected: true,
        threatName: 'Disguised.Script.Shell',
        engineName: this.engineName,
        details: { header: bufferString.slice(0, 16) },
      };
    }

    // 8. Inspect embedded HTML / Script tags in images
    if (
      (lowerFilename.endsWith('.png') ||
        lowerFilename.endsWith('.jpg') ||
        lowerFilename.endsWith('.jpeg') ||
        lowerFilename.endsWith('.webp')) &&
      /<script[\s>]/i.test(bufferString)
    ) {
      return {
        isClean: false,
        isInfected: true,
        threatName: 'Disguised.Script.Html',
        engineName: this.engineName,
        details: { pattern: '<script>' },
      };
    }

    return {
      isClean: true,
      isInfected: false,
      engineName: this.engineName,
    };
  }
}
