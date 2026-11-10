import { problemCatalog, problemType, type Money, type ProblemCode } from "@ride/contracts";

// 応答の状態の符号と本文。冪等キーの最初の結果（DAT-14 の response_status、response_body）を状態を変えたのと
// 同じトランザクションで書くため、ユースケースが HTTP の形まで作る。
export interface ApiResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface ProblemExtra {
  detail?: string;
  errors?: { field: string; code: string; message?: string }[];
  retryAfterSeconds?: number;
  currentFee?: Money;
}

export function problem(code: ProblemCode, traceId: string, extra: ProblemExtra = {}): ApiResult {
  const entry = problemCatalog[code];
  const body = {
    type: problemType(code),
    title: entry.title,
    status: entry.status,
    code,
    traceId,
    ...extra,
  };
  const headers: Record<string, string> = {};
  if (extra.retryAfterSeconds !== undefined) headers["Retry-After"] = String(extra.retryAfterSeconds);
  return { status: entry.status, body, headers };
}

export function ok(status: number, body: unknown): ApiResult {
  return { status, body };
}
