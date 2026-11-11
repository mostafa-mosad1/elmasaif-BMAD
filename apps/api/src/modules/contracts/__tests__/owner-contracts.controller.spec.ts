import { Test, TestingModule } from '@nestjs/testing';
import { OwnerContractsController } from '../owner-contracts.controller';
import { OwnerContractsService } from '../owner-contracts.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../../users/guards/active-role.guard';
import { UserRole, OwnerContractStatus } from '@elmasaif/shared';

describe('OwnerContractsController (Story 7.2)', () => {
  let controller: OwnerContractsController;
  let service: any;

  const mockUser = {
    id: 'user-owner-123',
    role: UserRole.OWNER,
  };

  const mockReq = {
    user: mockUser,
    headers: {
      'x-forwarded-for': '192.168.1.50, 10.0.0.1',
      'user-agent': 'Safari/605.1.15',
    },
    ip: '127.0.0.1',
  };

  const contractId = '11111111-2222-3333-4444-555555555555';

  beforeEach(async () => {
    service = {
      getContractDetail: jest.fn().mockResolvedValue({
        id: contractId,
        status: OwnerContractStatus.PENDING_SIGNATURE,
      }),
      requestSignatureOtp: jest.fn().mockResolvedValue({
        success: true,
        resendAvailableInSeconds: 60,
      }),
      signContract: jest.fn().mockResolvedValue({
        success: true,
        contractId,
        status: OwnerContractStatus.PENDING_FEE,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OwnerContractsController],
      providers: [
        { provide: OwnerContractsService, useValue: service },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ActiveRoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OwnerContractsController>(OwnerContractsController);
  });

  it('delegates getContractDetail to service', async () => {
    await controller.getContractDetail(mockReq, contractId);
    expect(service.getContractDetail).toHaveBeenCalledWith(mockUser.id, contractId);
  });

  it('delegates requestSignatureOtp to service', async () => {
    await controller.requestSignatureOtp(mockReq, contractId);
    expect(service.requestSignatureOtp).toHaveBeenCalledWith(mockUser.id, contractId);
  });

  it('delegates signContract to service with extracted IP and User-Agent', async () => {
    const body = {
      signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      otpCode: '123456',
    };

    await controller.signContract(mockReq, contractId, body);

    expect(service.signContract).toHaveBeenCalledWith(
      mockUser.id,
      contractId,
      body,
      '192.168.1.50',
      'Safari/605.1.15',
    );
  });
});

