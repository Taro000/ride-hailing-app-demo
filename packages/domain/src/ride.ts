// 配車依頼の状態遷移表（DEC-09。報告書「要素をまたぐ状態」の配車依頼の図をそのまま表にした）。
// domain は何にも依存しない（DEC-26）ので、状態の値は contracts と別に持つ。application が型の一致を確かめる。

export type RideState =
  | "booking"
  | "hold_checking"
  | "not_booked"
  | "searching"
  | "accepted"
  | "arrived"
  | "in_progress"
  | "ended"
  | "cancelled"
  | "no_show";

const transitions: Readonly<Record<RideState, readonly RideState[]>> = {
  booking: ["searching", "not_booked", "hold_checking"],
  hold_checking: ["searching", "not_booked"],
  not_booked: [],
  searching: ["accepted", "cancelled", "searching"],
  accepted: ["searching", "arrived", "cancelled"],
  arrived: ["in_progress", "no_show", "searching", "cancelled"],
  in_progress: ["in_progress", "ended"],
  ended: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(from: RideState, to: RideState): boolean {
  return transitions[from].includes(to);
}

// 409 ACTIVE_RIDE_EXISTS に数える状態（IFC-02）。not_booked は数えないので、手配をやめた依頼の押さえを確かめている間も手配できる。
export const activeRideStates: readonly RideState[] = [
  "booking",
  "hold_checking",
  "searching",
  "accepted",
  "arrived",
  "in_progress",
];

export function isActive(state: RideState): boolean {
  return activeRideStates.includes(state);
}
