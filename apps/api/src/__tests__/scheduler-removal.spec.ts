import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../app.module';

describe('API Scheduler Architecture Compliance (AR8, AD-7)', () => {
  it('does NOT include ScheduleModule in AppModule imports', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) || [];
    const moduleNames = imports.map((imp: any) => {
      if (typeof imp === 'function') {
        return imp.name;
      }
      if (imp && imp.module && typeof imp.module === 'function') {
        return imp.module.name;
      }
      return String(imp);
    });

    expect(moduleNames).not.toContain('ScheduleModule');
  });
});
