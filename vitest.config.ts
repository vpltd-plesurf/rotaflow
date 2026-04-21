import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Tests hit the Supabase REST API directly. Load creds from .env.local.
config({ path: ".env.local" });

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Isolation tests mutate shared DB state — run serially across files.
    // Within a file, beforeAll→tests→afterAll is sequential by default.
    fileParallelism: false,
  },
});
