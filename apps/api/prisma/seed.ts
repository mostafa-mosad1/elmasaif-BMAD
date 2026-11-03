import { PrismaClient, AdminRole } from '@prisma/client';
import * as argon2 from 'argon2';

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

async function main() {
  try {
    await seedGeographicData();
    await seedAdminUsers();
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
