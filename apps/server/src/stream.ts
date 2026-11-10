import {
  findActiveOrSettlingRide,
  maxHistorySeq,
  readPassengerHistoryAfter,
  toPassengerRide,
  type Database,
  type IdGenerator,
  type Logger,
} from "@ride/application";
import type { RideUpdated, StreamClosing, StreamHello } from "@ride/contracts";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { Env } from "./env.ts";
import type { ServerConfig } from "./config.ts";

// 状態の変化の配信（IFC-08、DEC-03、DEC-51）。出どころは状態の履歴の通し番号。
// 設計はインスタンスが一つの追いかけを持って流れに配る形にした（DEC-51）。この実装は流れごとに 1 秒ごとに読む
// （この規模では読み出しの数が同じくらいで、追いかけと追いつきの間の取りこぼしを作らない）。

export function parseCursor(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^h(\d+)-d(\d+)$/);
  return match ? Number(match[1]) : null;
}

const cursorOf = (historySeq: number) => `h${historySeq}-d0`;

export function streamRoute(
  c: Context<Env>,
  deps: { db: Database; ids: IdGenerator; logger: Logger; config: ServerConfig },
): Response {
  const account = c.get("account");
  if (!account) throw new Error("stream without a session");
  const lastEventId = c.req.header("Last-Event-ID");
  const trace = c.get("trace");

  return streamSSE(c, async (stream) => {
    const state = { closed: false };
    stream.onAbort(() => {
      state.closed = true;
    });
    const openedAt = Date.now();
    let lastWrite = Date.now();
    const parsed = parseCursor(lastEventId);
    let cursor = parsed ?? (await maxHistorySeq(deps.db.client));

    const hello: StreamHello = {
      v: 1,
      appVersion: deps.config.appVersion,
      serverTime: new Date().toISOString(),
      cursor: cursorOf(cursor),
    };
    await stream.writeSSE({ event: "hello", id: cursorOf(cursor), data: JSON.stringify(hello) });
    deps.logger.log({
      event: "stream.opened",
      severity: "INFO",
      message: "stream opened",
      client_trace_id: trace.clientTraceId,
      account_id: account.accountId,
      resumed: parsed !== null,
    });

    // カーソルが読めないときは、今の状態を changeId なしで丸ごと送る（IFC-08）。
    if (lastEventId && parsed === null) {
      const ride = await findActiveOrSettlingRide(deps.db.client, account.accountId);
      if (ride) {
        const message: RideUpdated = {
          v: 1,
          changeId: null,
          changeType: null,
          recordedAt: null,
          ride: toPassengerRide(ride),
        };
        await stream.writeSSE({ event: "ride.updated", id: cursorOf(cursor), data: JSON.stringify(message) });
      }
    }

    while (!state.closed) {
      if (Date.now() - openedAt >= deps.config.streamMaxAgeMs) {
        const closing: StreamClosing = { v: 1, reason: "max_age" };
        await stream.writeSSE({ event: "stream.closing", data: JSON.stringify(closing) });
        break;
      }
      try {
        const events = await readPassengerHistoryAfter(deps.db.client, account.accountId, cursor, 100);
        for (const event of events) {
          const message: RideUpdated = {
            v: 1,
            changeId: event.changeId,
            changeType: event.type,
            recordedAt: event.recordedAt,
            ride: toPassengerRide(event.ride),
          };
          await stream.writeSSE({ event: "ride.updated", id: cursorOf(event.seq), data: JSON.stringify(message) });
          cursor = event.seq;
          lastWrite = Date.now();
        }
      } catch {
        // Turso に届かない。生存確認だけ送り、次の 1 秒でやり直す（IFC-08、DEC-33）。
      }
      if (Date.now() - lastWrite >= deps.config.keepaliveMs) {
        await stream.write(": keepalive\n\n");
        lastWrite = Date.now();
      }
      await stream.sleep(deps.config.tailIntervalMs);
    }
    deps.logger.log({
      event: "stream.closed",
      severity: "INFO",
      message: "stream closed",
      client_trace_id: trace.clientTraceId,
      account_id: account.accountId,
    });
  });
}
