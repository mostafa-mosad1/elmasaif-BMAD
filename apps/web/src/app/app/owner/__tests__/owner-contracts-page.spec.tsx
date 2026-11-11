import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import OwnerContractsPage from '../contracts/page';
import {
  OwnerListingRequestItem,
  OwnerListingRequestStatus,
  PropertyType,
} from '@elmasaif/shared';

// Mock useRouter and usePathname
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/app/owner/contracts',
}));

const mockOwnerRequests: OwnerListingRequestItem[] = [
  {
    id: 'req-owner-1',
    listingId: 'listing-owner-1',
    propertyTitle: 'فيلا مودرن في النرجس',
    propertyType: PropertyType.VILLA,
    cityName: 'الرياض',
    districtName: 'النرجس',
    askPrice: 3500000,
    status: OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE,
    rejectionReason: null,
    modificationNotes: null,
    contractId: 'contract-1',
    contractStatus: 'PENDING_OWNER_SIGNATURE' as any,
    contractFee: 1000,
    contractExpiresAt: '2026-11-18T10:00:00.000Z',
    createdAt: '2026-11-11T09:00:00.000Z',
  },
  {
    id: 'req-owner-2',
    listingId: 'listing-owner-2',
    propertyTitle: 'شقة فاخرة في الياسمين',
    propertyType: PropertyType.APARTMENT,
    cityName: 'الرياض',
    districtName: 'الياسمين',
    askPrice: 1200000,
    status: OwnerListingRequestStatus.PENDING,
    rejectionReason: null,
    modificationNotes: null,
    contractId: null,
    contractStatus: null,
    contractFee: null,
    contractExpiresAt: null,
    createdAt: '2026-11-11T09:30:00.000Z',
  },
];

describe('OwnerContractsPage (Story 7.1)', () => {
  it('renders contracts page header and summary banner', () => {
    const html = renderToString(
      <OwnerContractsPage initialRequests={mockOwnerRequests} />,
    );

    expect(html).toContain('عقود الوساطة العقارية الإلكترونية');
    expect(html).toContain('عقود الوساطة والتسويق الإلكترونية');
  });

  it('renders dispatched contract card with action button to review and sign', () => {
    const html = renderToString(
      <OwnerContractsPage initialRequests={mockOwnerRequests} />,
    );

    expect(html).toContain('فيلا مودرن في النرجس');
    expect(html).toContain('الرياض');
    expect(html).toContain('النرجس');
    expect(html).toContain('بانتظار التوقيع الإلكتروني');
    expect(html).toContain('مراجعة وتوقيع العقد');
  });

  it('renders empty state when no contracts exist', () => {
    const html = renderToString(
      <OwnerContractsPage initialRequests={[]} />,
    );

    expect(html).toContain('لا توجد عقود وساطة صادرة حتى الآن');
  });
});
