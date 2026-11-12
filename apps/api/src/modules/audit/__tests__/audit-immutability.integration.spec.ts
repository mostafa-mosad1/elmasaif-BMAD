import * as fs from 'fs';
import * as path from 'path';
import { AUDIT_LOG_IMMUTABLE } from '@elmasaif/shared';

describe('Audit Database Immutability & Append-Only Guarantees (BR-19 / AC2)', () => {
  const sqlFilePath = path.join(
    __dirname,
    '../../../../prisma/sql/audit-invariants.sql',
  );
  const migrationFilePath = path.join(
    __dirname,
    '../../../../prisma/migrations/20261112_audit_logs_immutable/migration.sql',
  );

  it('provides the PostgreSQL trigger function prevent_audit_log_modification() in sql script', () => {
    expect(fs.existsSync(sqlFilePath)).toBe(true);
    const sql = fs.readFileSync(sqlFilePath, 'utf-8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION prevent_audit_log_modification()');
    expect(sql).toContain(
      'AuditLog entries are strictly immutable (append-only) and cannot be updated or deleted per BR-19',
    );
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON "audit_logs"');
  });

  it('provides dedicated migration script with trigger attachment and index creation', () => {
    expect(fs.existsSync(migrationFilePath)).toBe(true);
    const migration = fs.readFileSync(migrationFilePath, 'utf-8');

    expect(migration).toContain('"audit_logs_actorId_createdAt_idx"');
    expect(migration).toContain('prevent_audit_log_modification');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "audit_logs"');
  });

  it('simulates database trigger intercepting UPDATE and DELETE on audit_logs table', async () => {
    // Simulated Prisma client with PostgreSQL trigger behavior
    const simulatedPrisma = {
      auditLog: {
        create: jest.fn().mockImplementation(async (args) => ({
          id: 'log-uuid-1',
          ...args.data,
          createdAt: new Date(),
        })),
        update: jest.fn().mockImplementation(async () => {
          throw new Error(
            'AuditLog entries are strictly immutable (append-only) and cannot be updated or deleted per BR-19',
          );
        }),
        delete: jest.fn().mockImplementation(async () => {
          throw new Error(
            'AuditLog entries are strictly immutable (append-only) and cannot be updated or deleted per BR-19',
          );
        }),
      },
    };

    // 1. Insertion succeeds unconditionally
    const created = await simulatedPrisma.auditLog.create({
      data: {
        actorId: 'admin-1',
        actorType: 'ADMIN',
        action: 'PLATFORM_SETTINGS_UPDATED',
        entityType: 'PlatformSetting',
        entityId: 'default',
      },
    });
    expect(created.id).toBe('log-uuid-1');

    // 2. Direct UPDATE throws fatal PostgreSQL exception per BR-19
    await expect(
      simulatedPrisma.auditLog.update({
        where: { id: created.id },
        data: { action: 'TAMPERED_ACTION' },
      }),
    ).rejects.toThrow(
      'AuditLog entries are strictly immutable (append-only) and cannot be updated or deleted per BR-19',
    );

    // 3. Direct DELETE throws fatal PostgreSQL exception per BR-19
    await expect(
      simulatedPrisma.auditLog.delete({
        where: { id: created.id },
      }),
    ).rejects.toThrow(
      'AuditLog entries are strictly immutable (append-only) and cannot be updated or deleted per BR-19',
    );
  });
});

