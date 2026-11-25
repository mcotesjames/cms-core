import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from src/data/schema.ts into migrations/platform/ (spec section 2).
// Wrangler applies them: `npm run db:migrate` locally.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/data/schema.ts",
  out: "./migrations/platform",
});
