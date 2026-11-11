import type { Clock } from "@ride/application";

export const systemClock: Clock = { now: () => new Date() };

// テストと手元で時刻を進める時計（DEC-25）。
export class ManualClock implements Clock {
  private current: number;

  constructor(start: Date = new Date("2026-11-10T03:00:00.000Z")) {
    this.current = start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current += ms;
  }
}
