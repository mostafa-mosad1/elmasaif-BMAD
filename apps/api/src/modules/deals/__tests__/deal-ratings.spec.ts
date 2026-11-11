import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, ConflictException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@elmasaif/shared';
import { BuyerDealsController } from '../buyer-deals.controller';
import { BuyerDealsService } from '../buyer-deals.service';
import { DealsCancellationService } from '../deals-cancellation.service';
import { DisputesService } from '../disputes.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../../users/guards/active-role.guard';

describe('Deal Ratings API (Story 6.5 / AC: #7, FR-54, UC-30)', () => {
  let controller: BuyerDealsController;
  let service: jest.Mocked<BuyerDealsService>;

  const mockDealId = 'deal-uuid-123';
  const mockBuyerUserId = 'user-buyer-123';

  beforeEach(async () => {
    const mockBuyerDealsService = {
      submitDealRating: jest.fn(),
      getDealPayment: jest.fn(),
      listMyDeals: jest.fn(),
      uploadProof: jest.fn(),
      getProofDownloadUrl: jest.fn(),
      getDealInvoice: jest.fn(),
    };

    const mockDealsCancellationService = {
      cancelByBuyer: jest.fn(),
      requestSellerCancellation: jest.fn(),
    };

    const mockDisputesService = {
      fileDispute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BuyerDealsController],
      providers: [
        { provide: BuyerDealsService, useValue: mockBuyerDealsService },
        { provide: DealsCancellationService, useValue: mockDealsCancellationService },
        { provide: DisputesService, useValue: mockDisputesService },
        Reflector,
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ActiveRoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BuyerDealsController>(BuyerDealsController);
    service = module.get(BuyerDealsService);
  });

  it('submits rating on completed deal and returns HTTP 201 Created (AC-7)', async () => {
    const ratingDto = {
      id: 'rating-uuid-1',
      dealId: mockDealId,
      score: 5,
      comment: 'وسيط ممتاز وملتزم بالأنظمة وسرعة إتمام الإفراغ.',
      createdAt: '2026-11-11T10:00:00.000Z',
    };

    service.submitDealRating.mockResolvedValue(ratingDto as any);

    const result = await controller.submitRating(
      mockDealId,
      { score: 5, comment: 'وسيط ممتاز وملتزم بالأنظمة وسرعة إتمام الإفراغ.' },
      { user: { id: mockBuyerUserId, role: UserRole.BUYER } },
    );

    expect(service.submitDealRating).toHaveBeenCalledWith(
      mockBuyerUserId,
      UserRole.BUYER,
      mockDealId,
      { score: 5, comment: 'وسيط ممتاز وملتزم بالأنظمة وسرعة إتمام الإفراغ.' },
    );

    expect(result.statusCode).toBe(HttpStatus.CREATED);
    expect(result.data).toEqual(ratingDto);
    expect(result.message).toBe('تم تسجيل تقييمك بنجاح');
  });

  it('propagates 409 DEAL_NOT_COMPLETED when deal is not in COMPLETED state', async () => {
    service.submitDealRating.mockRejectedValue(
      new ConflictException({ code: 'DEAL_NOT_COMPLETED', message: 'الصفقة لم تكتمل بعد' }),
    );

    await expect(
      controller.submitRating(
        mockDealId,
        { score: 4 },
        { user: { id: mockBuyerUserId, role: UserRole.BUYER } },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('propagates 409 DEAL_ALREADY_RATED when deal already has a rating', async () => {
    service.submitDealRating.mockRejectedValue(
      new ConflictException({ code: 'DEAL_ALREADY_RATED', message: 'تم تقييم هذه الصفقة مسبقاً' }),
    );

    await expect(
      controller.submitRating(
        mockDealId,
        { score: 5 },
        { user: { id: mockBuyerUserId, role: UserRole.BUYER } },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('propagates 403 DEAL_RATING_NOT_PARTY when non-buyer attempts to rate', async () => {
    service.submitDealRating.mockRejectedValue(
      new ForbiddenException({ code: 'DEAL_RATING_NOT_PARTY', message: 'يحق لمشتري الصفقة فقط تقديم التقييم' }),
    );

    await expect(
      controller.submitRating(
        mockDealId,
        { score: 5 },
        { user: { id: 'stranger-user', role: UserRole.BUYER } },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
