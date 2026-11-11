import { createApi, type Api } from "@ride/web-shared";

// 組み立てたときの版（DEC-49）。配備の仕組み（ELM-06）が APP_VERSION と同じ値を VITE_APP_VERSION に埋める。
export const buildVersion: string = import.meta.env.VITE_APP_VERSION ?? "dev";

export const api: Api = createApi({ buildVersion });

export const unauthenticatedEvent = "ride:unauthenticated";
export const versionMismatchEvent = "ride:version-mismatch";

api.onUnauthenticated(() => window.dispatchEvent(new Event(unauthenticatedEvent)));
api.onVersionMismatch(() => window.dispatchEvent(new Event(versionMismatchEvent)));
