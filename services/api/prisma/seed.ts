import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

/**
 * Seed the first admin user for local dev.
 * Usage: pnpm --filter @crab/api db:seed
 * Credentials come from env (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD),
 * defaulting to admin@crab.local / admin12345.
 */
const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@crab.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`seed: admin ${email} already exists (id=${existing.id})`);
    return;
  }
  const user = await prisma.user.create({
    data: {
      email,
      displayName: "Admin",
      passwordHash: await bcrypt.hash(password, 12),
      isAdmin: true,
    },
  });
  console.log(`seed: created admin ${email} (id=${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
