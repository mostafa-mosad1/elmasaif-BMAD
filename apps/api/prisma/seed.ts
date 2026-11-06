import { PrismaClient, AdminRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { getSaudiBankName, maskSaudiIban } from '@elmasaif/shared';
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

    await prisma.adminUser.upsert({
      where: { username: account.username },
      update: {
        email: account.email,
        fullName: account.fullName,
        passwordHash,
        role: account.role,
        isActive: true,
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
        isActive: true,
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

async function main() {
  try {
    await seedGeographicData();
    await seedAdminUsers();
    await seedDemoListings();
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
