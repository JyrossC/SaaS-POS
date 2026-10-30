const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const permissions = [
  ['dashboard.view', 'View the tenant dashboard'],
  ['products.view', 'View tenant products'],
  ['products.create', 'Create tenant products'],
  ['products.update', 'Update tenant products'],
  ['products.archive', 'Archive tenant products'],
  ['inventory.view', 'View scoped store inventory'],
  ['inventory.adjust', 'Adjust scoped store inventory'],
  ['inventory.transfer', 'Transfer stock between stores'],
  ['inventory.count', 'Perform stock counts'],
  ['sales.view', 'View scoped sales'],
  ['sales.create', 'Create sales'],
  ['sales.void', 'Void a sale'],
  ['sales.refund', 'Issue a sales refund'],
  ['purchases.view', 'View purchasing records'],
  ['purchases.create', 'Create purchase orders'],
  ['purchases.approve', 'Approve purchase orders'],
  ['stores.view', 'View tenant stores'],
  ['stores.create', 'Create tenant stores'],
  ['stores.update', 'Update tenant store configuration'],
  ['staff.view', 'View tenant staff'],
  ['staff.invite', 'Invite tenant staff'],
  ['staff.update', 'Update tenant staff membership'],
  ['staff.deactivate', 'Deactivate tenant staff'],
  ['roles.view', 'View tenant roles'],
  ['roles.create', 'Create tenant roles'],
  ['roles.update', 'Update tenant roles'],
  ['roles.assign_permissions', 'Assign permissions to tenant roles'],
  ['reports.view', 'View authorized reports'],
  ['reports.export', 'Export authorized reports'],
  ['pharmacy.batches.view', 'View pharmacy batches'],
  ['pharmacy.batches.manage', 'Manage pharmacy batches'],
  ['pharmacy.dispensing.create', 'Create dispensing records'],
  ['pharmacy.prescriptions.view', 'View prescriptions'],
  ['subscriptions.view', 'View subscription and plan details'],
  ['subscriptions.manage', 'Manage tenant subscription'],
];

const platformModules = [
  'pos', 'products', 'inventory', 'purchasing',
  'pharmacy', 'analytics', 'ai', 'stores', 'staff',
];

const defaultPlans = [
  {
    code: 'STARTER',
    name: 'Starter',
    trialDays: 14,
    billingPeriodDays: 30,
    price: '29.00',
    entitlements: [
      { key: 'pos', value: true },
      { key: 'products', value: true },
      { key: 'inventory', value: true },
      { key: 'purchasing', value: false },
      { key: 'pharmacy', value: false },
      { key: 'analytics', value: true },
      { key: 'ai', value: false },
      { key: 'stores', value: true },
      { key: 'staff', value: true },
      { key: 'limit.stores', value: 1 },
      { key: 'limit.staff', value: 3 },
    ],
  },
  {
    code: 'GROWTH',
    name: 'Growth',
    trialDays: 14,
    billingPeriodDays: 30,
    price: '79.00',
    entitlements: [
      { key: 'pos', value: true },
      { key: 'products', value: true },
      { key: 'inventory', value: true },
      { key: 'purchasing', value: true },
      { key: 'pharmacy', value: false },
      { key: 'analytics', value: true },
      { key: 'ai', value: false },
      { key: 'stores', value: true },
      { key: 'staff', value: true },
      { key: 'limit.stores', value: 3 },
      { key: 'limit.staff', value: 10 },
    ],
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    trialDays: 14,
    billingPeriodDays: 30,
    price: '199.00',
    entitlements: [
      { key: 'pos', value: true },
      { key: 'products', value: true },
      { key: 'inventory', value: true },
      { key: 'purchasing', value: true },
      { key: 'pharmacy', value: true },
      { key: 'analytics', value: true },
      { key: 'ai', value: true },
      { key: 'stores', value: true },
      { key: 'staff', value: true },
      { key: 'limit.stores', value: 10 },
      { key: 'limit.staff', value: 30 },
    ],
  },
];

async function seedSystemCatalog() {
  await prisma.permission.createMany({
    data: permissions.map(([code, description]) => ({ code, description })),
    skipDuplicates: true,
  });

  for (const moduleKey of platformModules) {
    await prisma.platformModule.upsert({
      where: { moduleKey },
      create: { moduleKey, enabled: true },
      update: {},
    });
  }

  for (const plan of defaultPlans) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { code: plan.code } });
    if (existing) continue;

    const created = await prisma.subscriptionPlan.create({
      data: { code: plan.code, name: plan.name },
    });
    const version = await prisma.subscriptionPlanVersion.create({
      data: {
        planId: created.id,
        version: 1,
        isActive: true,
        trialDays: plan.trialDays,
        billingPeriodDays: plan.billingPeriodDays,
        price: plan.price,
        currency: 'USD',
      },
    });
    await prisma.planEntitlement.createMany({
      data: plan.entitlements.map(({ key, value }) => ({
        planVersionId: version.id,
        key,
        value,
      })),
    });
  }
}

seedSystemCatalog()
  .then(() => { console.log('System catalog seeded successfully.'); })
  .catch((error) => {
    console.error('Seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });