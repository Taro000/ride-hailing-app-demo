import type { Session } from "@ride/contracts";
import { Button, ErrorNotice, TextField, problemMessage } from "@ride/web-shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { api } from "../api.ts";

// ログイン（IFC-23）。自分でアカウントを作る画面はない（FR-01 AC3）。設定の符号でパスワードを決める画面は縦の一本の外。
export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ message: string; traceId?: string } | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    const result = await api.call<Session>({
      method: "POST",
      path: "/api/v1/auth/login",
      body: { email, password },
      kind: "session",
      suppressAuthEvent: true,
    });
    setSending(false);
    if (result.ok) {
      navigate("/", { replace: true });
      return;
    }
    const failure = result.error;
    setError(
      failure.kind === "answered"
        ? { message: problemMessage(failure.problem), traceId: failure.problem.traceId }
        : { message: "通信できませんでした。もう一度お試しください", traceId: failure.traceId },
    );
  }

  return (
    <main className="page">
      <h1 tabIndex={-1}>ログイン</h1>
      <form onSubmit={submit} className="stack">
        <TextField
          label="メールアドレス"
          type="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
          name="email"
        />
        <TextField
          label="パスワード"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          name="password"
        />
        <Button type="submit" isDisabled={sending}>
          ログインする
        </Button>
      </form>
      {error ? <ErrorNotice message={error.message} traceId={error.traceId} /> : null}
      <p className="note">アカウントは運営・サポート担当が作ります。</p>
    </main>
  );
}
