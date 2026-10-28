import * as path from 'path';
import * as dotenv from 'dotenv';

// Attempt to load .env from root or local workspace
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface WorkerConfig {
  nodeEnv: string;
  databaseUrl: string;
  bossSchema: string;
  heartbeatIntervalMs: number;
  gracefulShutdownTimeoutMs: number;
}

export function getWorkerConfig(): WorkerConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const databaseUrl = process.env.DATABASE_URL || '';

  if (nodeEnv === 'production' && !databaseUrl) {
    throw new Error('[Worker Config] DATABASE_URL is required in production environment.');
  }

  return {
    nodeEnv,
    databaseUrl: databaseUrl || 'postgresql://elmasaif_user:elmasaif_password@localhost:5432/elmasaif_db?schema=public',
    bossSchema: process.env.PG_BOSS_SCHEMA || 'pgboss',
    heartbeatIntervalMs: parseInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS || '60000', 10),
    gracefulShutdownTimeoutMs: parseInt(process.env.WORKER_SHUTDOWN_TIMEOUT_MS || '10000', 10)
  };
}
