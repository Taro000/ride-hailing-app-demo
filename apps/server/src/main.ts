import { serve } from "@hono/node-server";
import { FakeMaps, FakeStripe, systemClock } from "@ride/adapters";
import { migrate, openDatabase, sweepOnce, ulidIdGenerator } from "@ride/application";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { jsonLogger } from "./logger.ts";
import { seedDemo } from "./seed.ts";

// サーバー（ELM-04）の入口。Stripe と地図は偽物（DEC-25 の差し替え口）だけを組み立てる。
const config = loadConfig(process.env);
const logger = jsonLogger({ service: "server", appVersion: config.appVersion });
const db = openDatabase({
  url: config.databaseUrl,
  authToken: config.databaseAuthToken,
  timeoutMs: config.dbTimeoutMs,
});
await migrate(db);
const clock = systemClock;
const ids = ulidIdGenerator();
const payments = new FakeStripe(clock);
const maps = new FakeMaps();
if (config.seedDemo) await seedDemo({ db, clock, ids, settings: config.settings });

const app = createApp({ config, db, clock, ids, logger, payments, maps });
const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.log({ event: "server.started", severity: "INFO", message: `listening on ${info.port}` });
});

// 時刻の見回り（DEC-04）。前の回が終わってから次を待つ（重ねない）。
const loop = { running: true };
void (async () => {
  while (loop.running) {
    try {
      await sweepOnce({ db, clock, ids, payments, logger, settings: config.settings });
    } catch (error) {
      logger.log({
        event: "sweep.failed",
        severity: "ERROR",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, config.sweepIntervalMs));
  }
})();

const shutdown = () => {
  loop.running = false;
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
