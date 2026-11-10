import type { MapsGateway, MapsResult, RouteResult, TraceContext } from "@ride/application";
import type { PlaceCandidate, PlaceResolved, Point } from "@ride/contracts";

// Google Maps Platform の偽物（DEC-25 の差し替え口）。場所は決まった一覧から探し、経路は直線の距離から作る。

interface FakePlace {
  placeId: string;
  name: string;
  address: string;
  position: Point;
}

export const fakePlaces: FakePlace[] = [
  {
    placeId: "fake-tokyo-station",
    name: "東京駅",
    address: "東京都千代田区丸の内1丁目",
    position: { lat: 35.681236, lng: 139.767125 },
  },
  {
    placeId: "fake-shibuya-station",
    name: "渋谷駅",
    address: "東京都渋谷区道玄坂1丁目",
    position: { lat: 35.658034, lng: 139.701636 },
  },
  {
    placeId: "fake-shinjuku-station",
    name: "新宿駅",
    address: "東京都新宿区新宿3丁目",
    position: { lat: 35.690921, lng: 139.700258 },
  },
  {
    placeId: "fake-tokyo-tower",
    name: "東京タワー",
    address: "東京都港区芝公園4丁目",
    position: { lat: 35.658581, lng: 139.745433 },
  },
  {
    placeId: "fake-ueno-station",
    name: "上野駅",
    address: "東京都台東区上野7丁目",
    position: { lat: 35.713768, lng: 139.777254 },
  },
  {
    placeId: "fake-haneda",
    name: "羽田空港第3ターミナル",
    address: "東京都大田区羽田空港2丁目",
    position: { lat: 35.544, lng: 139.768 },
  },
  // 車で行けない場所（経路がない。FR-02 AC6）。
  {
    placeId: "fake-oshima-port",
    name: "伊豆大島 元町港",
    address: "東京都大島町元町",
    position: { lat: 34.75, lng: 139.355 },
  },
];

const island = (point: Point) => point.lat < 35.0;

const rad = (deg: number) => (deg * Math.PI) / 180;

function haversineM(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// Google の経路の線の符号化（Encoded Polyline Algorithm Format）。
export function encodePolyline(points: Point[]): string {
  let previousLat = 0;
  let previousLng = 0;
  let out = "";
  const encode = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);
    encode(lat - previousLat);
    encode(lng - previousLng);
    previousLat = lat;
    previousLng = lng;
  }
  return out;
}

export class FakeMaps implements MapsGateway {
  private failures = 0;

  failNext(count = 1): void {
    this.failures += count;
  }

  private takeFailure(): boolean {
    if (this.failures <= 0) return false;
    this.failures -= 1;
    return true;
  }

  async autocomplete(
    query: string,
    _sessionToken: string,
    _near: Point | null,
    _trace: TraceContext,
  ): Promise<MapsResult<PlaceCandidate[]>> {
    if (this.takeFailure()) return { kind: "unavailable" };
    const items = fakePlaces
      .filter((place) => place.name.includes(query) || place.address.includes(query))
      .map(({ placeId, name, address }) => ({ placeId, name, address }));
    return { kind: "ok", value: items };
  }

  async placeDetails(
    placeId: string,
    _sessionToken: string,
    _trace: TraceContext,
  ): Promise<MapsResult<PlaceResolved | null>> {
    if (this.takeFailure()) return { kind: "unavailable" };
    const place = fakePlaces.find((candidate) => candidate.placeId === placeId);
    return { kind: "ok", value: place ? { ...place } : null };
  }

  async computeRoute(from: Point, to: Point, _trace: TraceContext): Promise<MapsResult<RouteResult | null>> {
    if (this.takeFailure()) return { kind: "unavailable" };
    if (island(from) !== island(to)) return { kind: "ok", value: null };
    const distanceM = Math.round(haversineM(from, to) * 1.3);
    const durationSec = Math.round(distanceM / 5.5) + 120;
    return { kind: "ok", value: { distanceM, durationSec, encodedPolyline: encodePolyline([from, to]) } };
  }
}
