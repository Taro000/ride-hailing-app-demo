import type { HoldReleasePending, PassengerRide, RideEnvelope } from "@ride/contracts";
import {
  Button,
  ErrorNotice,
  StatusRegion,
  connectRideStream,
  formatTimeJst,
  formatYen,
  problemMessage,
} from "@ride/web-shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../api.ts";
import { applyUpdate, describeRide } from "../rideView.ts";
import { useOperation } from "../useOperation.ts";

// 手配の状況（IFC-24）。配信（IFC-08）と GET で今の状態を受ける。前面に戻ったら流れを開き直し、取り直す（FR-06 AC3）。
export function RidePage() {
  const { rideId = "" } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState<PassengerRide | null>(null);
  const [notice, setNotice] = useState<{ message: string; traceId?: string | undefined } | null>(null);
  const cancel = useOperation("passenger.rides.cancel");

  const load = useCallback(() => {
    void api
      .call<RideEnvelope>({ method: "GET", path: `/api/v1/passenger/rides/${rideId}`, kind: "read" })
      .then((result) => {
        if (result.ok) setRide((current) => applyUpdate(current, result.data.ride));
        else if (result.error.kind === "answered" && result.error.status === 404) navigate("/", { replace: true });
      });
  }, [rideId, navigate]);

  useEffect(() => {
    load();
    const stream = connectRideStream({
      onRideUpdated: (message) => {
        if (message.ride.rideId === rideId) setRide((current) => applyUpdate(current, message.ride));
      },
      onUnauthenticated: () => navigate("/login"),
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        stream.reconnect();
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stream.close();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [rideId, load, navigate]);

  async function cancelRide() {
    setNotice(null);
    // 許諾の前の取り消しは無料。確かめた額（0 円）を送る（FR-07 AC1、DEC-41）。
    const outcome = await cancel.run<RideEnvelope | HoldReleasePending>({
      method: "POST",
      path: `/api/v1/passenger/rides/${rideId}/cancel`,
      body: { expectedFee: { amount: 0, currency: "jpy" } },
    });
    if (outcome.kind === "done" || outcome.kind === "pending") {
      setRide((current) => applyUpdate(current, outcome.data.ride));
      return;
    }
    if (
      outcome.kind === "rejected" ||
      outcome.kind === "stopped" ||
      outcome.kind === "key_reused" ||
      outcome.kind === "waiting"
    ) {
      setNotice({ message: problemMessage(outcome.problem), traceId: outcome.problem.traceId });
      load();
      return;
    }
    if (outcome.kind === "needs_login") {
      navigate("/login");
      return;
    }
    setNotice({
      message: "取り消しの結果が分かりません。もう一度押すと、同じ取り消しとして送ります",
      traceId: outcome.traceId,
    });
  }

  if (!ride) {
    return (
      <main className="page">
        <h1 tabIndex={-1}>手配の状況</h1>
        <StatusRegion>読み込んでいます</StatusRegion>
      </main>
    );
  }
  const view = describeRide(ride);
  return (
    <main className="page">
      <h1 tabIndex={-1}>手配の状況</h1>
      <StatusRegion>
        <p className="ride-title">{view.title}</p>
        {view.detail ? <p>{view.detail}</p> : null}
      </StatusRegion>
      <dl className="estimate-values">
        <dt>乗る場所</dt>
        <dd>{ride.pickup.label}</dd>
        <dt>降りる場所</dt>
        <dd>{ride.dropoff.label}</dd>
        <dt>料金</dt>
        <dd>{formatYen(ride.fare.booked)}</dd>
        {ride.eta ? (
          <>
            <dt>到着予定（手配のとき）</dt>
            <dd>{formatTimeJst(ride.eta.arrivalAt)}</dd>
          </>
        ) : null}
      </dl>
      {view.canCancel ? (
        <Button variant="secondary" onPress={() => void cancelRide()} isDisabled={cancel.sending}>
          {ride.state === "hold_checking" ? "手配をやめる" : "取り消す（無料）"}
        </Button>
      ) : null}
      {view.finished ? <Link to="/">新しく手配する</Link> : null}
      {notice ? <ErrorNotice message={notice.message} traceId={notice.traceId} /> : null}
    </main>
  );
}
