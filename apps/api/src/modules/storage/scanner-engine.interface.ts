import { ScanEngineResult } from '@elmasaif/shared';

export interface IMalwareScannerEngine {
  readonly engineName: string;
  scanBuffer(buffer: Buffer, filename: string): Promise<ScanEngineResult>;
  scanStream?(stream: NodeJS.ReadableStream, filename: string): Promise<ScanEngineResult>;
  isAvailable(): Promise<boolean>;
}
