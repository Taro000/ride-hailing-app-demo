// 料金（R_fare。context.yaml の制約）と到着予定の三つの要素（FR-03 AC2）。

export interface FareTable {
  baseYen: number;
  perMinuteYen: number;
  perKmYen: number;
  pickupFeeYen: number;
  bookingFeeYen: number;
}

// context.yaml: 基本料金 100 円、1 分あたり 60 円、1 km あたり 330 円、迎車料金 300 円、アプリ手配料 100 円。
export const demoFareTable: FareTable = {
  baseYen: 100,
  perMinuteYen: 60,
  perKmYen: 330,
  pickupFeeYen: 300,
  bookingFeeYen: 100,
};

export interface FareYen {
  total: number;
  base: number;
  distance: number;
  time: number;
  pickupFee: number;
  bookingFee: number;
}

// 刻みと端数は入力にない（「km と分の刻み、1 円未満の端数、消費税の扱いは未定」）。この実装は、
// 距離は 0.1 km、時間は 1 分に切り上げ、各要素を円に四捨五入し、消費税は足さない（仮。プロダクトオーナーの合意が要る）。
export function computeFare(distanceM: number, durationSec: number, table: FareTable): FareYen {
  if (!Number.isFinite(distanceM) || !Number.isFinite(durationSec) || distanceM < 0 || durationSec < 0) {
    throw new RangeError("distance and duration must be non-negative numbers");
  }
  const km = Math.ceil(distanceM / 100) / 10;
  const minutes = Math.ceil(durationSec / 60);
  const distance = Math.round(km * table.perKmYen);
  const time = Math.round(minutes * table.perMinuteYen);
  const total = table.baseYen + distance + time + table.pickupFeeYen + table.bookingFeeYen;
  return {
    total,
    base: table.baseYen,
    distance,
    time,
    pickupFee: table.pickupFeeYen,
    bookingFee: table.bookingFeeYen,
  };
}

export interface EtaComponents {
  matchSec: number;
  pickupSec: number;
  rideSec: number;
}

// 見込みの求め方は入力にない（FR-03 の basis_note「見込みの時間の求め方は推定」）。DRV-06 は精度の話として残した。
// この実装は、ドライバーが見つかるまでと迎車を設定の固定値にし、走行は経路の所要時間にする。
export function computeEta(now: Date, components: EtaComponents): Date {
  const total = components.matchSec + components.pickupSec + components.rideSec;
  return new Date(now.getTime() + total * 1000);
}
