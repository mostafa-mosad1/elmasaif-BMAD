import { BadRequestException, ExecutionContext, ForbiddenException, PayloadTooLargeException } from '@nestjs/common';
import { AdminRole, IdentityDocumentType } from '@elmasaif/shared';
import {
  AdminIdentityController,
  AdminIdentityGuard,
  IDENTITY_ADMIN_PERMISSIONS
} from '../admin-identity.controller';
import { IdentityController, IdentityFileTooLargeFilter } from '../identity.controller';
import { IdentityService } from '../identity.service';

describe('IdentityController', () => {
  let controller: IdentityController;
  let service: jest.Mocked<Pick<
    IdentityService,
    'uploadIdentityDocument' | 'getIdentityStatus' | 'getIdentityDocumentDownloadUrl'
  >>;

  beforeEach(() => {
    service = {
      uploadIdentityDocument: jest.fn().mockResolvedValue({ id: 'identity-1' }),
      getIdentityStatus: jest.fn().mockResolvedValue({ status: 'PENDING_REVIEW' }),
      getIdentityDocumentDownloadUrl: jest.fn().mockResolvedValue({
        downloadUrl: 'https://private.example/file',
        expiresIn: 300
      })
    };
    controller = new IdentityController(service as unknown as IdentityService);
  });

  it('validates upload fields and delegates file processing to the service', async () => {
    const req = { user: { id: 'user-1' }, headers: { 'x-request-id': 'req-1' } };
    const response = await controller.upload(
      { originalname: 'id.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('document') },
      { documentType: IdentityDocumentType.NATIONAL_ID, idNumber: '1234567890' },
      req
    );

    expect(response).toMatchObject({
      code: 'SUCCESS',
      data: { id: 'identity-1' }
    });
    expect(service.uploadIdentityDocument).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ originalname: 'id.pdf' }),
      IdentityDocumentType.NATIONAL_ID,
      '1234567890'
    );
  });

  it('rejects invalid upload metadata before invoking the service', async () => {
    const req = { user: { id: 'user-1' }, headers: {} };
    await expect(controller.upload(
      { originalname: 'id.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('document') },
      { documentType: 'INVALID' },
      req
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(service.uploadIdentityDocument).not.toHaveBeenCalled();
  });

  it('translates PayloadTooLargeException to a structured 400 response', () => {
    const filter = new IdentityFileTooLargeFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-request-id': 'req-large' } }),
        getResponse: () => ({ status })
      })
    } as unknown as Parameters<typeof filter.catch>[1];

    filter.catch(new PayloadTooLargeException('too large'), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      code: 'IDENTITY_FILE_TOO_LARGE',
      requestId: 'req-large'
    }));
  });

  it('delegates status retrieval and document URL generation', async () => {
    await expect(controller.getStatus({ user: { id: 'user-1' }, headers: {} })).resolves.toMatchObject({
      code: 'SUCCESS',
      data: { status: 'PENDING_REVIEW' }
    });
    expect(service.getIdentityStatus).toHaveBeenCalledWith('user-1');

    await expect(controller.getDocumentUrl({ user: { id: 'user-1' }, headers: {} })).resolves.toMatchObject({
      code: 'SUCCESS',
      data: { downloadUrl: 'https://private.example/file', expiresIn: 300 }
    });
    expect(service.getIdentityDocumentDownloadUrl).toHaveBeenCalledWith('user-1', 'user-1');
  });
});

describe('AdminIdentityController and AdminIdentityGuard', () => {
  const documentId = '4ecaa1d1-e73f-44f3-9453-4f89653c98d4';
  let controller: AdminIdentityController;
  let service: jest.Mocked<Pick<
    IdentityService,
    | 'getPendingIdentityDocuments'
    | 'verifyIdentityDocument'
    | 'rejectIdentityDocument'
    | 'getAdminIdentityDocumentDownloadUrl'
  >>;
  const guard = new AdminIdentityGuard();

  beforeEach(() => {
    service = {
      getPendingIdentityDocuments: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
      verifyIdentityDocument: jest.fn().mockResolvedValue({ id: 'identity-1' }),
      rejectIdentityDocument: jest.fn().mockResolvedValue({ id: 'identity-1' }),
      getAdminIdentityDocumentDownloadUrl: jest.fn().mockResolvedValue({
        downloadUrl: 'https://private.example/file',
        expiresIn: 300
      })
    };
    controller = new AdminIdentityController(service as unknown as IdentityService);
  });

  it('requires an active administrator session with the required permission', () => {
    const makeContext = (
      admin: { id: string; role: AdminRole; isActive: boolean } | undefined,
      permissions: string[]
    ) => {
      const handler = () => {};
      Reflect.defineMetadata(IDENTITY_ADMIN_PERMISSIONS, permissions, handler);
      return {
        getHandler: () => handler,
        getClass: () => AdminIdentityController,
        switchToHttp: () => ({ getRequest: () => ({ admin }) })
      } as unknown as ExecutionContext;
    };

    expect(guard.canActivate(makeContext(
      { id: 'admin-1', role: AdminRole.MODERATOR, isActive: true },
      ['Users.Review', 'Compliance.Review']
    ))).toBe(true);
    expect(() => guard.canActivate(makeContext(undefined, ['Users.Review']))).toThrow(ForbiddenException);
    expect(guard.canActivate(makeContext(
      { id: 'auditor-1', role: AdminRole.FINANCIAL_AUDITOR, isActive: true },
      ['Users.View', 'Audit.View']
    ))).toBe(true);
    expect(() => guard.canActivate(makeContext(
      { id: 'auditor-1', role: AdminRole.FINANCIAL_AUDITOR, isActive: true },
      ['Users.Review', 'Compliance.Review']
    ))).toThrow(ForbiddenException);
  });

  it('lists pending documents and records administrative rejection with the document ID', async () => {
    const req = { admin: { id: 'admin-1' }, headers: {} };
    await controller.getPending(req, '2', '15');
    expect(service.getPendingIdentityDocuments).toHaveBeenCalledWith(2, 15);

    await controller.reject(documentId, { reason: 'الصورة غير واضحة' }, req);
    expect(service.rejectIdentityDocument).toHaveBeenCalledWith(
      documentId,
      'admin-1',
      'الصورة غير واضحة'
    );

    await controller.verify(documentId, req);
    expect(service.verifyIdentityDocument).toHaveBeenCalledWith(documentId, 'admin-1');
  });

  it('rejects invalid pagination and malformed review inputs', async () => {
    const req = { user: { id: 'admin-1' }, headers: {} };
    await expect(controller.getPending(req, '-1', '20')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.verify('not-a-uuid', req)).rejects.toMatchObject({
      response: { code: 'IDENTITY_INVALID_DOCUMENT' }
    });
  });
});
