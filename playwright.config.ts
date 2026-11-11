import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

// 画面の自動テスト（DEC-64 の Playwright と axe）。組み立てた乗客の SPA をサーバーが同じ入口から配る（DEC-23）。
// 対象は iOS の Safari（TC-09）だが、手元にあるのは Chromium だけなので、iPhone の大きさの Chromium で動かす。
const port = 8181;
const database = join(tmpdir(), `ride-e2e-${process.pid}-${Date.now()}.db`);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node apps/server/src/main.ts",
    url: `http://localhost:${port}/login`,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      APP_VERSION: "e2e",
      APP_ORIGIN: `http://localhost:${port}`,
      TURSO_DATABASE_URL: `file:${database}`,
      PORT: String(port),
      D_PICKUP_ACCURACY_M: "50",
      SEED_DEMO: "1",
      STATIC_DIR: "apps/web-passenger/dist",
      // 実時間を短くする（DEC-45 の設計上の値を環境変数で替える）。T_hold_wait 8 秒、T_op_stale 2 秒、見回り 0.5 秒。
      T_HOLD_WAIT_MS: "8000",
      T_OP_STALE_MS: "2000",
      P_SWEEP_MS: "500",
      P_TAIL_MS: "200",
    },
  },
});
