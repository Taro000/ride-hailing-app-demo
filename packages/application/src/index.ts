import type { PaymentStateValue as ContractPaymentState, RideState as ContractRideState } from "@ride/contracts";
import type { PaymentStateValue as DomainPaymentState, RideState as DomainRideState } from "@ride/domain";

export * from "./auth.ts";
export * from "./booking.ts";
export * from "./cancel.ts";
export * from "./db.ts";
export * from "./estimates.ts";
export * from "./ids.ts";
export * from "./patrol.ts";
export * from "./ports.ts";
export * from "./result.ts";
export * from "./rides.ts";
export * from "./settings.ts";
export * from "./views.ts";

// domain は contracts を読めない（DEC-26）ので状態の値が二か所にある。ここで一致を確かめる。
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const rideStatesMatch: Same<ContractRideState, DomainRideState> = true;
const paymentStatesMatch: Same<ContractPaymentState, DomainPaymentState> = true;
void rideStatesMatch;
void paymentStatesMatch;
