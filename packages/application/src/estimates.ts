import type { Estimate, EstimateRequest, Place, PlaceCandidates, PlaceInput, PlaceResolved } from "@ride/contracts";
import { computeEta, computeFare } from "@ride/domain";
import type { Database } from "./db.ts";
import type { Clock, IdGenerator, Logger, MapsGateway, TraceContext } from "./ports.ts";
import { ok, problem, type ApiResult } from "./result.ts";
import type { AppSettings } from "./settings.ts";

// 場所（FR-02）と見積もり（FR-03）。料金のモジュール（DAT-05 を書く唯一のモジュール）と地図のモジュール（DAT-11）。

export interface EstimateDeps {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  maps: MapsGateway;
  logger: Logger;
  settings: AppSettings;
  pickupAccuracyM: number | null; // D_pickup_accuracy（未定の値。DEC-45）
}

export async function searchPlaces(
  deps: EstimateDeps,
  trace: TraceContext,
  input: { query: string; sessionToken: string; near: { lat: number; lng: number } | null },
): Promise<ApiResult> {
  const result = await deps.maps.autocomplete(input.query, input.sessionToken, input.near, trace);
  if (result.kind === "unavailable") return problem("MAPS_UNAVAILABLE", trace.clientTraceId);
  const body: PlaceCandidates = { items: result.value.slice(0, 10), nextCursor: null };
  return ok(200, body);
}

export async function resolvePlace(
  deps: EstimateDeps,
  trace: TraceContext,
  input: { placeId: string; sessionToken: string },
): Promise<ApiResult> {
  const result = await deps.maps.placeDetails(input.placeId, input.sessionToken, trace);
  if (result.kind === "unavailable") return problem("MAPS_UNAVAILABLE", trace.clientTraceId);
  if (!result.value) return problem("NOT_FOUND", trace.clientTraceId);
  const body: PlaceResolved = result.value;
  return ok(200, body);
}

const yen = (amount: number) => ({ amount, currency: "jpy" as const });

function toPlace(input: PlaceInput): Place {
  return {
    label: input.label ?? (input.source === "current_location" ? "現在地" : "指定した場所"),
    address: null,
    placeId: input.placeId ?? null,
    position: input.position,
  };
}

export async function createEstimate(
  deps: EstimateDeps,
  trace: TraceContext,
  accountId: string,
  input: EstimateRequest,
): Promise<ApiResult> {
  // 現在地の誤差が D_pickup_accuracy を超え、ピンで確かめていない（FR-02 AC3）。
  if (
    input.pickup.source === "current_location" &&
    deps.pickupAccuracyM !== null &&
    (input.pickup.accuracyM ?? Number.POSITIVE_INFINITY) > deps.pickupAccuracyM &&
    !input.pickup.pinConfirmed
  ) {
    return problem("PICKUP_NOT_CONFIRMED", trace.clientTraceId);
  }
  const route = await deps.maps.computeRoute(input.pickup.position, input.dropoff.position, trace);
  if (route.kind === "unavailable") return problem("MAPS_UNAVAILABLE", trace.clientTraceId);
  if (!route.value) return problem("NO_ROUTE", trace.clientTraceId);

  const now = deps.clock.now();
  const fare = computeFare(route.value.distanceM, route.value.durationSec, deps.settings.fareTable);
  const components = {
    matchSec: deps.settings.etaMatchSec,
    pickupSec: deps.settings.etaPickupSec,
    rideSec: route.value.durationSec,
  };
  const eta = { arrivalAt: computeEta(now, components).toISOString(), components };
  const estimate: Estimate = {
    estimateId: deps.ids.newId("est"),
    pickup: toPlace(input.pickup),
    dropoff: toPlace(input.dropoff),
    fare: {
      total: yen(fare.total),
      base: yen(fare.base),
      distance: yen(fare.distance),
      time: yen(fare.time),
      pickupFee: yen(fare.pickupFee),
      bookingFee: yen(fare.bookingFee),
    },
    eta,
    durationSec: route.value.durationSec,
    distanceM: route.value.distanceM,
    route: {
      encodedPolyline: route.value.encodedPolyline,
      distanceM: route.value.distanceM,
      durationSec: route.value.durationSec,
    },
    expiresAt: new Date(now.getTime() + deps.settings.estimateValidMs).toISOString(),
  };
  const routeId = deps.ids.newId("route");
  await deps.db.write(async (tx) => {
    await tx.execute({
      sql: `INSERT INTO routes (route_id, purpose, estimate_id, encoded_polyline, distance_m, duration_s, computed_at)
            VALUES (?, 'estimate', ?, ?, ?, ?, ?)`,
      args: [
        routeId,
        estimate.estimateId,
        route.value!.encodedPolyline,
        route.value!.distanceM,
        route.value!.durationSec,
        now.toISOString(),
      ],
    });
    await tx.execute({
      sql: `INSERT INTO estimates (estimate_id, account_id, kind, pickup_json, dropoff_json, distance_m, duration_s,
              fare_json, eta_json, route_id, created_at, expires_at)
            VALUES (?, ?, 'booking', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        estimate.estimateId,
        accountId,
        JSON.stringify(estimate.pickup),
        JSON.stringify(estimate.dropoff),
        estimate.distanceM,
        estimate.durationSec,
        JSON.stringify(estimate.fare),
        JSON.stringify(estimate.eta),
        routeId,
        now.toISOString(),
        estimate.expiresAt,
      ],
    });
  });
  return ok(201, estimate);
}

export interface StoredEstimate {
  estimateId: string;
  pickup: Place;
  dropoff: Place;
  fareTotal: number;
  eta: Estimate["eta"];
  expiresAt: string;
  usedByRideId: string | null;
}

export async function getEstimate(
  exec: { execute: Database["client"]["execute"] },
  accountId: string,
  estimateId: string,
): Promise<StoredEstimate | null> {
  const found = await exec.execute({
    sql: `SELECT estimate_id, pickup_json, dropoff_json, fare_json, eta_json, expires_at, used_by_ride_id
          FROM estimates WHERE estimate_id = ? AND account_id = ?`,
    args: [estimateId, accountId],
  });
  const row = found.rows[0];
  if (!row) return null;
  const fare = JSON.parse(String(row.fare_json)) as Estimate["fare"];
  return {
    estimateId: String(row.estimate_id),
    pickup: JSON.parse(String(row.pickup_json)) as Place,
    dropoff: JSON.parse(String(row.dropoff_json)) as Place,
    fareTotal: fare.total.amount,
    eta: JSON.parse(String(row.eta_json)) as Estimate["eta"],
    expiresAt: String(row.expires_at),
    usedByRideId: row.used_by_ride_id === null ? null : String(row.used_by_ride_id),
  };
}
