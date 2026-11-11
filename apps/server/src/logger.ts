import type { LogEntry, Logger } from "@ride/application";

// アプリの構造化ログ（DEC-44、IFC-09）。Cloud Logging が JSON の行を読む。座標、連絡先、名前、検索の語、本文は書かない。
export function jsonLogger(
  base: { service: "server" | "batch"; appVersion: string },
  write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
): Logger {
  return {
    log(entry: LogEntry) {
      write(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          schema_version: 1,
          service: base.service,
          app_version: base.appVersion,
          ...entry,
        }),
      );
    },
  };
}

export class MemoryLogger implements Logger {
  readonly entries: LogEntry[] = [];

  log(entry: LogEntry): void {
    this.entries.push(entry);
  }
}
