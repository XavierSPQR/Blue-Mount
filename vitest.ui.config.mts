import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Component tests run in plain node and must NOT require the Firestore
 * emulator, so they get their own config rather than joining the
 * `tests/rules/**` suite that `npm run test:rules` boots an emulator for.
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["tests/ui/**/*.test.tsx"], environment: "node" },
});
