import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Seed Company
  await prisma.company.upsert({
    where: { id: 1 },
    update: {},
    create: {
      companyName: 'STAR HOTEL',
      streetAddress: '9, Jalan Bintang, 50100 Kuala Lumpur, Malaysia',
      contactNo: 'Tel/Fax : +603 - 4200 6336',
      currencySymbol: 'MYR',
      productVersion: '2.0.0',
      databaseVersion: 2.0,
      active: true,
    },
  });

  // Seed User Groups
  const groups = [
    { id: 1, groupName: 'Administrator', groupDesc: 'Highest Level User Group', securityLevel: 99, active: true },
    { id: 2, groupName: 'Manager', groupDesc: 'Cannot access Admin level', securityLevel: 98, active: false },
    { id: 3, groupName: 'Supervisor', groupDesc: 'Supervisor', securityLevel: 20, active: false },
    { id: 4, groupName: 'Clerk', groupDesc: 'Cashier', securityLevel: 10, active: true },
  ];
  for (const g of groups) {
    await prisma.userGroup.upsert({ where: { id: g.id }, update: {}, create: g });
  }

  // Seed Users (admin/admin, clerk/clerk)
  const adminHash = await bcrypt.hash('admin', 12);
  const clerkHash = await bcrypt.hash('clerk', 12);

  await prisma.userData.upsert({
    where: { userId: 'ADMIN' },
    update: {},
    create: {
      userGroup: 1, userId: 'ADMIN', userName: 'Demo Admin',
      userPassword: adminHash, idle: 0, loginAttempts: 0,
      changePassword: false, dashboardBlink: true, active: true,
    },
  });
  await prisma.userData.upsert({
    where: { userId: 'CLERK' },
    update: {},
    create: {
      userGroup: 4, userId: 'CLERK', userName: 'Receptionist',
      userPassword: clerkHash, idle: 300, loginAttempts: 0,
      changePassword: false, dashboardBlink: true, active: true,
    },
  });

  // Seed Module Access — matches legacy modGlobal.bas MOD_ constants
  const modules = [
    { moduleId: 1, moduleDesc: 'Dashboard', moduleType: 'Form', group1: true, group2: false, group3: false, group4: true },
    { moduleId: 2, moduleDesc: 'Booking', moduleType: 'Form', group1: true, group2: false, group3: false, group4: true },
    { moduleId: 3, moduleDesc: 'List Report', moduleType: 'Form', group1: true, group2: false, group3: false, group4: true },
    { moduleId: 4, moduleDesc: 'Print Report', moduleType: 'Form', group1: true, group2: false, group3: false, group4: false },
    { moduleId: 5, moduleDesc: 'Export Report', moduleType: 'Form', group1: true, group2: false, group3: false, group4: false },
    { moduleId: 6, moduleDesc: 'Edit Report', moduleType: 'Form', group1: true, group2: false, group3: false, group4: false },
    { moduleId: 7, moduleDesc: 'Edit Report (Expert)', moduleType: 'Form', group1: true, group2: false, group3: false, group4: false },
    { moduleId: 8, moduleDesc: 'Find Customer', moduleType: 'Form', group1: true, group2: false, group3: false, group4: true },
    { moduleId: 9, moduleDesc: 'Maintain Room', moduleType: 'Form', group1: true, group2: false, group3: false, group4: false },
    { moduleId: 10, moduleDesc: 'Maintain User', moduleType: 'Form', group1: true, group2: false, group3: false, group4: false },
    { moduleId: 11, moduleDesc: 'Access Control', moduleType: 'Form', group1: true, group2: false, group3: false, group4: false },
  ];
  for (const m of modules) {
    await prisma.moduleAccess.upsert({
      where: { id: m.moduleId },
      update: {},
      create: { id: m.moduleId, ...m, active: true },
    });
  }

  // Seed Room Types
  const roomTypes = ['SINGLE BED ROOM', 'DOUBLE BED ROOM', 'TWIN BED ROOM', 'DORM'];
  for (let i = 0; i < roomTypes.length; i++) {
    await prisma.roomType.upsert({
      where: { id: i + 1 },
      update: {},
      create: { typeShortName: roomTypes[i], typeLongName: '', active: true },
    });
  }

  // Seed Sample Rooms (11 rooms on Level 1, matching legacy default)
  const roomNames = ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111'];
  for (let i = 0; i < roomNames.length; i++) {
    await prisma.room.upsert({
      where: { id: i + 1 },
      update: {},
      create: {
        roomShortName: roomNames[i],
        roomLongName: '',
        roomStatus: 'Open',
        roomType: i < 4 ? 'SINGLE BED ROOM' : i < 7 ? 'DOUBLE BED ROOM' : 'TWIN BED ROOM',
        roomLocation: 'Level 1',
        roomPrice: i < 4 ? 100 : i < 7 ? 150 : 200,
        breakfast: true,
        breakfastPrice: 10,
        maintenance: false,
        active: true,
        createdBy: 'System',
      },
    });
  }

  console.log('Seed data inserted successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });