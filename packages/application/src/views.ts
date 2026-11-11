import type { RideEnvelope } from "@ride/contracts";
import type { Database } from "./db.ts";
import { ok, problem, type ApiResult } from "./result.ts";
import { findActiveOrSettlingRide, getPassengerRide, toPassengerRide } from "./rides.ts";

// 読むだけの経路（GET /api/v1/passenger/rides/active、GET /api/v1/passenger/rides/{rideId}）。

export async function getActiveRide(db: Database, passengerId: string): Promise<ApiResult> {
  const ride = await findActiveOrSettlingRide(db.client, passengerId);
  if (!ride) return { status: 204, body: null };
  const body: RideEnvelope = { ride: toPassengerRide(ride) };
  return ok(200, body);
}

export async function getRideView(
  db: Database,
  passengerId: string,
  rideId: string,
  traceId: string,
): Promise<ApiResult> {
  const ride = await getPassengerRide(db.client, rideId, passengerId);
  if (!ride) return problem("NOT_FOUND", traceId);
  const body: RideEnvelope = { ride: toPassengerRide(ride) };
  return ok(200, body);
}
