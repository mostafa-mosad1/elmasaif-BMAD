/**
 * Dedicated Worker Clock Provider
 * Encapsulates temporal access for scheduled worker jobs, sweeps, and heartbeats.
 */
export interface IWorkerClock {
  now(): Date;
  nowIso(): string;
  nowTimestamp(): number;
}

class WorkerClock implements IWorkerClock {
  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  nowTimestamp(): number {
    return this.now().getTime();
  }
}

export const workerClock = new WorkerClock();
