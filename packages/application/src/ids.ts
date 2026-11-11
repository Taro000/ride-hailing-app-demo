import { randomBytes } from "node:crypto";
import { monotonicFactory } from "ulid";
import { newSessionSecret } from "./auth.ts";
import type { IdGenerator, IdKind } from "./ports.ts";

// 公開する ID は種類の接頭辞と ULID（DEC-39）。route_ は DEC-39 の一覧にない（経路の写しの ID は公開しない）。
export function ulidIdGenerator(): IdGenerator {
  const next = monotonicFactory();
  return {
    newId: (kind: IdKind) => `${kind}_${next()}`,
    newSecret: newSessionSecret,
    newTraceId: () => randomBytes(16).toString("hex"),
  };
}
