import { RideUpdated, StreamHello } from "@ride/contracts";
import { newTraceId, traceparent } from "./api.ts";

// 配信の受信（IFC-08）。traceparent と Last-Event-ID を付けるため EventSource ではなく fetch で読む。
// 切れたら 1 秒待ってつなぎ直し、続けて失敗するときは 2、4、8 秒、最大 30 秒。60 秒何も届かなければ切れたとみなす。

export interface StreamHandlers {
  onHello?: (hello: StreamHello) => void;
  onRideUpdated: (message: RideUpdated) => void;
  onUnauthenticated?: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

export interface StreamOptions {
  fetchImpl?: typeof fetch;
  silenceMs?: number;
  firstBackoffMs?: number;
}

export interface StreamHandle {
  close(): void;
  reconnect(): void;
}

export function connectRideStream(handlers: StreamHandlers, options: StreamOptions = {}): StreamHandle {
  const doFetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const silenceMs = options.silenceMs ?? 60_000;
  const firstBackoff = options.firstBackoffMs ?? 1_000;
  let lastEventId: string | null = null;
  let stopped = false;
  let controller: AbortController | null = null;
  let backoff = firstBackoff;

  const dispatch = (block: string) => {
    const fields: Record<string, string> = {};
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      fields[line.slice(0, colon)] = line.slice(colon + 1).trimStart();
    }
    if (fields.id && fields.event !== "stream.closing") lastEventId = fields.id;
    if (!fields.event || fields.data === undefined) return;
    const data: unknown = JSON.parse(fields.data);
    if (fields.event === "hello") {
      const parsed = StreamHello.safeParse(data);
      if (parsed.success) handlers.onHello?.(parsed.data);
    } else if (fields.event === "ride.updated") {
      const parsed = RideUpdated.safeParse(data);
      if (parsed.success) handlers.onRideUpdated(parsed.data);
    } else if (fields.event === "stream.closing" && (data as { reason?: string }).reason === "replaced") {
      // 同じアカウントの 3 本目に閉じられた。自動では開き直さない（前面に戻ったときに開き直す）。
      stopped = true;
    }
  };

  async function runOnce(): Promise<void> {
    controller = new AbortController();
    const traceId = newTraceId();
    let silence: ReturnType<typeof setTimeout> | undefined;
    const resetSilence = () => {
      clearTimeout(silence);
      silence = setTimeout(() => controller?.abort(), silenceMs);
    };
    try {
      const res = await doFetch("/api/v1/stream", {
        headers: {
          traceparent: traceparent(traceId),
          "X-Client-Trace-Id": traceId,
          ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
        },
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (res.status === 401) {
        stopped = true;
        handlers.onUnauthenticated?.();
        return;
      }
      if (!res.ok || !res.body) return;
      handlers.onConnectionChange?.(true);
      backoff = firstBackoff;
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      resetSilence();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        resetSilence();
        buffer += value;
        let index: number;
        while ((index = buffer.indexOf("\n\n")) >= 0) {
          dispatch(buffer.slice(0, index));
          buffer = buffer.slice(index + 2);
        }
      }
    } catch {
      // 回線の切れ、無音、閉じた。下でつなぎ直す。
    } finally {
      clearTimeout(silence);
      handlers.onConnectionChange?.(false);
    }
  }

  void (async () => {
    while (!stopped) {
      await runOnce();
      if (stopped) break;
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff = Math.min(backoff * 2, 30_000);
    }
  })();

  return {
    close() {
      stopped = true;
      controller?.abort();
    },
    reconnect() {
      backoff = firstBackoff;
      controller?.abort();
    },
  };
}
