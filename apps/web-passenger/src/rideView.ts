import { pendingCatalog, type PassengerRide } from "@ride/contracts";

// 配信は少なくとも一度届き、順番が前後しうる。依頼の version で古いものを捨てる（IFC-08）。
export function applyUpdate(current: PassengerRide | null, incoming: PassengerRide): PassengerRide {
  if (!current || current.rideId !== incoming.rideId) return incoming;
  return incoming.version >= current.version ? incoming : current;
}

export interface RideDescription {
  title: string;
  detail: string | null;
  canCancel: boolean;
  finished: boolean;
}

// 手配の状況の画面の文（IFC-24）。「押さえていません」と示すのは Stripe が答えたとき（payment.state が none か released）だけ。
export function describeRide(ride: PassengerRide): RideDescription {
  const payment = ride.payment.state;
  const settling = payment === "hold_checking" || payment === "release_checking";
  switch (ride.state) {
    case "booking":
      return { title: "手配を処理しています", detail: null, canCancel: false, finished: false };
    case "hold_checking":
      return {
        title: pendingCatalog.HOLD_PENDING,
        detail: "しばらくお待ちください。取り消すこともできます。",
        canCancel: true,
        finished: false,
      };
    case "searching":
      return {
        title: "ドライバーを探しています",
        detail: "見つかるまでお待ちください。",
        canCancel: true,
        finished: false,
      };
    case "not_booked":
      if (settling)
        return { title: pendingCatalog.HOLD_RELEASE_PENDING, detail: null, canCancel: false, finished: false };
      if (payment === "released")
        return { title: "手配をやめました。押さえを解放しました", detail: null, canCancel: false, finished: true };
      return { title: "手配をやめました。押さえていません", detail: null, canCancel: false, finished: true };
    case "cancelled":
      if (settling)
        return {
          title: "取り消しました。押さえが残っていれば解放します",
          detail: null,
          canCancel: false,
          finished: false,
        };
      return { title: "取り消しました。押さえを解放しました", detail: null, canCancel: false, finished: true };
    default:
      return { title: "この手配の状態はこの画面では扱いません", detail: ride.state, canCancel: false, finished: true };
  }
}
