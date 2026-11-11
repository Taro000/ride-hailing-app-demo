import type { AuthedAccount, TraceContext } from "@ride/application";

export type Env = {
  Variables: {
    trace: TraceContext;
    account: AuthedAccount | null;
    routeId: string | null;
  };
};
