import type { Estimate, HoldPending, RideEnvelope } from "@ride/contracts";
import {
  Button,
  ErrorNotice,
  StatusRegion,
  formatMinutes,
  formatTimeJst,
  formatYen,
  problemMessage,
} from "@ride/web-shared";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api.ts";
import { PlacePicker, type PickedPlace } from "../components/PlacePicker.tsx";
import { useOperation } from "../useOperation.ts";

type Notice = { message: string; traceId?: string | undefined; kind: "error" | "info" };

// 手配（IFC-24）。CUJ-01 の三つの手順: 乗る場所・降りる場所を決める → 移動時間と料金を確認する → 配車を手配する。
export function BookingPage() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState<PickedPlace | null>(null);
  const [dropoff, setDropoff] = useState<PickedPlace | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const booking = useOperation("passenger.rides.create");

  const estimateRequest = useRef(0);

  // 進行中の依頼（または押さえを確かめている依頼）があれば手配の状況へ（FR-05 AC5、FR-06 AC3）。
  useEffect(() => {
    void api
      .call<RideEnvelope | null>({ method: "GET", path: "/api/v1/passenger/rides/active", kind: "read" })
      .then((active) => {
        if (active.ok && active.status === 200 && active.data)
          navigate(`/rides/${active.data.ride.rideId}`, { replace: true });
      });
  }, [navigate]);

  // 乗る場所か降りる場所を変えると計算し直す（FR-03 AC4）。見積もりは冪等キーを持たない（DEC-48）。
  function changePlaces(nextPickup: PickedPlace | null, nextDropoff: PickedPlace | null) {
    setPickup(nextPickup);
    setDropoff(nextDropoff);
    setEstimate(null);
    setNotice(null);
    booking.reset();
    if (!nextPickup || !nextDropoff) return;
    const requestId = ++estimateRequest.current;
    setEstimating(true);
    void api
      .call<Estimate>({
        method: "POST",
        path: "/api/v1/passenger/estimates",
        body: { pickup: nextPickup, dropoff: nextDropoff },
        kind: "read",
      })
      .then((result) => {
        if (requestId !== estimateRequest.current) return;
        setEstimating(false);
        if (result.ok) {
          setEstimate(result.data);
          return;
        }
        const failure = result.error;
        setNotice({
          kind: "error",
          message: failure.kind === "answered" ? problemMessage(failure.problem) : "料金を計算できませんでした",
          traceId: failure.kind === "answered" ? failure.problem.traceId : failure.traceId,
        });
      });
  }

  async function book() {
    if (!estimate) return;
    setNotice(null);
    const outcome = await booking.run<RideEnvelope | HoldPending>({
      method: "POST",
      path: "/api/v1/passenger/rides",
      body: { estimateId: estimate.estimateId },
    });
    switch (outcome.kind) {
      case "done":
      case "pending":
        navigate(`/rides/${outcome.data.ride.rideId}`);
        return;
      case "rejected":
        if (outcome.problem.code === "ACTIVE_RIDE_EXISTS") {
          const active = await api.call<RideEnvelope | null>({
            method: "GET",
            path: "/api/v1/passenger/rides/active",
            kind: "read",
          });
          if (active.ok && active.data) navigate(`/rides/${active.data.ride.rideId}`);
          return;
        }
        if (outcome.problem.code === "ESTIMATE_EXPIRED") setEstimate(null);
        setNotice({ kind: "error", message: problemMessage(outcome.problem), traceId: outcome.problem.traceId });
        return;
      case "waiting":
        setNotice({
          kind: "error",
          message: `${problemMessage(outcome.problem)}。少し待ってからもう一度「手配する」を押してください`,
          traceId: outcome.problem.traceId,
        });
        return;
      case "unknown":
        setNotice({
          kind: "error",
          message: "手配の結果が分かりません。もう一度押すと、同じ手配として送ります",
          traceId: outcome.traceId,
        });
        return;
      case "needs_login":
        navigate("/login");
        return;
      case "stopped":
      case "key_reused":
        setNotice({ kind: "error", message: problemMessage(outcome.problem), traceId: outcome.problem.traceId });
        return;
    }
  }

  return (
    <main className="page">
      <h1 tabIndex={-1}>配車を手配する</h1>
      <PlacePicker label="乗る場所" value={pickup} onChange={(place) => changePlaces(place, dropoff)} />
      <PlacePicker label="降りる場所" value={dropoff} onChange={(place) => changePlaces(pickup, place)} />
      <section aria-labelledby="estimate-heading" className="estimate">
        <h2 id="estimate-heading">移動時間と料金</h2>
        {estimating ? <StatusRegion>計算しています</StatusRegion> : null}
        {estimate ? (
          <dl className="estimate-values">
            <dt>到着予定</dt>
            <dd>{formatTimeJst(estimate.eta.arrivalAt)}</dd>
            <dt>所要時間（走行）</dt>
            <dd>{formatMinutes(estimate.durationSec)}</dd>
            <dt>料金</dt>
            <dd className="fare-total">{formatYen(estimate.fare.total)}</dd>
            <dt>内訳</dt>
            <dd className="fare-breakdown">
              基本 {formatYen(estimate.fare.base)}、距離 {formatYen(estimate.fare.distance)}、時間{" "}
              {formatYen(estimate.fare.time)}、迎車 {formatYen(estimate.fare.pickupFee)}、手配{" "}
              {formatYen(estimate.fare.bookingFee)}
            </dd>
          </dl>
        ) : !estimating ? (
          <p>乗る場所と降りる場所を決めると表示します。</p>
        ) : null}
      </section>
      <Button onPress={() => void book()} isDisabled={!estimate || booking.sending}>
        {booking.sending ? "手配しています" : "手配する"}
      </Button>
      {notice ? <ErrorNotice message={notice.message} traceId={notice.traceId} /> : null}
    </main>
  );
}
