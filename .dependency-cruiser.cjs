// コードの分け方と依存の規則（DEC-26。第 2 段階の「コードの分け方」のビュー）を CI で確かめる。
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-depends-on-nothing",
      comment: "domain は何にも依存しない（入出力を持たない）",
      severity: "error",
      from: { path: "^packages/domain/src" },
      to: { pathNot: "^packages/domain/src" },
    },
    {
      name: "application-does-not-import-adapters",
      comment: "外部サービス、時計、ID の生成の口は application に置き、adapters が実装する",
      severity: "error",
      from: { path: "^packages/application/src" },
      to: { path: "^packages/adapters" },
    },
    {
      name: "web-does-not-import-server-code",
      comment: "Web アプリはサーバーのコードを読み込まない。contracts だけを共有する",
      severity: "error",
      from: { path: "^(apps/web-passenger|packages/web-shared)/" },
      to: { path: "^(packages/(domain|application|adapters)|apps/server)/" },
    },
    {
      name: "only-server-assembles-adapters",
      comment: "adapters を組み立てるのは server（と batch）だけ",
      severity: "error",
      from: { path: "^packages/(domain|application|contracts|web-shared)/" },
      to: { path: "^packages/adapters/" },
    },
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|test-results|node_modules)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.node.json" },
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js"], conditionNames: ["import", "default"] },
  },
};
