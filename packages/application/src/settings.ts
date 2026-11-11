import { demoFareTable, type FareTable } from "@ride/domain";

// 設計上の値（DEC-45 は環境変数で渡す）。値はどれも設計の仮の値で、ここでは既定値として持つ。
export interface AppSettings {
  holdWaitMs: number; // T_hold_wait（DEC-52）
  opStaleMs: number; // T_op_stale（DEC-48）
  idemKeepMs: number; // T_idem_keep（DEC-48）
  estimateValidMs: number; // T_estimate_valid（passenger.openapi.yaml の Estimate.expiresAt）
  sessionIdleMs: number; // 最後に使ってから（DEC-43）
  sessionMaxMs: number; // 長くても（DEC-43）
  fareTable: FareTable;
  etaMatchSec: number; // ドライバーが見つかるまでの見込み（設計にない。実装で決めた固定値）
  etaPickupSec: number; // 迎車の見込み（同上）
  cancellationFeeYen: number;
}

export const defaultSettings: AppSettings = {
  holdWaitMs: 60_000,
  opStaleMs: 30_000,
  idemKeepMs: 7 * 24 * 60 * 60_000,
  estimateValidMs: 10 * 60_000,
  sessionIdleMs: 24 * 60 * 60_000,
  sessionMaxMs: 7 * 24 * 60 * 60_000,
  fareTable: demoFareTable,
  etaMatchSec: 120,
  etaPickupSec: 300,
  cancellationFeeYen: 500,
};
