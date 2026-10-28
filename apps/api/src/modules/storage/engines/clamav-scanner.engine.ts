import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
import { ScanEngineResult } from '@elmasaif/shared';
import { IMalwareScannerEngine } from '../scanner-engine.interface';

export interface ClamAvScannerOptions {
  host?: string;
  port?: number;
  timeoutMs?: number;
}

@Injectable()
export class ClamAvScannerEngine implements IMalwareScannerEngine {
  readonly engineName = 'ClamAvScanner';
  private readonly logger = new Logger(ClamAvScannerEngine.name);

  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  constructor(options?: ClamAvScannerOptions) {
    this.host = options?.host || process.env.CLAMAV_HOST || 'localhost';
    this.port = options?.port || (process.env.CLAMAV_PORT ? parseInt(process.env.CLAMAV_PORT, 10) : 3310);
    this.timeoutMs = options?.timeoutMs || 5000;
  }

  async isAvailable(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(this.timeoutMs);

      socket.on('connect', () => {
        socket.write('zPING\0');
      });

      socket.on('data', (data) => {
        const response = data.toString('utf-8');
        socket.destroy();
        resolve(response.includes('PONG'));
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(this.port, this.host);
    });
  }

  async scanBuffer(buffer: Buffer, filename: string): Promise<ScanEngineResult> {
    return new Promise<ScanEngineResult>((resolve, reject) => {
      const socket = new net.Socket();
      let responseData = '';
      let isCompleted = false;

      const cleanup = (error?: Error) => {
        if (isCompleted) return;
        isCompleted = true;
        socket.removeAllListeners();
        socket.destroy();
        if (error) {
          reject(error);
        }
      };

      socket.setTimeout(this.timeoutMs);

      socket.on('connect', () => {
        // ClamAV INSTREAM protocol
        socket.write('zINSTREAM\0');

        // Send buffer in chunks (chunk length in 4 bytes big endian + chunk data)
        const chunkSize = 2048;
        for (let offset = 0; offset < buffer.length; offset += chunkSize) {
          const slice = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
          const lengthHeader = Buffer.alloc(4);
          lengthHeader.writeUInt32BE(slice.length, 0);
          socket.write(lengthHeader);
          socket.write(slice);
        }

        // Final zero-length chunk signals EOF
        const zeroHeader = Buffer.alloc(4);
        socket.write(zeroHeader);
      });

      socket.on('data', (chunk) => {
        responseData += chunk.toString('utf-8');
      });

      socket.on('end', () => {
        if (isCompleted) return;
        isCompleted = true;
        socket.destroy();

        const cleaned = responseData.trim();
        if (cleaned.includes('FOUND')) {
          // e.g. "stream: Win.Test.EICAR_HDB-1 FOUND"
          const match = cleaned.match(/stream:\s*(.+?)\s*FOUND/i);
          const threatName = match ? match[1].trim() : 'Malware.Detected';
          this.logger.warn(`ClamAV detected threat '${threatName}' in file '${filename}'`);
          resolve({
            isClean: false,
            isInfected: true,
            threatName,
            engineName: this.engineName,
            details: { rawResponse: cleaned },
          });
        } else if (cleaned.includes('OK')) {
          resolve({
            isClean: true,
            isInfected: false,
            engineName: this.engineName,
          });
        } else if (cleaned.includes('ERROR')) {
          this.logger.error(`ClamAV returned scan error: ${cleaned}`);
          reject(new Error(`ClamAV scanner error: ${cleaned}`));
        } else {
          this.logger.error(`Unexpected ClamAV response: ${cleaned}`);
          reject(new Error(`Unexpected ClamAV response format: ${cleaned}`));
        }
      });

      socket.on('error', (err) => {
        this.logger.error(`TCP connection to ClamAV (${this.host}:${this.port}) failed: ${err.message}`);
        cleanup(new Error(`ClamAV daemon connection failed: ${err.message}`));
      });

      socket.on('timeout', () => {
        this.logger.error(`ClamAV scan timed out after ${this.timeoutMs}ms for file: ${filename}`);
        cleanup(new Error(`ClamAV scan timed out after ${this.timeoutMs}ms`));
      });

      socket.connect(this.port, this.host);
    });
  }
}
