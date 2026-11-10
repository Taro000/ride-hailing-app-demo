import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BookingPage } from "../src/pages/BookingPage.tsx";

const rideId = "ride_01M71TEVX39YGH5WXRSW2EW4GA";
const ride = {
  rideId,
  state: "hold_checking",
  version: 2,
  pickup: {
    label: "東京駅",
    address: null,
    placeId: "fake-tokyo-station",
    position: { lat: 35.681236, lng: 139.767125 },
  },
  dropoff: {
    label: "渋谷駅",
    address: null,
    placeId: "fake-shibuya-station",
    position: { lat: 35.658034, lng: 139.701636 },
  },
  fare: { booked: { amount: 4952, currency: "jpy" }, current: { amount: 4952, currency: "jpy" } },
  eta: null,
  threshold: null,
  payment: { state: "hold_checking", unpaidAmount: null, reason: null },
  cancellation: null,
  cancelRequested: false,
  createdAt: "2026-11-10T03:00:00.000Z",
  updatedAt: "2026-11-10T03:00:00.000Z",
};
const yen = (amount: number) => ({ amount, currency: "jpy" });
const estimate = {
  estimateId: "est_01M71TEKBHGZ3KNHR2Q0DNPQ60",
  pickup: ride.pickup,
  dropoff: ride.dropoff,
  fare: {
    total: yen(4952),
    base: yen(100),
    distance: yen(2772),
    time: yen(1680),
    pickupFee: yen(300),
    bookingFee: yen(100),
  },
  eta: { arrivalAt: "2026-11-10T03:34:25.000Z", components: { matchSec: 120, pickupSec: 300, rideSec: 1645 } },
  durationSec: 1645,
  distanceM: 8390,
  route: { encodedPolyline: "w~wxEqgatY`pChxK", distanceM: 8390, durationSec: 1645 },
  expiresAt: "2026-11-10T03:10:00.000Z",
};
const places = {
  東京: {
    placeId: "fake-tokyo-station",
    name: "東京駅",
    address: "東京都千代田区丸の内1丁目",
    position: ride.pickup.position,
  },
  渋谷: {
    placeId: "fake-shibuya-station",
    name: "渋谷駅",
    address: "東京都渋谷区道玄坂1丁目",
    position: ride.dropoff.position,
  },
} as const;

const bookingKeys: string[] = [];
let bookingResponse: () => Response = () => HttpResponse.json({ code: "HOLD_PENDING", ride }, { status: 202 });

const server = setupServer(
  http.get("*/api/v1/passenger/rides/active", () => new HttpResponse(null, { status: 204 })),
  http.post("*/api/v1/passenger/places/search", async ({ request }) => {
    const body = (await request.json()) as { query: keyof typeof places };
    const place = places[body.query];
    return HttpResponse.json({
      items: place ? [{ placeId: place.placeId, name: place.name, address: place.address }] : [],
      nextCursor: null,
    });
  }),
  http.post("*/api/v1/passenger/places/resolve", async ({ request }) => {
    const body = (await request.json()) as { placeId: string };
    return HttpResponse.json(Object.values(places).find((place) => place.placeId === body.placeId));
  }),
  http.post("*/api/v1/passenger/estimates", () => HttpResponse.json(estimate, { status: 201 })),
  http.post("*/api/v1/passenger/rides", ({ request }) => {
    bookingKeys.push(request.headers.get("Idempotency-Key") ?? "");
    return bookingResponse();
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  bookingKeys.length = 0;
});
afterAll(() => server.close());

function RideStub() {
  const params = useParams();
  return <p>手配の状況 {params.rideId}</p>;
}

function renderBooking() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/rides/:rideId" element={<RideStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function choosePlaces(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("乗る場所を探す"), "東京");
  await user.click(screen.getAllByRole("button", { name: "探す" })[0]!);
  await user.click(await screen.findByRole("button", { name: /東京駅/ }));
  await user.type(screen.getByLabelText("降りる場所を探す"), "渋谷");
  await user.click(screen.getByRole("button", { name: "探す" }));
  await user.click(await screen.findByRole("button", { name: /渋谷駅/ }));
}

describe("手配の画面（IFC-24）", () => {
  it("場所を選ぶと料金を示し、手配が 202 HOLD_PENDING なら手配の状況へ移る", async () => {
    const user = userEvent.setup();
    renderBooking();
    await choosePlaces(user);
    expect(await screen.findByText("4,952 円")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "手配する" }));
    expect(await screen.findByText(`手配の状況 ${rideId}`)).toBeInTheDocument();
    expect(bookingKeys).toHaveLength(1);
  });

  it("押さえを断られたら理由を示す。次の手配は新しい冪等キーで送る", async () => {
    bookingResponse = () =>
      HttpResponse.json(
        {
          type: "urn:ride-hailing-demo:problem:card_declined",
          title: "x",
          status: 402,
          code: "CARD_DECLINED",
          traceId: "a".repeat(32),
        },
        { status: 402, headers: { "Content-Type": "application/problem+json" } },
      );
    const user = userEvent.setup();
    renderBooking();
    await choosePlaces(user);
    await screen.findByText("4,952 円");
    await user.click(screen.getByRole("button", { name: "手配する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("カードで押さえられませんでした");
    expect(screen.getByRole("alert")).toHaveTextContent(`問い合わせ番号: ${"a".repeat(32)}`);
    await user.click(screen.getByRole("button", { name: "手配する" }));
    await waitFor(() => expect(bookingKeys).toHaveLength(2));
    expect(bookingKeys[0]).not.toBe(bookingKeys[1]);
  });

  it("503 PAYMENTS_UNAVAILABLE の後は、同じ冪等キーでもう一度送る", async () => {
    bookingResponse = () =>
      HttpResponse.json(
        { type: "x", title: "x", status: 503, code: "PAYMENTS_UNAVAILABLE", traceId: "b".repeat(32) },
        { status: 503, headers: { "Content-Type": "application/problem+json", "Retry-After": "2" } },
      );
    const user = userEvent.setup();
    renderBooking();
    await choosePlaces(user);
    await screen.findByText("4,952 円");
    await user.click(screen.getByRole("button", { name: "手配する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("押さえていません");
    await user.click(screen.getByRole("button", { name: "手配する" }));
    await waitFor(() => expect(bookingKeys).toHaveLength(2));
    expect(bookingKeys[0]).toBe(bookingKeys[1]);
  });
});
