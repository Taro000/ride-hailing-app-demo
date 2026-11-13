# 詳細設計の索引: 配車サービス

更新: 2026-11-13 · 入力の基準: b6feab9

<!-- generated: components -->
| コンポーネント | 名前 | 状態 | 報告書 | 確定のモジュール | 枠のモジュール |
|---|---|---|---|---|---|
| ELM-01 | 乗客とドライバーの Web アプリ | 未着手 | — | — | — |
| ELM-02 | 担当者とエンジニアの Web アプリ | 回答反映済み | 4-detailed-design/ELM-02.md | MOD-01〜MOD-02 | MOD-03〜MOD-19 |
| ELM-03 | 配車サーバー | 未着手 | — | — | — |
<!-- /generated -->

## 実装への申し送り

- 各コンポーネントは、その MOD とコンポーネントの報告書の中で作る。どのモジュールも、その MOD と、報告書の「型」「データ」「確かめ方」の中で作り、確定の深さのモジュールは、`behaviour` が名指す報告書の節と、報告書がそのモジュールに与えるキャッシュ、画面、設計上の値の中でも作る。コンポーネントを縛るインタフェース（IFC）、データの実体（DAT）、設計の決定（DEC）と、どのコンポーネントも縛る技術方針（POL。技術の組み合わせ、ディレクトリと依存の規則、テストの層、パイプライン、コードの中の約束事で、`2b-technical-policy.md` が索引にしている）を守る。
- 設計が開けたままにしたことは実装が決める。枠の深さの各モジュールの中、報告書の「データ」の節が与えるほかの表（DAT の中で）、設計が決めない値、下の申し送り。コードとそのテストがこれらの決めたことを持ち、`docs/design/` に書き戻さない。
- 設計が決めたことをコードが守れないとき（契約、不変条件、インタフェース、方針、決定が書いたとおりに動かないか、二つの項目が食い違う）は、黙って回り道をせず、指摘を書いて、どの段階を再実行するかを利用者に伝える。設計が開けたままにした細部は指摘にしない。指摘は `docs/design/fnd/` の新しいファイルで、そこにある最も大きい FND の次の番号にし、そこにあるほかのファイルと同じ項目を持つ（設計のスキルの `references/artifacts.md` が決めている）:
  - `raised_by: implementation` とし、`raised_in` には問題が現れるコードの道筋を書く。
  - `to` は、その項目を書いたスキル: DRV は `requirements-to-architecture-drivers`、ELM は `architecture-drivers-to-architecture`、POL は `architecture-to-technical-policy`、IFC と DAT は `architecture-to-high-level-design`、MOD は `high-level-design-to-detailed-design`、DEC はその `stage` のスキル。
  - `severity` は、主な設計を動かす要求、交渉できない制約か CUJ を設計どおりには満たせないとき `critical`、一部しか満たせないか二つの項目が食い違うとき `major`、ほかは `minor`。

<!-- generated: implementation-handoffs -->
| HND | コンポーネント | 名前 | 契機 |
|---|---|---|---|
| HND-16 | ELM-03 | ELM-03 が提供する HTTP と流れのインタフェースのスキーマ | ELM-03 の各インタフェースの経路を実装するとき |
<!-- /generated -->
