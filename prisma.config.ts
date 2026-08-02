import { defineConfig } from "prisma/config";

/** Prisma 7 config — connection URL lives here (not in schema). */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    // DATABASE_URL points at the target Supabase project (dev/staging/prod).
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
