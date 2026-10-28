/**
 * Worker Production Startup Safety Guard
 * Ensures that development shortcuts (mock clock, static OTP) cannot execute in production.
 */
export function assertWorkerProductionSafety(): void {
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === 'production') {
    if (process.env.ENABLE_MOCK_CLOCK === 'true') {
      const errorMsg =
        '[FATAL WORKER STARTUP GUARD] Mock clock and time manipulation are strictly forbidden in production (NODE_ENV=production). Aborting startup.';
      console.error(errorMsg);
      process.exit(1);
    }

    if (process.env.OTP_PROVIDER === 'static' || process.env.ENABLE_STATIC_OTP === 'true') {
      const errorMsg =
        "[FATAL WORKER STARTUP GUARD] Static OTP provider ('123456') is strictly forbidden in production (NODE_ENV=production). Aborting startup.";
      console.error(errorMsg);
      process.exit(1);
    }

    console.log('[Worker StartupGuard] Production safety checks passed successfully.');
  } else {
    console.log(
      `[Worker StartupGuard] Running in development/testing mode (NODE_ENV=${nodeEnv || 'development'}).`
    );
  }
}
