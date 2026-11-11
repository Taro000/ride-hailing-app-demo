import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "packages/{domain,application,adapters,contracts}/test/**/*.test.ts",
            "apps/server/test/**/*.test.ts",
          ],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "web",
          environment: "jsdom",
          include: ["packages/web-shared/test/**/*.test.{ts,tsx}", "apps/web-passenger/test/**/*.test.{ts,tsx}"],
          setupFiles: ["apps/web-passenger/test/setup.ts"],
        },
      },
    ],
  },
});
