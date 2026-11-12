import {
  PrismaClient,
  AdminRole,
  DealStatus,
  IdentityDocumentType,
  OfferStatus,
  PaymentType,
  ScanStatus,
  VerificationStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import {
  ADMIN_ROLE_PERMISSIONS,
  DEFAULT_COMMISSION_RATE,
  DEFAULT_FIXED_COMMISSION_SAR,
  DEFAULT_PAYMENT_WINDOW_HOURS,
  computeDealAmounts,
  computeVatBreakdown,
  getSaudiBankName,
  maskSaudiIban,
} from '@elmasaif/shared';
import { CryptoService } from '../src/common/crypto/crypto.service';

const prisma = new PrismaClient();

export interface SeedDistrict {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface SeedCity {
  id: string;
  nameAr: string;
  nameEn: string;
  districts: SeedDistrict[];
}

export const SAUDI_GEOGRAPHIC_DATA: SeedCity[] = [
  {
    id: '11111111-0000-4000-8000-000000000001',
    nameAr: 'الرياض',
    nameEn: 'Riyadh',
    districts: [
      { id: '22222222-0001-4000-8000-000000000001', nameAr: 'الملقا', nameEn: 'Al-Malqa' },
      { id: '22222222-0001-4000-8000-000000000002', nameAr: 'النرجس', nameEn: 'Al-Narjis' },
      { id: '22222222-0001-4000-8000-000000000003', nameAr: 'الياسمين', nameEn: 'Al-Yasmin' },
      { id: '22222222-0001-4000-8000-000000000004', nameAr: 'العليا', nameEn: 'Al-Olaya' },
      { id: '22222222-0001-4000-8000-000000000005', nameAr: 'النخيل', nameEn: 'Al-Nakheel' },
      { id: '22222222-0001-4000-8000-000000000006', nameAr: 'الصحافة', nameEn: 'Al-Sahafa' },
      { id: '22222222-0001-4000-8000-000000000007', nameAr: 'الربيع', nameEn: 'Al-Rabi' },
      { id: '22222222-0001-4000-8000-000000000008', nameAr: 'حطين', nameEn: 'Hittin' }
    ]
  },
  {
    id: '11111111-0000-4000-8000-000000000002',
    nameAr: 'جدة',
    nameEn: 'Jeddah',
    districts: [
      { id: '22222222-0002-4000-8000-000000000001', nameAr: 'الروضة', nameEn: 'Al-Rawdah' },
      { id: '22222222-0002-4000-8000-000000000002', nameAr: 'الشاطئ', nameEn: 'Al-Shati' },
      { id: '22222222-0002-4000-8000-000000000003', nameAr: 'الزهراء', nameEn: 'Al-Zahra' },
      { id: '22222222-0002-4000-8000-000000000004', nameAr: 'الحمراء', nameEn: 'Al-Hamra' },
      { id: '22222222-0002-4000-8000-000000000005', nameAr: 'السلامة', nameEn: 'Al-Salamah' },
      { id: '22222222-0002-4000-8000-000000000006', nameAr: 'أبحر الشمالية', nameEn: 'Obhur Al-Shamaliyah' }
    ]
  },
  {
    id: '11111111-0000-4000-8000-000000000003',
    nameAr: 'الدمام',
    nameEn: 'Dammam',
    districts: [
      { id: '22222222-0003-4000-8000-000000000001', nameAr: 'الفيصلية', nameEn: 'Al-Faisaliyah' },
      { id: '22222222-0003-4000-8000-000000000002', nameAr: 'الريان', nameEn: 'Al-Rayan' },
      { id: '22222222-0003-4000-8000-000000000003', nameAr: 'الشاطئ الغربي', nameEn: 'Al-Shati Al-Gharbi' },
      { id: '22222222-0003-4000-8000-000000000004', nameAr: 'المريكبات', nameEn: 'Al-Muraikabat' },
      { id: '22222222-0003-4000-8000-000000000005', nameAr: 'الزهور', nameEn: 'Al-Zuhour' }
    ]
  },
  {
    id: '11111111-0000-4000-8000-000000000004',
    nameAr: 'مكة المكرمة',
    nameEn: 'Mecca',
    districts: [
      { id: '22222222-0004-4000-8000-000000000001', nameAr: 'العوالي', nameEn: 'Al-Awali' },
      { id: '22222222-0004-4000-8000-000000000002', nameAr: 'الشوقية', nameEn: 'Al-Shawqiyyah' },
      { id: '22222222-0004-4000-8000-000000000003', nameAr: 'الرصيفة', nameEn: 'Al-Rusaifah' },
      { id: '22222222-0004-4000-8000-000000000004', nameAr: 'الكعكية', nameEn: 'Al-Kakiyyah' },
      { id: '22222222-0004-4000-8000-000000000005', nameAr: 'بطحاء قريش', nameEn: 'Batha Quraish' }
    ]
  },
  {
    id: '11111111-0000-4000-8000-000000000005',
    nameAr: 'المدينة المنورة',
    nameEn: 'Medina',
    districts: [
      { id: '22222222-0005-4000-8000-000000000001', nameAr: 'القبلتين', nameEn: 'Al-Qiblatayn' },
      { id: '22222222-0005-4000-8000-000000000002', nameAr: 'قباء', nameEn: 'Quba' },
      { id: '22222222-0005-4000-8000-000000000003', nameAr: 'العزيزية', nameEn: 'Al-Aziziyah' },
      { id: '22222222-0005-4000-8000-000000000004', nameAr: 'سيد الشهداء', nameEn: 'Sayyid Al-Shuhada' },
      { id: '22222222-0005-4000-8000-000000000005', nameAr: 'الحرم', nameEn: 'Al-Haram' }
    ]
  },
  {
    id: '11111111-0000-4000-8000-000000000006',
    nameAr: 'الطائف',
    nameEn: 'Taif',
    districts: [
      { id: '22222222-0006-4000-8000-000000000001', nameAr: 'الحوية', nameEn: 'Al-Hawiyah' },
      { id: '22222222-0006-4000-8000-000000000002', nameAr: 'الشهار', nameEn: 'Al-Shahar' },
      { id: '22222222-0006-4000-8000-000000000003', nameAr: 'الهدا', nameEn: 'Al-Hada' },
      { id: '22222222-0006-4000-8000-000000000004', nameAr: 'الردف', nameEn: 'Al-Radaf' },
      { id: '22222222-0006-4000-8000-000000000005', nameAr: 'الفيصلية', nameEn: 'Al-Faisaliyah' }
    ]
  },
  {
    id: '11111111-0000-4000-8000-000000000007',
    nameAr: 'الخبر',
    nameEn: 'Khobar',
    districts: [
      { id: '22222222-0007-4000-8000-000000000001', nameAr: 'الحزام الذهبي', nameEn: 'Al-Hizam Al-Thahabi' },
      { id: '22222222-0007-4000-8000-000000000002', nameAr: 'الحزام الأخضر', nameEn: 'Al-Hizam Al-Akhdar' },
      { id: '22222222-0007-4000-8000-000000000003', nameAr: 'الراكة الجنوبية', nameEn: 'Al-Rakah Al-Janubiyah' },
      { id: '22222222-0007-4000-8000-000000000004', nameAr: 'الخبر الشمالية', nameEn: 'Al-Khobar Al-Shamaliyah' },
      { id: '22222222-0007-4000-8000-000000000005', nameAr: 'العليا', nameEn: 'Al-Ulaya' }
    ]
  }
];

export async function seedGeographicData() {
  console.log('🌍 Seeding Saudi Geographic Master Data (7 Cities & Districts)...');

  let totalCitiesSeeded = 0;
  let totalDistrictsSeeded = 0;

  for (const cityData of SAUDI_GEOGRAPHIC_DATA) {
    const city = await prisma.city.upsert({
      where: { id: cityData.id },
      update: {
        nameAr: cityData.nameAr,
        nameEn: cityData.nameEn,
        isActive: true
      },
      create: {
        id: cityData.id,
        nameAr: cityData.nameAr,
        nameEn: cityData.nameEn,
        isActive: true
      }
    });
    totalCitiesSeeded++;

    for (const districtData of cityData.districts) {
      await prisma.district.upsert({
        where: {
          id_cityId: {
            id: districtData.id,
            cityId: city.id
          }
        },
        update: {
          nameAr: districtData.nameAr,
          nameEn: districtData.nameEn,
          isActive: true
        },
        create: {
          id: districtData.id,
          cityId: city.id,
          nameAr: districtData.nameAr,
          nameEn: districtData.nameEn,
          isActive: true
        }
      });
      totalDistrictsSeeded++;
    }
  }

  console.log(`✅ Geographic seeding complete: ${totalCitiesSeeded} cities, ${totalDistrictsSeeded} districts.`);
}

export interface SeedAdminAccount {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: AdminRole;
  defaultPassword: string;
}

export const INITIAL_ADMIN_ACCOUNTS: SeedAdminAccount[] = [
  {
    id: '99999999-0000-4000-8000-000000000001',
    username: 'superadmin',
    email: 'admin@elmasaif.sa',
    fullName: 'المشرف العام - المصايف',
    role: AdminRole.SUPER_ADMIN,
    defaultPassword: process.env.SEED_SUPERADMIN_PASSWORD || 'Admin@Elmasaif2026',
  },
  {
    id: '99999999-0000-4000-8000-000000000002',
    username: 'moderator',
    email: 'moderator@elmasaif.sa',
    fullName: 'مشرف العمليات',
    role: AdminRole.MODERATOR,
    defaultPassword: process.env.SEED_MODERATOR_PASSWORD || 'Moderator@Elmasaif2026',
  },
];

export async function seedAdminUsers() {
  console.log('🔐 Seeding Isolated Administrative Accounts (AdminUser)...');

  for (const account of INITIAL_ADMIN_ACCOUNTS) {
    const passwordHash = await argon2.hash(account.defaultPassword, {
      type: argon2.argon2id,
    });

    const rolePermissions = ADMIN_ROLE_PERMISSIONS[account.role as any] ?? [];

    await prisma.adminUser.upsert({
      where: { username: account.username },
      update: {
        email: account.email,
        fullName: account.fullName,
        passwordHash,
        role: account.role,
        permissions: rolePermissions,
        isActive: true,
        deletedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        id: account.id,
        username: account.username,
        email: account.email,
        fullName: account.fullName,
        passwordHash,
        role: account.role,
        permissions: rolePermissions,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  console.log(`✅ Admin accounts seeded: ${INITIAL_ADMIN_ACCOUNTS.length} isolated staff accounts.`);
}

// Demo listings to verify the Story 3.1 public search surface renders visible results.
// At least one ACTIVE and one RESERVED listing are required (AC #2 status gating).
const DEMO_SELLER = {
  id: '77777777-0000-4000-8000-000000000001',
  profileId: '77777777-0000-4000-8000-000000000101',
  username: 'demo-marketer',
  fullName: 'وسيط تجريبي - المصايف',
  mobileNumber: '0500000099',
  nationalId: '1000000099',
  iban: 'SA0380000000608010167519',
};

// Story 5.1: a stable id keeps the payout-account upsert idempotent across seed runs.
const DEMO_PAYOUT_ACCOUNT_ID = '99999999-0000-4000-8000-000000000101';

export async function seedDemoListings() {
  console.log('🏠 Seeding Demo ACTIVE/RESERVED Listings (Story 3.1)...');

  const cityId = '11111111-0000-4000-8000-000000000001'; // الرياض
  const districtId = '22222222-0001-4000-8000-000000000002'; // النرجس

  await prisma.user.upsert({
    where: { id: DEMO_SELLER.id },
    update: {},
    create: {
      id: DEMO_SELLER.id,
      username: DEMO_SELLER.username,
      fullName: DEMO_SELLER.fullName,
      mobileNumber: DEMO_SELLER.mobileNumber,
      nationalId: DEMO_SELLER.nationalId,
      passwordHash: await argon2.hash('Demo@Elmasaif2026', { type: argon2.argon2id }),
    },
  });

  await prisma.userProfile.upsert({
    where: { id: DEMO_SELLER.profileId },
    update: {},
    create: {
      id: DEMO_SELLER.profileId,
      userId: DEMO_SELLER.id,
      role: 'MARKETER',
      payoutIban: DEMO_SELLER.iban,
    },
  });

  // Story 5.1 / AC-5: `DealsService.finalApprove` refuses with DEAL_SELLER_PAYOUT_REQUIRED when
  // the seller has no `PayoutAccount`, and `UserProfile.payoutIban` is a masked display string, so
  // no seeded listing could ever be bound into a deal without this row. Idempotent: an existing
  // account keeps its ciphertext (re-encrypting would churn a random IV on every seed run).
  const cryptoService = new CryptoService(new ConfigService());
  await prisma.payoutAccount.upsert({
    where: { id: DEMO_PAYOUT_ACCOUNT_ID },
    update: {},
    create: {
      id: DEMO_PAYOUT_ACCOUNT_ID,
      profileId: DEMO_SELLER.profileId,
      accountHolderName: DEMO_SELLER.fullName,
      bankName: getSaudiBankName(DEMO_SELLER.iban),
      ibanEncrypted: cryptoService.encrypt(DEMO_SELLER.iban),
      ibanMasked: maskSaudiIban(DEMO_SELLER.iban),
      ibanLast4: DEMO_SELLER.iban.slice(-4),
      isDefault: true,
    },
  });

  const demoListings = [
    {
      id: '88888888-0000-4000-8000-000000000001',
      title: 'فيلا مودرن مع مسبح في النرجس',
      description: 'فيلا سكنية بتصميم حديث في حي النرجس شمال الرياض، تشطيب سوبر ديلوكس.',
      propertyType: 'VILLA',
      askPrice: 3200000,
      areaSquareMeters: 450,
      bedrooms: 5,
      yearBuilt: 2024,
      status: 'ACTIVE',
    },
    {
      id: '88888888-0000-4000-8000-000000000002',
      title: 'شقة فاخرة محجوزة قيد التقييم',
      description: 'شقة راقية في حي النرجس بإطلالة مفتوحة، حالتها محجوزة حالياً.',
      propertyType: 'APARTMENT',
      askPrice: 1450000,
      areaSquareMeters: 180,
      bedrooms: 3,
      yearBuilt: 2023,
      status: 'RESERVED',
    },
    {
      id: '88888888-0000-4000-8000-000000000003',
      title: 'دوبلكس فاخر مكتمل الإفراغ في النرجس',
      description: 'دوبلكس راقي تم بيعه واكتمال صفقة الشراء بنجاح.',
      propertyType: 'VILLA',
      askPrice: 2000000,
      areaSquareMeters: 300,
      bedrooms: 4,
      yearBuilt: 2024,
      status: 'SOLD',
    },
  ];

  for (const listing of demoListings) {
    await prisma.listing.upsert({
      where: { id: listing.id },
      update: { status: listing.status as any },
      create: {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        propertyType: listing.propertyType as any,
        cityId,
        districtId,
        latitude: 24.8133,
        longitude: 46.6307,
        askPrice: listing.askPrice,
        areaSquareMeters: listing.areaSquareMeters,
        bedrooms: listing.bedrooms,
        yearBuilt: listing.yearBuilt,
        status: listing.status as any,
        sellerProfileId: DEMO_SELLER.profileId,
        payoutIban: DEMO_SELLER.iban,
      },
    });
  }

  console.log(`✅ Demo listings seeded: ${demoListings.length} (1 ACTIVE, 1 RESERVED).`);
}

// Story 5.2: one buyer, a verified identity and one `AWAITING_PAYMENT_PROOF` deal, so the dual
// wire-transfer screen, its 48-hour countdown and the proof upload can be exercised end to end.
// Stable ids keep every upsert idempotent across seed runs.
const DEMO_BUYER = {
  id: '77777777-0000-4000-8000-000000000201',
  profileId: '77777777-0000-4000-8000-000000000211',
  username: 'demo-buyer',
  fullName: 'مشترٍ تجريبي - المصايف',
  mobileNumber: '0500000088',
  nationalId: '1000000088',
  email: 'demo-buyer@elmasaif.sa',
};

const DEMO_IDENTITY_FILE_ID = '99999999-0000-4000-8000-000000000201';
const DEMO_IDENTITY_DOCUMENT_ID = '99999999-0000-4000-8000-000000000202';
const DEMO_OFFER_ID = '99999999-0000-4000-8000-000000000203';
const DEMO_DEAL_ID = '99999999-0000-4000-8000-000000000204';
const DEMO_RESERVED_LISTING_ID = '88888888-0000-4000-8000-000000000002';

export async function seedDemoDeal() {
  console.log('💳 Seeding Demo Buyer, Verified Identity and Deal (Story 5.2)...');

  await prisma.user.upsert({
    where: { id: DEMO_BUYER.id },
    update: {},
    create: {
      id: DEMO_BUYER.id,
      username: DEMO_BUYER.username,
      fullName: DEMO_BUYER.fullName,
      mobileNumber: DEMO_BUYER.mobileNumber,
      nationalId: DEMO_BUYER.nationalId,
      email: DEMO_BUYER.email,
      passwordHash: await argon2.hash('Demo@Elmasaif2026', { type: argon2.argon2id }),
    },
  });

  await prisma.userProfile.upsert({
    where: { id: DEMO_BUYER.profileId },
    update: {},
    create: {
      id: DEMO_BUYER.profileId,
      userId: DEMO_BUYER.id,
      role: 'BUYER',
      status: 'ACTIVE',
    },
  });

  // FR-30 / BR-10: `IdentityService.getIdentityStatus` only sets `canUploadDealPaymentProof`
  // when the newest document's file object is CLEAN and the document is not REJECTED, so the
  // demo needs both rows or every proof upload is refused with DEAL_IDENTITY_REQUIRED.
  await prisma.fileObject.upsert({
    where: { id: DEMO_IDENTITY_FILE_ID },
    update: {},
    create: {
      id: DEMO_IDENTITY_FILE_ID,
      bucket: 'elmasaif-private-documents',
      key: `identity/${DEMO_BUYER.id}/demo-national-id.pdf`,
      mimeType: 'application/pdf',
      fileSize: 245_760,
      scanStatus: ScanStatus.CLEAN,
      scannedAt: new Date(),
    },
  });

  await prisma.identityDocument.upsert({
    where: { id: DEMO_IDENTITY_DOCUMENT_ID },
    update: {},
    create: {
      id: DEMO_IDENTITY_DOCUMENT_ID,
      userId: DEMO_BUYER.id,
      fileObjectId: DEMO_IDENTITY_FILE_ID,
      documentType: IdentityDocumentType.NATIONAL_ID,
      // `IdentityService.uploadIdentityDocument` binds the document to the registered national id.
      idNumber: DEMO_BUYER.nationalId,
      status: VerificationStatus.VERIFIED,
      verifiedAt: new Date(),
    },
  });

  // `Deal.offerId` is required and unique, so the terminal offer has to exist before the deal.
  await prisma.offer.upsert({
    where: { id: DEMO_OFFER_ID },
    update: {},
    create: {
      id: DEMO_OFFER_ID,
      listingId: DEMO_RESERVED_LISTING_ID,
      buyerProfileId: DEMO_BUYER.profileId,
      offerPrice: '1450000.00',
      status: OfferStatus.CONVERTED_TO_DEAL,
      expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000),
    },
  });

  const payout = await prisma.payoutAccount.findUnique({ where: { id: DEMO_PAYOUT_ACCOUNT_ID } });
  if (!payout) {
    throw new Error(
      'Demo seller payout account is missing — seedDemoListings() must run before seedDemoDeal()',
    );
  }

  // Same frozen snapshot the admin approval writes (Story 5.1): fixed-point money, the seller
  // payout copied (never re-encrypted) and a 48-hour window starting from this instant.
  const amounts = computeDealAmounts({
    dealPrice: '1450000',
    commissionRate: DEFAULT_COMMISSION_RATE,
    fixedCommission: DEFAULT_FIXED_COMMISSION_SAR,
  });
  const paymentWindowHours = DEFAULT_PAYMENT_WINDOW_HOURS;
  const now = new Date();
  const paymentDeadline = new Date(now.getTime() + paymentWindowHours * 3_600_000);

  // Documented deviation: `buildDealNumber`/`buildDealReferenceCode` derive a hex short code from
  // the UUID, which no human-readable demo code can express. The demo deal is recognisable by
  // design, and both columns stay unique because the suffix is fixed.
  const utcDate = now.toISOString().slice(0, 10).replace(/-/g, '');
  const dealNumber = `DL-${utcDate}-DEMO000001`;

  await prisma.deal.upsert({
    where: { id: DEMO_DEAL_ID },
    update: {},
    create: {
      id: DEMO_DEAL_ID,
      dealNumber,
      dealReferenceCode: 'ELM-DEMO000001-C',
      offerId: DEMO_OFFER_ID,
      listingId: DEMO_RESERVED_LISTING_ID,
      buyerProfileId: DEMO_BUYER.profileId,
      sellerProfileId: DEMO_SELLER.profileId,
      dealPrice: amounts.finalDealPrice,
      platformCommission: amounts.finalCommission,
      totalAmount: amounts.finalTotal,
      commissionRateSnapshot: DEFAULT_COMMISSION_RATE.toFixed(4),
      fixedCommissionSnapshot: amounts.fixedCommission,
      paymentWindowHoursSnapshot: paymentWindowHours,
      sellerPayoutAccountId: payout.id,
      sellerPayoutHolderName: payout.accountHolderName,
      sellerPayoutBankName: payout.bankName,
      sellerPayoutIbanEncrypted: payout.ibanEncrypted,
      sellerPayoutIbanMasked: payout.ibanMasked,
      approvedByAdminId: INITIAL_ADMIN_ACCOUNTS[0].id,
      status: DealStatus.UNDER_ADMIN_AUDIT,
      paymentDeadline,
      createdAt: now,
    },
  });

  // Story 5.3: seed two reviewable payment slots with CLEAN FileObjects so the audit queue is demonstrable
  const DEMO_COMMISSION_PROOF_FILE_ID = '77777777-0000-4000-8000-000000000301';
  const DEMO_PURCHASE_PROOF_FILE_ID = '77777777-0000-4000-8000-000000000302';
  const DEMO_COMMISSION_PAYMENT_ID = '99999999-0000-4000-8000-000000000301';
  const DEMO_PURCHASE_PAYMENT_ID = '99999999-0000-4000-8000-000000000302';

  await prisma.fileObject.upsert({
    where: { id: DEMO_COMMISSION_PROOF_FILE_ID },
    update: {},
    create: {
      id: DEMO_COMMISSION_PROOF_FILE_ID,
      bucket: 'elmasaif-private',
      key: 'deals/proofs/commission-proof.pdf',
      fileSize: 102400,
      mimeType: 'application/pdf',
      scanStatus: ScanStatus.CLEAN,
      scannedAt: now,
    },
  });

  await prisma.fileObject.upsert({
    where: { id: DEMO_PURCHASE_PROOF_FILE_ID },
    update: {},
    create: {
      id: DEMO_PURCHASE_PROOF_FILE_ID,
      bucket: 'elmasaif-private',
      key: 'deals/proofs/purchase-proof.pdf',
      fileSize: 204800,
      mimeType: 'application/pdf',
      scanStatus: ScanStatus.CLEAN,
      scannedAt: now,
    },
  });

  await prisma.payment.upsert({
    where: {
      dealId_paymentType: {
        dealId: DEMO_DEAL_ID,
        paymentType: PaymentType.PLATFORM_COMMISSION,
      },
    },
    update: {},
    create: {
      id: DEMO_COMMISSION_PAYMENT_ID,
      dealId: DEMO_DEAL_ID,
      paymentType: PaymentType.PLATFORM_COMMISSION,
      amount: amounts.finalCommission,
      status: 'PROOF_UPLOADED',
      proofFileUrl: DEMO_COMMISSION_PROOF_FILE_ID,
      bankReferenceCode: 'REF-COMM-DEMO-01',
      senderBankName: 'مصرف الراجحي',
      uploadedAt: now,
    },
  });

  await prisma.payment.upsert({
    where: {
      dealId_paymentType: {
        dealId: DEMO_DEAL_ID,
        paymentType: PaymentType.SELLER_PURCHASE_PRICE,
      },
    },
    update: {},
    create: {
      id: DEMO_PURCHASE_PAYMENT_ID,
      dealId: DEMO_DEAL_ID,
      paymentType: PaymentType.SELLER_PURCHASE_PRICE,
      amount: amounts.finalDealPrice,
      status: 'PROOF_UPLOADED',
      proofFileUrl: DEMO_PURCHASE_PROOF_FILE_ID,
      bankReferenceCode: 'REF-PRICE-DEMO-02',
      senderBankName: 'البنك الأهلي السعودي',
      uploadedAt: now,
    },
  });

  console.log(
    `✅ Demo deal seeded: ${dealNumber} (ELM-DEMO000001-C) for ${DEMO_BUYER.username}, ` +
      `payment deadline ${paymentDeadline.toISOString()} with 2 reviewable payments in PROOF_UPLOADED.`
  );
}

// Story 5.4: Seed scenario for a completed deal with generated invoice and released contacts for manual QA.
const DEMO_COMPLETED_DEAL_ID = '99999999-0000-4000-8000-000000000205';
const DEMO_COMPLETED_OFFER_ID = '99999999-0000-4000-8000-000000000206';
const DEMO_COMPLETED_LISTING_ID = '88888888-0000-4000-8000-000000000003';

export async function seedDemoCompletedDeal() {
  console.log('🎉 Seeding Demo Completed Deal, Invoice & Rating (Story 5.4)...');
  const now = new Date();

  await prisma.offer.upsert({
    where: { id: DEMO_COMPLETED_OFFER_ID },
    update: {},
    create: {
      id: DEMO_COMPLETED_OFFER_ID,
      listingId: DEMO_COMPLETED_LISTING_ID,
      buyerProfileId: DEMO_BUYER.profileId,
      offerPrice: 2000000,
      status: OfferStatus.CONVERTED_TO_DEAL,
      expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000),
    },
  });

  const amounts = computeDealAmounts({
    dealPrice: '2000000',
    commissionRate: DEFAULT_COMMISSION_RATE,
    fixedCommission: DEFAULT_FIXED_COMMISSION_SAR,
  });

  const dealNumber = `DL-20261107-DEMO000002`;

  await prisma.deal.upsert({
    where: { id: DEMO_COMPLETED_DEAL_ID },
    update: {},
    create: {
      id: DEMO_COMPLETED_DEAL_ID,
      dealNumber,
      dealReferenceCode: 'ELM-DEMO000002-C',
      offerId: DEMO_COMPLETED_OFFER_ID,
      listingId: DEMO_COMPLETED_LISTING_ID,
      buyerProfileId: DEMO_BUYER.profileId,
      sellerProfileId: DEMO_SELLER.profileId,
      dealPrice: amounts.finalDealPrice,
      platformCommission: amounts.finalCommission,
      totalAmount: amounts.finalTotal,
      commissionRateSnapshot: DEFAULT_COMMISSION_RATE.toFixed(4),
      fixedCommissionSnapshot: amounts.fixedCommission,
      paymentWindowHoursSnapshot: 48,
      sellerPayoutAccountId: DEMO_PAYOUT_ACCOUNT_ID,
      sellerPayoutHolderName: DEMO_SELLER.fullName,
      sellerPayoutBankName: getSaudiBankName(DEMO_SELLER.iban),
      sellerPayoutIbanEncrypted: 'mock-ciphertext',
      sellerPayoutIbanMasked: maskSaudiIban(DEMO_SELLER.iban),
      approvedByAdminId: '00000000-0000-0000-0000-000000000001',
      status: DealStatus.COMPLETED,
      paymentDeadline: new Date(now.getTime() - 24 * 3_600_000),
      completedAt: now,
      createdAt: new Date(now.getTime() - 48 * 3_600_000),
    },
  });

  await prisma.payment.upsert({
    where: {
      dealId_paymentType: {
        dealId: DEMO_COMPLETED_DEAL_ID,
        paymentType: PaymentType.PLATFORM_COMMISSION,
      },
    },
    update: {},
    create: {
      dealId: DEMO_COMPLETED_DEAL_ID,
      paymentType: PaymentType.PLATFORM_COMMISSION,
      amount: amounts.finalCommission,
      status: 'CONFIRMED',
      proofFileUrl: 'mock-proof-url-1',
      bankReferenceCode: 'REF-COMM-COMPL-01',
      senderBankName: 'مصرف الراجحي',
      uploadedAt: now,
      verifiedAt: now,
    },
  });

  await prisma.payment.upsert({
    where: {
      dealId_paymentType: {
        dealId: DEMO_COMPLETED_DEAL_ID,
        paymentType: PaymentType.SELLER_PURCHASE_PRICE,
      },
    },
    update: {},
    create: {
      dealId: DEMO_COMPLETED_DEAL_ID,
      paymentType: PaymentType.SELLER_PURCHASE_PRICE,
      amount: amounts.finalDealPrice,
      status: 'CONFIRMED',
      proofFileUrl: 'mock-proof-url-2',
      bankReferenceCode: 'REF-PRICE-COMPL-02',
      senderBankName: 'البنك الأهلي السعودي',
      uploadedAt: now,
      verifiedAt: now,
    },
  });

  const vat = computeVatBreakdown(String(amounts.finalCommission), 0.15);
  await prisma.invoiceRecord.upsert({
    where: { invoiceNumber: `INV-20261107-${dealNumber}` },
    update: {},
    create: {
      invoiceNumber: `INV-20261107-${dealNumber}`,
      dealId: DEMO_COMPLETED_DEAL_ID,
      sellerId: DEMO_SELLER.profileId,
      buyerId: DEMO_BUYER.profileId,
      subtotalAmount: vat.subtotalAmount,
      vatAmount: vat.vatAmount,
      vatRate: 0.15,
      totalAmount: vat.totalAmount,
      vatTreatment: vat.vatTreatment,
      partyDetails: {
        buyer: {
          profileId: DEMO_BUYER.profileId,
          userId: DEMO_BUYER.id,
          fullName: DEMO_BUYER.fullName,
          mobileNumber: DEMO_BUYER.mobileNumber,
        },
        seller: {
          profileId: DEMO_SELLER.profileId,
          userId: DEMO_SELLER.id,
          fullName: DEMO_SELLER.fullName,
          mobileNumber: DEMO_SELLER.mobileNumber,
        },
        deal: {
          dealNumber,
          dealPrice: amounts.finalDealPrice,
          platformCommission: amounts.finalCommission,
        },
      },
      createdAt: now,
    },
  });

  console.log(`✅ Demo completed deal seeded: ${dealNumber} with confirmed payments and invoice.`);
}

export const SEED_OWNER_CONTRACT_TEMPLATE_ID = '77777777-0001-4000-8000-000000000001';

export const STANDARD_OWNER_CONTRACT_CONTENT = `عقد تسويق ووساطة عقارية إلكتروني (مالك مباشر)
وفقاً للائحة التنفيذية لنظام الوساطة العقارية الصادرة عن الهيئة العامة للعقار بالمملكة العربية السعودية.

تاريخ الإرسال: {{dispatchDate}}

الطرف الأول (الوسيط العقاري): منصة المصايف العقارية (سجل تجاري رقم 1010000000، ترخيص فال للوساطة والتسويق العقاري رقم 1200000000).
الطرف الثاني (المالك): {{ownerName}} (رقم الهوية الوطنية / الإقامة: {{nationalId}}).

تمهيد:
حيث أن الطرف الثاني هو المالك الشرعي للعقار المبين في هذا العقد، ورغبته في تفويض منصة المصايف العقارية كوسيط عقاري مرخص لتسويق وعرض العقار في المنصة الإلكترونية، فقد اتفق الطرفان بكامل أهليتهما المعتبرة شرعاً ونظاماً على البنود الآتية:

البند الأول: بيانات العقار ومواصفاته:
- عنوان العقار: {{propertyTitle}}
- نوع العقار: {{propertyType}}
- المدينة: {{cityName}}
- الحي: {{districtName}}
- السعر المطلوب: {{askPrice}} ريال سعودي

البند الثاني: التزامات الوسيط (الطرف الأول):
1. تسويق العقار عبر القنوات الرقمية المعتمدة لمنصة المصايف مع الالتزام بضوابط الإعلانات العقارية الصادرة عن الهيئة العامة للعقار.
2. التحقق من سلامة وثائق الملكية والمعلومات المقدمة وفق الإجراءات النظامية.
3. استقبال العروض والطلبات وإتاحتها للطرف الثاني بشفافية عبر المنصة.

البند الثالث: التزامات المالك (الطرف الثاني):
1. الإقرار بصحة كافة المستندات والبيانات والوثائق المقدمة بشأن صك الملكية وخلو العقار من أي نزاع أو حجز قضائي يمنع التصرف فيه.
2. سداد رسوم العقد والتسويق المقررة بمبلغ قدره ({{contractFee}} ريال سعودي) والمستحقة على الحساب البنكي للمنصة (IBAN: {{platformIBAN}}).
3. الالتزام بعدم التصرف في العقار بطريقة تتعارض مع التزامات الوساطة أثناء سريان هذا العقد.

البند الرابع: المدة والإنهاء:
يسري هذا العقد فور اكتمال التوقيع الإلكتروني من الطرفين وسداد الرسوم المقررة، وتكون مدة سريان العقد 90 يوماً ميلادياً تجدد بموافقة الطرفين.

البند الخامس: الإخطارات والنظام الحاكم:
تعد المراسلات عبر البريد الإلكتروني والرسائل النصية والمنصة إخطاراً رسمياً منتجاً لآثاره النظامية، ويخضع هذا العقد ويفسر وفقاً للأنظمة واللوائح المعمول بها في المملكة العربية السعودية وخاصة نظام الوساطة العقارية ولائحته التنفيذية.`;

export async function seedContractTemplates() {
  await prisma.contractTemplate.upsert({
    where: { id: SEED_OWNER_CONTRACT_TEMPLATE_ID },
    update: {
      title: 'عقد تسويق ووساطة عقارية إلكتروني قياسي (مالك مباشر)',
      content: STANDARD_OWNER_CONTRACT_CONTENT,
      version: 1,
      isActive: true,
    },
    create: {
      id: SEED_OWNER_CONTRACT_TEMPLATE_ID,
      title: 'عقد تسويق ووساطة عقارية إلكتروني قياسي (مالك مباشر)',
      content: STANDARD_OWNER_CONTRACT_CONTENT,
      version: 1,
      isActive: true,
    },
  });

  console.log(`✅ Standard contract template seeded: ${SEED_OWNER_CONTRACT_TEMPLATE_ID}`);
}

export async function seedPlatformSettings() {
  await prisma.platformSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      commissionRate: 0.0250,
      fixedFeeSar: 0.00,
      ownerContractFeeSar: 1000.00,
      vatRate: 15.00,
      paymentWindowHours: 48,
      paymentCorrectionHours: 12,
      contractFeeDeadlineDays: 7,
      coolingOffPeriodDays: 14,
      dealReviewSlaAlertHours: 4,
      dealReviewSlaEscalationHours: 12,
      dealReviewSlaSuperAdminHours: 24,
      ticketSlaFirstResponseHours: 4,
      ticketSlaResolutionHours: 48,
      taskClaimLeaseMinutes: 15,
      taskClaimHeartbeatMinutes: 5,
      fraudRejectedProofThreshold: 3,
      fraudWindowHours: 72,
    },
  });

  console.log('✅ Default platform settings seeded');
}

async function main() {
  try {
    await seedGeographicData();
    await seedAdminUsers();
    await seedContractTemplates();
    await seedPlatformSettings();
    await seedDemoListings();
    await seedDemoDeal();
    await seedDemoCompletedDeal();
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
