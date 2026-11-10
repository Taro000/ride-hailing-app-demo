import type { Eta, HistoryType, PassengerRide, Place } from "@ride/contracts";
import {
  activeRideStates,
  canChangePayment,
  canTransition,
  type PaymentStateValue,
  type RideState,
} from "@ride/domain";
import type { Exec } from "./db.ts";
import type { IdGenerator } from "./ports.ts";

// 配車のモジュール（DAT-06、DAT-07 を書く唯一のモジュール。DEC-09、NFR-11）。
// 状態の変化は状態遷移表で許されたものだけを、version の条件付きの書き込みで行い、同じトランザクションで履歴を追記する。

export interface RideRow {
  rideId: string;
  passengerId: string;
  state: RideState;
  version: number;
  pickup: Place;
  dropoff: Place;
  fareBooked: number;
  fareCurrent: number;
  etaShown: Eta;
  thresholdCurrent: number | null;
  paymentStatus: PaymentStateValue;
  cancelRequested: boolean;
  cancelledBy: "passenger" | "driver" | "system" | null;
  cancelReason: string | null;
  estimateId: string;
  createdAt: string;
  updatedAt: string;
  testAccount: boolean;
}

const rideColumns = `ride_id, passenger_id, state, version, pickup_json, dropoff_json, fare_booked, fare_current,
  eta_shown_json, threshold_current, payment_status, cancel_requested, cancelled_by, cancel_reason, estimate_id,
  created_at, updated_at, test_account`;

const prefixedRideColumns = rideColumns
  .split(",")
  .map((column) => `r.${column.trim()}`)
  .join(", ");

export function rowToRide(row: Record<string, unknown>): RideRow {
  return {
    rideId: String(row.ride_id),
    passengerId: String(row.passenger_id),
    state: String(row.state) as RideState,
    version: Number(row.version),
    pickup: JSON.parse(String(row.pickup_json)) as Place,
    dropoff: JSON.parse(String(row.dropoff_json)) as Place,
    fareBooked: Number(row.fare_booked),
    fareCurrent: Number(row.fare_current),
    etaShown: JSON.parse(String(row.eta_shown_json)) as Eta,
    thresholdCurrent: row.threshold_current === null ? null : Number(row.threshold_current),
    paymentStatus: String(row.payment_status) as PaymentStateValue,
    cancelRequested: Number(row.cancel_requested) === 1,
    cancelledBy: (row.cancelled_by as RideRow["cancelledBy"]) ?? null,
    cancelReason: row.cancel_reason === null ? null : String(row.cancel_reason),
    estimateId: String(row.estimate_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    testAccount: Number(row.test_account) === 1,
  };
}

export async function getRide(exec: Exec, rideId: string): Promise<RideRow | null> {
  const found = await exec.execute({ sql: `SELECT ${rideColumns} FROM rides WHERE ride_id = ?`, args: [rideId] });
  return found.rows[0] ? rowToRide(found.rows[0]) : null;
}

export async function getPassengerRide(exec: Exec, rideId: string, passengerId: string): Promise<RideRow | null> {
  const ride = await getRide(exec, rideId);
  // 他人の依頼も 404 にする（DRV-29）。
  return ride && ride.passengerId === passengerId ? ride : null;
}

const activeList = activeRideStates.map((state) => `'${state}'`).join(", ");

export async function findActiveRide(exec: Exec, passengerId: string): Promise<RideRow | null> {
  const found = await exec.execute({
    sql: `SELECT ${rideColumns} FROM rides WHERE passenger_id = ? AND state IN (${activeList})`,
    args: [passengerId],
  });
  return found.rows[0] ? rowToRide(found.rows[0]) : null;
}

// GET /api/v1/passenger/rides/active: 進行中の依頼。なければ押さえの確かめか解放が続く最新の not_booked か cancelled。
export async function findActiveOrSettlingRide(exec: Exec, passengerId: string): Promise<RideRow | null> {
  const active = await findActiveRide(exec, passengerId);
  if (active) return active;
  const found = await exec.execute({
    sql: `SELECT ${rideColumns} FROM rides
          WHERE passenger_id = ? AND state IN ('not_booked', 'cancelled')
            AND payment_status IN ('hold_checking', 'release_checking')
          ORDER BY created_at DESC LIMIT 1`,
    args: [passengerId],
  });
  return found.rows[0] ? rowToRide(found.rows[0]) : null;
}

export async function hasUnpaidRide(exec: Exec, passengerId: string): Promise<boolean> {
  const found = await exec.execute({
    sql: "SELECT 1 FROM rides WHERE passenger_id = ? AND payment_status IN ('unpaid', 'unpaid_checking') LIMIT 1",
    args: [passengerId],
  });
  return found.rows.length > 0;
}

export interface NewRide {
  rideId: string;
  passengerId: string;
  pickup: Place;
  dropoff: Place;
  fareYen: number;
  eta: Eta;
  threshold: number | null;
  estimateId: string;
  testAccount: boolean;
  now: Date;
}

export async function insertBookingRide(exec: Exec, ride: NewRide): Promise<RideRow> {
  const now = ride.now.toISOString();
  await exec.execute({
    sql: `INSERT INTO rides (ride_id, passenger_id, state, version, pickup_json, dropoff_json, fare_booked, fare_current,
            eta_shown_json, threshold_at_booking, threshold_current, payment_status, estimate_id, created_at, updated_at,
            test_account)
          VALUES (?, ?, 'booking', 1, ?, ?, ?, ?, ?, ?, ?, 'holding', ?, ?, ?, ?)`,
    args: [
      ride.rideId,
      ride.passengerId,
      JSON.stringify(ride.pickup),
      JSON.stringify(ride.dropoff),
      ride.fareYen,
      ride.fareYen,
      JSON.stringify(ride.eta),
      ride.threshold,
      ride.threshold,
      ride.estimateId,
      now,
      now,
      ride.testAccount ? 1 : 0,
    ],
  });
  const created = await getRide(exec, ride.rideId);
  if (!created) throw new Error("ride insert failed");
  return created;
}

export class RideConflictError extends Error {}

export interface HistoryInput {
  type: HistoryType;
  actorKind: "passenger" | "driver" | "staff" | "system";
  actorId: string | null;
  details?: Record<string, unknown>;
  traceId: string | null;
}

export interface RideChange {
  state?: RideState;
  paymentStatus?: PaymentStateValue;
  cancelRequested?: boolean;
  cancelledBy?: "passenger" | "driver" | "system";
  cancelReason?: string | null;
}

// 条件付きの書き込み。読んだ版から変わっていれば RideConflictError（見回りと乗客の操作が重なったとき）。
export async function changeRide(
  exec: Exec,
  ids: IdGenerator,
  ride: RideRow,
  change: RideChange,
  history: HistoryInput | null,
  now: Date,
): Promise<RideRow> {
  const nextState = change.state ?? ride.state;
  if (change.state && change.state !== ride.state && !canTransition(ride.state, change.state)) {
    throw new Error(`ride transition not allowed: ${ride.state} -> ${change.state}`);
  }
  const nextPayment = change.paymentStatus ?? ride.paymentStatus;
  if (
    change.paymentStatus &&
    change.paymentStatus !== ride.paymentStatus &&
    !canChangePayment(ride.paymentStatus, change.paymentStatus)
  ) {
    throw new Error(`payment transition not allowed: ${ride.paymentStatus} -> ${change.paymentStatus}`);
  }
  const updated = await exec.execute({
    sql: `UPDATE rides SET state = ?, payment_status = ?, cancel_requested = ?, cancelled_by = ?, cancel_reason = ?,
            version = version + 1, updated_at = ?
          WHERE ride_id = ? AND version = ?`,
    args: [
      nextState,
      nextPayment,
      (change.cancelRequested ?? ride.cancelRequested) ? 1 : 0,
      change.cancelledBy ?? ride.cancelledBy,
      change.cancelReason === undefined ? ride.cancelReason : change.cancelReason,
      now.toISOString(),
      ride.rideId,
      ride.version,
    ],
  });
  if (updated.rowsAffected !== 1) throw new RideConflictError(ride.rideId);
  if (history) await appendHistory(exec, ids, ride, history, now);
  const after = await getRide(exec, ride.rideId);
  if (!after) throw new Error("ride vanished");
  return after;
}

async function appendHistory(
  exec: Exec,
  ids: IdGenerator,
  ride: RideRow,
  input: HistoryInput,
  now: Date,
): Promise<void> {
  await exec.execute({
    sql: `INSERT INTO ride_history (change_id, ride_id, type, recorded_at, actor_kind, actor_id, details_json, trace_id,
            test_account)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      ids.newId("chg"),
      ride.rideId,
      input.type,
      now.toISOString(),
      input.actorKind,
      input.actorId,
      input.details ? JSON.stringify(input.details) : null,
      input.traceId,
      ride.testAccount ? 1 : 0,
    ],
  });
}

export function toPassengerRide(ride: RideRow): PassengerRide {
  return {
    rideId: ride.rideId,
    state: ride.state,
    version: ride.version,
    pickup: ride.pickup,
    dropoff: ride.dropoff,
    fare: {
      booked: { amount: ride.fareBooked, currency: "jpy" },
      current: { amount: ride.fareCurrent, currency: "jpy" },
    },
    eta: ride.etaShown,
    threshold: ride.thresholdCurrent,
    payment: { state: ride.paymentStatus, unpaidAmount: null, reason: null },
    cancellation:
      ride.state === "cancelled" && ride.cancelledBy
        ? { cancelledBy: ride.cancelledBy, reason: ride.cancelReason }
        : null,
    cancelRequested: ride.cancelRequested,
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
  };
}

export interface HistoryEvent {
  seq: number;
  changeId: string;
  type: HistoryType;
  recordedAt: string;
  ride: RideRow;
}

// 配信の出どころ（DEC-51）。その乗客の依頼の履歴を通し番号の順に読む。依頼は今の姿を添える（IFC-08）。
export async function readPassengerHistoryAfter(
  exec: Exec,
  passengerId: string,
  afterSeq: number,
  limit: number,
): Promise<HistoryEvent[]> {
  const found = await exec.execute({
    sql: `SELECT h.seq, h.change_id, h.type, h.recorded_at, ${prefixedRideColumns}
          FROM ride_history h JOIN rides r ON r.ride_id = h.ride_id
          WHERE r.passenger_id = ? AND h.seq > ?
          ORDER BY h.seq LIMIT ?`,
    args: [passengerId, afterSeq, limit],
  });
  return found.rows.map((row) => ({
    seq: Number(row.seq),
    changeId: String(row.change_id),
    type: String(row.type) as HistoryType,
    recordedAt: String(row.recorded_at),
    ride: rowToRide(row),
  }));
}

export async function maxHistorySeq(exec: Exec): Promise<number> {
  const found = await exec.execute("SELECT COALESCE(MAX(seq), 0) AS seq FROM ride_history");
  return Number(found.rows[0]?.seq ?? 0);
}
