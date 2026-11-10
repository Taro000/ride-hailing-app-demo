# 詳細設計の索引: 配車アプリ（ride-hailing-app-demo）

更新: 2026-11-08

| コンポーネント | 名前 | 状態 | 報告書 | モジュール | 未解決の指摘 |
|---|---|---|---|---|---|
| ELM-01 | 乗客の Web アプリ | 未着手 | | | |
| ELM-02 | ドライバーの Web アプリ | 未着手 | | | |
| ELM-03 | 管理とエンジニアの画面 | 回答反映済み | 4-detailed-design/ELM-03.md | MOD-01〜MOD-20 | なし |
| ELM-04 | サーバー | 未着手 | | | |
| ELM-05 | 毎日の処理と運用のコマンド | 未着手 | | | |
| ELM-06 | 配備の仕組み | 未着手 | | | |
| ELM-22 | 手元の保守の手順 | 未着手 | | | |

「未解決の指摘」は、この段（`high-level-design-to-detailed-design`）に宛てた、そのコンポーネントの指摘。データの置き場所（ELM-07、08、09、23）、外部システム、実行環境は詳細設計を持たない。表は、持ち主のデータの実体を持つコンポーネントが設計する。

## コンポーネントをまたぐ引き継ぎ

先に設計したコンポーネントが、後で設計するコンポーネントに求めること。後のコンポーネントの詳細設計はこれを入力にし、満たせなければ先のコンポーネントのこの段を動かし直す。

| 求める側 | 相手 | 求めること | 書いた所 |
|---|---|---|---|
| ELM-03 | ELM-01（`packages/web-shared` の持ち主） | WS-API（冪等キーの控え、送り直し、トレース ID の見出し、版の違いと 401 の知らせ）、WS-REC（ブラウザのエラーの記録の一時の保存と送信）、WS-MAP（地図とマーカー、失敗の知らせ）、WS-UI（React Aria Components の部品。DEC-56）、WS-TEXT（文言、額と時刻の表し方、日本時間の換算）の約束 | ELM-03 の報告書「共有のパッケージに求める約束」 |
| ELM-03 | ELM-04（`packages/contracts` の持ち主） | IFC-01・05・06・07 の型、入力の検査（誤りは `Problem.errors` と同じ field と code）、誤りの符号の日本語の文 | 同上 |
| ELM-03 | ELM-04（サーバー） | `/backoffice/` の下の静的なファイルの配布（知らない経路は index.html。DEC-60）、管理の画面の CSP、パスキーの options と応答を WebAuthn の JSON の形にする（DEC-59） | ELM-03 の報告書「ほかのコンポーネントへの引き継ぎ」 |
| ELM-03 | ELM-06（配備の仕組み） | 管理の画面の組み立てに APP_VERSION と同じ版を埋める。CI のゲートで ELM-03 のテスト（単体、部品、Playwright と axe）を動かす | 同上 |

ELM-03 で選んだライブラリ（DEC-56 React Aria Components、DEC-57 TanStack Query、DEC-58 React Router、DEC-64 MSW と Playwright と axe）は、web-shared を通じて ELM-01・02 にも及ぶ。ELM-01・02 の詳細設計は、これに合わせるか、変えるならその決定で ELM-03 も直す。

## この段から出した指摘

| FND | 出した詳細設計 | 宛先 | 重さ | 状態 |
|---|---|---|---|---|
| FND-79 | ELM-03 | 第 3 段階（architecture-to-high-level-design） | 軽微 | 未解決 |
| FND-80 | ELM-03 | 第 3 段階 | 軽微 | 未解決 |
| FND-81 | ELM-03 | 第 3 段階 | 軽微 | 未解決 |
| FND-82 | ELM-03 | 第 2 段階（architecture-drivers-to-architecture） | 軽微 | 未解決 |
| FND-83 | ELM-03 | 第 2 段階 | 軽微 | 未解決 |
