import { z } from "zod";

// 型と入力の検査（packages/contracts、持ち主 ELM-04）。形は ifc/specs/*.yaml の components.schemas に合わせた。

const ulid = "[0-9A-HJKMNP-TV-Z]{26}";
export const idPattern = {
  ride: new RegExp(`^ride_${ulid}$`),
  account: new RegExp(`^acc_${ulid}$`),
  estimate: new RegExp(`^est_${ulid}$`),
  change: new RegExp(`^chg_${ulid}$`),
} as const;

export const Money = z.object({
  amount: z.int().min(0),
  currency: z.literal("jpy"),
});
export type Money = z.infer<typeof Money>;

export const Point = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Point = z.infer<typeof Point>;

export const Place = z.object({
  label: z.string(),
  address: z.string().nullable(),
  placeId: z.string().nullable(),
  position: Point,
});
export type Place = z.infer<typeof Place>;

export const PlaceInput = z.object({
  position: Point,
  accuracyM: z.number().min(0).optional(),
  placeId: z.string().max(300).optional(),
  label: z.string().max(200).optional(),
  source: z.enum(["current_location", "search", "pin"]),
  pinConfirmed: z.boolean().optional(),
});
export type PlaceInput = z.infer<typeof PlaceInput>;

export const PlaceSearchRequest = z.object({
  query: z.string().min(1).max(200),
  sessionToken: z.uuid(),
  near: Point.nullable().optional(),
});
export type PlaceSearchRequest = z.infer<typeof PlaceSearchRequest>;

export const PlaceCandidate = z.object({
  placeId: z.string(),
  name: z.string(),
  address: z.string(),
});
export type PlaceCandidate = z.infer<typeof PlaceCandidate>;

export const PlaceCandidates = z.object({
  items: z.array(PlaceCandidate).max(10),
  nextCursor: z.null(),
});
export type PlaceCandidates = z.infer<typeof PlaceCandidates>;

export const PlaceResolveRequest = z.object({
  placeId: z.string().min(1).max(300),
  sessionToken: z.uuid(),
});
export type PlaceResolveRequest = z.infer<typeof PlaceResolveRequest>;

export const PlaceResolved = z.object({
  placeId: z.string(),
  name: z.string(),
  address: z.string(),
  position: Point,
});
export type PlaceResolved = z.infer<typeof PlaceResolved>;

export const EstimateRequest = z.object({
  pickup: PlaceInput,
  dropoff: PlaceInput,
});
export type EstimateRequest = z.infer<typeof EstimateRequest>;

export const FareBreakdown = z.object({
  total: Money,
  base: Money,
  distance: Money,
  time: Money,
  pickupFee: Money,
  bookingFee: Money,
});
export type FareBreakdown = z.infer<typeof FareBreakdown>;

export const Eta = z.object({
  arrivalAt: z.iso.datetime(),
  components: z.object({
    matchSec: z.int().min(0),
    pickupSec: z.int().min(0),
    rideSec: z.int().min(0),
  }),
});
export type Eta = z.infer<typeof Eta>;

export const Route = z.object({
  encodedPolyline: z.string(),
  distanceM: z.int().min(0),
  durationSec: z.int().min(0),
});
export type Route = z.infer<typeof Route>;

export const Estimate = z.object({
  estimateId: z.string().regex(idPattern.estimate),
  pickup: Place,
  dropoff: Place,
  fare: FareBreakdown,
  eta: Eta,
  durationSec: z.int().min(0),
  distanceM: z.int().min(0),
  route: Route,
  expiresAt: z.iso.datetime(),
});
export type Estimate = z.infer<typeof Estimate>;

export const BookingRequest = z.object({
  estimateId: z.string().regex(idPattern.estimate),
  paymentMethodId: z.string().max(200).nullable().optional(),
});
export type BookingRequest = z.infer<typeof BookingRequest>;

export const CancelRequest = z.object({
  expectedFee: Money,
});
export type CancelRequest = z.infer<typeof CancelRequest>;

export const rideStates = [
  "booking",
  "hold_checking",
  "not_booked",
  "searching",
  "accepted",
  "arrived",
  "in_progress",
  "ended",
  "cancelled",
  "no_show",
] as const;
export type RideState = (typeof rideStates)[number];

export const paymentStates = [
  "none",
  "holding",
  "hold_checking",
  "held",
  "release_checking",
  "released",
  "capturing",
  "checking",
  "paid",
  "unpaid",
  "unpaid_checking",
  "partially_refunded",
  "refunded",
] as const;
export type PaymentStateValue = (typeof paymentStates)[number];

// 状態の履歴の種類（DAT-07）と配信の changeType（IFC-08）。hold_not_found はこの実装で足した:
// 手配をやめた依頼の押さえが「ない」と Stripe で確かめたとき（payment.state が none になる）に、
// 配信が状態の履歴を追うだけで届けられるようにするため。設計の type の一覧には、この変化を表す値がない。
export const historyTypes = [
  "requested",
  "accepted",
  "driver_cancelled",
  "relisted",
  "cancelled",
  "arrived",
  "started",
  "no_show",
  "ended",
  "destination_changed",
  "destination_change_abandoned",
  "threshold_lowered",
  "charged",
  "charge_failed",
  "refunded",
  "hold_released",
  "not_booked",
  "hold_not_found",
] as const;
export type HistoryType = (typeof historyTypes)[number];

export const PaymentState = z.object({
  state: z.enum(paymentStates),
  unpaidAmount: Money.nullable(),
  reason: z.string().nullable(),
});
export type PaymentState = z.infer<typeof PaymentState>;

export const PassengerRide = z.object({
  rideId: z.string().regex(idPattern.ride),
  state: z.enum(rideStates),
  version: z.int().min(1),
  pickup: Place,
  dropoff: Place,
  fare: z.object({ booked: Money, current: Money }),
  eta: Eta.nullable(),
  threshold: z.number().nullable(),
  payment: PaymentState,
  cancellation: z
    .object({
      cancelledBy: z.enum(["passenger", "driver", "system"]),
      reason: z.string().nullable(),
    })
    .nullable(),
  cancelRequested: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PassengerRide = z.infer<typeof PassengerRide>;

export const RideEnvelope = z.object({ ride: PassengerRide });
export type RideEnvelope = z.infer<typeof RideEnvelope>;

export const HoldPending = z.object({ code: z.literal("HOLD_PENDING"), ride: PassengerRide });
export type HoldPending = z.infer<typeof HoldPending>;

export const HoldReleasePending = z.object({
  code: z.literal("HOLD_RELEASE_PENDING"),
  ride: PassengerRide,
});
export type HoldReleasePending = z.infer<typeof HoldReleasePending>;

export const Problem = z.looseObject({
  type: z.string(),
  title: z.string(),
  status: z.int(),
  code: z.string(),
  detail: z.string().optional(),
  traceId: z.string(),
  errors: z.array(z.object({ field: z.string(), code: z.string(), message: z.string().optional() })).optional(),
  retryAfterSeconds: z.int().min(0).optional(),
  currentFee: Money.optional(),
});
export type Problem = z.infer<typeof Problem>;

export const Credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});
export type Credentials = z.infer<typeof Credentials>;

export const Account = z.object({
  accountId: z.string().regex(idPattern.account),
  roles: z.array(z.enum(["passenger", "driver", "operator", "engineer"])),
  testAccount: z.boolean(),
});
export type Account = z.infer<typeof Account>;

export const Session = z.object({
  account: Account,
  nextStep: z.enum(["none", "passkey", "passkey_registration"]),
});
export type Session = z.infer<typeof Session>;

// 配信（IFC-08）。乗客の流れで使うものだけ。
export const StreamHello = z.object({
  v: z.literal(1),
  appVersion: z.string(),
  serverTime: z.iso.datetime(),
  cursor: z.string(),
});
export type StreamHello = z.infer<typeof StreamHello>;

export const RideUpdated = z.object({
  v: z.literal(1),
  changeId: z.string().regex(idPattern.change).nullable(),
  changeType: z.enum(historyTypes).nullable(),
  recordedAt: z.iso.datetime().nullable(),
  ride: PassengerRide,
});
export type RideUpdated = z.infer<typeof RideUpdated>;

export const StreamClosing = z.object({
  v: z.literal(1),
  reason: z.enum(["max_age", "replaced", "shutdown"]),
});
export type StreamClosing = z.infer<typeof StreamClosing>;
