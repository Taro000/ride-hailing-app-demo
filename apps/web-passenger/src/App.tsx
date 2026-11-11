import type { Session } from "@ride/contracts";
import { Button, StatusRegion } from "@ride/web-shared";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router";
import { api, unauthenticatedEvent, versionMismatchEvent } from "./api.ts";
import { BookingPage } from "./pages/BookingPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { RidePage } from "./pages/RidePage.tsx";

// ログインしていない人には、ログインの画面だけを示す（FR-01 AC3）。
function RequireSession(props: { children: ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void (async () => {
      const session = await api.call<Session>({
        method: "GET",
        path: "/api/v1/auth/session",
        kind: "read",
        suppressAuthEvent: true,
      });
      if (session.ok) setReady(true);
      else navigate("/login", { replace: true });
    })();
  }, [navigate]);
  return ready ? props.children : <StatusRegion>読み込んでいます</StatusRegion>;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [newVersion, setNewVersion] = useState(false);
  const main = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const toLogin = () => navigate("/login");
    const mismatch = () => setNewVersion(true);
    window.addEventListener(unauthenticatedEvent, toLogin);
    window.addEventListener(versionMismatchEvent, mismatch);
    return () => {
      window.removeEventListener(unauthenticatedEvent, toLogin);
      window.removeEventListener(versionMismatchEvent, mismatch);
    };
  }, [navigate]);

  // 画面が移ったら見出しに焦点を移す（WS-UI。WCAG 2.2 AA）。
  useEffect(() => {
    main.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [location.pathname]);

  return (
    <div ref={main}>
      {newVersion ? (
        // DEC-49 は「操作の途中でないときに読み直す」。この実装は知らせて、乗客が読み直す（自動では読み直さない）。
        <div role="alert" className="banner">
          新しい版があります。
          <Button variant="secondary" onPress={() => window.location.reload()}>
            読み直す
          </Button>
        </div>
      ) : null}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireSession>
              <BookingPage />
            </RequireSession>
          }
        />
        <Route
          path="/rides/:rideId"
          element={
            <RequireSession>
              <RidePage />
            </RequireSession>
          }
        />
      </Routes>
    </div>
  );
}
