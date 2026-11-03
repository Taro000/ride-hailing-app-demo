# 概要設計: 配車アプリ（ride-hailing-app-demo）

状態: 回答反映済み · 更新: 2026-11-03 · 第 3 段階（全 4 段階）

## 要約

インタフェースは 29 件ある。内訳は HTTP 15 件（自分のもの 7、外部 8）、イベント 4 件（自分のもの 2、外部 2）、バッチ 3 件、画面 7 件。仕様書は OpenAPI 7 件と AsyncAPI 2 件（`ifc/specs/`）。端から端の流れは、CUJ ごとに 17 件、主な設計を動かす要求ごとに 8 件の図で描いた。データの実体は 29 件で、どれも持ち主は一つ。共通の約束事は 13 件の決定（DEC-38〜50）にした。エラーは RFC 9457 の形に変わらない符号とトレース ID を足し、状態を変える要求にはすべて冪等キーを付け、URL に個人情報を入れない。ほかに、配信の出どころ（DEC-51）、押さえの結果が分からないとき（DEC-52）、毎日の処理の結果（DEC-53）、知らせと一つ目の規則（DEC-54）、回数の制限（DEC-55）を決めた。

時刻のしきい値を持つ目標はどれも、ふつうの流れが収まる。NFR-02（5 秒）は直列の区間の予算の和が 3.45〜3.65 秒になる。ただし携帯の回線の区間の値は入力になく仮の値なので、最初のデモの前に実機 2 台で SLI-02 を測ることを関門にする。NFR-25（10 秒）は最悪 9.2 秒で、余りは 0.8 秒しかない。NFR-24（3 秒）は最悪 2.85 秒、NFR-06（8:30）は 07:35 ごろ、NFR-33（5 分）は最悪 102 秒。一方で、この規模（PC-05）では、NFR-01 と NFR-02 の許容される失敗の件数は 28 日で 1 件ほどかそれ未満、NFR-03 でも一回の回で 9〜11 回しかない。そのため失敗したときの流れは、エラーバジェットに収めるのではなく 1 件ずつ振り返る（EBP-01 の最後の規則）。

第 2 段階に未解決の指摘が 8 件（中 3 件）ある。この段で決められる部分は先に閉じ、残りは第 2 段階の再実行の後に追随する（「第 2 段階の未解決の指摘との関係」）。この段からは第 2 段階に指摘を 2 件出した（FND-28・29。どちらも軽微）。品質チェーンへの課題は新しく 2 件と、第 2 段階の課題 1 への具体案が 1 件ある。要合意の項目は、設計上の値（タイムアウト、回数の制限、セッションの長さ、T_hold_wait、T_op_stale）と、押さえの結果が分からないときの扱い（質問 2 で選んだ案は確認済み）。質問 1 で、第 2 段階の指摘が残るまま進めることが決まった。前提を並べた質問 3〜5 には回答がなく、推定のまま。

## 入力

| 出どころ | 得たもの |
|---|---|
| `docs/design/2-architecture.md`、`elm/`、`dec/` | 要素 23 件（コンポーネント 7）、決定 37 件、5 つのビュー、通し確認。とくに DEC-03（SSE）、DEC-08（トランザクション）、DEC-09（条件付きの書き込み）、DEC-12（お金の操作のキーの表と確かめ中）、DEC-15（座標の表）、DEC-16（URL の決まり）、DEC-17・35（知らせとアラート）、DEC-20（認証）、DEC-21（上限）、DEC-22（地図）、DEC-33（T_route、T_db）、DEC-37（閉じる前と終える前の確かめ）。第 2 段階が「第 3 段階で決める」とした点（確かめ中にするまでの時間、一つ目の規則の条件の形、操作キーの保持、トレース ID の見出しの形、URL の決まりの共通の約束事、毎日の処理の処理ごとの上限） |
| `docs/design/drv/`、`design-context.yaml`、`1-architecture-drivers.md` | 設計を動かす要求 32 件（主なもの 16 件）、技術制約 TC-01〜14、PC-01〜05（規模）、TEAM-01。今の構造はない（すべて新設） |
| `docs/design/fnd/` | この段への未解決の指摘はない。第 2 段階への未解決の指摘 FND-19〜26（中 3 件）と第 1 段階への FND-27（`reviews/2026-11-03-architecture-2.md`）。レビューの質問 1・2 の答え（デモの URL を発表、ブログ、動画で示し、デモの回の最中や前にも示す） |
| `docs/quality/fr/` | FR 54 件（廃止の FR-35 を除く）の受け入れ基準 200 件。トレースの対象 |
| `docs/quality/sli/`、`nfr/`、`ebp/EBP-01` | SLI-01〜05 の測定点と数え方。時刻のしきい値を持つ NFR-02・03（SLO）と NFR-24・25・06・33（監視と確かめ）。監視の NFR の出どころ。EBP-01 の最後の規則 |
| `docs/quality/qr/`、`context.yaml` | データの品質（QR-27〜37、49）とセキュリティ（QR-20〜22、38〜41、47）の中身。CUJ とその手順、利用者 |
| Cloud Run と Cloud Monitoring の文書（Context7 と docs.cloud.google.com、2026-11-03） | 入口の要求のログに結ぶにはコンテナのログの `logging.googleapis.com/trace` に `X-Cloud-Trace-Context` の値を書く。`traceparent` は Cloud Run の要求に入る（ブラウザが送った値を入口のログが使うことは書かれていない）。`run.googleapis.com/request_count` のラベルは `response_code`、`response_code_class`、`route`（いつも空）で、入口とアプリの応答を分けられない。`container/instance_count` は `state`、`job/completed_execution_count` は `result`。どれも 60 秒ごとに取られ、最大 120 秒遅れて見える |
| Stripe の文書（Context7、2026-11-03） | サンドボックスの上限は 1 秒に 25 件、Search は 20 件。Search は書いた直後の読み出しに使わない（ふだん 1 分、障害では 1 時間遅れる）。書いた直後は一覧を使う。429 で上限の見出しがないものはロックの待ち |
| Google の文書（2026-11-03） | Routes API の computeRoutes（POST `routes.googleapis.com/directions/v2:computeRoutes`、`X-Goog-FieldMask`、`TRAFFIC_AWARE`、distanceMeters と duration と polyline）。内容をためておく制限の今の規約は確かめられなかった（第 2 段階から持ち越し） |
| 公開のサフィックスの一覧（publicsuffix.org、2026-11-03） | `*.run.app` が載る。サービスのホスト名がそのまま一つのサイトになる |
| リポジトリ | 製品のコードと基盤の定義はない。すべて新設 |

## 第 2 段階の未解決の指摘との関係

最新のレビュー（`reviews/2026-11-03-architecture-2.md`）が第 2 段階に出した指摘は 8 件あり、まだ処理されていない（中 3 件）。この段の決めがそれらの答えに左右されるので、次のように扱った。インタフェースの形でこの段が決められる部分は先に決めた。第 2 段階の決定を変える部分は、第 2 段階の項目のまま設計し、変わりうる項目を挙げた。第 2 段階の項目は書き換えていない。

| 指摘 | 重さ | この段で決めたこと | 第 2 段階に残ること | この段で変わりうる項目 |
|---|---|---|---|---|
| FND-19 ELM-06 の Turso のトークン | 中 | 閉じる前と終える前の数えを、イメージのコマンド（IFC-10 の count-open と period-status）にした。ELM-06 は持ち主の表を直接読まない。ELM-06 がトークンを持つ今の形でも、Cloud Run のジョブで動かす形でも、コマンドの約束は同じ（DEC-53） | ELM-06 のトークン（構造の変更と配備の記録に使う）と、DEC-34・28、脅威のモデルの記述 | IFC-10、IFC-11、DAT-26 |
| FND-20 Turso に届かないときの知らせ | 中 | 一つ目の規則の条件を、アプリが返す 503 も数える形にした。指標のラベルでは入口とアプリの応答を分けられないため。Turso に届かないときも 4〜5 分で知らせが届く。サーバーの知らせは、記録を書けなくても先に送る（DEC-54） | SLI-03 の確かめがない分の数え方、DEC-35・17 の記述 | IFC-19、IFC-17、DAT-21、測定点 |
| FND-21 T_route と降車の確定 | 軽微 | 状態を変える要求すべてに冪等キーを付けた（DEC-48）。T_route で切られた乗車の終了も、同じキーで送り直すと最初の結果を受ける。処理中を確かめ中とみなすまでの時間は 30 秒（切られても続く最長 13.0 秒の 2.3 倍） | T_route の根拠と、降車の確定を応答の後に動かす形との比べ | IFC-03（complete）、DEC-48 |
| FND-22 期間を終える手順 | 軽微 | 毎日の結果の知らせに、期間を終えられるか（period_end_ready）を載せる（DEC-53） | 誰がいつ「期間を終える」を動かすか。毎日の処理では 0 件にならないものの扱い | IFC-10、IFC-11 |
| FND-23 URL の公開と DEC-21 | 中 | 経路ごとの回数の制限の値を置いた（DEC-55）。一つのアカウントと IP が地図の割り当てを使い切ることは防ぐ | URL を公開する前提で DEC-21 を決め直すこと（参加者の流れを先に通す、地図の全体の上限など） | DEC-55、IFC-02、IFC-08 |
| FND-24 裏の時刻が遅れて届く | 軽微 | なし（測定点は今の DEC-35・16 のまま） | 遅れて届いた裏の時刻で除き直すか | 測定点（SLI-03）、DAT-21 |
| FND-25 DEC-15 の読める相手 | 軽微 | 位置のモジュールが、受けた時刻だけを測るモジュールに返す形にした（DAT-21） | DEC-15 の表の記述 | DAT-21 |
| FND-26 Stripe に残る参加者の記録 | 軽微 | Stripe の顧客には内部の ID だけを送り、メールアドレスと名前は送らない（IFC-13） | DEC-10 か DEC-36 に書くこと | IFC-13 |
| FND-27 URL の公開と PC-05（第 1 段階あて） | 軽微 | なし | PC-05 と DRV-01・02・29 の環境 | DEC-55 の値 |

順番から見ると、この段は第 2 段階の指摘を処理する前に進めている。このため、第 2 段階を再実行すると、上の「変わりうる項目」でこの段の再実行が要る。数えると IFC 8 件（IFC-02、03、08、10、11、13、17、19）、DAT 2 件（DAT-21、26）、DEC 2 件（DEC-48、55）と SLI-03 の測定点で、29 件のインタフェースのうち 21 件と、29 件の実体のうち 27 件は変わらない見込み。

## 共通の約束事

| 約束事 | 決めたこと | DEC |
|---|---|---|
| エラー | 形: {type, title, status, code, detail, traceId, errors?, retryAfterSeconds?}。title と detail は日本語で個人情報を含めない。code は UPPER_SNAKE_CASE。429 と 503 には Retry-After の見出しも付ける。符号の一覧は packages/contracts に置き、画面はそこの文を示す（DEC-46） | DEC-38 |
| ID | サーバーが作る: 依頼 ride_、アカウント acc_、ドライバー drv_、見積もり est_、状態の変化 chg_、お金の操作 mop_、返金の要求 rfr_、苦情 cmp_ の後に ULID（26 文字）。ブラウザが作る: Idempotency-Key（UUIDv4）、トレース ID（W3C の 32 桁の 16 進）、clientEventId と clientErrorId（UUIDv4）。配信のカーソルは状態の履歴とドライバーの受付の記録の通し番号から作る不透明な文字 | DEC-39 |
| 時刻 | 送る: 2026-11-03T05:00:00.000Z。持つ: UTC（形は第 4 段階）。業務の日付: Asia/Tokyo の 0 時で区切る。ブラウザの時刻の欄には、サーバーが受けた時刻（received_at）を並べて持つ | DEC-40 |
| お金 | {amount: 1234, currency: "jpy"}。画面から送られた額は使わない（取り消しの expectedFee は確かめのためだけで、違えば 409） | DEC-41 |
| 一覧と並べ方 | ?cursor=&limit= で受け、{items, nextCursor} を返す。状態や種類のような列挙の絞り込みは問い合わせの文字に置いてよい。依頼の一覧（ドライバー）は条件で絞った全部を返す（数件） | DEC-42 |
| ログインのセッション | クッキーの名前は __Host-rh_session。最初の運営・エンジニアのアカウントは、役割のアカウントが一つもないときだけ、Secret Manager の一度だけの秘密で作る（IFC-01 staff-bootstrap）。ドライバーのアカウントは運営・サポート担当が登録し、ドライバーは設定の符号でパスワードを決める（管理者はパスワードを知らない） | DEC-43 |
| ログとトレース | どの行にも: timestamp、severity、message、logging.googleapis.com/trace、logging.googleapis.com/spanId、client_trace_id、event、schema_version、service（server か batch）、app_version。要求の行（request.completed）に: route_id、method、status、elapsed_ms、account_id、account_kind（participant か test）、ride_id。書かない: 座標、連絡先、名前、場所の検索の語、自由記述（苦情、報告）、カードの情報、クッキー、トークン、秘密、Webhook の URL、要求と応答の本文、IP アドレス（入口のログには残る）。重さ: DEBUG、INFO、WARNING、ERROR（知らせの対象は ERROR） | DEC-44 |
| 設定と秘密 | 秘密: STRIPE_SECRET_KEY（制限付き）、TURSO_AUTH_TOKEN、MAPS_SERVER_KEY、CHAT_WEBHOOK_URL、STAFF_BOOTSTRAP_SECRET。設定: TURSO_DATABASE_URL、MAPS_BROWSER_KEY、STRIPE_PUBLISHABLE_KEY、APP_VERSION、GCP_PROJECT_ID、しきい値（D_pickup_accuracy、D_arrival、D_dropoff、D_nearby_drivers、T_match_wait、T_noshow_wait、T_cancel_grace、V_moving、N_rating_levels、N_min_ratings）と設計上の値。値のない未定の値は起動を止める（未定のまま本番に出さない） | DEC-45 |
| 言語と表示 | 額は「1,234 円」、距離は m と km、時刻は HH:mm（日本時間）、到着予定は分の単位。アクセシビリティの名前も日本語（DRV-24） | DEC-46 |
| 命名 | 経路のまとまり: /api/v1/auth、/api/v1/passenger、/api/v1/driver、/api/v1/admin、/api/v1/engineer、/api/v1/locations、/api/v1/visibility-events、/api/v1/records、/api/v1/stream。route_id は passenger.rides.create のような . つなぎ。操作は資源の下の動詞（/rides/{rideId}/cancel）を POST で | DEC-47 |
| 冪等キーと送り直し | 同じキーで同じ中身: 最初の結果（状態の符号と本文）を返す。動いている間: 409 OPERATION_IN_PROGRESS と Retry-After: 1。結果が分からない（202 の HOLD_PENDING など）: pending として 202 を返し、確定したら最初の結果を確定したものに替える。同じキーで違う中身: 422 IDEMPOTENCY_KEY_REUSED。一つ目のトランザクションを書けなかったとき（Turso に届かない）は何も残らず、同じキーで送り直すと初めからやり直す。サーバーはブラウザの要求を送り直さない。サーバーから Stripe への送り直しは DEC-12 のとおり一か所 | DEC-48 |
| 版の扱い | 配信のメッセージと毎日の処理の出力は v か schema_version を持つ。ログは schema_version。画面は応答の X-App-Version と配信の hello の appVersion が自分と違い、操作の途中でないとき（手配の確定や乗車の終了を待っていないとき）に読み直し、GET で今の状態を取り直す | DEC-49 |
| タイムアウト | 一覧: ブラウザ 15 秒（SSE を除く）→ サーバー T_route 10 秒（DEC-33）→ 中の Turso 1 回 2 秒（DEC-33）、地図 1 回 2 秒（DEC-22）、Stripe 1 回 2.5 秒（DEC-12）、チャット 1 回 5 秒。乗車の終了はサーバーの中で最悪 9.2 秒（Turso が遅いと 13.0 秒）で、T_route で 503 を返しても処理は続き、結果は冪等キーと配信で受ける（FND-21 の残りは第 2 段階） | DEC-50 |

## 設計の決定

| DEC | 問い | 選んだ案 | 退けた案 | 根拠 |
|---|---|---|---|---|
| DEC-38 | すべてのインタフェースで、エラーをどの形で返すか | RFC 9457 の問題の詳細に code、traceId、errors を足す | 独自の {code, message, traceId, details}（中身は同じで、標準でない分だけ道具の助けを失う）。HTTP の状態の符号と文だけ（画面が場合を見分けられず、送り直してはいけないものを送り直す） | 推定 |
| DEC-39 | 公開する ID をどの形にし、誰が作るか | 種類の接頭辞と ULID（サーバーが作る）。ブラウザが作るキーは UUIDv4 と W3C のトレース ID | UUIDv7 だけ（推測できなさは同じで、種類が読めない分だけ調べにくい）。データベースの連番（推測でき、件数が漏れる） | 推定 |
| DEC-40 | 時刻をどう送り、どう持ち、業務の日付をどこで区切るか | インタフェースは UTC の RFC 3339（ミリ秒、Z）。業務の日付は Asia/Tokyo。期限の判定はサーバーの時計 | エポックからのミリ秒の数（ログと画面で読めない）。日本時間の文字（時差を持つ機械と道具で誤る） | 推定 |
| DEC-41 | 額をどう表し、誰が決めるか | 円の整数と通貨の符号。額はサーバーだけが決める | 小数の文字（市場が一つで要らない（第 2 段階の可変性））。浮動小数（誤差が出る） | 推定 |
| DEC-42 | 一覧をどう区切って返し、どう並べるか | 不透明なカーソルと limit。新しい順 | ページの番号と offset（追記でずれる）。全部を返す（上限がない） | 推定 |
| DEC-43 | ログインの状態をどう持ち、どれだけ保ち、どう切るか | サーバーに置くセッションと __Host- のクッキー（HttpOnly、Secure、SameSite=Strict）。状態を変える要求は Origin を確かめる | ブラウザに持たせる署名付きのトークン（ログアウトと停止ですぐ切れない）。SameSite=Lax のクッキー（広げる理由がない） | 推定 |
| DEC-44 | 一つの操作の記録をどうつなぎ、ログに何を書き、何を書かないか | ブラウザが traceparent と X-Client-Trace-Id を送り、サーバーは Cloud Run が渡す X-Cloud-Trace-Context を logging.googleapis.com/trace と spanId に、ブラウザの ID を client_trace_id に書く | traceparent だけに頼る（確かめられない前提に頼る）。独自の見出しだけ（入口のログと結べない） | 推定 |
| DEC-45 | 環境ごとの設定と秘密をどこに置き、画面にどう渡すか | 環境変数（手元とデモの回）。秘密は Secret Manager から環境変数へ。画面の設定は GET /api/v1/config | 設定をイメージに焼く（同じイメージを配る決まり（DEC-27）に反する）。秘密を GitHub の秘密に置く（DEC-34 に反する） | 推定 |
| DEC-46 | 人向けの文をどこに置き、日付や額をどう表すか | 日本語だけ。画面の文言は web-shared の文言のモジュール、誤りの文は contracts の符号の一覧。表示は ja-JP と Asia/Tokyo | 多言語の仕組みを入れる（要らない）。画面が符号から文を作る（誤りの文が二か所になる） | 推定 |
| DEC-47 | 経路、欄、出来事、符号の名前をどう付けるか | 経路は /api/v1/<役割>/ の後に小文字のハイフンつなぎの複数形。JSON の欄は camelCase、列挙は小文字の _ つなぎ、誤りの符号は UPPER_SNAKE、出来事は小文字の . つなぎ、ログの欄は snake_case | すべて snake_case（型と合わない）。すべて camelCase（ログの問い合わせと SLI の欄名と合わない） | 推定 |
| DEC-48 | どの要求を冪等にし、誰がどこで送り直すか | 状態を変える要求すべてに Idempotency-Key（位置、前面と裏、記録は、それぞれの ID で重複を捨てる）。最初の結果を 7 日保つ。送り直すのはブラウザの API の呼び出しのモジュールだけ | 手配と返金だけに鍵（お金を動かすほかの操作（取り消し、不在、乗車の終了、降車場所の変更、未払いの支払い）が守られない）。状態の条件だけで拒む（最初の結果を返せない） | 推定 |
| DEC-49 | インタフェースを、使う側を壊さずにどう変えるか | 経路に v1。足すだけで、知らない欄は両側とも無視する。X-App-Version で古い画面を読み直させる | 見出しで版を選ぶ（入口のログに版が残らない）。版を持たない（戻しで壊れる） | 推定 |
| DEC-50 | 呼び出しごとのタイムアウトをどう決めるか | 呼び出しごとに相手の正常な遅い応答より上、呼ぶ側は待つもの全体（確かめを含む）より上 | 遅延の予算から決める（正常な呼び出しを切る）。ライブラリの既定のまま（呼ぶ側と呼ばれる側の順が崩れる） | 推定 |
| DEC-51 | SSE で何を送り、それをインスタンスがどこから知るか | 状態の履歴とドライバーの受付の記録を通し番号で追い、相手の位置と到着予定は 1 秒ごとの今の値の読み出しで送る。ドライバーの一覧は変化のたびに丸ごと送る | 位置も追記の表で追う（書く量と追う量が増え、座標の表を位置のモジュールだけが読む決まり（DEC-15）を配信の追いかけに広げる）。一覧は知らせだけ送り、画面が取り直す（NFR-02 の余りが少ない） | 推定 |
| DEC-52 | 手配の押さえか、降車場所の変更の押さえ直しの結果が分からないとき、乗客に何を返し、いつまで確かめるか | 202 で確かめ中を返し、T_hold_wait（60 秒）まで見回りが確かめる。間に合えば探し始め（変更なら変える）、間に合わなければ押さえを解放して手配をやめる（変更なら変えない）。乗客はその間取り消せる | 確かめがつくまで待つ（Stripe が止まると終わりがない）。失敗として返す（押さえが残りうるのに「押さえていない」と言う） | 推定 |
| DEC-53 | 毎日の処理の結果を誰がどう読み、閉じる前と終える前の数えをどう行うか | 日と処理ごとの記録を DAT-24 に、要約と期間を終えられるかを毎日の結果の知らせに書く。閉じる前の数えと期間の状態はイメージのコマンドが返し、ELM-06 は表を直接読まない。ELM-04 は突き合わせの結果を読むだけ | ELM-06 が SQL で表を直接読む（決まりが二か所になる）。ELM-06 がサーバーの API で数える（期間を終えるときに使えない） | 推定 |
| DEC-54 | エンジニアへの知らせをどの形で送り、Cloud Monitoring の一つ目の規則をどんな条件にするか | 中立の知らせの形（種類、急ぎか、件数、窓、トレース ID の例、依頼 ID、知らせの ID）。記録を書けなくても先に送る。一つ目の規則は 5xx と 429 を 5 分で 5 件以上か、インスタンスの指標が 10 分ないとき | 一つ目の規則を入口だけに絞る（指標で分けられない）。記録を書けたときだけ知らせる（Turso の障害で知らせが止まる） | 推定 |
| DEC-55 | 経路ごとの回数の制限をいくつにし、どこで数えるか | 経路ごとの値。ふだんはインスタンスのメモリで数え、アカウントの作成とログインの失敗だけ Turso で数える | すべて Turso で数える（書く量が増え、Turso の障害で守りも止まる）。制限を置かない（DEC-21 に反する） | 推定 |

## インタフェース

| IFC | 種類 | 名前 | 提供側 | 利用側 | 操作 | FR | 仕様 | 根拠 |
|---|---|---|---|---|---|---|---|---|
| IFC-01 | HTTP | 認証と起動の API | ELM-04 | ELM-01、ELM-02、ELM-03 | 11 件（GET /api/v1/config ほか） | 01、48 | auth.openapi.yaml | 推定 |
| IFC-02 | HTTP | 乗客の API | ELM-04 | ELM-01 | 24 件（POST /api/v1/passenger/places/search ほか） | 02、03、04、05、06、07、08、09、12、13、14、29、31、43、44、51 | passenger.openapi.yaml | 推定 |
| IFC-03 | HTTP | ドライバーの API | ELM-04 | ELM-02 | 14 件（POST /api/v1/driver/reception/start ほか） | 16、17、18、19、20、21、22、23、25、26、27、28、29、31、32、33、34、47 | driver.openapi.yaml | 推定 |
| IFC-04 | HTTP | 位置と前面・裏の API | ELM-04 | ELM-01、ELM-02 | 2 件（POST /api/v1/locations ほか） | 10、11、17、21、24、34、51 | location.openapi.yaml | 推定 |
| IFC-05 | HTTP | 画面の記録の API | ELM-04 | ELM-01、ELM-02、ELM-03 | 3 件（POST /api/v1/records/displays ほか） | 02、13、38、54 | records.openapi.yaml | 推定 |
| IFC-06 | HTTP | 管理の API | ELM-04 | ELM-03 | 13 件（GET /api/v1/admin/complaints ほか） | 45、46、47、48、49、50 | admin.openapi.yaml | 推定 |
| IFC-07 | HTTP | エンジニアの API | ELM-04 | ELM-03 | 3 件（POST /api/v1/engineer/history-search ほか） | 01、39、40 | engineer.openapi.yaml | 推定 |
| IFC-08 | イベント | 状態の変化の配信 | ELM-04 | ELM-01、ELM-02 | hello、ride.updated、ride.live、driver.requests、driver.status、stream.closing | 06、07、09、10、11、12、16、18、19、20、22、24、25、26、28、29、31、47、54 | stream.asyncapi.yaml | 推定 |
| IFC-09 | イベント | アプリの構造化ログ | ELM-04 | ELM-05、USR-03 | request.completed、external.call、money.op、client.error、notification.sent / notification.failed、job.taskほか | 36、37、38 | app-logs.asyncapi.yaml | 推定 |
| IFC-10 | バッチ | 毎日の処理と運用のコマンド | ELM-05 | ELM-06、ELM-04 | daily、count-open、period-status、出力の表 | 29、30、36、53、55 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-11 | バッチ | 配備と開け閉めの手順 | ELM-06 | USR-03 | ci、build、start-period、open-demo、close-demo、rollbackほか | 41、42 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-12 | バッチ | 手元の保守の手順 | ELM-22 | USR-03 | export、prune、restore、unarchive、destroy | — | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-13 | HTTP | Stripe のサーバーの API（外部） | ELM-10 | ELM-04、ELM-05 | POST /v1/customers、POST /v1/setup_intents、GET /v1/setup_intents/{id}、GET /v1/customers/{id}/payment_methods、POST /v1/payment_methods/{id}/detach、POST /v1/payment_intents（capture_method=manual、confirm=true）、POST /v1/payment_intents/{id}/capture（amount_to_capture）、POST /v1/payment_intents/{id}/cancelほか | 04、05、07、12、27、29、30、31、50、55 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-14 | HTTP | Stripe の入力部品（外部、ブラウザ） | ELM-10 | ELM-01 | Stripe.js の読み込み（js.stripe.com）、Payment Element の表示、stripe.confirmSetup | 04、31 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-15 | HTTP | Google Maps のサーバーの API（外部） | ELM-11 | ELM-04 | POST https://places.googleapis.com/v1/places:autocomplete、GET https://places.googleapis.com/v1/places/{placeId}、POST https://routes.googleapis.com/directions/v2:computeRoutes | 02、03、10、12、19、23 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-16 | HTTP | Google Maps の地図の表示（外部、ブラウザ） | ELM-11 | ELM-01、ELM-02、ELM-03 | Maps JavaScript API の読み込み、地図、マーカー、経路の線 | 02、10、11、19、23、24、45 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-17 | HTTP | チャットの Webhook（外部） | ELM-12 | ELM-04、ELM-05、ELM-14 | POST <Webhook の URL> | 36、55 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-18 | イベント | 端末のブラウザの機能（外部） | ELM-13 | ELM-01、ELM-02 | Geolocation（watchPosition、enableHighAccuracy）、Screen Wake Lock（navigator.wakeLock.request('screen')）、音の再生（Web Audio）、Page Visibility（visibilitychange） | 02、06、17、21、24、52 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-19 | イベント | Cloud Monitoring の規則（外部） | ELM-14 | USR-03 | 一つ目の規則（デモの回の間だけ有効）、二つ目の規則（デモの期間だけ有効） | 36 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-20 | HTTP | Cloud Logging の読み出し（外部） | ELM-08 | ELM-05 | entries.list（Logging API v2） | 36 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-21 | HTTP | Google Cloud の管理の操作（外部） | ELM-19 | ELM-06 | Artifact Registry、Cloud Run の管理の API（ELM-17）、Cloud Scheduler、Cloud Monitoring、Secret Manager、API Keys | 41、42 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-22 | HTTP | Turso の管理の操作（外部、CLI） | ELM-18 | ELM-22 | turso db shell <db> .dump、書き出しからのデータベースの作成、時点を指定した復元、turso group unarchive、turso db destroy、turso db tokens create | — | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-23 | 画面 | 乗客のアカウントと支払い手段の画面 | ELM-01 | USR-01 | ログイン、アカウントの作成、支払い手段、未払いの支払い | 01、04、31 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-24 | 画面 | 乗客の手配から降車までの画面 | ELM-01 | USR-01 | 手配、手配の状況、迎車中、乗車中、到着と支払いの結果 | 02、03、05、06、07、08、09、10、11、12、24、26、28、29、31、43、51、54 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-25 | 画面 | 乗客の評価・設定・履歴・報告の画面 | ELM-01 | USR-01 | 評価、しきい値の設定、乗車の履歴、報告 | 13、14、43、44 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-26 | 画面 | ドライバーの受付と依頼の画面 | ELM-02 | USR-02 | ログインと初回の設定、受付、依頼の一覧、依頼の内容 | 01、16、17、18、19、20、21、34、47、52、54 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-27 | 画面 | ドライバーの迎車・乗車・受取額・条件の画面 | ELM-02 | USR-02 | 迎車中、乗車中、受取額、受ける条件 | 07、12、22、23、24、25、26、27、28、29、31、32、33、54 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-28 | 画面 | 管理の画面 | ELM-03 | USR-04 | ログイン、苦情の一覧と詳細、対処の記録、ドライバー、請求と返金 | 01、45、46、47、48、49、50 | なし（相手のもの、または画面とバッチ） | 推定 |
| IFC-29 | 画面 | エンジニアの画面 | ELM-03 | USR-03 | 状態の履歴の検索、依頼の位置、テスト用の印 | 01、40 | なし（相手のもの、または画面とバッチ） | 推定 |

画面の利用側は利用者（USR-01 乗客、USR-02 ドライバー、USR-03 エンジニア、USR-04 運営・サポート担当）。外部のインタフェース（IFC-13〜22）は相手の決まりに従い、adapters の包みが自分の共通の約束事（DEC-38〜50）に置き換える。データの置き場所への自分の読み書き（ELM-04・05 → ELM-07）はインタフェースにせず、第 4 段階が設計する。ELM-05 が ELM-04 の持つ表を書く例外（DEC-05）は、同じモジュールのコードを動かすもので、インタフェースにはならない。ほかの要素が持ち主の表を読むのは次の二つだけで、どちらも持ち主のインタフェースの一部にした。ELM-04 は突き合わせの結果（DAT-23。IFC-10）を読むだけ。ELM-06 は IFC-10 のコマンドを通して数える。ELM-06 が Turso に書くのは、自分の配備の記録（DAT-26）と、持ち主のモジュールが書いた構造の変更を当てることだけで、どちらもインタフェースにしない（DEC-27。使う資格情報は FND-19 で変わりうる）。

SLI-01 の六つの操作と経路（毎日の SLI-01 は入口のログの経路をこの表で route_id に当てる。DEC-35 の 1 分ごとの数も同じ route_id で数える）:

| 操作 | 経路 | route_id |
|---|---|---|
| 手配の確定（FR-05） | POST /api/v1/passenger/rides | passenger.rides.create |
| 依頼の一覧（FR-18） | GET /api/v1/driver/requests | driver.requests.list |
| 許諾（FR-20） | POST /api/v1/driver/requests/{rideId}/accept | driver.requests.accept |
| 迎車の到着（FR-25） | POST /api/v1/driver/rides/{rideId}/arrive | driver.rides.arrive |
| 運転の開始（FR-26） | POST /api/v1/driver/rides/{rideId}/start | driver.rides.start |
| 乗車の終了（FR-28） | POST /api/v1/driver/rides/{rideId}/complete | driver.rides.complete |

依頼の一覧は配信（IFC-08 の driver.requests）でも届く（DEC-51）。SLI-01 が数えるのは GET の要求だけ（流れは長い要求で、成否を数えない。配信の速さは SLI-02 が見る）。

## エラーの決まり

全操作に共通の行は、IFC-02 の「共通」の行に一度だけ載せる（IFC-01〜07 で同じ。ログインなしの経路には認証の行が付かない）。画面のエラーと空の状態は「画面」と各画面の項目（IFC-23〜29）に書いた。

| IFC | 操作 | 場合 | 知らせ方 | 呼ぶ側 |
|---|---|---|---|---|
| IFC-01 | POST /api/v1/auth/signup | 必要な項目が欠けている、形が違う（FR-01 AC2） | 400 INVALID_REQUEST | 欄を直す |
| IFC-01 | POST /api/v1/auth/signup | 同じメールアドレスのアカウントがある（FR-01 AC2） | 409 EMAIL_ALREADY_REGISTERED | 理由を示し、ログインへ案内する（品質チェーンへの課題 1） |
| IFC-01 | POST /api/v1/auth/login | メールアドレスかパスワードが違う（FR-01 AC4） | 401 INVALID_CREDENTIALS | その旨を示す（どちらが違うかは言わない） |
| IFC-01 | POST /api/v1/auth/login | 続けて失敗したので一時に止めている（DEC-20） | 429 ACCOUNT_LOCKED | 再開の時刻を示して待たせる |
| IFC-01 | POST /api/v1/auth/passkeys/authenticate | パスキーの確かめに失敗した | 401 PASSKEY_FAILED | もう一度確かめる。続くならパスワードからやり直す |
| IFC-01 | POST /api/v1/auth/passkeys/register | 登録の確かめに失敗した | 400 PASSKEY_REGISTRATION_FAILED | もう一度登録する |
| IFC-01 | POST /api/v1/auth/driver-setup | 符号が違う、期限切れ、使用済み | 400 SETUP_CODE_INVALID | 運営・サポート担当に出し直しを頼むよう示す（IFC-06 setup-code） |
| IFC-01 | POST /api/v1/auth/staff-bootstrap | 秘密が違う | 401 BOOTSTRAP_SECRET_INVALID | 何もしない |
| IFC-01 | POST /api/v1/auth/staff-bootstrap | 役割のアカウントがもうある | 409 ALREADY_BOOTSTRAPPED | 使わない（ログインする） |
| IFC-02 | POST /api/v1/passenger/places/search | 地図のサービスが答えない、失敗、1 日の割り当てに達した（DEC-22） | 503 MAPS_UNAVAILABLE | 候補を示せないことと、ピンで指定できることを示す。自動では送り直さない |
| IFC-02 | POST /api/v1/passenger/places/resolve | 地図のサービスが答えない | 503 MAPS_UNAVAILABLE | ピンで指定するよう示す |
| IFC-02 | POST /api/v1/passenger/estimates | 乗る場所と降りる場所の間に経路がない（FR-02 AC6） | 422 NO_ROUTE | 料金の確認に進めないことと理由を示す |
| IFC-02 | POST /api/v1/passenger/estimates | 現在地の誤差が D_pickup_accuracy を超え、ピンで確かめていない（FR-02 AC3） | 422 PICKUP_NOT_CONFIRMED | ピンで乗る場所を確かめさせる |
| IFC-02 | POST /api/v1/passenger/estimates | 経路を得られない（FR-03 AC5） | 503 MAPS_UNAVAILABLE | 値を示さず、手配に進めないことと理由を示す |
| IFC-02 | POST /api/v1/passenger/rides | 支払い手段が登録されていない（FR-05 AC2） | 409 PAYMENT_METHOD_REQUIRED | 支払い手段の画面へ |
| IFC-02 | POST /api/v1/passenger/rides | 押さえられない（残高不足、カードの停止など。FR-05 AC3） | 402 CARD_DECLINED | 理由と、別の支払い手段を選ぶ手段を示す。新しい冪等キーで送る |
| IFC-02 | POST /api/v1/passenger/rides | 本人の確かめを求められた（DEC-11 の応答を左右する点と同じ扱い） | 402 CARD_AUTHENTICATION_REQUIRED | 別の支払い手段を選ぶよう示す |
| IFC-02 | POST /api/v1/passenger/rides | 進行中の依頼がある（FR-05 AC4） | 409 ACTIVE_RIDE_EXISTS | 手配の状況の画面へ |
| IFC-02 | POST /api/v1/passenger/rides | 未払いの乗車がある（FR-05 AC4、FR-31 AC3） | 409 UNPAID_RIDE_EXISTS | 未払いの支払いの画面へ |
| IFC-02 | POST /api/v1/passenger/rides | 見積もりの期限切れか使用済み | 409 ESTIMATE_EXPIRED | 見積もり直す |
| IFC-02 | POST /api/v1/passenger/rides | 押さえの結果が分からない（タイムアウト、Stripe の 5xx）。依頼は確かめ中（DEC-52） | 202 HOLD_PENDING | 「支払いを確かめています」と示し、配信（IFC-08）と GET で待つ。取り消せる。新しい冪等キーで送り直さない |
| IFC-02 | POST /api/v1/passenger/rides | Stripe に要求が届かなかったと分かっている（接続できない、回数の上限） | 503 PAYMENTS_UNAVAILABLE | 押さえていないと示し、少し後に同じ冪等キーで送れる |
| IFC-02 | GET /api/v1/passenger/rides/{rideId}/cancellation-quote | 乗車が始まっている（FR-07 AC6） | 409 RIDE_ALREADY_STARTED | 降車場所の変更を案内する |
| IFC-02 | GET /api/v1/passenger/rides/{rideId}/cancellation-quote | 終わっている、取り消し済み | 409 RIDE_ALREADY_ENDED | 状態を読み直して示す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/cancel | 確かめた額と今の額が違う（その間に許諾、遅れの境目など） | 409 CANCELLATION_FEE_CHANGED | 新しい額を示して確かめ直し、新しい冪等キーで送る |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/cancel | 乗車が始まっている（FR-07 AC6） | 409 RIDE_ALREADY_STARTED | 降車場所の変更を案内する |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/cancel | 終わっている、取り消し済み | 409 RIDE_ALREADY_ENDED | 状態を読み直して示す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/threshold | 探している状態でない | 409 RIDE_NOT_SEARCHING | 状態を読み直す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/threshold | 今の値より下でない（上げることは FR-08 にない） | 422 THRESHOLD_NOT_LOWER | 下げる値を選ばせる |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/destination-quotes | 乗車中でない | 409 RIDE_NOT_IN_PROGRESS | 状態を読み直す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/destination-quotes | 経路がない | 422 NO_ROUTE | 変えられないことを示す（FR-12 AC4） |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/destination-quotes | 料金を計算できない（FR-12 AC4） | 503 MAPS_UNAVAILABLE | 変えられないことと理由を示す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/destination-changes | 料金が上がる変更で、新しい額を押さえられない（FR-12 AC4） | 402 HOLD_FAILED | 降車場所を変えず理由を示す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/destination-changes | 見積もりの期限切れ | 409 QUOTE_EXPIRED | 見積もり直す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/destination-changes | ほかの変更を確かめている | 409 DESTINATION_CHANGE_IN_PROGRESS | 待って配信を見る |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/destination-changes | 乗車中でない | 409 RIDE_NOT_IN_PROGRESS | 状態を読み直す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/destination-changes | 押さえ直しの結果が分からない | 202 DESTINATION_CHANGE_PENDING | 「確かめています」と示し、配信で待つ。T_hold_wait を過ぎると変えずに終わる |
| IFC-02 | GET /api/v1/passenger/rides/{rideId}/driver-photo | 担当のドライバーがいない、または終わった | 404 NOT_FOUND | 写真を示さない |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/rating | もう評価した（FR-13 AC3） | 409 ALREADY_RATED | 受け付けなかった旨を示す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/rating | 乗車が終わっていない | 409 RIDE_NOT_ENDED | 状態を読み直す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/reports | 種類が選ばれていない（FR-43 AC3） | 400 INVALID_REQUEST | 種類を選ぶよう示す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/unpaid-payments | 未払いでない | 409 NOT_UNPAID | 状態を読み直す |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/unpaid-payments | ほかの支払いを確かめている | 409 PAYMENT_IN_PROGRESS | 待って配信を見る |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/unpaid-payments | 断られた | 402 CARD_DECLINED | 理由を示し、別の支払い手段を選ばせる（新しい冪等キー） |
| IFC-02 | POST /api/v1/passenger/rides/{rideId}/unpaid-payments | 結果が分からない | 202 PAYMENT_PENDING | 「確かめています」と示し、配信で待つ |
| IFC-02 | PUT /api/v1/passenger/threshold | N_rating_levels の範囲の外（FR-14 AC3） | 400 INVALID_REQUEST | 範囲の中の値を選ばせる |
| IFC-02 | GET /api/v1/passenger/payment-methods | Stripe が答えない | 503 PAYMENTS_UNAVAILABLE | 今は示せないと示す |
| IFC-02 | POST /api/v1/passenger/payment-methods/setup-intents | Stripe が答えない | 503 PAYMENTS_UNAVAILABLE | 今は登録できないと示す |
| IFC-02 | POST /api/v1/passenger/payment-methods | Stripe が受け付けなかった（期限切れ、番号の誤りなど。FR-04 AC2） | 402 PAYMENT_METHOD_REJECTED | 理由を示す（ふつうは入力部品が先に示す） |
| IFC-02 | DELETE /api/v1/passenger/payment-methods/{paymentMethodId} | 進行中の依頼で使っている（FR-04 AC3） | 409 PAYMENT_METHOD_IN_USE | 削除しない旨を示す |
| IFC-02 | 共通 | 要求の形が違う（欄の不足、範囲の外、冪等キーがない）。errors に欄ごとの中身 | 400 INVALID_REQUEST | 欄を直す。同じものを送り直さない |
| IFC-02 | 共通 | ログインしていないか、セッションが切れた | 401 UNAUTHENTICATED | ログインの画面へ。操作の途中なら、ログインの後に同じ冪等キーで送る |
| IFC-02 | 共通 | 役割が違う、または送り元（Origin）がサービスの URL でない | 403 FORBIDDEN | 送り直さない（画面の誤りとしてブラウザのエラーの記録に残す） |
| IFC-02 | 共通 | ない、または自分のものでない（他人の依頼も 404 にする。DRV-29） | 404 NOT_FOUND | 画面を読み直す |
| IFC-02 | 共通 | 同じ冪等キーの要求がまだ動いている（DEC-48） | 409 OPERATION_IN_PROGRESS | Retry-After（1 秒）の後に同じキーで送るか、状態を読み直す |
| IFC-02 | 共通 | 同じ冪等キーで中身の違う要求（DEC-48） | 422 IDEMPOTENCY_KEY_REUSED | 画面の誤り。新しい操作として新しいキーで始める |
| IFC-02 | 共通 | 回数の上限（DEC-55） | 429 RATE_LIMITED | Retry-After まで待つ |
| IFC-02 | 共通 | 想定外の誤り | 500 INTERNAL_ERROR | 読むだけの要求は間を置いて送り直す。状態を変える要求は同じ冪等キーで送り直すか、状態を読み直す |
| IFC-02 | 共通 | T_route（10 秒）で切った。中の処理は続いていることがある（DEC-33） | 503 ROUTE_TIMEOUT | 結果が分からないとして扱う。読むだけの要求は送り直す。状態を変える要求は同じ冪等キーで送り直すか、状態を読み直す。新しいキーでは送らない |
| IFC-02 | 共通 | Turso に届かないか遅い（T_db）。状態を変えたかどうかは、一つ目のトランザクションを書けたかによる | 503 DEPENDENCY_UNAVAILABLE | ROUTE_TIMEOUT と同じ |
| IFC-03 | POST /api/v1/driver/reception/start | 配車を停止されている（FR-17 AC3、FR-47 AC2） | 403 DRIVER_SUSPENDED | 受付を始めさせずその旨を示す |
| IFC-03 | POST /api/v1/driver/reception/start | 位置がない（FR-17 AC2。ふつうは画面が位置情報の許可で先に止める） | 400 LOCATION_REQUIRED | 位置情報の利用の許可を求める |
| IFC-03 | GET /api/v1/driver/requests | 受付中でない（停止されたときを含む） | 409 NOT_RECEIVING | 受付の画面へ |
| IFC-03 | GET /api/v1/driver/requests/{rideId} | 速さが V_moving 以上（FR-21 AC1） | 409 DRIVER_MOVING | 停車してから操作するよう示す |
| IFC-03 | GET /api/v1/driver/requests/{rideId} | ほかのドライバーが許諾したか、乗客が取り消した（FR-19 AC2） | 409 REQUEST_NO_LONGER_AVAILABLE | その旨を示して一覧に戻る |
| IFC-03 | POST /api/v1/driver/requests/{rideId}/accept | ほかのドライバーが許諾した（FR-20 AC2） | 409 ALREADY_TAKEN | その旨を示して一覧に戻る |
| IFC-03 | POST /api/v1/driver/requests/{rideId}/accept | 乗客が取り消した（FR-20 AC3） | 409 RIDE_CANCELLED | その旨を示して一覧に戻る |
| IFC-03 | POST /api/v1/driver/requests/{rideId}/accept | 迎車中か乗車中（FR-20 AC4） | 409 DRIVER_BUSY | 受け付けなかった旨を示す |
| IFC-03 | POST /api/v1/driver/requests/{rideId}/accept | しきい値か評価の件数を満たさない（一覧を見た後に評価値が下がったなど。FR-16 AC2） | 409 NOT_ELIGIBLE | 割り当てなかった旨を示して一覧に戻る |
| IFC-03 | POST /api/v1/driver/requests/{rideId}/accept | 速さが V_moving 以上（FR-21 AC1） | 409 DRIVER_MOVING | 停車してから操作するよう示す |
| IFC-03 | POST /api/v1/driver/requests/{rideId}/accept | 停止された（QR-16） | 403 DRIVER_SUSPENDED | 受付の画面へ |
| IFC-03 | POST /api/v1/driver/rides/{rideId}/cancel | 乗車が始まっている（FR-22 AC2） | 409 RIDE_ALREADY_STARTED | 取り消さずその旨を示す |
| IFC-03 | POST /api/v1/driver/rides/{rideId}/arrive | 乗る場所から D_arrival より離れている（FR-25 AC2） | 409 TOO_FAR_FROM_PICKUP | 受け付けず、乗車場所に近づくよう示す（距離を添える） |
| IFC-03 | POST /api/v1/driver/rides/{rideId}/arrive | 取り消された依頼（FR-25 AC4） | 409 RIDE_CANCELLED | 受け付けずその旨を示す |
| IFC-03 | POST /api/v1/driver/rides/{rideId}/start | 確認コードが一致しない（FR-26 AC2）。残りの回数を添える | 422 CONFIRMATION_CODE_MISMATCH | 運転を始めさせず、依頼主かどうか確かめるよう示す |
| IFC-03 | POST /api/v1/driver/rides/{rideId}/start | 一つの割り当てで 10 回違った（仮。DEC-55） | 429 CONFIRMATION_ATTEMPTS_EXCEEDED | 乗客と確かめて、取り消すよう示す |
| IFC-03 | POST /api/v1/driver/rides/{rideId}/no-show | T_noshow_wait を過ぎていない（FR-27 AC2）。残りの秒数を添える | 409 NO_SHOW_TOO_EARLY | 受け付けず、あとどれだけ待つかを示す |
| IFC-03 | POST /api/v1/driver/rides/{rideId}/complete | 最後に指定した降車場所から D_dropoff を超えて離れている（FR-28 AC2）。距離を添える | 409 FAR_FROM_DROPOFF | ドライバーに確かめ、confirmFarFromDropoff: true で新しい冪等キーで送る |
| IFC-03 | POST /api/v1/driver/rides/{rideId}/complete | T_route で切った。乗車は終わっていて、確定が動いていることがある（FND-21） | 503 ROUTE_TIMEOUT | 同じ冪等キーで送り直すか、依頼を読み直す。配信で結果を待つ |
| IFC-03 | PUT /api/v1/driver/conditions | 負の値など、ありえない値（FR-33 AC3） | 400 INVALID_REQUEST | 受け付けず、範囲を示す |
| IFC-04 | POST /api/v1/locations | 送る状態でない（乗客の乗車が始まったか依頼が終わった、ドライバーが受付を止めた） | 409 NOT_SHARING_NOW | 送るのをやめる（FR-24 AC3） |
| IFC-04 | POST /api/v1/locations | 座標の範囲か時刻がおかしい（未来の時刻、60 秒より古い測定） | 400 INVALID_REQUEST | その位置を捨て、次の位置を送る |
| IFC-04 | POST /api/v1/locations | Turso に届かない | 503 DEPENDENCY_UNAVAILABLE | 送り直さず、次の時刻に新しい位置を送る |
| IFC-05 | POST /api/v1/records/displays | 形が違う | 400 INVALID_REQUEST | その記録を捨てる（送り直さない） |
| IFC-05 | POST /api/v1/records/displays | Turso に届かない | 503 DEPENDENCY_UNAVAILABLE | ブラウザに保ち、後で送る |
| IFC-05 | POST /api/v1/records/client-errors | 形が違う | 400 INVALID_REQUEST | その記録を捨てる |
| IFC-05 | POST /api/v1/records/screen-events | 形が違う | 400 INVALID_REQUEST | その記録を捨てる |
| IFC-06 | POST /api/v1/admin/complaints/{complaintId}/actions | 対処の内容か理由がない（FR-46 AC2） | 400 INVALID_REQUEST | 入れるよう示す |
| IFC-06 | POST /api/v1/admin/drivers | 必要な項目が欠けている（FR-48 AC2） | 400 INVALID_REQUEST | 欠けている項目を示す |
| IFC-06 | POST /api/v1/admin/drivers | そのナンバーは登録済み（FR-48 AC3） | 409 PLATE_ALREADY_REGISTERED | 登録せずその旨を示す |
| IFC-06 | POST /api/v1/admin/drivers | そのメールアドレスのアカウントがある | 409 EMAIL_ALREADY_REGISTERED | その旨を示す |
| IFC-06 | POST /api/v1/admin/drivers | 写真が 5 MB を超える | 413 PHOTO_TOO_LARGE | 小さくするよう示す |
| IFC-06 | POST /api/v1/admin/drivers | 写真が JPEG か PNG でない | 422 PHOTO_INVALID | 形を示す |
| IFC-06 | PATCH /api/v1/admin/drivers/{driverId} | そのナンバーは登録済み | 409 PLATE_ALREADY_REGISTERED | その旨を示す |
| IFC-06 | POST /api/v1/admin/drivers/{driverId}/setup-code | ドライバーはもう設定を済ませた | 409 SETUP_ALREADY_DONE | 出し直さない |
| IFC-06 | POST /api/v1/admin/rides/{rideId}/refunds | 返金できる残りの額を超える（FR-50 AC2） | 422 REFUND_EXCEEDS_REMAINING | 受け付けず残りの額を示す |
| IFC-06 | POST /api/v1/admin/rides/{rideId}/refunds | Stripe が返金を断った（FR-50 AC4） | 402 REFUND_FAILED | 完了と示さず理由を示す。やり直すときは新しい返金の要求にする（品質チェーンへの課題 2） |
| IFC-06 | POST /api/v1/admin/rides/{rideId}/refunds | Stripe が答えなかった | 202 REFUND_PENDING | 「確かめています」と示し、請求の記録を読み直す。同じ冪等キーで送り直してよい |
| IFC-07 | POST /api/v1/engineer/history-search | 条件がない | 400 SEARCH_CONDITION_REQUIRED | 条件を入れるよう示す |
| IFC-07 | POST /api/v1/engineer/history-search | 時間の範囲が 31 日を超える | 400 RANGE_TOO_WIDE | 狭めるよう示す |
| IFC-08 | — | ログインしていない | 401 UNAUTHENTICATED | ログインの画面へ |
| IFC-08 | — | 流れの本数の上限 | 429 STREAM_LIMIT と Retry-After | 流れを開かず、15 秒ごとに GET /api/v1/passenger/rides/active（ドライバーは GET /api/v1/driver/rides/active と GET /api/v1/driver/requests）で取り直し、Retry-After の後に開き直す（DEC-51） |
| IFC-08 | — | 流れが切れた（回線の切れ、インスタンスの入れ替え、30 分の区切り、stream.closing） | 接続が終わる | 1 秒待ち、最後の id を Last-Event-ID に付けて開き直す。続けて失敗するときは 2、4、8 秒、最大 30 秒の間を置く |
| IFC-08 | — | 60 秒何も届かない（生存確認は 25 秒ごと） | — | 切れたものとみなして開き直す |
| IFC-08 | — | カーソルが読めないか古すぎる | ride.updated と driver.requests を changeId なしで丸ごと | 今の状態に置き換える |
| IFC-08 | — | ブラウザが裏から前面に戻った | — | 流れを開き直し、GET で今の状態を取り直す（FR-06 AC3、FR-17 AC4） |
| IFC-08 | — | Turso に届かない（追いかけの読み出しが T_db で切れる） | 送るものがない（生存確認だけ） | 待つ。サーバーは次の 1 秒でやり直す（DEC-33） |
| IFC-09 | — | JSON として読めない行 | Cloud Logging が文字のまま残す | 集計から外れる。CI のゲート（NFR-32、NFR-40）でそういう行を出さない |
| IFC-09 | — | 取り込みの欠け | — | 0.1% 未満と仮定する（SLI-01）。お金と状態は Turso の記録が正で、ログは調べるための写し |
| IFC-10 | — | daily: Stripe から記録を取り出せない | その日の突き合わせを終えたと記録しない。終わりの符号 1 | 知らせ、次の実行で残りの日を続ける（FR-55 AC3、DRV-33）。ジョブの失敗は ELM-14 の二つ目の規則が知らせる（DEC-17） |
| IFC-10 | — | daily: 確かめ中のお金の操作を片付けられない（Stripe が答えない） | 確かめ中のまま残し、数を記録と知らせに載せる | 次の実行で続ける。期間を終える条件は満たさない（DEC-37） |
| IFC-10 | — | daily: Cloud Logging を読み終えられない | その日の SLI-01 を終えたと記録しない | 次の実行で続ける |
| IFC-10 | — | daily: 保存期間の処理が途中で失敗 | 変えられなかった件数を記録する | 次の実行で残りを続ける（FR-53 AC3） |
| IFC-10 | — | daily: 知らせを送れない | 終わりの符号 1（黙って成功しない。DEC-17） | ジョブの失敗として ELM-14 が知らせる |
| IFC-10 | — | daily: Turso に届かない（保管に回った、トークン） | 何もせず終わりの符号 1 | 同上。期間を始めるときは ELM-06 が先に止まる（20） |
| IFC-10 | — | count-open: 残りがある | 10 と一覧（依頼 ID と状態だけ） | ELM-06 はデモを閉じずに止まり、一覧を示す（DEC-37） |
| IFC-10 | — | period-status: 翌朝の処理がまだか、残りがある | 10 | ELM-06 は期間を終えずに止まる。毎日の結果の知らせが「終えられる」を伝えたら動かし直す |
| IFC-10 | — | Turso に届かない | 20 | ELM-06 は止まり、手元の手順（IFC-12）で保管から戻すよう示す |
| IFC-11 | — | ゲートが落ちた | 手順の失敗 | 配備せず、どのテストが落ちたかを示す（FR-41 AC3） |
| IFC-11 | — | open-demo の途中で失敗 | 手順の失敗と配備の記録（失敗） | 本番は前の版のまま（サービスがなければないまま）。失敗を記録して知らせる（FR-41 AC4）。動かし直すと同じ結果に収まる |
| IFC-11 | — | rollback で戻せる前の版がない | 手順の失敗 | 戻さずその旨を示す（FR-42 AC2） |
| IFC-11 | — | close-demo で count-open が 10 | 手順の失敗と一覧 | 閉じない。参加者が終えるか、見回りが片付けてから動かし直す。理由を付けて強いて閉じると配備の記録に残す（DEC-37） |
| IFC-11 | — | end-period で period-status が 10 | 手順の失敗 | 終えない。翌朝の処理の後に動かし直す（DEC-37） |
| IFC-11 | — | Turso に届かない（20） | 手順の失敗 | 止まり、IFC-12 の unarchive を動かすよう示す（DEC-27） |
| IFC-11 | — | GCP の操作の失敗（403、409、429、5xx） | その段で手順の失敗 | 原因を直して動かし直す（どの段も置き換えの形なので、続きから同じ結果になる） |
| IFC-12 | — | 書き出しの途中で失敗 | 中途のファイルを消す | 前の二つが残る。もう一度動かす（書き終えて確かめてから名前を付ける） |
| IFC-12 | — | 復号できない（パスフレーズの違い、改ざん） | 止まる | もう一つの書き出しか、時点を指定した復元を使う |
| IFC-12 | — | Turso の CLI の失敗 | その段で止まる | 原因を直して動かし直す |
| IFC-12 | — | destroy の確かめの文が違う | 何もしない | — |
| IFC-13 | — | カードが断られた | 402 card_error と decline_code | 押さえ・請求の失敗として扱う（FR-05 AC3、FR-31）。同じキーで送り直さない |
| IFC-13 | — | 本人の確かめを求められた | PaymentIntent の status が requires_action | 押さえられないと扱い、その PaymentIntent を取り消す（DEC-11） |
| IFC-13 | — | 要求の誤り、同じキーで違う引数 | 400 invalid_request_error、idempotency_error | 設計の誤り。送り直さず確かめ中にして知らせる |
| IFC-13 | — | 同じキーの要求が動いている | 409 | 要求の中では待たず確かめ中にし、見回りが確かめる |
| IFC-13 | — | 回数の上限か、ロックの待ち | 429（回数の上限は見出しを持つ。持たないものはロックの待ち。Stripe の文書） | Stripe は動いていない。要求の中では送らず確かめ中にし、見回りが同じキーで送る |
| IFC-13 | — | Stripe の中の誤り | 5xx | 同じキーの送り直しは同じ応答を返す（Stripe の文書）ので送り直さず、確かめ中にする（DEC-12 (c)） |
| IFC-13 | — | タイムアウト、接続の切れ | — | 要求の中では同じキーでだけ送り直す（降車の確定は 2 回まで、ほかは送り直さない。DEC-12）。それでも分からなければ確かめ中 |
| IFC-13 | — | Stripe-Should-Retry の見出しがある | true か false | それに従う |
| IFC-14 | — | カードの番号、期限、拒否の誤り | 入力部品のエラー | 入力部品がその場で示す（FR-04 AC2） |
| IFC-14 | — | Stripe.js を読み込めない | 読み込みの失敗 | 「今は登録できません」と示し、ブラウザのエラーの記録に残す |
| IFC-14 | — | 本人の確かめに失敗 | confirmSetup の失敗 | 理由を示し、もう一度か別のカードを選ばせる |
| IFC-15 | — | 要求の誤り、鍵の制限 | 400 INVALID_ARGUMENT、403 PERMISSION_DENIED | 設計の誤りとして知らせ、地図を使えないと扱う |
| IFC-15 | — | 1 日の割り当てに達した | 429 RESOURCE_EXHAUSTED | 地図を使えないと扱う（FR-03 AC5、FR-23 AC3）。その日の残りは決まった扱い（DRV-11） |
| IFC-15 | — | Google の中の誤り、タイムアウト | 5xx、2 秒で切る | 要求の中では送り直さず、地図を使えないと扱う（DEC-22） |
| IFC-15 | — | 経路がない | 200 で routes が空 | NO_ROUTE（FR-02 AC6） |
| IFC-16 | — | 鍵の誤り、割り当て、読み込めない | gm_authFailure か読み込みの失敗 | 地図の代わりに住所と位置の文字を示し、ドラッグしない代わり（DEC-24）で操作を続ける。ブラウザのエラーの記録に残す |
| IFC-17 | — | 2xx 以外、タイムアウト | — | 1、2、4 秒の間を置いて 3 回まで送り直す。429 は Retry-After に従う |
| IFC-17 | — | それでも送れない | — | 送れなかったと記録し（FR-36 AC3）、次の 1 分のまとめで送り直す。毎日の処理は失敗として終わる（DEC-17） |
| IFC-18 | — | 位置の利用が許可されていない | PERMISSION_DENIED | 乗客には現在地を入れず探して指定するよう示す（FR-02 AC4）。ドライバーには受付を始めさせず許可を求める（FR-17 AC2） |
| IFC-18 | — | 位置を得られない | POSITION_UNAVAILABLE、TIMEOUT | その回は送らない。相手の画面は古さを示す（FR-10 AC4） |
| IFC-18 | — | 画面の点灯を使えない、失敗 | 例外か解放の出来事 | 画面が消えると一覧と現在地の更新が止まることを示す（FR-52 AC4）。前面に戻ったら取り直す（FR-52 AC3） |
| IFC-18 | — | 音を鳴らせない | 再生の失敗 | 画面の知らせだけにし、次のタップで鳴らせるようにする |
| IFC-19 | — | チャットが止まっている | 届かない | 残る危険（第 2 段階の F16） |
| IFC-20 | — | 読み出しの割り当て | 429 | 間を置いて送り直す |
| IFC-20 | — | 5xx、タイムアウト | — | 3 回まで送り直す |
| IFC-20 | — | 権限がない | 403 | 失敗として終わる |
| IFC-20 | — | 読み終えられない | — | その日の SLI-01 を終えたと記録しない（DRV-33） |
| IFC-21 | — | 権限がない | 403 | 止まる |
| IFC-21 | — | 消すものがない | 404 | 消えたとみなして続ける |
| IFC-21 | — | 競合 | 409 | 置き換えで解く |
| IFC-21 | — | 回数の上限、Google の中の誤り | 429、5xx | gcloud の既定の送り直し。それでも失敗したら止まる |
| IFC-22 | — | CLI の失敗 | 終わりの符号 | 手順を止める |
| IFC-22 | — | 保管に回っている | 問い合わせに答えない | 先に unarchive |

結果が分からないときの約束（interfaces.md の「結果が分からない状態」）:

- お金を動かす要求（手配、取り消し、降車場所の変更、不在、乗車の終了、未払いの支払い、返金）は、Stripe の結果が分からなければ「押さえていない」「請求していない」と言わない。手配、降車場所の変更、未払いの支払い、返金は 202 と確かめ中を返す。取り消し、不在、乗車の終了は、依頼の状態の変化は済ませたうえで 200 と payment.state = checking を返す。どちらも配信（IFC-08）で結果を届ける。
- 「押さえていない」と言うのは三つのときだけ。Stripe が断ったとき（402）、要求が Stripe に届かなかったと分かっているとき（接続できない、429）、確かめで押さえがないと分かったか押さえを取り消したとき。
- 同じ冪等キーの送り直しは最初の結果を受け、動いている間は 409 を受ける。新しいキーで送り直すのは、定まった拒みを受けた後だけ（DEC-48）。
- Stripe への送り直しは、要求の中では同じキーでだけ行う（DEC-12）。照らしてから新しいキーで送るのは確かめの中だけ（DEC-12 (d)）。

## 端から端の流れ

参加者は要素で、ID を付けた。矢印のメッセージには、使うインタフェースの ID を書いた。トランザクションは「トランザクション 1」のように番号で示す。どれもトランザクションは外部の呼び出しをまたがない（DEC-08）。

### CUJ-01-A 場所と見積もり（乗る場所・降りる場所を決める、移動時間と料金を確認する）

```mermaid
sequenceDiagram
  autonumber
  actor P as USR-01 乗客
  participant PA as ELM-01 乗客の Web アプリ
  participant BC as ELM-13 端末のブラウザの機能
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant MAP as ELM-11 Google Maps
  P->>PA: 手配の画面を開く
  PA->>SRV: POST /api/v1/records/screen-events 手配の画面を開いた（IFC-05、FR-02 AC7）
  PA->>BC: watchPosition（IFC-18）
  alt 許可されている
    BC-->>PA: 現在地と誤差
    opt 誤差が D_pickup_accuracy を超える
      PA-->>P: ピンで乗る場所を確かめるよう求める（FR-02 AC3）
    end
  else 許可されていない
    PA-->>P: 場所を探して指定するよう示す（FR-02 AC4）
  end
  P->>PA: 降りる場所の語を打つ
  PA->>SRV: POST /api/v1/passenger/places/search 語は本文（IFC-02、DEC-16）
  SRV->>MAP: places:autocomplete（IFC-15、2 秒）
  alt 候補がある
    SRV-->>PA: 200 候補（名前と住所。QR-18）
  else 候補がない
    SRV-->>PA: 200 items 空（FR-02 AC5）
  else 地図が答えない、割り当てに達した
    SRV-->>PA: 503 MAPS_UNAVAILABLE（ピンで指定できると示す）
  end
  P->>PA: 候補を選ぶ
  PA->>SRV: POST /api/v1/passenger/places/resolve（IFC-02）
  SRV->>MAP: places/placeId（IFC-15）
  SRV-->>PA: 位置と住所
  PA->>SRV: POST /api/v1/passenger/estimates（IFC-02）
  SRV->>MAP: computeRoutes TRAFFIC_AWARE（IFC-15、2 秒、送り直さない）
  alt 経路がある
    SRV->>DB: 見積もりと経路の写し（DAT-05、DAT-11）
    SRV-->>PA: 201 到着予定時刻と三つの要素、所要時間、料金の内訳（FR-03）
  else 経路がない
    SRV-->>PA: 422 NO_ROUTE（FR-02 AC6）
  else 地図が答えない
    SRV-->>PA: 503 MAPS_UNAVAILABLE（値を示さず手配に進めない。FR-03 AC5）
  end
  opt しきい値を設定している（FR-51）
    PA->>SRV: POST /api/v1/passenger/nearby-drivers/count（IFC-02）
    SRV->>DB: 受付中で 30 秒以内の位置のドライバーを数える（位置のモジュール）
    SRV-->>PA: 近くの数としきい値を満たす数
  end
```

### CUJ-01-B 手配の確定（配車を手配する）

```mermaid
sequenceDiagram
  autonumber
  participant PA as ELM-01 乗客の Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant ST as ELM-10 Stripe
  participant DA as ELM-02 ドライバーの Web アプリ
  PA->>SRV: POST /api/v1/passenger/rides 冪等キー K（IFC-02）
  SRV->>DB: K を探す（DAT-14）
  alt K の最初の結果がある
    SRV-->>PA: 最初の結果をそのまま返す
  else K がまだ動いている
    SRV-->>PA: 409 OPERATION_IN_PROGRESS（Retry-After 1）
  else 新しい K
    SRV->>DB: トランザクション 1、進行中と未払いを確かめ、依頼を booking、押さえ 1 を processing、K を processing で書く
    SRV->>ST: PaymentIntent を作って押さえる（IFC-13、キー ride_R_hold_1、2.5 秒）
    alt 押さえた
      SRV->>DB: トランザクション 2、依頼を searching、履歴 requested、押さえ succeeded、K に 201
      SRV-->>PA: 201 ドライバーを探しています
      SRV-->>DA: 次の追いかけ（1 秒以内）で driver.requests（IFC-08）
    else 断られた、本人の確かめを求められた
      SRV->>DB: トランザクション 2、依頼を not_booked、押さえ failed、K に 402
      SRV-->>PA: 402 CARD_DECLINED か CARD_AUTHENTICATION_REQUIRED（FR-05 AC3）
    else タイムアウト、接続の切れ、5xx
      SRV->>DB: トランザクション 2、依頼を hold_checking、押さえ checking、K を pending
      SRV-->>PA: 202 HOLD_PENDING（DEC-52）
    end
  end
  opt 確かめ中（見回り 5 秒ごと、DEC-04）
    SRV->>DB: お金の操作のリースを取る（DAT-13）
    SRV->>ST: 顧客の PaymentIntent の一覧（作った時刻で絞り、メタデータの money_op_id で照らす）
    alt 押さえがあり、T_hold_wait の内で、取り消しの求めがない
      SRV->>DB: 依頼を searching、履歴 requested、K に 201
      SRV-->>PA: ride.updated（IFC-08）
    else 押さえがなく、T_hold_wait の内
      SRV->>ST: 同じキー ride_R_hold_1 で送り直す（24 時間の内。DEC-12 (d)）
    else T_hold_wait を過ぎた、乗客が取り消した
      SRV->>ST: 押さえがあれば取り消す（キー pi_X_cancel）
      SRV->>DB: 依頼を not_booked、履歴 not_booked、K に最後の結果
      SRV-->>PA: ride.updated not_booked（押さえていないと示す）
    else Stripe が答えない
      Note over SRV: checking のまま。次の見回りで続ける
    end
  end
  opt インスタンスがトランザクション 1 の後に止まった
    Note over SRV,DB: 押さえ processing が T_op_stale（30 秒）を過ぎると checking にし、上の確かめに入る
  end
```

### CUJ-01-C 取り消し（配車を手配する。FR-07、FR-08）

```mermaid
sequenceDiagram
  autonumber
  participant PA as ELM-01 乗客の Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant ST as ELM-10 Stripe
  participant DA as ELM-02 ドライバーの Web アプリ
  PA->>SRV: GET /api/v1/passenger/rides/R/cancellation-quote（IFC-02）
  SRV->>DB: 状態、許諾、許諾のときの到着予定、到着の印
  SRV-->>PA: 額 0 か 500 と理由（FR-07 AC1〜4）
  PA->>PA: 額を示し、乗客が確かめる（FR-07 AC2）
  PA->>SRV: POST /api/v1/passenger/rides/R/cancel 確かめた額、冪等キー K
  alt 今の額が違う
    SRV-->>PA: 409 CANCELLATION_FEE_CHANGED（新しい額）
  else 乗車が始まっている
    SRV-->>PA: 409 RIDE_ALREADY_STARTED（降車場所の変更を案内。FR-07 AC6）
  else 押さえの確かめ中
    SRV->>DB: cancel_requested
    SRV-->>PA: 202 CANCEL_PENDING（見回りが解放する）
  else 取り消せる
    SRV->>DB: トランザクション 1、cancelled、履歴 cancelled（誰が、額。FR-07 AC7）、お金の操作 processing、K processing
    SRV->>ST: 無料は cancel（キー pi_X_cancel）、500 円は capture amount_to_capture 500（キー pi_X_capture）
    alt 成功
      SRV->>DB: トランザクション 2、結果、履歴 charged か hold_released、K に 200
      SRV-->>PA: 200
    else 確定の定まった失敗
      SRV->>DB: トランザクション 2、未払い（FR-07 AC5、FR-31）
      SRV-->>PA: 200 payment.state unpaid
    else 分からない
      SRV->>DB: トランザクション 2、checking
      SRV-->>PA: 200 payment.state checking（結果は配信で）
    end
    SRV-->>DA: ride.updated cancelled と音（IFC-08、FR-07 AC2）
  end
```

### CUJ-01-D アカウントと支払い手段（配車を手配する。FR-01、FR-04）

```mermaid
sequenceDiagram
  autonumber
  actor P as USR-01 乗客
  participant PA as ELM-01 乗客の Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant ST as ELM-10 Stripe のサーバーの API
  participant SJ as ELM-10 Stripe の入力部品
  P->>PA: メールアドレスとパスワード
  PA->>SRV: POST /api/v1/auth/signup 冪等キー（IFC-01）
  alt 作れた
    SRV->>DB: アカウントとセッション（DAT-01、DAT-02）
    SRV-->>PA: 201 とクッキー
  else 欠けている、同じメールアドレス
    SRV-->>PA: 400 か 409 EMAIL_ALREADY_REGISTERED（FR-01 AC2）
  else IP ごとの上限
    SRV-->>PA: 429 RATE_LIMITED
  end
  PA->>SRV: POST /api/v1/passenger/payment-methods/setup-intents（IFC-02）
  SRV->>ST: 顧客がなければ作る（metadata は内部の ID だけ。FND-26）、SetupIntent を作る（IFC-13）
  SRV-->>PA: client secret
  PA->>SJ: Payment Element と confirmSetup（IFC-14。カードは Stripe の枠の中）
  alt 登録できた
    PA->>SRV: POST /api/v1/passenger/payment-methods setupIntentId
    SRV->>ST: SetupIntent を読む
    SRV->>DB: 既定の支払い手段（DAT-12）
    SRV-->>PA: 201 種類と下 4 桁（FR-04 AC1）
  else カードの誤り
    SJ-->>PA: 入力部品が理由を示す（FR-04 AC2）
  end
```

### CUJ-02 乗車（乗客）（手配した車かどうかを確認する）

```mermaid
sequenceDiagram
  autonumber
  participant DA as ELM-02 ドライバーの Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant MAP as ELM-11 Google Maps
  participant PA as ELM-01 乗客の Web アプリ
  participant BC as ELM-13 端末のブラウザの機能
  Note over DA,SRV: 許諾は CUJ-06
  SRV->>DB: 許諾のトランザクション（担当、確認コード、許諾のときの到着予定、車両の写し、履歴 accepted）
  SRV-->>PA: ride.updated accepted（ドライバーと車、確認コード。IFC-08、FR-09）
  PA->>BC: 音（IFC-18、FR-06 AC1）
  PA->>SRV: POST /api/v1/records/displays changeId と示した時刻（IFC-05）
  PA->>SRV: GET /api/v1/passenger/rides/R/driver-photo（IFC-02）
  loop 迎車中、10 秒ごと
    DA->>SRV: POST /api/v1/locations（IFC-04）
    SRV->>DB: 受信の記録と最後の位置（位置のモジュール）
    SRV-->>PA: ride.live ドライバーの位置（1 秒ごとの今の値。DEC-51）
  end
  loop 60 秒ごと（見回り）
    SRV->>MAP: computeRoutes ドライバーから乗車場所（IFC-15）
    SRV->>DB: 到着予定
    SRV-->>PA: ride.live 到着予定
  end
  alt ドライバーの位置が 30 秒より古い
    SRV-->>PA: ride.live stale
    PA->>PA: 最後の位置と時刻、止まっていることを示す（FR-10 AC4）
  end
  alt ドライバーが取り消した（FR-22）
    SRV-->>PA: ride.updated relisted 探し直しています（FR-06 AC4）
    Note over PA: 別のドライバーが許諾すると、表示と確認コードを替える（FR-09 AC2）
  end
  DA->>SRV: POST /api/v1/driver/rides/R/arrive（迎車の流れ）
  SRV-->>PA: ride.updated arrived と音（FR-06 AC2）
  opt 裏から前面に戻った
    PA->>SRV: GET /api/v1/passenger/rides/active と流れの開き直し（FR-06 AC3）
  end
```

### 迎車（CUJ にない流れ。CUJ-02 と CUJ-07 の間）

```mermaid
sequenceDiagram
  autonumber
  participant DA as ELM-02 ドライバーの Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant PA as ELM-01 乗客の Web アプリ
  participant BC as ELM-13 乗客の端末のブラウザの機能
  Note over DA: 許諾の応答に乗車場所までの経路（なければ null。FR-23 AC3）
  opt 乗客が位置の利用を許可している
    loop 迎車中、10 秒ごと
      PA->>BC: watchPosition
      PA->>SRV: POST /api/v1/locations（IFC-04）
      SRV-->>DA: ride.live 乗客の位置（担当のドライバーにだけ。FR-24）
    end
  end
  DA->>SRV: POST /api/v1/driver/rides/R/arrive 位置、冪等キー（IFC-03）
  alt D_arrival 以内
    SRV->>DB: 到着 verified、位置の記録、履歴 arrived、疑わしい印（DEC-29）
    SRV-->>DA: 200
    SRV-->>PA: ride.updated arrived
  else 遠い
    SRV-->>DA: 409 TOO_FAR_FROM_PICKUP 距離（FR-25 AC2）
  else 位置がないか、誤差が D_arrival より大きい
    SRV->>DB: 到着（確かめられなかった印。FR-25 AC3）
    SRV-->>DA: 200 arrival.verified false
  else 取り消された
    SRV-->>DA: 409 RIDE_CANCELLED（FR-25 AC4）
  end
  opt ドライバーが取り消す（FR-22）
    DA->>SRV: POST /api/v1/driver/rides/R/cancel 冪等キー
    SRV->>DB: searching、履歴 driver_cancelled と relisted、押さえはそのまま、確認コードを無効に
    SRV-->>PA: ride.updated relisted
    SRV-->>DA: 200
  end
```

### CUJ-03 降車（乗客）（正しい場所に到着したかを確認する）

```mermaid
sequenceDiagram
  autonumber
  participant PA as ELM-01 乗客の Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant MAP as ELM-11 Google Maps
  participant ST as ELM-10 Stripe
  participant DA as ELM-02 ドライバーの Web アプリ
  loop 乗車中
    SRV-->>PA: ride.live 車の位置と到着予定（FR-11）
  end
  PA->>SRV: POST /api/v1/passenger/rides/R/destination-quotes 新しい降車場所（IFC-02）
  SRV->>MAP: computeRoutes 乗車の開始から新しい降車場所
  SRV->>DB: 見積もり destination_change
  SRV-->>PA: 料金と到着予定（FR-12 AC1）
  PA->>SRV: POST /api/v1/passenger/rides/R/destination-changes quoteId、冪等キー
  SRV->>DB: トランザクション 1、押さえ n を processing
  SRV->>ST: 新しい額で押さえる（キー ride_R_hold_n）
  alt 押さえた
    SRV->>DB: トランザクション 2、降車場所と料金、履歴 destination_changed、古い押さえの取り消しを processing
    SRV->>ST: 古い押さえを取り消す（キー pi_old_cancel）
    SRV->>DB: トランザクション 3、取り消しの結果
    SRV-->>PA: 200
    SRV-->>DA: ride.updated destination_changed と音、新しい経路（FR-12 AC2、FR-23 AC2）
  else 断られ、料金が上がる
    SRV-->>PA: 402 HOLD_FAILED 降車場所を変えない（FR-12 AC4）
  else 断られ、料金が下がる
    SRV->>DB: 古い押さえのまま降車場所と料金を変える（終わりに下がった額だけを確定。DEC-11）
    SRV-->>PA: 200
  else 分からない
    SRV-->>PA: 202 DESTINATION_CHANGE_PENDING（見回りが T_hold_wait まで確かめる。DEC-52）
  end
  Note over PA,DA: 乗車の終了と支払いの結果は CUJ-08
```

### CUJ-04 ドライバーの評価

```mermaid
sequenceDiagram
  autonumber
  participant PA as ELM-01 乗客の Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  SRV-->>PA: ride.updated ended（CUJ-08）
  PA->>SRV: POST /api/v1/records/screen-events 評価の画面を開いた（IFC-05、FR-13 AC4）
  alt 送る
    PA->>SRV: POST /api/v1/passenger/rides/R/rating 段階、冪等キー（IFC-02）
    alt 初めて
      SRV->>DB: 一つのトランザクションで評価、評価値、件数（DAT-15、FR-15）
      SRV-->>PA: 201
    else もう評価した
      SRV-->>PA: 409 ALREADY_RATED（FR-13 AC3）
    end
  else 閉じる
    PA->>PA: 送らずに閉じる（FR-13 AC2）
  end
```

### CUJ-05 評価のしきい値の設定

```mermaid
sequenceDiagram
  autonumber
  participant PA as ELM-01 乗客の Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant DA as ELM-02 ドライバーの Web アプリ
  PA->>SRV: PUT /api/v1/passenger/threshold 値か null（IFC-02）
  alt 範囲の中
    SRV->>DB: 今の値と変化の記録（DAT-16）
    SRV-->>PA: 200 次の手配から（FR-14 AC1・2）
  else 範囲の外
    SRV-->>PA: 400 INVALID_REQUEST（FR-14 AC3）
  end
  Note over PA,SRV: 手配のとき、その時点のしきい値を依頼に写す（FR-05 AC1）
  opt 探している間に T_match_wait を過ぎた（FR-08）
    PA->>PA: 待ち続ける、取り消す、しきい値を下げる、を示す
    PA->>SRV: POST /api/v1/passenger/rides/R/threshold 下げた値、冪等キー
    SRV->>DB: 依頼のしきい値と履歴 threshold_lowered（FR-08 AC3）
    SRV-->>PA: 200
    SRV-->>DA: driver.requests 下げた値で示し直す（FR-16 AC4）
  end
```

### CUJ-06 配車受付（配車依頼を選ぶ、依頼内容を確認する、依頼を許諾する）

```mermaid
sequenceDiagram
  autonumber
  actor D as USR-02 ドライバー
  participant DA as ELM-02 ドライバーの Web アプリ
  participant BC as ELM-13 端末のブラウザの機能
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant MAP as ELM-11 Google Maps
  participant PA as ELM-01 乗客の Web アプリ
  D->>DA: 受付を始めるタップ
  DA->>BC: 位置の許可、wakeLock、音の準備（IFC-18、FR-52）
  alt 位置の利用が許可されていない
    DA-->>D: 受付を始めさせず許可を求める（FR-17 AC2）
  else 許可されている
    DA->>SRV: POST /api/v1/driver/reception/start 位置（IFC-03）
    alt 停止中
      SRV-->>DA: 403 DRIVER_SUSPENDED（FR-17 AC3）
    else
      SRV->>DB: 受付中、変化の記録、最後の位置（DAT-04、DAT-10）
      SRV-->>DA: 200
      DA->>SRV: GET /api/v1/stream（IFC-08）と GET /api/v1/driver/requests（IFC-03）
    end
  end
  Note over SRV: 新しい依頼（CUJ-01-B のトランザクション 2）
  SRV->>DB: 追いかけで履歴 requested を読み、このドライバーに示してよい一覧を読む（配車のモジュール）
  SRV-->>DA: driver.requests 丸ごと
  DA->>BC: 音（FR-18 AC2）
  DA->>SRV: POST /api/v1/records/displays listedChangeId（IFC-05）
  D->>DA: 依頼を選ぶ
  DA->>SRV: GET /api/v1/driver/requests/R（IFC-03）
  alt 走行中（V_moving 以上）
    SRV->>DB: 断った操作の時刻と速さ（DAT-19、FR-21 AC4）
    SRV-->>DA: 409 DRIVER_MOVING
  else 許諾済みか取り消し済み
    SRV-->>DA: 409 REQUEST_NO_LONGER_AVAILABLE（FR-19 AC2）
  else
    SRV->>MAP: computeRoutes ドライバーから乗車場所（60 秒は許諾で使い回す。FND-28）
    SRV-->>DA: 200 ピン、経路、受取額、距離と所要時間（FR-19）
  end
  D->>DA: 許諾する
  DA->>SRV: POST /api/v1/driver/requests/R/accept 冪等キー（IFC-03）
  SRV->>DB: 一つのトランザクションで条件付きの書き込み、searching、受付中、停止でない、迎車中でない、しきい値を確かめ直し、担当、確認コード、到着予定、履歴 accepted（DEC-09）
  alt 割り当てた
    SRV-->>DA: 200 迎車中（経路と到着予定）
    SRV-->>PA: ride.updated accepted（CUJ-02）
    SRV-->>DA: driver.requests（この依頼を一覧から消す）
  else ほかのドライバーが先
    SRV-->>DA: 409 ALREADY_TAKEN（FR-20 AC2）
  else 取り消された、迎車中、条件を満たさない、走行中
    SRV-->>DA: 409 RIDE_CANCELLED か DRIVER_BUSY か NOT_ELIGIBLE か DRIVER_MOVING
  end
```

### CUJ-07 乗車（ドライバー）（依頼主かどうかを確認する、運転を始める）

```mermaid
sequenceDiagram
  autonumber
  participant DA as ELM-02 ドライバーの Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant MAP as ELM-11 Google Maps
  participant ST as ELM-10 Stripe
  participant PA as ELM-01 乗客の Web アプリ
  DA->>SRV: POST /api/v1/driver/rides/R/start 確認コード、位置、冪等キー（IFC-03）
  alt 一致した
    SRV->>MAP: computeRoutes 降車場所まで
    SRV->>DB: 乗車中、履歴 started（位置）、乗客の最後の位置を消す（DEC-14）
    SRV-->>DA: 200 降車場所までの経路（FR-23 AC2）
    SRV-->>PA: ride.updated started（乗客は位置の送信をやめる。FR-24 AC3）
  else 一致しない
    SRV->>DB: 試した回数を増やす
    SRV-->>DA: 422 CONFIRMATION_CODE_MISMATCH（FR-26 AC2）
  else 10 回違った
    SRV-->>DA: 429 CONFIRMATION_ATTEMPTS_EXCEEDED
  end
  opt 乗客が現れない
    DA->>SRV: POST /api/v1/driver/rides/R/no-show 位置、冪等キー
    alt T_noshow_wait を過ぎていない
      SRV-->>DA: 409 NO_SHOW_TOO_EARLY 残りの秒数（FR-27 AC2）
    else 位置を確かめた到着
      SRV->>DB: トランザクション 1、no_show、履歴、確定 500 円を processing
      SRV->>ST: capture amount_to_capture 500（キー pi_X_capture）
      SRV->>DB: トランザクション 2、結果（失敗なら未払い。FR-27 AC4）
      SRV-->>DA: 200
      SRV-->>PA: ride.updated no_show、500 円（FR-27 AC1）
    else 位置を確かめられなかった到着
      SRV->>DB: トランザクション 1、no_show、押さえの取り消しを processing
      SRV->>ST: cancel（キー pi_X_cancel。FR-27 AC3）
      SRV->>DB: トランザクション 2、結果
      SRV-->>DA: 200
    end
  end
```

### CUJ-08 降車（ドライバー）（到着を確認する、決済を行う）

```mermaid
sequenceDiagram
  autonumber
  participant DA as ELM-02 ドライバーの Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant ST as ELM-10 Stripe
  participant PA as ELM-01 乗客の Web アプリ
  participant B as ELM-05 毎日の処理
  DA->>SRV: POST /api/v1/driver/rides/R/complete 位置、冪等キー K（IFC-03）
  opt 降車場所から D_dropoff を超えて離れていて、確かめていない
    SRV-->>DA: 409 FAR_FROM_DROPOFF 距離（FR-28 AC2）
    DA->>SRV: 確かめてから confirmFarFromDropoff true、新しい冪等キー
  end
  SRV->>DB: トランザクション 1、ended、履歴 ended（位置）、確定（今の料金）processing、K processing
  SRV-->>PA: ride.updated ended（評価の画面へ。FR-28 AC1）
  SRV->>ST: capture（キー pi_X_capture、2.5 秒）
  opt 応答がない
    SRV->>ST: 同じキーで 2 回まで送り直す（0.5 秒、1 秒の待ち。DEC-12）
  end
  alt 確定した
    SRV->>DB: トランザクション 2、履歴 charged（額と時刻。FR-29 AC5）、paid、K に 200
    SRV-->>DA: 200 paid
    SRV-->>PA: ride.updated charged 支払いの完了
  else 断られた
    SRV->>DB: トランザクション 2、未払い（FR-31）
    SRV-->>DA: 200 unpaid
    SRV-->>PA: ride.updated charge_failed（別の支払い手段で払う手段）
  else 3 回とも応答がない、5xx
    SRV->>DB: トランザクション 2、checking
    SRV-->>DA: 200 checking 請求を確かめています
    SRV-->>PA: ride.updated（乗客は降りてよい。FR-29 AC3）
  else T_route（10 秒）を過ぎた
    SRV-->>DA: 503 ROUTE_TIMEOUT（処理は続く）
    DA->>SRV: 同じ K で送り直す（409 OPERATION_IN_PROGRESS か最初の結果）
  end
  opt 確かめ中
    SRV->>ST: 見回りが PaymentIntent を読む（IFC-13）
    SRV->>DB: 結果（FR-29 AC4）
    B->>ST: サービスがないときは翌朝の処理が確かめる（IFC-10）
  end
  opt 乗客が未払いを払う（FR-31 AC2）
    PA->>SRV: POST /api/v1/passenger/rides/R/unpaid-payments 支払い手段、冪等キー
    SRV->>ST: PaymentIntent を自動で確定（キー ride_R_unpaid_n。FND-29）
    SRV->>DB: 未払いを解消、履歴 charged
    SRV-->>PA: 200
    SRV-->>DA: ride.updated 完了（FR-31 AC2、FR-32 AC3）
  end
```

### CUJ-09 受ける条件の設定

```mermaid
sequenceDiagram
  autonumber
  participant DA as ELM-02 ドライバーの Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  DA->>SRV: PUT /api/v1/driver/conditions 受取額の下限、距離の上限（IFC-03）
  alt ありうる値
    SRV->>DB: 今の値と変化の記録（FR-33 AC4）
    SRV-->>DA: 200
    DA->>SRV: GET /api/v1/driver/requests 条件で絞った一覧（FR-33 AC1）
  else 負の値など
    SRV-->>DA: 400 INVALID_REQUEST（FR-33 AC3）
  end
  loop 10 秒ごと
    DA->>SRV: POST /api/v1/locations 位置と今の一覧のハッシュ（IFC-04）
    SRV->>DB: 位置を書き、一覧を選び直してハッシュを比べる（FR-34 AC2）
    SRV-->>DA: requestsChanged
    opt 変わった
      DA->>SRV: GET /api/v1/driver/requests
    end
  end
```

### CUJ-10 障害の原因の特定

```mermaid
sequenceDiagram
  autonumber
  actor E as USR-03 エンジニア
  participant SRV as ELM-04 サーバー
  participant B as ELM-05 毎日の処理
  participant MON as ELM-14 Cloud Monitoring
  participant CHAT as ELM-12 チャット
  participant BO as ELM-03 エンジニアの画面
  participant LOG as ELM-08 Cloud Logging
  par サーバーのエラー、外部の失敗、ブラウザのエラー
    SRV->>CHAT: 1 分ごとにまとめた知らせ（種類、件数、トレース ID の例。IFC-17）
  and SLO を速く割った
    SRV->>CHAT: 毎分の評価の呼び出しかチケット（DEC-35）
  and アプリが止まった、5xx と 429 が続く（Turso に届かないときも）
    MON->>CHAT: 一つ目の規則（IFC-19、4〜5 分）
  and 毎日の処理
    B->>CHAT: 毎日の結果（期間を終えられるかを含む）
    MON->>CHAT: ジョブが失敗したら二つ目の規則
  end
  opt チャットに送れない
    SRV->>SRV: 送れなかったと記録し、次の 1 分で送り直す（FR-36 AC3）
  end
  CHAT-->>E: 知らせを読む
  E->>BO: トレース ID か依頼 ID で探す
  BO->>SRV: POST /api/v1/engineer/history-search（IFC-07）
  SRV-->>BO: 状態の履歴とブラウザのエラー（各行に Logs Explorer の URL）
  E->>LOG: Logs Explorer をトレース ID で開く（入口、サーバー、外部の呼び出し。DEC-19）
```

### CUJ-11〜13 変更の配備（新しい機能の追加、既存の機能の修正、利用技術の版上げ）

```mermaid
sequenceDiagram
  autonumber
  actor E as USR-03 エンジニア
  participant GH as ELM-06 配備の仕組み
  participant REG as ELM-09 Artifact Registry
  participant GCP as ELM-19 Google Cloud の管理の操作
  participant DB as ELM-07 データベース
  participant SRV as ELM-04 サービス
  E->>GH: main に入れる
  GH->>GH: ci のゲート（IFC-11）
  alt ゲートが落ちた
    GH-->>E: 落ちたテストを示し、配備しない（FR-41 AC3）
  else 通った
    GH->>REG: イメージを置く（ダイジェスト）
  end
  E->>GH: start-period（期間の始めだけ）
  GH->>GH: count-open で Turso が答えるかを確かめる（IFC-10）
  GH->>GCP: ジョブ、定時の起動、二つ目の規則を有効にし、定時の起動から一度動かす（IFC-21）
  E->>GH: open-demo
  GH->>DB: 構造の変更（足すだけ）
  GH->>GCP: サービスとジョブを同じダイジェストで配備し、一つ目の規則を有効にする
  alt 途中で失敗
    GH->>DB: 配備の記録（失敗）
    GH-->>E: 本番は前の版のまま（FR-41 AC4）
  else 成功
    GH->>DB: 配備の記録（版、時刻、変更、種類、最初のコミットの時刻。FR-41 AC2）
  end
  Note over SRV: 開いたままの画面は X-App-Version を見て、操作の途中でないときに読み直す（DEC-49）
  opt おかしい
    E->>GH: rollback 理由
    GH->>GCP: 一つ前のダイジェストをサービスとジョブに（FR-42）
    GH->>DB: 戻した時刻と理由
  end
  E->>GH: close-demo
  GH->>GH: count-open
  alt 0 件
    GH->>GCP: 一つ目の規則を止め、サービスを消す
  else 残りがある
    GH-->>E: 一覧を示して止まる（理由を付ければ強いて閉じる。DEC-37）
  end
```

### CUJ-14 苦情への対応（ドライバーの登録を含む）

```mermaid
sequenceDiagram
  autonumber
  participant PA as ELM-01 乗客の Web アプリ
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant BO as ELM-03 管理の画面
  participant DA as ELM-02 ドライバーの Web アプリ
  PA->>SRV: POST /api/v1/passenger/rides/R/reports 種類と内容、冪等キー（IFC-02、FR-43）
  alt 種類がない
    SRV-->>PA: 400（FR-43 AC3）
  else
    SRV->>DB: 苦情（乗車とドライバーに結び付ける。DAT-17）
    SRV-->>PA: 201
  end
  BO->>SRV: GET /api/v1/admin/complaints status open（IFC-06）
  BO->>SRV: GET /api/v1/admin/complaints/C
  SRV->>DB: 報告、履歴、料金と請求、ドライバーと車、評価値、過去の苦情、位置（位置のモジュールが運営の役割を確かめて読む。DEC-15）
  SRV-->>BO: 詳細（FR-45 AC2）
  BO->>SRV: POST /api/v1/admin/complaints/C/actions 対処と理由、冪等キー（FR-46）
  SRV->>DB: 一つのトランザクションで対処（追記）、対処済み、管理の操作の記録。停止なら配車のモジュールの停止も（DEC-31）
  SRV-->>BO: 201
  opt 停止した
    SRV-->>DA: driver.status suspended と driver.requests 空（IFC-08。迎車中と乗車中の依頼は続く。FR-47 AC1）
  end
  Note over BO,SRV: ドライバーの登録（FR-48）
  BO->>SRV: POST /api/v1/admin/drivers 名前、写真、メールアドレス、車両、冪等キー
  alt 欠けている、ナンバーが登録済み
    SRV-->>BO: 400 か 409 PLATE_ALREADY_REGISTERED（FR-48 AC2・3）
  else
    SRV->>DB: アカウント invited、ドライバー、車両、設定の符号、管理の操作の記録
    SRV-->>BO: 201 設定の符号（24 時間）
  end
  DA->>SRV: POST /api/v1/auth/driver-setup メールアドレス、符号、パスワード（IFC-01）
  SRV-->>DA: 200 ログインした
```

### CUJ-16 返金への対応

```mermaid
sequenceDiagram
  autonumber
  participant BO as ELM-03 管理の画面
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant ST as ELM-10 Stripe
  participant PA as ELM-01 乗客の Web アプリ
  BO->>SRV: GET /api/v1/admin/rides/R/billing（IFC-06）
  SRV->>DB: 料金、変化、請求、返金、残り、差、突き合わせの結果（DAT-23 を読むだけ）
  SRV-->>BO: 請求の記録（FR-49）
  BO->>SRV: POST /api/v1/admin/rides/R/refunds 請求、額、理由、冪等キー K
  alt 残りを超える
    SRV-->>BO: 422 REFUND_EXCEEDS_REMAINING（FR-50 AC2）
  else
    SRV->>DB: トランザクション 1、返金の要求 Q（K から一つ作る）、お金の操作 processing、管理の操作の記録（要求）
    SRV->>ST: refunds の作成（キー refund_Q、metadata に Q）
    alt 返金した
      SRV->>DB: トランザクション 2、履歴 refunded、管理の操作の記録（結果）
      SRV-->>BO: 201
      Note over PA: 乗客の履歴に返金の額（FR-44 AC3）
    else 断られた
      SRV->>DB: トランザクション 2、failed（完了と記録しない）
      SRV-->>BO: 402 REFUND_FAILED（やり直すなら新しい返金の要求）
    else 分からない
      SRV->>DB: checking
      SRV-->>BO: 202 REFUND_PENDING
      SRV->>ST: 見回りがその PaymentIntent の返金の一覧を metadata の Q で照らす
    end
  end
```

### DRV-01 受け付け続ける

```mermaid
sequenceDiagram
  autonumber
  participant APP as ELM-01 と ELM-02
  participant IN as ELM-17 Cloud Run の入口
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant MON as ELM-14 Cloud Monitoring
  participant CHAT as ELM-12 チャット
  APP->>IN: 主要な流れの操作（SLI-01 の六つ）
  IN->>SRV: 要求（入口の要求のログを書く。DAT-28）
  alt Turso が遅い
    SRV->>DB: 1 回 T_db（2 秒）で切る（DEC-33）
    SRV-->>IN: 503 DEPENDENCY_UNAVAILABLE
    IN-->>APP: 503（SLI-01 の失敗）
    APP->>IN: 同じ冪等キーで送り直す（1、2、4 秒。DEC-48）
  else 経路が T_route を過ぎた
    SRV-->>IN: 503 ROUTE_TIMEOUT（DEC-33）
  else インスタンスが入れ替わる（SIGTERM から 10 秒）
    Note over SRV: 動いている要求は終わるまで続く。切れたお金の操作は T_op_stale で確かめ中になり、新しいインスタンスの見回りが片付ける
    IN->>SRV: 新しい要求は新しいインスタンスへ（状態を持たない。DEC-02）
  end
  par 知らせ
    SRV->>CHAT: サーバーのエラー（1 分ごと）と NFR-01 のアラート（毎分）
  and Turso に届かないとき
    MON->>CHAT: 一つ目の規則（5xx と 429 が 5 分で 5 件以上。DEC-54）
  end
```

### DRV-02 状態の変化を届ける

```mermaid
sequenceDiagram
  autonumber
  participant W as ELM-04 変化を書いたインスタンス
  participant DB as ELM-07 データベース
  participant S as ELM-04 流れを持つインスタンス
  participant APP as ELM-01 か ELM-02 の相手
  W->>DB: 状態と履歴を一つのトランザクションで（seq、changeId、recorded_at）
  loop 1 秒ごと（P_tail）
    S->>DB: カーソルより後の履歴と受付の記録（T_db で切る）
    S->>DB: 担当の依頼の相手の位置と到着予定の今の値（位置のモジュール）
  end
  S-->>APP: ride.updated か driver.requests か ride.live（見てよいものだけ。IFC-08）
  APP->>APP: 示す
  APP->>S: POST /api/v1/records/displays changeId、示した時刻、裏から戻ったか（5 秒ごとにまとめる。IFC-05）
  alt 流れが切れた（回線、入れ替え、30 分）
    APP->>S: 1 秒後に Last-Event-ID 付きで開き直す
    S-->>APP: カーソルより後を送り直す（二度目は changeId で捨てる）
  else 流れが上限で断られた
    S-->>APP: 429 STREAM_LIMIT と Retry-After
    APP->>S: 15 秒ごとに GET で取り直す（DEC-51）
  else 裏から前面に戻った
    APP->>S: GET で今の状態を取り直し、流れを開き直す
  end
```

### DRV-03 現在地の新しさ

```mermaid
sequenceDiagram
  autonumber
  participant BC as ELM-13 端末のブラウザの機能
  participant APP as ELM-02（迎車中は ELM-01 も）
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant CHAT as ELM-12 チャット
  loop 10 秒ごと（L_send）
    BC-->>APP: watchPosition の最新の位置
    APP->>SRV: POST /api/v1/locations（IFC-04）
    SRV->>DB: 受信の記録と最後の位置（measured_at が新しいときだけ上書き）
  end
  opt 裏に回る
    APP->>SRV: POST /api/v1/visibility-events hidden（keepalive。届かなければ前面に戻ったときに送り直す）
  end
  loop 毎分 0 秒
    SRV->>DB: 使用中の参加者ごとに、最後に受けた時刻が 30 秒以内か（DAT-21、条件付きの書き込み）
    SRV->>SRV: NFR-03 のアラートの窓を数える（DEC-35）
    opt 条件を満たした
      SRV->>CHAT: 呼び出しかチケット
    end
  end
  Note over SRV: 30 秒より古いドライバーは受付中に数えない（FR-51、FR-34）。相手の画面には stale を送る（FR-10 AC4）
```

### DRV-04 お金を一度だけ（毎日の処理）

```mermaid
sequenceDiagram
  autonumber
  participant SCH as ELM-19 Cloud Scheduler
  participant B as ELM-05 毎日の処理
  participant DB as ELM-07 データベース
  participant ST as ELM-10 Stripe
  participant LOG as ELM-08 Cloud Logging
  participant CHAT as ELM-12 チャット
  participant MON as ELM-14 Cloud Monitoring
  SCH->>B: 06:00 に起動（IFC-10。デモの期間だけ）
  loop 終わっていない日ごと（古い日から）
    B->>DB: 確かめ中のお金の操作のリースを取る
    B->>ST: 照らす。起きていれば記録、24 時間の内なら同じキー、過ぎていれば照らしてから新しいキー（DEC-12 (d)）
    B->>ST: 前日の PaymentIntent と返金の一覧（日本時間の日）
    B->>DB: 依頼ごとに比べ、突き合わせの結果を追記（DAT-23、FR-55）
    opt 一致しない、NFR-07 の誤り
      B->>CHAT: 1 件ごとに知らせる（エンジニアと運営）
    end
    B->>DB: 履歴の確かめ、毎日の監視、SLI-02〜05 の集計
    B->>LOG: 入口の要求のログとアプリのログを読む（IFC-20、SLI-01）
    B->>DB: 保存期間の処理（FR-53）、期間の要約（DAT-24）
  end
  alt どれかが終わらない
    B->>CHAT: 知らせ
    B-->>SCH: 失敗として終わる（DEC-17）
    MON->>CHAT: 二つ目の規則（遅くとも 07:35 ごろ）
  else すべて終わった
    B->>CHAT: 毎日の結果（期間を終えられるか）
  end
```

### DRV-05 割り当ての規則

```mermaid
sequenceDiagram
  autonumber
  participant D1 as ELM-02 ドライバー 1
  participant D2 as ELM-02 ドライバー 2
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant BO as ELM-03 管理の画面
  par ほぼ同時の許諾
    D1->>SRV: POST /api/v1/driver/requests/R/accept
    D2->>SRV: POST /api/v1/driver/requests/R/accept
  end
  SRV->>DB: D1 のトランザクション、state searching かつ version v を条件に担当を書く
  SRV->>DB: D2 のトランザクション、同じ条件で書く（条件が外れて 0 行）
  SRV-->>D1: 200
  SRV-->>D2: 409 ALREADY_TAKEN（FR-20 AC2）
  Note over SRV,DB: 停止、迎車中でない、しきい値と評価の件数も同じトランザクションで確かめ直す（DEC-09）
  BO->>SRV: POST /api/v1/admin/drivers/D1/suspend
  SRV->>DB: 停止と変化の記録
  SRV-->>D1: driver.status suspended と driver.requests 空（FR-47）
  D1->>SRV: 一覧を開いたまま許諾する
  SRV-->>D1: 403 DRIVER_SUSPENDED（QR-16）
```

### DRV-07 iOS の Safari の前面と裏

```mermaid
sequenceDiagram
  autonumber
  participant APP as ELM-02 ドライバーの Web アプリ
  participant BC as ELM-13 iOS の Safari
  participant SRV as ELM-04 サーバー
  APP->>BC: 受付を始めるタップで wakeLock と音の準備
  BC-->>APP: visibilitychange hidden（ほかのアプリ、画面を消した）
  APP->>SRV: POST /api/v1/visibility-events hidden（keepalive）
  Note over BC: 裏では位置と流れが止まる（TC-09）
  BC-->>APP: visibilitychange visible
  APP->>SRV: POST /api/v1/visibility-events visible（hidden が届いていなければ一緒に）
  APP->>BC: wakeLock をもう一度（FR-52 AC3）
  opt 使えない、失敗
    APP->>APP: 画面が消えると更新が止まることを示す（FR-52 AC4）
  end
  APP->>SRV: GET /api/v1/driver/rides/active と GET /api/v1/driver/requests（FR-17 AC4）
  APP->>SRV: 流れを Last-Event-ID 付きで開き直す
  APP->>BC: watchPosition を続け、次の 10 秒で位置を送る
```

### DRV-27 測定点の記録

```mermaid
sequenceDiagram
  autonumber
  participant APP as ELM-01 と ELM-02
  participant IN as ELM-17 Cloud Run の入口
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  participant LOG as ELM-08 Cloud Logging
  participant B as ELM-05 毎日の処理
  APP->>IN: 要求（traceparent と X-Client-Trace-Id）
  IN->>LOG: 入口の要求のログ（trace、spanId、状態の符号、時間。SLI-01）
  IN->>SRV: 要求（X-Cloud-Trace-Context）
  SRV->>DB: 状態と履歴（SLI-05、SLI-02 の記録の時刻）
  SRV->>LOG: request.completed（trace、spanId、route_id、account_kind）
  APP->>SRV: 表示の記録（SLI-02）、前面と裏（SLI-02 と SLI-03 の除外）、位置（SLI-03）、ブラウザのエラー（FR-38）
  SRV->>DB: 毎分の位置の確かめと 1 分ごとの数（DAT-21）
  B->>LOG: 前日の入口のログとアプリのログを読み、trace と spanId で結んでテスト用を除く（SLI-01）
  B->>DB: SLI-02〜05 を記録から数える（DAT-25）と突き合わせ（SLI-04）
```

### DRV-29 守る

```mermaid
sequenceDiagram
  autonumber
  actor X as 攻撃者か参加者でない人
  participant SRV as ELM-04 サーバー
  participant DB as ELM-07 データベース
  X->>SRV: 他人の依頼 ID で GET /api/v1/passenger/rides/R
  SRV->>DB: セッションと依頼の持ち主を確かめる
  SRV-->>X: 404 NOT_FOUND（他人のものもないものと同じ）
  X->>SRV: 額を書き換えた取り消し
  SRV-->>X: 409 CANCELLATION_FEE_CHANGED（額はサーバーが決める。DEC-41）
  X->>SRV: ほかのサイトからの POST
  SRV-->>X: 403 FORBIDDEN（Origin。SameSite Strict のクッキーも付かない。DEC-43）
  X->>SRV: 乗客の役割で /api/v1/admin
  SRV-->>X: 403 FORBIDDEN（経路のまとまりで役割を確かめる。DEC-20）
  X->>SRV: ログインの総当たり
  SRV->>DB: 失敗の数（DAT-01）
  SRV-->>X: 429 ACCOUNT_LOCKED（5 回で 15 分。DEC-20）
  X->>SRV: 場所の検索と見積もりを繰り返す
  SRV-->>X: 429 RATE_LIMITED（アカウントごと。DEC-55）
  X->>SRV: 流れを多く開く
  SRV-->>X: 429 STREAM_LIMIT（2、6、40。多くのアカウントと IP からは残る危険。FND-23）
  Note over SRV: 管理とエンジニアの経路はパスキーが済んだセッションだけ。管理の操作は担当とともに記録（DEC-31）
```

### 制約と原則の主な要求

場面を持たない主な要求（制約）は、次のインタフェースの決まりに表れる。

| DRV | インタフェースでの表れ |
|---|---|
| DRV-17 技術 | OpenAPI の型を packages/contracts で共有する（DEC-26）。React と Hono の上で、どの仕様も TypeScript の型にできる形（JSON Schema 2020-12） |
| DRV-18 デモの回だけ | 手元では http://localhost:8080 で同じ仕様（servers）。サービスがないときに動くもの（IFC-10、IFC-11）は API を使わない |
| DRV-20 Web アプリだけ | 端末の機能は IFC-18 の四つだけ。安全な文脈（HTTPS か localhost） |
| DRV-21 個人情報 | URL に入れない（DEC-47）。ログに書かない（DEC-44）。座標は位置のモジュールだけが返す（IFC-04、IFC-07、IFC-08）。Stripe に送らない（IFC-13）。保持期間（DAT の保持期間の列） |
| DRV-22 カードの情報 | IFC-14 だけで入れ、サーバーの API の型にカードの欄がない |
| DRV-24 アクセシビリティ | 画面のインタフェース（IFC-23〜29）の決まり。ドラッグしない代わり（DEC-24）は地図が出ないときも使う（IFC-16） |
| DRV-25 役割 | 経路のまとまりで役割を確かめる（/api/v1/admin、/api/v1/engineer。DEC-47）。パスキーが済んだセッションだけ（DEC-43） |
| DRV-26 一人と費用 | 共通の約束事を一つにし、仕様書を道具で確かめる。回数の制限（DEC-55）。読み出しの増え方は FND-28 |
| DRV-30〜33（原則） | お金の操作はすべて冪等（DEC-48）。状態は配車のモジュールだけが書く（DAT-06、DAT-07）。ログとエラーの記録に座標を書かない（DEC-44）。毎日の処理は終わっていない日を続ける（IFC-10） |

## 遅延の予算

時刻のしきい値を持つ SLO は NFR-02 と NFR-03 の二つ。時刻のしきい値を持つ監視と確かめ（NFR-24、NFR-25、NFR-06、NFR-33）も同じ形で見た。予算は直列の区間それぞれに、目標の外れの割合を区間の数で分けたパーセンタイルで割り当てた（flows-and-budgets.md）。数はすべて作業用のスクリプト `budget.py` で計算した（出力は節の終わり）。予算はタイムアウトではない。タイムアウトは DEC-50 で別に決めた。

### NFR-02（SLI-02。状態の変化を記録した時刻から相手の画面に示した時刻まで 5 秒、95%）

測る区間は、状態の履歴の recorded_at（サーバーの時計）から、ブラウザが示した時刻（サーバーが受けた時刻を上限にする）まで。

| 区間 | 予算（99 パーセンタイル。5 区間） | もと |
|---|---|---|
| 次の追いかけまでの待ち | 1.00 秒 | P_tail（DEC-03）。上限で数える |
| 追いかけの読み出し（Turso） | 0.20 秒 | 仮。DEC-33 の見込み 0.1 秒の 2 倍 |
| 相手の選び分けと SSE への書き出し | 0.05 秒 | 仮 |
| 携帯の回線で端末に届く | 2.00 秒 | 入力にない。仮 |
| 受け取り、描画、表示の時刻の記録 | 0.20 秒 | 仮 |
| 余り | 1.55 秒 | |
| 合計 | 5.00 秒 | NFR-02 のしきい値 |

新しい依頼がドライバーの一覧に出る場合は、そのドライバーに示してよい一覧の読み出し（0.20 秒）が加わる。6 区間で 99.17 パーセンタイルに割り当て、和は 3.65 秒、余りは 1.35 秒。一覧を知らせだけにして画面が取り直す案（DEC-51 で退けた案）は 7 区間、和 4.70 秒、余り 0.30 秒になる。

携帯の回線の区間の 99 パーセンタイルは入力になく、測ってもいない。そこで、最初のデモの前の通しの確かめ（NFR-20 の実機の確かめと同じ機会。iPhone 2 台、携帯の回線）で、FR-54 の表示の記録から SLI-02 を測ることを関門にする。「遅延の予算は満たす」と言えるのは、その値が出てからになる。

### NFR-03（SLI-03。毎分の確かめで、最後に届いた位置が 30 秒以内、95%）

L_send（10 秒）ごとに送り、受けた時刻で数える。続けて 1 回届かなくても新しい。2 回続けて届かないと、二つの位置が届くまでの時間の差の分だけ古い時間ができ、毎分の確かめがそこに当たると古いと数える（当たる見込みは差 ÷ 60）。3 回続けて届かないと古い。一回の送信の予算は「次の送信より前に届くこと」で、遅れた送信は次の送信と重ならないよう捨てる（IFC-04）。30 秒の新しさは、位置の写しをほかに持たない（配信は 1 秒ごとに最後の位置を読む）ことで守る。

### NFR-24（手配の画面の要求で 3 秒を超えたものが 1 時間に 5% 以下。入口の時間）

| 要求 | 区間（予算のパーセンタイル） | 予算の和 | タイムアウトまで待った最悪 |
|---|---|---|---|
| 場所の検索 | ELM-04 0.15 秒、Places 1.00 秒（97.5） | 1.15 秒 | 2.15 秒 |
| 見積もり | ELM-04 0.15 秒、Routes 1.00 秒、見積もりの書き込み 0.20 秒（98.33） | 1.35 秒 | 2.35 秒 |
| 手配の確定 | ELM-04 とトランザクション 1 0.20 秒、Stripe 1.50 秒、トランザクション 2 0.10 秒（98.33） | 1.80 秒 | 2.85 秒（第 2 段階の 2.7 秒にセッションの読み出し 0.1 秒を足した） |

Places、Routes、Stripe の値は入力になく、仮の値。最初のデモの前の NFR-44 の確かめで測る（DEC-50）。

### NFR-25（乗車の終了から請求の結果の記録まで、どの乗車も 10 秒以内）

どの乗車もなので、パーセンタイルではなく最悪で見た。Stripe の確定 3 回 × 2.5 秒と待ち 1.5 秒で 9.0 秒、二つのトランザクションを足して 9.2 秒（余り 0.8 秒）。Turso が遅く二つとも T_db で止まると 13.0 秒で、NFR-25 が知らせる（異常として知らせてよい。第 2 段階）。余りが小さいことは FND-21（第 2 段階）の論点のまま。

### NFR-06（前日分の突き合わせと履歴の確かめ。8:30 に終わっていなければ知らせる）

06:00 に始め、一回の上限 45 分 × 2 回で遅くとも 07:30 に終わるか失敗する。指標が見えるまでの遅れと知らせで 07:35 ごろ、8:30 まで 55 分。処理ごとの上限（DEC-53）の和は 42 分で、一回の上限 45 分の内。

### NFR-33（試験用のエラーから 5 分以内に知らせが届く）

サーバーのエラーは最悪 87 秒（1 分のまとめ、チャットへの送信 5 秒 × 4 回と待ち 7 秒）。ブラウザのエラーは、記録の送信を足して最悪 102 秒。どちらも 300 秒の内。

### 失敗したときの流れとエラーバジェット

| SLO | 28 日の有効な出来事（PC-05 の規模） | 許容される失敗の件数 | 失敗したときの流れの扱い |
|---|---|---|---|
| NFR-01（99%） | 8〜144 件 | 0.08〜1.44 件 | 1 件の 503 でも使い切りうる。Turso の障害、インスタンスの入れ替え、T_route の超えは、どれも 1 件ずつ振り返る（EBP-01 の最後の規則）。送り直し（DEC-48）は参加者の操作を救うが、SLI-01 は要求ごとに数えるので失敗は消えない |
| NFR-02（95%） | 6〜15 組（デモ全体） | 0.30〜0.75 件 | 30 分ごとのつなぎ直しに当たる見込みは一つの変化で 0.11%、デモ全体で 0.017 組で、件数の内。流れを上限で断られると、15 秒ごとの問い合わせの間の変化は遅いと数える（参加者でない人の利用で起きうる。FND-23） |
| NFR-03（95%） | 一回の回で 186〜225 回 | 9.3〜11.2 回（一回の回） | 位置の送信が 30 秒止まれば 3 回が古くなる。裏の時間は除く（裏に回った時刻が遅れて届くときの扱いは FND-24） |

この規模では、許容される失敗の件数が NFR-01 と NFR-02 で 1 件ほどかそれ未満なので、失敗したときの流れを「件数の内に収める」設計はできない。これは第 2 段階の品質チェーンへの課題 4 と同じで、第 1 段階の質問 13 で品質チェーンは直さないと決まっている。設計ができるのは、起きる見込みを下げることと、起きたら知らせて 1 件ずつ振り返れるよう記録を残すこと（DRV-27）だけ。

### スクリプトの出力

```text
## NFR-02（SLI-02。記録した時刻から相手の画面に示した時刻まで 5 秒、95%）
### A: 依頼の状態の変化（許諾、取り消し、探し直し、迎車の到着）
しきい値 5.0 秒、目標 95%、直列の区間 5 個 → 各区間の予算は 99.00 パーセンタイル
  - 次の追いかけまでの待ち（P_tail）: 1.00 秒（DEC-03。一様に 0〜1 秒、上限で数える）
  - 追いかけの読み出し（Turso）: 0.20 秒（仮。DEC-33 の見込み 0.1 秒の 2 倍）
  - 相手の選び分けと SSE への書き出し（ELM-04）: 0.05 秒（仮。第 2 段階の見込み）
  - 携帯の回線で端末に届く: 2.00 秒（入力にない。実機で測る（下の確かめ））
  - ブラウザの受け取り、描画、表示の時刻の記録: 0.20 秒（仮）
  合計 3.45 秒、余り 1.55 秒（しきい値の 31%）

### B: 新しい依頼がドライバーの一覧に出る（DEC-51: 一覧を丸ごと送る）
しきい値 5.0 秒、目標 95%、直列の区間 6 個 → 各区間の予算は 99.17 パーセンタイル
  - 次の追いかけまでの待ち（P_tail）: 1.00 秒（DEC-03）
  - 追いかけの読み出し（Turso）: 0.20 秒（仮）
  - そのドライバーに示してよい依頼の読み出し（Turso）: 0.20 秒（仮。FR-16、FR-34 の条件）
  - SSE への書き出し: 0.05 秒（仮）
  - 携帯の回線で端末に届く: 2.00 秒（入力にない）
  - 描画と表示の時刻の記録: 0.20 秒（仮）
  合計 3.65 秒、余り 1.35 秒（しきい値の 27%）

### C（退けた案）: 知らせだけ送り、画面が一覧を取り直す
しきい値 5.0 秒、目標 95%、直列の区間 7 個 → 各区間の予算は 99.29 パーセンタイル
  - 次の追いかけまでの待ち（P_tail）: 1.00 秒（DEC-03）
  - 追いかけの読み出し（Turso）: 0.20 秒（仮）
  - SSE への書き出し: 0.05 秒（仮）
  - 携帯の回線で知らせが届く: 2.00 秒（入力にない）
  - 一覧の要求の往復（携帯の回線）: 1.00 秒（入力にない。仮）
  - 一覧の読み出し（ELM-04 と Turso）: 0.25 秒（仮）
  - 描画と表示の時刻の記録: 0.20 秒（仮）
  合計 4.70 秒、余り 0.30 秒（しきい値の 6%）

## NFR-03（SLI-03。毎分の確かめで、最後に届いた位置が 30 秒以内、95%）
送る間隔 L_send 10 秒、T_loc_fresh 30 秒。届いた位置の間が T を超えると古い。
  続けて 0 回届かない: 届いた位置の間は 10 秒（それぞれの届くまでの時間の差を除く）→ 新しい
  続けて 1 回届かない: 届いた位置の間は 20 秒（それぞれの届くまでの時間の差を除く）→ 新しい
  続けて 2 回届かない: 届いた位置の間は 30 秒（それぞれの届くまでの時間の差を除く）→ 境目（下の注）
  続けて 3 回届かない: 届いた位置の間は 40 秒（それぞれの届くまでの時間の差を除く）→ 古い
  注: 2 回続けて届かないと間は 30 秒 + （次が届くまでの時間 − 前が届くまでの時間）。この差の秒数だけ古い時間ができ、毎分の確かめがそこに当たると古いと数える（当たる見込みは差 ÷ 60）
  一回の送信の予算: 次の送信（10 秒後）より前に届くこと。届くまでの上限は T_route（10 秒）なので、遅れた送信は次の送信と重ならないよう捨てる

## NFR-24（手配の画面の要求が 3 秒を超えるのが 1 時間に 5% 以下。入口の時間で測る）
### 場所の検索（POST /api/v1/passenger/places/search）
しきい値 3.0 秒、目標 95%、直列の区間 2 個 → 各区間の予算は 97.50 パーセンタイル
  - ELM-04 の処理（セッションの確かめを含む）: 0.15 秒（仮。Turso の読み出し 1 回を含む）
  - Places API の候補: 1.00 秒（入力にない。タイムアウトは 2 秒（DEC-22））
  合計 1.15 秒、余り 1.85 秒（しきい値の 62%）
  タイムアウトまで待った最悪は 0.15 + 2.00 = 2.15 秒

### 見積もり（POST /api/v1/passenger/estimates）
しきい値 3.0 秒、目標 95%、直列の区間 3 個 → 各区間の予算は 98.33 パーセンタイル
  - ELM-04 の処理（セッション、運賃の計算）: 0.15 秒（仮）
  - Routes API の経路: 1.00 秒（入力にない。タイムアウトは 2 秒（DEC-22））
  - 見積もりの書き込み（Turso）: 0.20 秒（仮）
  合計 1.35 秒、余り 1.65 秒（しきい値の 55%）
  タイムアウトまで待った最悪は 0.15 + 2.00 + 0.20 = 2.35 秒

### 手配の確定（POST /api/v1/passenger/rides）
しきい値 3.0 秒、目標 95%、直列の区間 3 個 → 各区間の予算は 98.33 パーセンタイル
  - ELM-04 の処理と一つ目のトランザクション（セッション、操作キー、処理中）: 0.20 秒（仮。Turso 2 回）
  - Stripe の押さえ: 1.50 秒（入力にない。タイムアウトは 2.5 秒（DEC-12）。NFR-44 の確かめで測る）
  - 二つ目のトランザクション（依頼、履歴、最初の結果）: 0.10 秒（仮）
  合計 1.80 秒、余り 1.20 秒（しきい値の 40%）
  タイムアウトまで待った最悪は 0.05 + 3 × 0.1 + 2.5 = 2.85 秒（第 2 段階の 2.7 秒にセッションの読み出しを足した）

## NFR-25（乗車の終了から請求の結果の記録まで 10 秒を超えた乗車が 1 件でもあれば知らせる。どの乗車も、なので最悪で見る）
  Stripe の確定 3 回 × 2.5 秒 + 待ち 1.5 秒 = 9.0 秒
  一つ目と二つ目のトランザクション 2 × 0.1 秒を足して 9.2 秒（余り 0.8 秒）
  Turso が遅く二つとも T_db（2 秒）で止まると 13.0 秒で 10 秒を超え、NFR-25 が知らせる（異常として知らせてよい。第 2 段階）

## 処理中を確かめ中とみなすまでの時間 T_op_stale
  経路が T_route（10 秒）で切られても、処理は自分の呼び出しが終わるまで続く。最長は 13.0 秒（降車の確定で二つのトランザクションが T_db で止まったとき。FND-21 の計算と同じ）
  T_op_stale = 30 秒は最長の 2.3 倍。これより短いと、まだ動いている操作の確かめが始まる

## ブラウザのタイムアウト
  SSE 以外の要求は 15 秒。サーバーは T_route（10 秒）で必ず答えるので、その上に携帯の回線の 5 秒を足した（5 秒の余り）

## NFR-06（前日分の突き合わせと履歴の確かめが 9:00 までに終わり、8:30 に終わっていなければ知らせる）
  06:00 に始め、一回の上限 45 分 × 2 回で遅くとも 07:30 に終わるか失敗する（DEC-17）
  ジョブの指標は 60 秒ごとに取られ、最大 120 秒遅れて見える（Cloud Monitoring の指標の一覧）。合わせて 180 秒、知らせに 2 分として 07:35 ごろ。8:30 まで 55 分
  処理ごとの上限（仮）: 確かめ中のお金の操作を片付ける 5 分、Stripe との突き合わせ（FR-55） 15 分、履歴の確かめと毎日の監視 5 分、SLI の集計（入口のログの読み出しを含む） 10 分、保存期間の処理（FR-53） 5 分、期間を終える条件の記録と知らせ 2 分。合計 42 分で一回の上限 45 分の内（余り 3 分）
  ふだんの実行は数分（乗車 2〜6 回。PC-05）。追いつく日が多いときは、日ごとに同じ順で続ける

## NFR-33（試験用のエラーを起こしてから 5 分以内に知らせが届く）
  サーバーのエラー: 1 分ごとにまとめる（60 秒）+ チャットへの送信（5 秒 × 4 回 + 待ち 7 秒の最悪 27 秒）= 最悪 87 秒
  ブラウザのエラー: 記録の送信（すぐ送る。届かなければ前面に戻ったとき）+ 上と同じ。通信があれば最悪 102 秒（ブラウザのタイムアウト 15 秒を足す）
  どちらも 300 秒の内（余り 198 秒）

## 一つ目の Cloud Monitoring の規則が知らせるまで（DEC-54）
  Turso に届かないとき: 位置の送信だけで 2 人 × 6 回/分 = 12 件/分の 503。5 件目までに 25 秒
  指標の取り込み 60 秒 + 見えるまで 120 秒 + 評価 60 秒として、最初の 503 から 25 + 240 = 265 秒ほど（4 分半）

## エラーバジェットの件数（PC-05 の規模。第 2 段階の derive4.py の見込み）
  NFR-01（SLI-01、99%）: 28 日の有効な要求は 8〜144 件 → 許容される失敗の件数は 0.08〜1.44 件。1 ÷（1 − 0.99）= 100 件に届かないので、EBP-01 の最後の規則（1 件ずつ振り返る）
  NFR-02（SLI-02、95%）: デモ全体の組は 6〜15 組 → 0.30〜0.75 件。1 ÷ 0.05 = 20 組に届かないので同じ
  NFR-03（SLI-03、95%）: 一回の回の確かめは 186〜225 回 → 9.3〜11.2 回（回が 1〜4 回なので 28 日では 9.3〜45.0 回）

## 失敗したときの流れ（NFR-02）
  流れの 30 分ごとのつなぎ直し: つなぎ直しの間（1 秒の待ち + TLS と最初の応答で 1 秒ほど、仮に 2.0 秒）に起きた変化は、つなぎ直した後に届く。一つの変化が当たる見込みは 2.0/1800 = 0.11%
  デモ全体の 15 組で、当たる組の数の見込みは 0.017 組。許容される失敗の件数（0.30〜0.75 件）の内
  インスタンスの入れ替え: 流れが切れ、1 秒の待ちでつなぎ直し、最後の通し番号から送り直す。入れ替えは週に数回（Cloud Run の文書。第 2 段階）で、デモの回の 3 時間に当たる見込みは小さい
  流れが上限（40 本）で断られたとき: 15 秒ごとの問い合わせに移るので、その間の変化は最大 15 秒遅れ、遅いと数える。参加者でない人の利用で起きうる（FND-23）

## Turso の読み出し（DEC-51。第 2 段階の DEC-03 の見込みとの差）
  インスタンスが 1 秒ごとに 3 回（状態の履歴、ドライバーの受付の記録、相手の位置と到着予定の今の値）読む: デモの回 1 回で 32,400 回（第 2 段階の見込みは 10,800 回。3 倍）

## 地図の呼び出し（DEC-22 の場面に、依頼の内容の経路を足した）
  第 2 段階の見込み 189 回 + 依頼の内容のドライバーから乗車場所までの経路（乗車 3 回 × 見る回数 3 回まで。60 秒は許諾で使い回す）9 回 = 198 回
  Q_maps_day 1,000 回に 5.1 倍の余裕（第 2 段階は 5.3 倍）
```

## 画面

画面ごとの中身（目的、示すもの、受け取るもの、操作と移り先、エラーと空の状態）は IFC-23〜29 の項目に書いた。ここでは CUJ ごとの移り変わりを描く。箱の括弧はその画面のインタフェース。

### CUJ-01 配車手配（乗客）

```mermaid
flowchart TD
  L["ログイン（IFC-23）"] -->|"ログインした"| B["手配（IFC-24）"]
  L -->|"アカウントを作る"| S["アカウントの作成（IFC-23）"]
  S -->|"欠けている、同じメールアドレス"| S
  S -->|"作った"| PM["支払い手段（IFC-23）"]
  L -->|"未払いがある"| U["未払いの支払い（IFC-23）"]
  B -->|"位置の許可がない、誤差が大きい、候補がない、経路がない、地図が使えない"| B
  B -->|"支払い手段がない"| PM
  PM -->|"登録した"| B
  B -->|"押さえられない"| B
  B -->|"未払いがある"| U
  U -->|"払った"| B
  B -->|"手配した、押さえの確かめ中"| ST["手配の状況（IFC-24）"]
  ST -->|"T_match_wait を過ぎた、しきい値を下げた"| ST
  ST -->|"取り消した、確かめが間に合わなかった"| B
  ST -->|"許諾された"| PU["迎車中（IFC-24）"]
```

### CUJ-02 乗車（乗客）、CUJ-03 降車（乗客）

```mermaid
flowchart TD
  PU["迎車中（IFC-24）"] -->|"位置が届かない、到着予定がない"| PU
  PU -->|"ドライバーが取り消した"| ST["手配の状況（IFC-24）"]
  PU -->|"取り消した（額を確かめる）"| B["手配（IFC-24）"]
  PU -->|"違う車を報告"| R["報告（IFC-25）"]
  PU -->|"運転が始まった"| IR["乗車中（IFC-24）"]
  IR -->|"降車場所を変えられない、確かめ中"| IR
  IR -->|"違う車を報告"| R
  IR -->|"乗車が終わった"| RS["到着と支払いの結果（IFC-24）"]
  RS -->|"請求を確かめています"| RS
  RS -->|"未払い"| U["未払いの支払い（IFC-23）"]
  RS -->|"支払いの完了"| RT["評価（IFC-25）"]
```

### CUJ-04 ドライバーの評価、CUJ-05 評価のしきい値の設定

```mermaid
flowchart TD
  RT["評価（IFC-25）"] -->|"送った、もう評価した"| H["乗車の履歴（IFC-25）"]
  RT -->|"閉じた"| B["手配（IFC-24）"]
  TH["しきい値の設定（IFC-25）"] -->|"範囲の外"| TH
  TH -->|"設定した、解除した"| B
  H -->|"履歴がない"| H
  H -->|"報告する"| R["報告（IFC-25）"]
  R -->|"種類がない"| R
  R -->|"送った"| H
```

### CUJ-06 配車受付（ドライバー）

```mermaid
flowchart TD
  DL["ログインと初回の設定（IFC-26）"] -->|"符号が違う、期限切れ"| DL
  DL -->|"ログインした"| RC["受付（IFC-26）"]
  RC -->|"位置の許可がない、停止中、画面の点灯を使えない"| RC
  RC -->|"受付を始めた"| LI["依頼の一覧（IFC-26）"]
  LI -->|"依頼がない、走行中"| LI
  LI -->|"停止された"| RC
  LI -->|"選んだ"| DT["依頼の内容（IFC-26）"]
  DT -->|"許諾済み、取り消された、間に合わなかった、条件を満たさない、走行中"| LI
  DT -->|"許諾した"| PK["迎車中（IFC-27）"]
```

### CUJ-07 乗車（ドライバー）、CUJ-08 降車（ドライバー）、CUJ-09 受ける条件の設定

```mermaid
flowchart TD
  PK["迎車中（IFC-27）"] -->|"到着が遠い、コードが違う、不在が早すぎる、経路がない"| PK
  PK -->|"乗客が取り消した、取り消した、不在で終えた"| LI["依頼の一覧（IFC-26）"]
  PK -->|"運転を始めた"| IR["乗車中（IFC-27）"]
  IR -->|"降車場所が変わった、終えるには遠い"| IR
  IR -->|"終えた（完了、確かめ中、未払い）"| LI
  LI -->|"受取額"| EA["受取額（IFC-27）"]
  EA -->|"まだない"| EA
  LI -->|"条件"| CO["受ける条件（IFC-27）"]
  CO -->|"ありえない値"| CO
  CO -->|"設定した"| LI
```

### CUJ-14 苦情への対応、CUJ-16 返金への対応（運営・サポート担当）

```mermaid
flowchart TD
  AL["ログイン、パスワードとパスキー（IFC-28）"] -->|"パスキーの失敗"| AL
  AL --> CL["苦情の一覧（IFC-28）"]
  CL -->|"該当する苦情がない"| CL
  CL --> CD["苦情の詳細（IFC-28）"]
  CD --> AC["対処の記録（IFC-28）"]
  AC -->|"内容がない"| AC
  AC -->|"記録した"| CL
  CD --> BI["請求と返金（IFC-28）"]
  BI -->|"残りを超える、断られた、確かめ中、Stripe と一致しない"| BI
  AL --> DR["ドライバー（IFC-28）"]
  DR -->|"欠けている、ナンバーが登録済み"| DR
  DR -->|"登録した、設定の符号を一度だけ示す"| DR
```

### CUJ-10 障害の原因の特定（エンジニア）

```mermaid
flowchart TD
  EL["ログイン（IFC-28 と同じ）"] --> SR["状態の履歴の検索（IFC-29）"]
  SR -->|"ない、範囲が広すぎる"| SR
  SR -->|"行のトレース ID"| LX["Logs Explorer（Google Cloud のコンソール）"]
  SR --> PO["依頼の位置（IFC-29）"]
  SR --> TA["テスト用の印（IFC-29）"]
```

## データ

```mermaid
erDiagram
  DAT-01 ||--o{ DAT-02 : "セッションとパスキー"
  DAT-01 ||--o| DAT-03 : "ドライバー"
  DAT-01 ||--o| DAT-12 : "支払い手段の参照"
  DAT-01 ||--o| DAT-16 : "しきい値と条件"
  DAT-01 ||--o| DAT-10 : "最後の位置"
  DAT-01 ||--o{ DAT-09 : "受信の記録"
  DAT-03 ||--|| DAT-04 : "受付と停止"
  DAT-03 ||--o| DAT-15 : "評価値"
  DAT-01 ||--o{ DAT-06 : "乗客の依頼"
  DAT-03 ||--o{ DAT-06 : "担当した依頼"
  DAT-05 ||--o| DAT-06 : "手配した見積もり"
  DAT-06 ||--o{ DAT-07 : "状態の履歴"
  DAT-07 ||--o| DAT-08 : "位置"
  DAT-06 ||--o{ DAT-13 : "お金の操作"
  DAT-06 ||--o{ DAT-11 : "経路の写し"
  DAT-06 ||--o| DAT-15 : "評価"
  DAT-06 ||--o{ DAT-17 : "苦情と対処"
  DAT-17 ||--o{ DAT-18 : "管理の操作の記録"
  DAT-07 ||--o{ DAT-19 : "表示の記録"
  DAT-06 ||--o{ DAT-23 : "突き合わせの結果"
  DAT-01 ||--o{ DAT-14 : "操作キー"
  DAT-27 ||--|| DAT-28 : "trace と spanId"
```

DAT-20〜22、24〜26、29 はほかの実体と ID でゆるく結ぶだけなので、図から外した。

| DAT | 実体 | 持ち主 | 置き場所 | 整合の取り方 | 保持期間 | 扱いの区分 | 根拠 |
|---|---|---|---|---|---|---|---|
| DAT-01 | アカウント | ELM-04 | ELM-07 | 認証のモジュールだけが書く。 | メールアドレスとパスワードのハッシュは、最後に使ってから T_pii_retention（3 年）を過ぎると消して匿名にする（FR-53）。残りはシステムを終えるとき（DEC-36） | 個人情報 | 推定 |
| DAT-02 | セッション、パスキー、一度だけの符号 | ELM-04 | ELM-07 | 認証のモジュールだけが書く。 | セッションは期限（DEC-43）か失効の後に毎日の処理が消す。パスキーと符号はアカウントと同じ | 個人情報 | 推定 |
| DAT-03 | ドライバーと車両 | ELM-04 | ELM-07 | 管理のモジュールだけが書く。 | 個人に結び付く部分は、記録してから T_pii_retention（3 年）を過ぎると毎日の処理が消して匿名にする（FR-53）。残りはシステムを終えるときに消す（DEC-36） | 個人情報 | 推定 |
| DAT-04 | ドライバーの受付と停止（今の状態と変化の記録） | ELM-04 | ELM-07 | 配車のモジュールだけが書く。 | 変化の記録は T_pii_retention（FR-17 の受付の時間、FR-47 AC4）。今の状態はシステムを終えるとき | 個人情報 | 推定 |
| DAT-05 | 見積もり（手配と降車場所の変更） | ELM-04 | ELM-07 | 料金のモジュールだけが書く。 | 期限を過ぎるか使った後に、毎日の処理が経路の写しとともに消す | 個人情報 | 推定 |
| DAT-06 | 配車依頼 | ELM-04 | ELM-07 | 配車のモジュールだけが書く（DRV-31）。 | 個人に結び付く部分は、記録してから T_pii_retention（3 年）を過ぎると毎日の処理が消して匿名にする（FR-53）。残りはシステムを終えるときに消す（DEC-36） | 個人情報 | 推定 |
| DAT-07 | 配車依頼と乗車の状態の履歴 | ELM-04 | ELM-07 | 配車のモジュールが依頼の状態と同じトランザクションで追記するだけ（FR-39 AC2）。 | 変化の種類と時刻は残す。操作した人と位置の参照は T_pii_retention で消す（FR-53 AC1）。システムを終えるとき（DEC-36） | 個人情報 | 推定 |
| DAT-08 | 状態の履歴が参照する位置 | ELM-04 | ELM-07 | 位置のモジュールだけが読み書きする（DEC-15）。 | T_pii_retention（FR-53） | 個人情報 | 推定 |
| DAT-09 | 位置の受信の記録 | ELM-04 | ELM-07 | 位置のモジュールが受けるたびに追記し、同じトランザクションで最後の位置（DAT-10）を更新する。 | T_log_retention（28 日、仮。DEC-14）。毎日の処理が消す | 個人情報 | 推定 |
| DAT-10 | 参加者ごとの最後の位置 | ELM-04 | ELM-07 | 位置のモジュールだけが書く。 | 乗客の分は示すのをやめるとき（FR-24 AC3）、ドライバーの分は受付を止めたとき（FR-17）に消す（DEC-14） | 個人情報 | 推定 |
| DAT-11 | Google の経路の写し | ELM-04 | ELM-07 | 地図のモジュールだけが書く。 | 依頼のその区間が終わるか見積もりの期限で消す（DEC-22。Google の規約の確かめは未解決の点） | 個人情報 | 推定 |
| DAT-12 | 支払い手段の参照 | ELM-04 | ELM-07 | 支払いのモジュールだけが書く。 | アカウントと同じ | 決済情報 | 推定 |
| DAT-13 | お金の操作（押さえ、確定、押さえの取り消し、返金、未払いの支払い） | ELM-04 | ELM-07 | 支払いのモジュールだけが書く（ELM-05 は同じモジュールで確かめ中を片付ける。 | 額、種類、Stripe の ID は突き合わせのために残す。依頼の匿名化と一緒に個人への結び付きを消す。システムを終えるとき | 決済情報 | 推定 |
| DAT-14 | 操作キーと最初の結果 | ELM-04 | ELM-07 | 冪等性のモジュールだけが書く。 | 7 日（仮。T_idem_keep。DEC-48）。毎日の処理が消す | 個人情報 | 推定 |
| DAT-15 | 評価と評価値 | ELM-04 | ELM-07 | 評価のモジュールだけが書く。 | 乗客との結び付きは T_pii_retention で消す。評価値は残す | 個人情報 | 推定 |
| DAT-16 | 乗客のしきい値とドライバーの受ける条件 | ELM-04 | ELM-07 | 設定のモジュールだけが書く。 | T_pii_retention | 個人情報 | 推定 |
| DAT-17 | 苦情（乗客の報告）と対処 | ELM-04 | ELM-07 | 苦情のモジュールだけが書く。 | T_pii_retention | 個人情報 | 推定 |
| DAT-18 | 管理の操作の記録 | ELM-04 | ELM-07 | 管理のモジュールが操作と同じトランザクションで追記するだけ（DEC-31）。 | 担当との結び付きは T_pii_retention で匿名にする（DEC-31）。システムを終えるとき | 個人情報 | 推定 |
| DAT-19 | 表示の記録、画面の出来事、前面と裏の時刻、断った操作 | ELM-04 | ELM-07 | 測るモジュールだけが書く。 | T_log_retention（毎日の処理が消す） | 個人情報 | 推定 |
| DAT-20 | ブラウザのエラーの記録 | ELM-04 | ELM-07 | 測るモジュールだけが書く。 | T_log_retention | 個人情報 | 推定 |
| DAT-21 | 1 分ごとの数、位置の確かめ、アラートの状態 | ELM-04 | ELM-07 | 測るモジュールだけが書く。 | T_log_retention | 個人情報 | 推定 |
| DAT-22 | 知らせの記録 | ELM-04 | ELM-07 | 知らせのモジュールだけが書く（ELM-05 も同じモジュールで書く）。 | T_log_retention | 社内 | 推定 |
| DAT-23 | Stripe との突き合わせの結果 | ELM-05 | ELM-07 | 毎日の処理だけが追記する（FR-55 AC4。 | 個人情報を持たない。システムを終えるとき | 決済情報 | 推定 |
| DAT-24 | 毎日の処理の記録と期間の要約 | ELM-05 | ELM-07 | 毎日の処理だけが書く。 | システムを終えるとき | 社内 | 推定 |
| DAT-25 | SLI の日ごとの値 | ELM-05 | ELM-07 | 毎日の処理だけが書く。 | システムを終えるとき | 社内 | 推定 |
| DAT-26 | 配備と開け閉めの記録 | ELM-06 | ELM-07 | 配備の仕組みだけが手順の終わりに一行書く（FR-41 AC2、FR-42 AC1）。 | システムを終えるとき | 社内 | 推定 |
| DAT-27 | アプリの構造化ログ | ELM-04 | ELM-08 | 一行ずつ書き、書き換えない。 | 30 日（Cloud Logging の既定。DEC-16） | 社内（位置、連絡先、名前、自由記述、カードの情報を書かない。DEC-44） | 推定 |
| DAT-28 | Cloud Run の入口の要求のログ | ELM-17 | ELM-08 | Cloud Run の入口が書く（アプリは書かない）。 | 30 日（Cloud Logging の既定） | 個人情報（IP アドレス） | 推定 |
| DAT-29 | データベースの書き出し | ELM-22 | ELM-23 | 手元の保守の手順だけが書く。 | 最新の二つ。システムを終えるときに消す（DEC-28、DEC-36） | 個人情報（全員の個人情報と決済情報の記録） | 推定 |

持ち主の例外は一つだけで、第 2 段階の DEC-05 が決めた。ELM-05 は、ELM-04 の持つ実体（DAT-07 の匿名化、DAT-13 の確かめ中の片付け）を、同じ配車と支払いのモジュールのコードで書く。書くコードは一つで、同じ行を ELM-04 の見回りと ELM-05 が同時に片付けないよう、DAT-13 のリースで一つにする。

保持期間は、品質チェーンの T_pii_retention（3 年）と T_log_retention（28 日）、第 2 段階の決定（DEC-14、DEC-16、DEC-22、DEC-28、DEC-36）から取った。操作キーの 7 日（DEC-48）は個人情報の保持期間ではなく、送り直しのための設計上の値。

### データの品質の流れ

DRV-03（現在地と受付の状態の最新性。QR-27）:

```mermaid
flowchart LR
  BC["ELM-13 位置、誤差、測った時刻"] -->|"10 秒ごと（IFC-04）"| LOC["ELM-04 位置のモジュール: 範囲、未来の時刻、60 秒より古い測定、速さを確かめる"]
  LOC -->|"追記"| R[("DAT-09 受信の記録")]
  LOC -->|"新しいときだけ上書き"| LAST[("DAT-10 最後の位置")]
  LAST -->|"1 秒ごとの今の値（DEC-51）"| SSE["IFC-08 ride.live（30 秒より古いと stale）"]
  LAST -->|"30 秒より古いドライバーを除く"| CNT["一覧の距離（FR-34）と近くの数（FR-51）"]
  R -->|"毎分 0 秒"| CHK[("DAT-21 位置の確かめ")]
  CHK --> SLI["SLI-03 と NFR-03 のアラート"]
```

位置の写しはほかに持たず、配信も 1 秒ごとに最後の位置を読むので、届くまでの遅れは 1 秒と回線の時間だけ。許される古さ（30 秒）が、送る間隔（10 秒）と配信の読み出しの間隔（1 秒）の上限になる。

DRV-04（請求と返金の記録が Stripe と一致する。QR-32）:

```mermaid
flowchart LR
  OP["ELM-04 支払いのモジュール（DEC-12 の三つのトランザクション）"] -->|"冪等キーとメタデータ"| ST["ELM-10 Stripe の PaymentIntent と返金"]
  OP --> M[("DAT-13 お金の操作")]
  M -->|"処理中が 30 秒を過ぎた、結果が分からない"| CHK["確かめ中（見回り 5 秒ごと、毎日の処理）"]
  CHK -->|"一覧と取り出しで照らす"| ST
  ST -->|"前日の一覧（日本時間）"| REC["ELM-05 突き合わせ: 依頼ごとに押さえ、確定、取り消し、返金、未払いの支払いの額と件数"]
  M --> REC
  REC --> RES[("DAT-23 突き合わせの結果")]
  RES --> N["知らせ（FR-55 AC2、NFR-07）"]
  RES --> FR49["管理の画面（FR-49 AC3）"]
  RES --> SLI4["SLI-04 と NFR-04"]
```

DRV-27（状態の履歴の完全性。QR-33）:

```mermaid
flowchart LR
  ACT["状態を変える操作（IFC-02、03、06）と見回り"] --> DISP["ELM-04 配車のモジュール: 状態遷移表で確かめる"]
  DISP -->|"同じトランザクション"| H[("DAT-07 状態の履歴")]
  DISP -->|"同じトランザクション"| P[("DAT-08 位置の記録")]
  H -->|"1 秒ごと"| SSE["IFC-08（記録に残った変化は必ず配る）"]
  H -->|"翌朝"| CHECK["ELM-05 履歴の確かめ: 終わり方ごとの変化がそろうか"]
  P --> CHECK
  CHECK --> SLI5["SLI-05 と NFR-05"]
  APP["ELM-01 と ELM-02 のエラーと報告"] -->|"送れなければ端末に保つ（FR-38 AC2）"| ERR[("DAT-20 と DAT-17")]
```

ほかのデータの品質:

| 要求 | どこから来るか | どう確かめるか | どう伝わるか | 何と何を照らすか |
|---|---|---|---|---|
| QR-28、29 乗る場所の正確性と座標の精度（DRV-08） | 端末の位置、Places の候補、ピン | 誤差が D_pickup_accuracy を超えればピンで確かめる（FR-02 AC3）。座標は小数点以下 6 桁以上（NFR-37） | 見積もりから依頼に写す（DAT-05 → DAT-06） | 運転を始めた位置と乗る場所（NFR-14、毎日） |
| QR-35 障害で失わない（DRV-13） | Turso | 時点を指定した復元（24 時間）と書き出し（DEC-28） | 復元は新しいデータベース | 復元の後に突き合わせ（NFR-38） |
| QR-37 登録されたドライバーだけ | 運営・サポート担当の登録（FR-48） | ドライバーの役割は登録でだけ付く（IFC-06） | アカウントと受付 | NFR-30 のテスト |
| QR-49 到着の記録 | ドライバーの到着の操作と位置 | D_arrival、誤差、疑わしい印（DEC-29） | 位置を確かめた到着だけに不在の料金とキャンセル料 | NFR-45 の毎日の一覧 |
| QR-31 評価値 | 乗客の評価 | 範囲（FR-14 AC3）、一つの依頼に一つ | 評価と評価値を一つのトランザクション | NFR-19 の見直し（ドライバーが 1 人で取れない。第 2 段階） |

## 要素をまたぐ状態

### 配車依頼（ELM-01、ELM-02、ELM-04、ELM-05）

```mermaid
stateDiagram-v2
  state "手配の処理中" as booking
  state "押さえの確かめ中" as hold_checking
  state "手配できなかった" as not_booked
  state "ドライバーを探している" as searching
  state "迎車中" as accepted
  state "迎車が到着" as arrived
  state "乗車中" as in_progress
  state "乗車の終わり" as ended
  state "取り消し" as cancelled
  state "不在" as no_show
  [*] --> booking: ELM-04 が手配のトランザクション 1 で書く
  booking --> searching: 押さえた（ELM-04）
  booking --> not_booked: 断られた（ELM-04）
  booking --> hold_checking: タイムアウト、5xx、T_op_stale（ELM-04）
  hold_checking --> searching: 見回りが押さえを見つけた、T_hold_wait の内で取り消しの求めなし（ELM-04）
  hold_checking --> not_booked: T_hold_wait を過ぎた、乗客が取り消した、押さえがないと確かめた（押さえがあれば取り消してから）
  searching --> accepted: ドライバーが許諾（ELM-02）
  searching --> cancelled: 乗客が取り消し、無料（ELM-01）
  searching --> searching: しきい値を下げた（ELM-01）
  accepted --> searching: ドライバーが取り消し、押さえはそのまま（ELM-02）
  accepted --> arrived: 到着（ELM-02）
  accepted --> cancelled: 乗客が取り消し、500 円か無料（ELM-01）
  arrived --> in_progress: 確認コードが一致（ELM-02）
  arrived --> no_show: T_noshow_wait の後（ELM-02）
  arrived --> searching: ドライバーが取り消し（ELM-02）
  arrived --> cancelled: 乗客が取り消し（ELM-01）
  in_progress --> in_progress: 降車場所の変更（ELM-01）
  in_progress --> ended: 乗車の終了（ELM-02）
  not_booked --> [*]
  ended --> [*]: 配車として終わり、お金は次の図
  cancelled --> [*]: 配車として終わり、キャンセル料は次の図
  no_show --> [*]: 配車として終わり、不在の料金は次の図
```

searching と accepted と arrived には時刻で出る道がない。FR-08 は乗客が待ち続けることを許し、システムが終える機能がないため（第 2 段階の品質チェーンへの課題 7）。出口は参加者の操作だけで、押さえを持ったまま残りうる。そのためデモを閉じる手順は count-open で止まる（DEC-37）。

### 依頼の支払いの状態（ELM-04、ELM-05、ELM-10）

```mermaid
stateDiagram-v2
  state "押さえている途中" as holding
  state "押さえた" as held
  state "押さえを確かめ中" as hold_checking
  state "解放した" as released
  state "確定している途中" as capturing
  state "支払い済み" as paid
  state "未払い" as unpaid
  state "請求を確かめ中" as checking
  state "一部を返金" as partially_refunded
  state "全部を返金" as refunded
  [*] --> holding: 手配（ELM-04）
  holding --> held: 押さえた
  holding --> hold_checking: 分からない
  hold_checking --> held: 見回りが見つけた
  hold_checking --> released: 押さえがない、または取り消した
  held --> held: 押さえ直し（降車場所の変更。古い押さえを取り消す）
  held --> released: 無料の取り消し、確かめられなかった到着での不在
  held --> capturing: 乗車の終了、キャンセル料、不在の料金
  capturing --> paid: 確定した
  capturing --> unpaid: 定まった失敗（FR-31）
  capturing --> checking: 分からない
  checking --> paid: 見回りか毎日の処理が確定を見つけた
  checking --> unpaid: 確定していないと確かめた
  unpaid --> paid: 別の支払い手段で払った（FR-31 AC2）
  paid --> partially_refunded: 一部の返金（ELM-03）
  partially_refunded --> partially_refunded: さらに一部の返金
  paid --> refunded: 全部の返金
  partially_refunded --> refunded: 残りの返金
  released --> [*]
  refunded --> [*]
```

paid、partially_refunded、unpaid は終わりにしない。返金と支払いでまだお金が動きうるため。

### お金の操作（DAT-13。ELM-04 の要求と見回り、ELM-05）

```mermaid
stateDiagram-v2
  state "処理中" as processing
  state "成功" as succeeded
  state "失敗" as failed
  state "確かめ中" as checking
  state "起きていない" as not_happened
  [*] --> processing: トランザクション 1（ELM-04）
  processing --> succeeded: Stripe が成功を返した（トランザクション 2）
  processing --> failed: Stripe が定まった失敗を返した（402 など）
  processing --> checking: タイムアウト、5xx、409、429、T_op_stale を過ぎた
  checking --> succeeded: 照らして見つけた、同じキーの送り直しが成功（リースを持つ一つだけ）
  checking --> failed: 同じキーの送り直しが定まった失敗
  checking --> not_happened: 起きていないと確かめ、もう送らない（取り消しの求め、T_hold_wait、24 時間を過ぎて新しいキーに替えるとき）
  checking --> checking: Stripe が答えない（次の見回り、翌朝）
  succeeded --> [*]
  failed --> [*]
  not_happened --> [*]
```

### ドライバーの受付（DAT-04。ELM-02、ELM-03、ELM-04）

```mermaid
stateDiagram-v2
  state "受付していない" as off
  state "受付中" as receiving
  state "停止中" as suspended
  [*] --> off: 登録（ELM-03）
  off --> receiving: 受付の開始（ELM-02）
  receiving --> off: 受付の停止（ELM-02）
  receiving --> suspended: 停止、受付を止める（ELM-03）
  off --> suspended: 停止（ELM-03）
  suspended --> off: 再開（ELM-03）
```

受付中でも、位置が 30 秒より古いあいだは受付中に数えない（DEC-14）。迎車中と乗車中は依頼の状態から決まる（停止しても続く。FR-47 AC1）。

### 操作キー（DAT-14。ELM-01〜03、ELM-04）

```mermaid
stateDiagram-v2
  state "処理中" as processing
  state "結果待ち" as pending
  state "最初の結果あり" as completed
  [*] --> processing: お金を動かす操作のトランザクション 1
  [*] --> completed: お金を動かさない操作は一つのトランザクションで最初の結果まで書く
  processing --> completed: トランザクション 2 で最初の結果
  processing --> pending: 結果が分からない（202）
  pending --> completed: 確かめで結果が定まった
  completed --> [*]: T_idem_keep（7 日）の後に毎日の処理が消す
```

処理中のまま止まったもの（インスタンスがトランザクション 1 の後に止まった）は、お金の操作が T_op_stale で確かめ中になり、確かめの結果で completed になる。

### デモの期間と回（ELM-06、ELM-05、ELM-17、ELM-19）

```mermaid
stateDiagram-v2
  state "何も動かない" as idle
  state "期間の中" as period_open
  state "デモの回" as demo_open
  state "システムを終えた" as system_ended
  [*] --> idle
  idle --> period_open: start-period（ELM-06。ジョブ、定時の起動、二つ目の規則を有効にし、一度動かす）
  period_open --> demo_open: open-demo（ELM-06。サービス、一つ目の規則）
  demo_open --> period_open: close-demo（count-open が 0、または理由を付けて強いて）
  period_open --> period_open: 毎朝 06:00 の毎日の処理（ELM-05）
  period_open --> idle: end-period（period-status が終えられる、または理由を付けて強いて）
  idle --> system_ended: end-system（ELM-06 と ELM-22）
  system_ended --> [*]
```

### 苦情（DAT-17。ELM-01、ELM-03、ELM-04）

```mermaid
stateDiagram-v2
  state "未対応" as open
  state "対処済み" as handled
  [*] --> open: 乗客の報告（ELM-01）
  open --> handled: 対処を記録（ELM-03）
  handled --> handled: 対処を変えた（前の記録を残して追記）
```

## 測定点

| SLI | 出どころ | 欄 |
|---|---|---|
| SLI-01 配車の主要な流れの可用性 | 入口の要求のログ（DAT-28。ELM-05 が IFC-20 で読む）と、アプリの request.completed（IFC-09）。trace と spanId で結び、テスト用アカウントを除く（DEC-16、DEC-44）。アラートには ELM-04 が書く 1 分ごとの数（DAT-21。DEC-35） | 入口: requestMethod、requestUrl（経路の表で route_id に当てる）、status、latency、trace、spanId、timestamp。アプリ: route_id、account_kind、status。除くもの: テスト用アカウント（account_kind）、六つの操作でない経路。死活の確かめと合成の監視は置かない。Cloud Run の起動の確かめは入口を通らない |
| SLI-02 状態の変化を相手の画面に届ける速さ | 状態の履歴（DAT-07）と表示の記録（DAT-19。IFC-05）。前面と裏（DAT-19）。新しい依頼の相手は、その時点の受付（DAT-04）、条件（DAT-16）、受信の記録（DAT-09）から ELM-05 が求める | change_id、type、recorded_at、account_id、displayed_at、received_at、after_background、test_account |
| SLI-03 現在地の最新性 | ELM-04 の毎分 0 秒の位置の確かめ（DAT-21）。受信の記録と最後の位置（DAT-09、DAT-10）、前面と裏（DAT-19）、受付の開始（DAT-04）から書く。位置のモジュールは受けた時刻だけを返す | minute、account_id、role_state、last_received_at、fresh、excluded_reason（裏、受付の最初の 30 秒、テスト用） |
| SLI-04 請求と返金の記録の一致 | ELM-05 の突き合わせの結果（DAT-23）。Stripe の一覧（IFC-13）と DAT-13 から | business_date、ride_id、matched、mismatches、test_account。結果の分からない請求は翌日に判定し直す |
| SLI-05 状態の履歴の完全性 | 状態の履歴（DAT-07）と位置の記録（DAT-08）。ELM-05 の履歴の確かめ | ride_id、type、recorded_at、actor_kind、actor_id、position_ref か no_position_reason、test_account |

監視の NFR の出どころ:

| NFR | 出どころ | 誰が数えるか |
|---|---|---|
| NFR-06 毎日の処理の進み | 毎日の処理の記録（DAT-24）と、ELM-14 の二つ目の規則 | ELM-05、ELM-14 |
| NFR-07 請求の誤りと二重 | 突き合わせの結果（DAT-23）とお金の操作（DAT-13） | ELM-05（毎朝） |
| NFR-09 規則に反する割り当て | 状態の履歴（DAT-07）と受付と停止の記録（DAT-04） | ELM-05（毎朝） |
| NFR-14 乗る場所のずれ | 運転の開始の位置（DAT-08）と依頼の乗る場所（DAT-06） | ELM-05（毎朝） |
| NFR-21 ブラウザごとのエラー | ブラウザのエラーの記録（DAT-20）と入口のログの userAgent | ELM-05（前日を 1 時間ごとに。チケット） |
| NFR-24 手配の画面の応答 | 入口の要求のログの route_id が places.search、places.resolve、estimates.create、rides.create のもの | ELM-05（前日を 1 時間ごとに。チケット） |
| NFR-25 降車の請求の時間 | 状態の履歴の ended と charged の時刻の差（DAT-07） | ELM-05（毎朝） |
| NFR-28 外部の呼び出しの失敗 | 外部の呼び出しの 1 分ごとの数（DAT-21） | ELM-04（毎分、直近 1 時間。デモの回の間は呼び出し） |
| NFR-29 走行中に見える許諾 | 許諾の時刻（DAT-07）と前後の受信の記録（DAT-09） | ELM-05（週に一度） |
| NFR-41 保存期間を過ぎた個人情報 | 保存期間の処理の記録（DAT-24）と、期限を過ぎて残る記録の数 | ELM-05（毎朝） |
| NFR-45 不在の料金とキャンセル料の根拠 | 不在とキャンセル料の請求（DAT-07、DAT-13）と到着の位置（DAT-08） | ELM-05（毎朝） |

## 受け入れ基準のトレース

すべての割り当てられた FR（54 件）の受け入れ基準 200 件を、通るインタフェースと流れに当てた。流れの名前は「端から端の流れ」の見出し。FR-40 AC1 の「履歴とログを時刻順に一つに示す」は、第 2 段階の技術的負債（DEC-19）のとおり、エンジニアの画面（IFC-29）と Logs Explorer の二つに分かれる。

| FR | 基準 | IFC | 流れ |
|---|---|---|---|
| FR-01 | AC1: 乗客が必要な項目を入れてアカウントを作ると、ログインして手配の画面を使える。 | IFC-01、IFC-23、IFC-26、IFC-28 | CUJ-01-D |
| FR-01 | AC2: 必要な項目が欠けているとき、または同じ連絡先のアカウントがすでにあるとき、アカウントを作らず理… | IFC-01、IFC-23、IFC-26、IFC-28 | CUJ-01-D |
| FR-01 | AC3: ドライバーは運営・サポート担当が作ったアカウント（FR-48）で、運営・サポート担当はあらかじ… | IFC-01、IFC-06、IFC-26、IFC-28 | CUJ-14（ドライバーの登録） |
| FR-01 | AC4: 誤った資格情報でログインしようとしたとき、ログインさせずその旨を示す。 | IFC-01、IFC-23、IFC-26、IFC-28 | CUJ-01-D |
| FR-01 | AC5: アカウントにテスト用の印を付けられ、そのアカウントの出来事の記録（FR-39）にも印が残る（測… | IFC-07、IFC-29 | DRV-27 |
| FR-02 | AC1: 位置情報の利用を許可した乗客が手配の画面を開くと、現在地が乗る場所として入っている。 | IFC-02、IFC-15、IFC-16、IFC-18、IFC-24 | CUJ-01-A |
| FR-02 | AC2: 住所や施設の名前で探すと候補を示し、選んだ場所に地図のピンを置く。乗客はピンを動かして入口など… | IFC-02、IFC-15、IFC-16、IFC-18、IFC-24 | CUJ-01-A |
| FR-02 | AC3: 乗る場所に入れた現在地の誤差が D_pickup_accuracy を超えるとき、乗る場所を現… | IFC-02、IFC-15、IFC-16、IFC-18、IFC-24 | CUJ-01-A |
| FR-02 | AC4: 位置情報の利用が許可されていないとき、現在地を入れず、場所を探して指定するよう示す。 | IFC-02、IFC-15、IFC-16、IFC-18、IFC-24 | CUJ-01-A |
| FR-02 | AC5: 探しても候補がないとき、その旨を示し、地図のピンで指定できるようにする。 | IFC-02、IFC-15、IFC-16、IFC-18、IFC-24 | CUJ-01-A |
| FR-02 | AC6: 乗る場所と降りる場所の間に経路がないとき、料金の確認に進めず理由を示す。 | IFC-02、IFC-15、IFC-16、IFC-18、IFC-24 | CUJ-01-A |
| FR-02 | AC7: 手配の画面を開いた時刻を記録する（QIU-03 の測定に使う）。 | IFC-05 | DRV-27 |
| FR-03 | AC1: 乗る場所と降りる場所が決まると、目的地への到着予定時刻、所要時間、料金を示す。 | IFC-02、IFC-15、IFC-24 | CUJ-01-A |
| FR-03 | AC2: 到着予定時刻は、ドライバーが見つかるまでの見込みの時間、ドライバーが乗車場所に着くまでの見込み… | IFC-02、IFC-15、IFC-24 | CUJ-01-A |
| FR-03 | AC3: 料金は、模擬の運賃表 R_fare（context.yaml の制約）を、経路の見込みの距離（… | IFC-02、IFC-15、IFC-24 | CUJ-01-A |
| FR-03 | AC4: 乗る場所か降りる場所を変えると、示す値を計算し直す。 | IFC-02、IFC-15、IFC-24 | CUJ-01-A |
| FR-03 | AC5: 外部のサービスから経路や渋滞の情報を得られないとき、値を示さず、手配に進めないことと理由を示す。 | IFC-02、IFC-15、IFC-24 | CUJ-01-A |
| FR-03 | AC6: 手配したとき、そのとき示していた到着予定時刻と料金を依頼に記録する（QIU-02 と QIU-… | IFC-02、IFC-15、IFC-24 | CUJ-01-A |
| FR-04 | AC1: 乗客が支払い手段を登録すると、手配のときにその支払い手段を使う。 | IFC-02、IFC-13、IFC-14、IFC-23 | CUJ-01-D |
| FR-04 | AC2: 決済のサービスが受け付けない支払い手段（期限切れ、番号の誤りなど）は、登録せず理由を示す。 | IFC-02、IFC-13、IFC-14、IFC-23 | CUJ-01-D |
| FR-04 | AC3: 進行中の依頼で使っている支払い手段を削除しようとしたとき、削除せずその旨を示す。 | IFC-02、IFC-13、IFC-14、IFC-23 | CUJ-01-D |
| FR-05 | AC1: 乗客が手配を確定すると、確定した料金の額を決済のサービスで押さえ、確定した料金、示した到着予定… | IFC-02、IFC-13、IFC-08、IFC-24 | CUJ-01-B |
| FR-05 | AC2: 支払い手段が登録されていないとき、依頼を作らず、登録を求める。 | IFC-02、IFC-13、IFC-08、IFC-24 | CUJ-01-B |
| FR-05 | AC3: 決済のサービスが額を押さえられないとき（残高不足、カードの停止など）、依頼を作らず、理由と、別… | IFC-02、IFC-13、IFC-08、IFC-24 | CUJ-01-B |
| FR-05 | AC4: 進行中の依頼がある乗客、または未払いの乗車がある乗客（FR-31）が手配しようとしたとき、依頼… | IFC-02、IFC-13、IFC-08、IFC-24 | CUJ-01-B |
| FR-05 | AC5: 確定の操作が二度届いても、依頼は一つだけ作り、額も一度だけ押さえる。 | IFC-02、IFC-13、IFC-08、IFC-24 | CUJ-01-B |
| FR-06 | AC1: ドライバーが許諾すると、乗客の画面を迎車中に変え、ドライバーと車の情報（FR-09）を示し、音… | IFC-08、IFC-18、IFC-24 | CUJ-02 |
| FR-06 | AC2: 迎車が乗車場所に着くと（FR-25）、乗客の画面と音で知らせる。 | IFC-08、IFC-18、IFC-24 | CUJ-02 |
| FR-06 | AC3: ブラウザが裏に回っていた間に状況が変わったとき、前面に戻ったら最新の状況を示す。 | IFC-08、IFC-02、IFC-18 | DRV-07 |
| FR-06 | AC4: 許諾したドライバーが取り消して探し直しているとき（FR-22）、その旨を示す。 | IFC-08、IFC-18、IFC-24 | CUJ-02 |
| FR-07 | AC1: 許諾の前に乗客が取り消すと、依頼をドライバーの一覧から消し、押さえた額をすべて解放する。キャン… | IFC-02、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-01-C |
| FR-07 | AC2: 許諾の後に乗客が取り消そうとすると、取り消す前にキャンセル料（500 円）がかかることを示し、… | IFC-02、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-01-C |
| FR-07 | AC3: 許諾したときに示した乗車場所への到着予定時刻（FR-10 が記録した値）から T_cancel… | IFC-02、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-01-C |
| FR-07 | AC4: 許諾のときの到着予定が記録されていないとき、キャンセル料をかけずに取り消す。 | IFC-02、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-01-C |
| FR-07 | AC5: キャンセル料の請求に失敗すると、未払いとして扱う（FR-31）。 | IFC-02、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-01-C |
| FR-07 | AC6: 乗車が始まった依頼を取り消そうとしたとき、取り消さず、降車場所の変更（FR-12）を案内する。 | IFC-02、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-01-C |
| FR-07 | AC7: 誰がいつ取り消したか、キャンセル料を請求したかどうかとその額を記録する（FR-39）。 | IFC-02、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-01-C |
| FR-08 | AC1: 手配から T_match_wait が過ぎても許諾がないとき、その旨を示し、「待ち続ける」と「… | IFC-02、IFC-08、IFC-24 | CUJ-01-B、CUJ-05 |
| FR-08 | AC2: しきい値を設定している乗客には、しきい値でドライバーが絞られていることを示し、しきい値を下げて… | IFC-02、IFC-08、IFC-24 | CUJ-01-B、CUJ-05 |
| FR-08 | AC3: しきい値を下げたとき、変更後のしきい値と変えた時刻を依頼に記録する（QIU-01 と QIU-… | IFC-02、IFC-08、IFC-24 | CUJ-01-B、CUJ-05 |
| FR-08 | AC4: 「取り消す」を選ぶと、FR-07 と同じく依頼を取り消す。 | IFC-02、IFC-08、IFC-24 | CUJ-01-B、CUJ-05 |
| FR-09 | AC1: 依頼が許諾されると、乗客の画面にドライバーの名前と顔写真、車種、車の色、ナンバー、乗車の確認コ… | IFC-08、IFC-02、IFC-24 | CUJ-02 |
| FR-09 | AC2: ドライバーが取り消してほかのドライバーが許諾したとき、表示を新しいドライバーと車に替え、確認コ… | IFC-08、IFC-02、IFC-24 | CUJ-02 |
| FR-10 | AC1: 迎車中、ドライバーの現在地と乗車場所への到着予定を地図に示し、現在地が届くたびに更新する。 | IFC-08、IFC-15、IFC-16、IFC-24 | CUJ-02 |
| FR-10 | AC2: 依頼が許諾されたとき、乗客に最初に示した乗車場所への到着予定時刻を依頼に記録する。ドライバーが… | IFC-08、IFC-15、IFC-16、IFC-24 | CUJ-02 |
| FR-10 | AC3: 到着予定を計算できず示せないとき、その旨を示し、依頼には到着予定がないことを記録する。 | IFC-08、IFC-15、IFC-16、IFC-24 | CUJ-02 |
| FR-10 | AC4: ドライバーの現在地が届かなくなったとき（ドライバーのブラウザが裏に回ったときなど）、最後に分か… | IFC-08、IFC-15、IFC-16、IFC-24 | CUJ-02 |
| FR-10 | AC5: 現在地がまた届くようになると、更新が止まっているという表示を消す。 | IFC-08、IFC-15、IFC-16、IFC-24 | CUJ-02 |
| FR-11 | AC1: 乗車中、車の現在地、最後に指定した降車場所のピン、到着予定時刻を地図に示し、現在地が届くたびに… | IFC-08、IFC-16、IFC-24 | CUJ-03 |
| FR-11 | AC2: 現在地が届かなくなったとき、最後に分かった位置とその時刻を示す。 | IFC-08、IFC-16、IFC-24 | CUJ-03 |
| FR-12 | AC1: 乗車中の乗客が新しい降車場所を指定すると、その場合の料金と到着予定時刻を計算して示し、乗客が承… | IFC-02、IFC-15、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-03 |
| FR-12 | AC2: 乗客が承認すると、ドライバーの画面と音で知らせて新しい降車場所のピンと経路を示し、確定した料金… | IFC-02、IFC-15、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-03 |
| FR-12 | AC3: 今いる場所で降りることも、降車場所の変更として指定できる。 | IFC-02、IFC-15、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-03 |
| FR-12 | AC4: 料金を計算できないとき、または新しい額を押さえられないとき、降車場所を変えず理由を示す。 | IFC-02、IFC-15、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-03 |
| FR-12 | AC5: 変えた時刻と、変更の前後の降車場所と料金を記録する（QIU-02、QIU-06、QIU-08 … | IFC-02、IFC-15、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-03 |
| FR-13 | AC1: 乗車が終わると（FR-28）、乗客の画面に評価の画面を示し、乗客は N_rating_leve… | IFC-02、IFC-25 | CUJ-04 |
| FR-13 | AC2: 乗客は評価を送らずに評価の画面を閉じられる。 | IFC-02、IFC-25 | CUJ-04 |
| FR-13 | AC3: 評価を送った乗車にもう一度評価を送ろうとしたとき、受け付けずその旨を示す。 | IFC-02、IFC-25 | CUJ-04 |
| FR-13 | AC4: 評価の画面を開いた時刻と、評価を送った時刻を記録する（QIU-09 の測定に使う）。 | IFC-05 | DRV-27 |
| FR-14 | AC1: 乗客がしきい値を設定すると、次の手配からその値を使う。 | IFC-02、IFC-25 | CUJ-05 |
| FR-14 | AC2: 乗客がしきい値を解除すると、次の手配から評価に関わらずすべてのドライバーを対象にする。 | IFC-02、IFC-25 | CUJ-05 |
| FR-14 | AC3: 評価の段階（N_rating_levels）の範囲の外の値は受け付けない。 | IFC-02、IFC-25 | CUJ-05 |
| FR-14 | AC4: 設定の画面で、評価の件数が N_min_ratings に満たないドライバーには依頼を示さない… | IFC-02、IFC-25 | CUJ-05 |
| FR-15 | AC1: ドライバーの評価値は、そのドライバーが受けたすべての評価の平均とする。 | IFC-02 | CUJ-04 |
| FR-15 | AC2: 評価が届くと、そのドライバーの評価値と評価の件数を更新し、次のしきい値の判定（FR-16）から… | IFC-02 | CUJ-04 |
| FR-15 | AC3: 評価がまだないドライバーは、評価値なし、件数 0 とする。 | IFC-02 | CUJ-04 |
| FR-16 | AC1: しきい値を設定した乗客の依頼は、評価値がしきい値以上で、評価の件数が N_min_rating… | IFC-03、IFC-08、IFC-26 | CUJ-06、DRV-05 |
| FR-16 | AC2: 条件を満たさないドライバーがその依頼を許諾しようとしたとき（一覧を見た後に評価値が下がったとき… | IFC-03、IFC-08、IFC-26 | CUJ-06、DRV-05 |
| FR-16 | AC3: しきい値を設定していない乗客の依頼は、評価に関わらず示す。 | IFC-03、IFC-08、IFC-26 | CUJ-06、DRV-05 |
| FR-16 | AC4: 依頼の途中で乗客がしきい値を下げたとき（FR-08）、下げた値で示す相手を選び直す。 | IFC-02、IFC-08 | CUJ-05 |
| FR-17 | AC1: ドライバーが受付を開始すると、依頼の一覧（FR-18）を示し、現在地をサーバーに送り始める。 | IFC-03、IFC-04、IFC-18、IFC-26 | CUJ-06 |
| FR-17 | AC2: 位置情報の利用が許可されていないとき、受付を開始させず、許可を求める。 | IFC-03、IFC-04、IFC-18、IFC-26 | CUJ-06 |
| FR-17 | AC3: 配車を停止されたドライバー（FR-47）が受付を開始しようとしたとき、開始させずその旨を示す。 | IFC-03、IFC-04、IFC-18、IFC-26 | CUJ-06 |
| FR-17 | AC4: 受付中にブラウザが裏に回った時刻と前面に戻った時刻を記録し（QIU-12 と QIU-17 の… | IFC-04、IFC-18 | DRV-07 |
| FR-17 | AC5: ドライバーが受付を停止すると、一覧の更新と現在地の送信をやめ、停止した時刻を記録する。 | IFC-03、IFC-04、IFC-18、IFC-26 | CUJ-06 |
| FR-18 | AC1: 受付中のドライバーに、示してよい依頼（FR-16、FR-34）を一覧で示し、各依頼に現在地から… | IFC-03、IFC-08、IFC-26 | CUJ-06 |
| FR-18 | AC2: 新しい依頼が来ると一覧に加え、音で知らせる。 | IFC-03、IFC-08、IFC-26 | CUJ-06 |
| FR-18 | AC3: ほかのドライバーが許諾した依頼と、取り消された依頼は一覧から消す。 | IFC-03、IFC-08、IFC-26 | CUJ-06 |
| FR-18 | AC4: 示す依頼がないとき、その旨を示す。 | IFC-03、IFC-08、IFC-26 | CUJ-06 |
| FR-19 | AC1: ドライバーが一覧で依頼を選ぶと、乗車場所と降車場所のピン、経路、受取額、乗車場所までの距離と所… | IFC-03、IFC-15、IFC-16、IFC-26 | CUJ-06 |
| FR-19 | AC2: 見ている間にほかのドライバーが許諾したとき、または乗客が取り消したとき、その旨を示して一覧に戻… | IFC-03、IFC-15、IFC-16、IFC-26 | CUJ-06 |
| FR-20 | AC1: ドライバーが許諾すると、依頼をそのドライバーに割り当て、ほかのドライバーの一覧から消し、乗客に… | IFC-03、IFC-08、IFC-26 | CUJ-06、DRV-05 |
| FR-20 | AC2: 同じ依頼を二人のドライバーがほぼ同時に許諾したとき、一人だけに割り当て、もう一人にはほかのドラ… | IFC-03、IFC-08、IFC-26 | CUJ-06、DRV-05 |
| FR-20 | AC3: 乗客が取り消した依頼を許諾しようとしたとき、割り当てずその旨を示す。 | IFC-03、IFC-08、IFC-26 | CUJ-06、DRV-05 |
| FR-20 | AC4: 迎車中または乗車中のドライバーが新しい依頼を許諾しようとしたとき、受け付けずその旨を示す。 | IFC-03、IFC-08、IFC-26 | CUJ-06、DRV-05 |
| FR-21 | AC1: 現在地から求めたドライバーの速度が V_moving 以上のとき、依頼を選ぶ操作と許諾する操作… | IFC-03、IFC-04、IFC-26 | CUJ-06 |
| FR-21 | AC2: 速度が V_moving 未満になると、操作を受け付ける。 | IFC-03、IFC-04、IFC-26 | CUJ-06 |
| FR-21 | AC3: 位置情報が届かず速度を求められないとき、操作を受け付け、速度が分からなかったことを記録する。 | IFC-03、IFC-04、IFC-26 | CUJ-06 |
| FR-21 | AC4: 受け付けなかった操作の時刻と速度を記録する（QIU-14 の測定に使う）。 | IFC-03、IFC-04、IFC-26 | CUJ-06 |
| FR-22 | AC1: 迎車中のドライバーが取り消すと、乗客に知らせ（FR-06）、依頼を乗客の依頼のまま、ほかのドラ… | IFC-03、IFC-08、IFC-27 | 迎車 |
| FR-22 | AC2: 乗車が始まった依頼を取り消そうとしたとき、取り消さずその旨を示す。 | IFC-03、IFC-08、IFC-27 | 迎車 |
| FR-22 | AC3: 誰がいつ取り消したかを記録する（FR-39）。 | IFC-03、IFC-08、IFC-27 | 迎車 |
| FR-23 | AC1: ドライバーが許諾すると、現在地から乗車場所までの経路と乗車場所のピンを地図に示す。 | IFC-03、IFC-15、IFC-16、IFC-27 | 迎車、CUJ-07 |
| FR-23 | AC2: 運転を始めると（FR-26）、降車場所までの経路と降車場所のピンを示す。降車場所が変わると（F… | IFC-03、IFC-15、IFC-16、IFC-27 | 迎車、CUJ-07 |
| FR-23 | AC3: 外部のサービスから経路を得られないとき、乗車場所または降車場所のピンだけを示し、経路を示せない… | IFC-03、IFC-15、IFC-16、IFC-27 | 迎車、CUJ-07 |
| FR-24 | AC1: 迎車中、位置情報の利用を許可した乗客の現在地をドライバーの地図に示し、届くたびに更新する。 | IFC-04、IFC-08、IFC-18、IFC-27、IFC-24 | 迎車 |
| FR-24 | AC2: 乗客が許可していないとき、または現在地が届かないとき、乗車場所のピンだけを示し、乗客の現在地が… | IFC-04、IFC-08、IFC-18、IFC-27、IFC-24 | 迎車 |
| FR-24 | AC3: 乗車が始まるか依頼が終わると、乗客の現在地を示すのをやめ、乗客のブラウザからの送信も止める。 | IFC-04、IFC-08、IFC-18、IFC-27、IFC-24 | 迎車 |
| FR-25 | AC1: ドライバーが乗車場所への到着を知らせたとき、現在地が乗る場所から D_arrival 以内なら… | IFC-03、IFC-08、IFC-27 | 迎車 |
| FR-25 | AC2: 現在地が乗る場所から D_arrival より離れているとき、到着を受け付けず、乗車場所に近づ… | IFC-03、IFC-08、IFC-27 | 迎車 |
| FR-25 | AC3: 現在地を得られないとき、または現在地の誤差が D_arrival より大きく距離を確かめられな… | IFC-03、IFC-08、IFC-27 | 迎車 |
| FR-25 | AC4: 取り消された依頼について到着を知らせようとしたとき、受け付けずその旨を示す。 | IFC-03、IFC-08、IFC-27 | 迎車 |
| FR-26 | AC1: ドライバーが乗客から聞いた確認コードを入れ、手配の確認コードと一致すると、乗車の開始の時刻と位… | IFC-03、IFC-08、IFC-24、IFC-27 | CUJ-07 |
| FR-26 | AC2: 確認コードが一致しないとき、運転を開始させず、依頼主かどうか確かめるよう示す。 | IFC-03、IFC-08、IFC-24、IFC-27 | CUJ-07 |
| FR-27 | AC1: 乗車場所への到着から T_noshow_wait が過ぎると、ドライバーは依頼を不在として終え… | IFC-03、IFC-13、IFC-08、IFC-27 | CUJ-07 |
| FR-27 | AC2: 到着から T_noshow_wait が過ぎる前に不在として終えようとしたとき、受け付けず、あ… | IFC-03、IFC-13、IFC-08、IFC-27 | CUJ-07 |
| FR-27 | AC3: 到着が「位置を確かめられなかった」と記録されている依頼（FR-25）を不在で終えたとき、不在の… | IFC-03、IFC-13、IFC-08、IFC-27 | CUJ-07 |
| FR-27 | AC4: 不在の料金の請求に失敗すると、未払いとして扱う（FR-31）。 | IFC-03、IFC-13、IFC-08、IFC-27 | CUJ-07 |
| FR-28 | AC1: ドライバーが降車場所への到着を知らせると、乗車を終え、時刻と位置を記録し、決済（FR-29）を… | IFC-03、IFC-08、IFC-27、IFC-24 | CUJ-08 |
| FR-28 | AC2: 終える位置が、最後に指定した降車場所から D_dropoff を超えて離れているとき、ドライバ… | IFC-03、IFC-08、IFC-27、IFC-24 | CUJ-08 |
| FR-29 | AC1: 乗車が終わると、乗客の操作なしに、確定した料金（降車場所を変えたときは変更後の料金）を押さえて… | IFC-03、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-08 |
| FR-29 | AC2: 決済のサービスが請求の失敗を返したとき、FR-31 の扱いに移る。 | IFC-03、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-08 |
| FR-29 | AC3: 決済のサービスが応答しないとき、失敗と扱わず、同じキー（FR-30）で請求の結果を確かめる。確… | IFC-03、IFC-13、IFC-08、IFC-10 | CUJ-08、DRV-04 |
| FR-29 | AC4: 確かめた結果が成功なら支払いの完了を示し、失敗なら FR-31 の扱いに移る。 | IFC-08、IFC-10 | DRV-04 |
| FR-29 | AC5: 請求した額と時刻を乗車の記録に残す。 | IFC-03、IFC-13、IFC-08、IFC-24、IFC-27 | CUJ-08 |
| FR-30 | AC1: 請求済みの依頼と種類の組について同じキーの請求が届くと、最初の結果を返し、二度目の請求はしない。 | IFC-13、IFC-03 | CUJ-08、DRV-04 |
| FR-30 | AC2: 決済のサービスから応答がなく請求をやり直すとき、同じキーを使う。 | IFC-13、IFC-03 | CUJ-08、DRV-04 |
| FR-30 | AC3: 依頼か請求の種類が違えば、それぞれのキーで請求する。 | IFC-13、IFC-03 | CUJ-08、DRV-04 |
| FR-31 | AC1: 請求に失敗すると、乗客の画面に理由と、別の支払い手段を選んで払う手段を示し、ドライバーの画面に… | IFC-02、IFC-13、IFC-14、IFC-23、IFC-27 | CUJ-08 |
| FR-31 | AC2: 乗客が別の支払い手段で払うと、未払いを解消し、両方の画面に示す。 | IFC-02、IFC-13、IFC-14、IFC-23、IFC-27 | CUJ-08 |
| FR-31 | AC3: 未払いの依頼がある乗客の新しい手配は受け付けない（FR-05）。 | IFC-02、IFC-13、IFC-14、IFC-23、IFC-27 | CUJ-08 |
| FR-32 | AC1: 乗車が終わると、その乗車の運賃、手数料（アプリ手配料）、受取額、決済の状態（完了・未払い）をド… | IFC-03、IFC-27 | CUJ-08 |
| FR-32 | AC2: 許諾していた依頼が乗客に取り消されてキャンセル料を請求したとき（FR-07）、または不在で終え… | IFC-03、IFC-27 | CUJ-08 |
| FR-32 | AC3: 未払いが解消されると（FR-31）、決済の状態を完了に変える。 | IFC-03、IFC-27 | CUJ-08 |
| FR-33 | AC1: ドライバーが受取額の下限と、現在地から乗車場所までの距離の上限を設定すると、それ以降の依頼の一… | IFC-03、IFC-27 | CUJ-09 |
| FR-33 | AC2: 条件を解除すると、条件のない一覧に戻す。 | IFC-03、IFC-27 | CUJ-09 |
| FR-33 | AC3: 負の値など、ありえない値は受け付けない。 | IFC-03、IFC-27 | CUJ-09 |
| FR-33 | AC4: 条件の値と変えた時刻を記録する（QIU-12 と QIU-17 の数え分けに使う）。 | IFC-03、IFC-27 | CUJ-09 |
| FR-34 | AC1: 条件を設定したドライバーの一覧には、受取額が下限以上で、現在地から乗車場所までの距離が上限以内… | IFC-03、IFC-04、IFC-08 | CUJ-09 |
| FR-34 | AC2: ドライバーが移動して乗車場所までの距離が変わると、示す依頼を選び直す。 | IFC-03、IFC-04、IFC-08 | CUJ-09 |
| FR-34 | AC3: 条件を設定していないドライバーには、しきい値（FR-16）で絞った依頼をすべて示す。 | IFC-03、IFC-04、IFC-08 | CUJ-09 |
| FR-36 | AC1: 通知の条件を満たすエラー（サーバーのエラー、外部サービスの呼び出しの失敗、ブラウザから届いたエ… | IFC-17、IFC-19、IFC-09、IFC-10 | CUJ-10 |
| FR-36 | AC2: 通知した時刻と内容を記録する（QIU-19 の起点に使う）。 | IFC-17、IFC-19、IFC-09、IFC-10 | CUJ-10 |
| FR-36 | AC3: 通知先に送れなかったとき、送れなかったことを記録し、送り直す。 | IFC-17、IFC-19、IFC-09、IFC-10 | CUJ-10 |
| FR-37 | AC1: ブラウザの一つの操作から始まった処理のログは、どの部分のものでも同じトレース ID を持つ。 | IFC-01、IFC-02、IFC-03、IFC-09、IFC-13、IFC-15 | CUJ-10、DRV-27 |
| FR-37 | AC2: 外部サービスへの要求と応答のログにも、そのトレース ID を残す。 | IFC-01、IFC-02、IFC-03、IFC-09、IFC-13、IFC-15 | CUJ-10、DRV-27 |
| FR-37 | AC3: エラーの応答にトレース ID を含め、ブラウザのエラーの記録（FR-38）と結び付けられるよう… | IFC-01、IFC-02、IFC-03、IFC-09、IFC-13、IFC-15 | CUJ-10、DRV-27 |
| FR-38 | AC1: 乗客かドライバーのブラウザでエラー（画面の処理の失敗、サーバーへの要求の失敗、位置情報の取得の… | IFC-05、IFC-09 | CUJ-10 |
| FR-38 | AC2: 通信が切れていて送れないとき、ブラウザに保持し、通信が戻ったら送る。 | IFC-05、IFC-09 | CUJ-10 |
| FR-39 | AC1: 配車依頼と乗車の状態が変わるたびに（手配、許諾、取り消し、迎車の到着、乗車の開始、不在、乗車の… | IFC-02、IFC-03、IFC-06、IFC-07 | DRV-27 |
| FR-39 | AC2: 記録は書き換えず、追記だけする。ただし、保存期間を過ぎた記録から操作した人と位置を消すとき（F… | IFC-02、IFC-03、IFC-06、IFC-07 | DRV-27 |
| FR-39 | AC3: テスト用アカウント（FR-01）の依頼の記録には、テスト用の印を残す。 | IFC-02、IFC-03、IFC-06、IFC-07 | DRV-27 |
| FR-40 | AC1: 依頼 ID で探すと、その依頼の状態の履歴（FR-39）と、関係するトレース ID のログを時… | IFC-07、IFC-29 | CUJ-10 |
| FR-40 | AC2: トレース ID で探すと、ブラウザ・サーバー・外部サービスのログを時刻順に示す。 | IFC-07、IFC-29 | CUJ-10 |
| FR-40 | AC3: 利用者 ID、時間の範囲、エラーの種類でも探せる。 | IFC-07、IFC-29 | CUJ-10 |
| FR-40 | AC4: 条件に合うものがないとき、その旨を示す。 | IFC-07、IFC-29 | CUJ-10 |
| FR-41 | AC1: エンジニアが配備を始めると、自動のテストを実行し、通ったときだけ本番を新しい版に替える。 | IFC-11、IFC-21 | CUJ-11〜13 |
| FR-41 | AC2: 配備ごとに、版、時刻、含まれる変更、変更の種類（新しい機能・修正・版上げ）、各変更の最初のコミ… | IFC-11、IFC-21 | CUJ-11〜13 |
| FR-41 | AC3: テストに通らないとき、配備せず、どのテストが失敗したかを示す。 | IFC-11、IFC-21 | CUJ-11〜13 |
| FR-41 | AC4: 配備の途中で失敗したとき、本番は前の版のまま動き、失敗を記録してエンジニアに通知する。 | IFC-11、IFC-21 | CUJ-11〜13 |
| FR-42 | AC1: エンジニアが戻す操作をすると、本番を一つ前に配備した版に替え、戻した時刻と理由を記録する。 | IFC-11、IFC-21 | CUJ-11〜13 |
| FR-42 | AC2: 戻せる前の版がないとき（初めての配備のあと）、戻さずその旨を示す。 | IFC-11、IFC-21 | CUJ-11〜13 |
| FR-43 | AC1: 乗客が乗車の履歴（FR-44）から乗車を選び、種類と内容を入れて報告すると、その乗車とドライバ… | IFC-02、IFC-24、IFC-25 | CUJ-14 |
| FR-43 | AC2: 迎車中と乗車中の画面からも「手配した車と違う車に乗った」を報告できる（QIU-05 の分子に使… | IFC-02、IFC-24、IFC-25 | CUJ-14 |
| FR-43 | AC3: 種類が選ばれていないとき、受け付けず、選ぶよう示す。 | IFC-02、IFC-24、IFC-25 | CUJ-14 |
| FR-44 | AC1: 乗車が終わると、その乗車（日時、乗る場所・降りる場所、ドライバーと車、示した料金、請求額）を乗… | IFC-02、IFC-25 | CUJ-14 |
| FR-44 | AC2: キャンセル料か不在の料金を請求すると（FR-07、FR-27）、その依頼（日時、乗る場所、ドラ… | IFC-02、IFC-25 | CUJ-14 |
| FR-44 | AC3: 返金されると（FR-50）、その乗車の履歴に返金の額を示す。 | IFC-02、IFC-06 | CUJ-16 |
| FR-44 | AC4: 未払いの依頼には、未払いであることと払う手段（FR-31）を示す。 | IFC-02、IFC-25 | CUJ-14 |
| FR-45 | AC1: 受け付けた苦情を、状態（未対応・対処済み）、種類、受付の時刻とともに一覧で示し、状態と種類で絞… | IFC-06、IFC-28 | CUJ-14 |
| FR-45 | AC2: 苦情を開くと、報告の内容、その乗車の記録（状態の履歴、経路、料金と請求）、ドライバーと車の情報… | IFC-06、IFC-28 | CUJ-14 |
| FR-46 | AC1: 運営・サポート担当が対処の内容（対処しないことを含む）と理由を入れて記録すると、記録の時刻と担… | IFC-06、IFC-28 | CUJ-14 |
| FR-46 | AC2: 対処の内容が入っていないとき、記録せず、入れるよう示す。 | IFC-06、IFC-28 | CUJ-14 |
| FR-46 | AC3: 対処済みの苦情の対処を変えるとき、前の記録を残したまま新しい記録を加える。 | IFC-06、IFC-28 | CUJ-14 |
| FR-47 | AC1: 運営・サポート担当がドライバーの配車を停止すると、そのドライバーの受付を止め、依頼の一覧を示さ… | IFC-06、IFC-03、IFC-08、IFC-28 | CUJ-14、DRV-05 |
| FR-47 | AC2: 停止中のドライバーが受付を開始しようとしたとき、開始させない（FR-17）。 | IFC-06、IFC-03、IFC-08、IFC-28 | CUJ-14、DRV-05 |
| FR-47 | AC3: 再開すると、そのドライバーは受付を開始できる。 | IFC-06、IFC-03、IFC-08、IFC-28 | CUJ-14、DRV-05 |
| FR-47 | AC4: 停止と再開の時刻、担当、理由を記録する。 | IFC-06、IFC-03、IFC-08、IFC-28 | CUJ-14、DRV-05 |
| FR-48 | AC1: 運営・サポート担当が、審査を通ったドライバーの名前、顔写真、連絡先と、車両の車種、色、ナンバー… | IFC-06、IFC-01、IFC-28、IFC-26 | CUJ-14（ドライバーの登録） |
| FR-48 | AC2: 必要な項目が欠けているとき、登録せず、欠けている項目を示す。 | IFC-06、IFC-01、IFC-28、IFC-26 | CUJ-14（ドライバーの登録） |
| FR-48 | AC3: すでに登録されたナンバーを登録しようとしたとき、登録せずその旨を示す。 | IFC-06、IFC-01、IFC-28、IFC-26 | CUJ-14（ドライバーの登録） |
| FR-48 | AC4: 車両の情報を変えると、次の依頼から新しい情報を乗客に示す（FR-09）。 | IFC-06、IFC-01、IFC-28、IFC-26 | CUJ-14（ドライバーの登録） |
| FR-49 | AC1: 依頼を開くと、手配時に示した料金、降車場所の変更による料金の変化、請求の種類と額、決済の状態、… | IFC-06、IFC-10、IFC-28 | CUJ-16 |
| FR-49 | AC2: 請求額と確定した料金が違うとき、その差を示す。 | IFC-06、IFC-10、IFC-28 | CUJ-16 |
| FR-49 | AC3: 決済のサービスの記録と一致しなかった依頼（FR-55）には、一致しなかった項目を示す。 | IFC-06、IFC-10、IFC-28 | CUJ-16 |
| FR-49 | AC4: 苦情（FR-45）から、その依頼の請求の記録を開ける。 | IFC-06、IFC-10、IFC-28 | CUJ-16 |
| FR-50 | AC1: 運営・サポート担当が額と理由を入れて返金すると、決済のサービスで返金し、額、理由、担当、時刻を… | IFC-06、IFC-13、IFC-28 | CUJ-16 |
| FR-50 | AC2: 返金できる残りの額を超える額は受け付けず、その旨を示す。 | IFC-06、IFC-13、IFC-28 | CUJ-16 |
| FR-50 | AC3: 返金の要求ごとに一意のキーを付け、同じ返金の操作が二度届いても返金は一度だけ行う。 | IFC-06、IFC-13、IFC-28 | CUJ-16 |
| FR-50 | AC4: 決済のサービスが返金に失敗したとき、返金を完了と記録せず理由を示す。やり直すときは同じキーを使… | IFC-06、IFC-13、IFC-28 | CUJ-16 |
| FR-51 | AC1: しきい値を設定した乗客が乗る場所を決めると、手配の前に、乗る場所から D_nearby_dri… | IFC-02、IFC-24 | CUJ-01-A |
| FR-51 | AC2: 乗る場所を変えると、数え直す。 | IFC-02、IFC-24 | CUJ-01-A |
| FR-51 | AC3: しきい値を満たすドライバーが一人もいないとき、その旨と、しきい値を下げられること（FR-14）… | IFC-02、IFC-24 | CUJ-01-A |
| FR-52 | AC1: ドライバーが受付を始めると、受付・迎車・乗車が続く間、画面が自動で消えないようにする。 | IFC-18、IFC-26、IFC-27 | DRV-07 |
| FR-52 | AC2: 受付を終えて、迎車中でも乗車中でもなくなると、画面を消えないようにすることをやめる。 | IFC-18、IFC-26、IFC-27 | DRV-07 |
| FR-52 | AC3: ブラウザが裏に回ったあと前面に戻ると、もう一度画面が消えないようにする。 | IFC-18、IFC-26、IFC-27 | DRV-07 |
| FR-52 | AC4: ブラウザが画面を消えないようにすることに対応していない、または失敗したとき、画面が消えると依頼… | IFC-18、IFC-26、IFC-27 | DRV-07 |
| FR-53 | AC1: 記録してから T_pii_retention を過ぎた状態の履歴（FR-39）は、操作した人と… | IFC-10 | DRV-27 |
| FR-53 | AC2: ログに残る位置情報と個人情報は、記録してから T_pii_retention を過ぎると消す。 | IFC-10 | DRV-27 |
| FR-53 | AC3: 処理が途中で失敗したとき、次の処理で残りを続け、変えられなかった件数を記録する。 | IFC-10 | DRV-27 |
| FR-54 | AC1: 新しい配車依頼がドライバーの一覧に（FR-18）、状態の変化（許諾、迎車の到着、取り消し、降車… | IFC-05、IFC-08 | DRV-02 |
| FR-54 | AC2: ブラウザが裏に回っていた間の変化を、前面に戻ってから示したときは、裏から戻って示したという印を… | IFC-05、IFC-08 | DRV-02 |
| FR-54 | AC3: 同じ変化を同じ相手に二度目に示したときは記録しない。 | IFC-05、IFC-08 | DRV-02 |
| FR-54 | AC4: 通信が切れていて送れないとき、ブラウザに保持し、通信が戻ったら送る。 | IFC-05、IFC-08 | DRV-02 |
| FR-54 | AC5: テスト用アカウントの印を記録に残す（FR-01）。 | IFC-05、IFC-08 | DRV-02 |
| FR-55 | AC1: 毎日、前日の押さえ・請求（運賃、キャンセル料、不在の料金）・返金の記録を、決済のサービスの記録… | IFC-10、IFC-13、IFC-17 | DRV-04 |
| FR-55 | AC2: 一致しない依頼があると、その一覧をエンジニアと運営・サポート担当に知らせ、管理の画面のその依頼… | IFC-10、IFC-13、IFC-17 | DRV-04 |
| FR-55 | AC3: 決済のサービスから記録を取り出せないとき、その日の突き合わせを終えたと記録せず、エンジニアに知… | IFC-10、IFC-13、IFC-17 | DRV-04 |
| FR-55 | AC4: 突き合わせの結果は書き換えない。直した後にもう一度突き合わせると、新しい結果として追記する。 | IFC-10、IFC-13、IFC-17 | DRV-04 |
| FR-55 | AC5: テスト用アカウントの依頼も突き合わせ、印を結果に残す（FR-01）。 | IFC-10、IFC-13、IFC-17 | DRV-04 |

## 設計上の値

この段で決めた仮の値（どれも要合意）:

| 値 | 仮の値 | もと | 項目 |
|---|---|---|---|
| limit | 既定 20、最大 100 | 提案。画面の一覧の長さ | DEC-42 |
| 乗客とドライバーのセッション | 最後に使ってから 24 時間、長くても 7 日 | デモの回（3 時間）とデモ（1〜2 日）の間にログインし直さない | DEC-43 |
| 運営とエンジニアのセッション | 最後に使ってから 1 時間、長くても 8 時間。ログインごとにパスキー | 役割の操作の重さ（DEC-20） | DEC-43 |
| パスワードの長さ | 12 文字以上 | 提案（NIST SP 800-63B の考え方） | DEC-43 |
| ドライバーの設定の符号 | 英数 10 文字、24 時間、一度だけ | 運営・サポート担当が直接渡す | DEC-43 |
| T_idem_keep（最初の結果を保つ期間） | 7 日 | Stripe のキーの 24 時間より長く、デモ（1〜2 日）の送り直しをすべて覆う。T_pii_retention より短い | DEC-48 |
| T_op_stale（処理中を確かめ中とみなすまで） | 30 秒 | T_route で切られても続く処理の最長 13.0 秒（遅延の予算の計算）の 2.3 倍（DEC-12 が第 3 段階に任せた値） | DEC-48 |
| ブラウザの送り直し | ネットワークの誤り、タイムアウト、500、503 のときだけ、同じキーで 3 回まで（1、2、4 秒の間） | 409 OPERATION_IN_PROGRESS は Retry-After に従う。それでも分からなければ状態を読み直す | DEC-48 |
| ブラウザの要求のタイムアウト（SSE のほか） | 15 秒 | T_route（10 秒）に携帯の回線の 5 秒を足した（計算） | DEC-50 |
| 配信の無音の上限（ブラウザ） | 60 秒 | 生存確認 25 秒の 2 回分を少し超える | DEC-50 |
| チャットの Webhook | 1 回 5 秒、3 回まで送り直す（1、2、4 秒） | 提案。最悪 27 秒で NFR-33 の 5 分の内（計算） | DEC-50 |
| 毎日の処理の Stripe の呼び出し | 1 回 10 秒、読むだけは 3 回まで送り直す | 要求の外なので NFR-24 に縛られない | DEC-50 |
| 毎日の処理の Cloud Logging の読み出し | 1 回 30 秒、3 回まで | 提案 | DEC-50 |
| 配備と開け閉めの手順（IFC-11） | 手順ごとに 30 分（start-period は 60 分） | ジョブの一回の上限 45 分を待つ start-period のほかは数分で終わる | DEC-50 |
| 流れを断られたときの問い合わせ | 15 秒ごと | NFR-02 の 5 秒には届かないが、迎車と到着の流れを止めない最小の間隔として提案 | DEC-51 |
| T_hold_wait | 60 秒 | T_book（30 秒）の 2 倍。見回り（5 秒）で 10 回ほど確かめられる | DEC-52 |
| 毎日の処理の処理ごとの上限 | 確かめ中の片付け 5 分、突き合わせ 15 分、履歴の確かめと監視 5 分、SLI の集計 10 分、保存期間 5 分、記録と知らせ 2 分（合計 42 分） | 一回の上限 45 分の内（計算）。ふだんは数分 | DEC-53 |
| 一つ目の規則（a） | 5xx か 429 が 5 分で 5 件以上 | Turso に届かないと位置の送信だけで 1 分に 12 件の 503 が出るので、30 秒ほどで超える。ふだんの一時の誤り 1〜2 件では鳴らない | DEC-54 |
| 一つ目の規則（b） | インスタンスの数の指標が 10 分届かない | 最小 1 のインスタンスは 60 秒ごとに指標を出す。止まって入れ替わらないときを拾う | DEC-54 |
| 知らせをまとめる間隔 | 1 分（DEC-17 のまま） | NFR-33 の 5 分の内 | DEC-54 |
| アカウントの作成 | IP ごとに 1 時間に 5 件（DEC-21） | 第 2 段階 | DEC-55 |
| ログイン | 同じアカウントで 5 回続けて失敗すると 15 分止める（DEC-20）。IP ごとに 1 時間に 30 回 | 第 2 段階と提案 | DEC-55 |
| 場所の検索 | アカウントごとに 1 分に 30 回、1 日に 300 回 | 打つたびに呼ぶので 0.3 秒の間を置く。一回の手配で 20〜40 回 | DEC-55 |
| 見積もり | アカウントごとに 1 分に 10 回、1 日に 100 回 | 場所を変えるたびに計算し直す（FR-03 AC4） | DEC-55 |
| 手配の確定 | アカウントごとに 1 時間に 10 回 | デモの回の乗車は 1〜3 回（PC-05） | DEC-55 |
| 位置 | アカウントごとに 1 分に 12 回 | L_send 10 秒の 2 倍 | DEC-55 |
| 記録 | アカウントごとに 1 分に 60 回 | まとめて送るので十分 | DEC-55 |
| 確認コード | 一つの割り当てで 10 回違ったら止める | 4 桁の符号を当て推量で当てられないように | DEC-55 |
| そのほかの経路 | アカウントごとに 1 分に 120 回 | 提案 | DEC-55 |

この段の予算とタイムアウトが前提にしている第 2 段階の値は、P_tail 1 秒、生存確認 25 秒、流れの最長 30 分（DEC-03）、P_sweep 5 秒（DEC-04）、Stripe 1 回 2.5 秒と降車の確定の送り直し 2 回（DEC-12）、L_send 10 秒（DEC-14）、流れの本数 2・6・40（DEC-21）、地図 2 秒と到着予定の取り直し 60 秒（DEC-22）、T_route 10 秒と T_db 2 秒（DEC-33）、ジョブの一回 45 分とやり直し 1 回（DEC-17）。値を変えるのは第 2 段階で、この段はそれに従う。

## 指摘

この段への未解決の指摘はなかった（初めての実行）。第 2 段階への未解決の指摘（FND-19〜26）とこの段の関係は「第 2 段階の未解決の指摘との関係」に書いた。この段が出した指摘:

| FND | 出どころ | 判断 | 中身 |
|---|---|---|---|
| FND-28（出した、軽微） | この段 → `architecture-drivers-to-architecture` | 未解決 | DEC-03 の配信の出どころは状態の履歴だけだが、相手の位置（FR-10、11、24）、到着予定の取り直し（DEC-22）、ドライバーの停止（FR-47）は状態の履歴にない（DEC-15）。この段は出どころを足した（DEC-51）。Turso の読み出しはデモの回 1 回で 10,800 回から 32,400 回になる。また FR-19 の乗車場所までの所要時間の経路が DEC-22 の場面にないので足した。地図の呼び出しは 189 回から 198 回になる（計算）。構造は変わらず、記述と見込みのずれだけ |
| FND-29（出した、軽微） | 同上 | 未解決 | DEC-12 のお金の操作の表に、未払いを別の支払い手段で払う操作（FR-31 AC2）がない。この段は IFC-02 と IFC-13 で、キーを依頼と何回目かにし、成功は一度、試みは失敗と確定するたびに一つにした。表に足すのは第 2 段階 |

## 品質チェーンへの課題

| # | 課題 | 品質チェーンの項目 | 直し方の案 | 品質チェーンの段階 |
|---|---|---|---|---|
| 1 | FR-01 AC2 は、同じ連絡先のアカウントがあるときに理由を示すとする。これを示すと、メールアドレスを入れた人にアカウントがあるかどうかが分かる。デモの URL を公開する（レビューの質問 1）ので、誰でも試せる。IP ごとの作成の上限（DEC-21）で数は抑えるが、知られることは防げない。下書きは FR-01 AC2 のとおりに示す | FR-01、QR-20、DRV-29 | 示す文を「このメールアドレスでは作れません」のように有無の分からない形にするか、確かめのメールを送る機能を足す。または有無が分かることを受け入れると書く | 第 2 段階（FR-01）、第 3 段階（QR-20） |
| 2 | FR-50 AC4 は「返金に失敗したとき、やり直すときは同じキーを使う」とする。応答がなかったときの送り直しには正しい。一方、Stripe が返金を断ったと確定したときに同じキーで送ると、Stripe は同じ失敗を返す（キーは結果を保つ。Stripe の文書）ので、やり直しにならない。下書きは、確定した失敗の後のやり直しを新しい返金の要求（新しいキー）にした | FR-50、FR-30 | AC4 を「応答がなく送り直すときは同じキーを使う。失敗と確定した返金をやり直すときは新しい返金の要求にする」に直す | 第 2 段階（FR-50） |
| 3 | 第 2 段階の課題 1（押さえの結果が分からないときの扱いが FR-05 にない）に、この段の具体の形を足す。下書きは DEC-52 で、T_hold_wait（60 秒）まで確かめ、その間は乗客に「確かめています」と取り消しを示し、間に合わなければ押さえを解放して手配をやめたと示す。降車場所の変更（FR-12）も同じ | FR-05、FR-12、QR-07 | FR-05 と FR-12 に、この扱いを受け入れ基準として足す | 第 2 段階（FR-05、FR-12） |

第 2 段階の課題 1〜3・5〜7（3 は上で具体の形を足した）、第 1 段階の課題 1・3〜5、レビューの品質チェーンへの課題 1・2（SLI-03 の確かめのない分、参加者でない人の利用）は残る。

## 要合意

| 項目 | 合意すること | 承認者の候補 |
|---|---|---|
| DEC-42 | 一覧の limit（既定 20、最大 100） | 開発の責任者 |
| DEC-43 | セッションの長さ（乗客とドライバーは 24 時間・最長 7 日、運営とエンジニアは 1 時間・最長 8 時間とログインごとのパスキー）、パスワードの長さ、設定の符号 | 開発の責任者 |
| DEC-48 | T_idem_keep（7 日）、T_op_stale（30 秒）、ブラウザの送り直し（3 回まで、1・2・4 秒） | 開発の責任者 |
| DEC-50 | ブラウザ 15 秒、配信の無音 60 秒、チャット 5 秒と 3 回、毎日の処理の Stripe 10 秒と Cloud Logging 30 秒、配備の手順 30 分（start-period は 60 分）。Stripe の 2.5 秒が正常な遅い応答から決めた値でないこと（NFR-44 で測る） | 開発の責任者 |
| DEC-51 | 流れを断られたときの 15 秒ごとの問い合わせ。Turso の読み出しが 3 倍になること | 開発の責任者 |
| DEC-52 | T_hold_wait（60 秒）と、間に合わなければ手配をやめること（押さえられていた手配も取りやめになる） | プロダクトオーナー、開発の責任者 |
| DEC-53 | 毎日の処理の処理ごとの上限（合計 42 分） | 開発の責任者 |
| DEC-54 | 一つ目の規則の条件（5 分で 5 件、インスタンスの指標が 10 分ない）。サーバーの知らせと二度鳴りうること | 開発の責任者 |
| DEC-55 | 経路ごとの回数の制限の値。多くのアカウントと IP からの利用は抑えられないこと（FND-23 は第 2 段階） | プロダクトオーナー、開発の責任者 |
| IFC-01、02、03、05、06、08、10、17、19 | 上の値をそれぞれのインタフェースで使うこと | 開発の責任者（IFC-02、06 はプロダクトオーナーも） |

承認者の候補はどちらも開発者本人（STK-01）。

## 質問と回答

| # | 質問 | 下書きの答え | 回答 | 変わったこと |
|---|---|---|---|---|
| 1 | 第 2 段階に未解決の指摘が 8 件（中 3 件）あるまま、この段を進めるか | 進める。この段で決められる部分（FND-20・21・22・26 の一部）を先に閉じ、第 2 段階の再実行の後にこの段を追随させる | 下書きどおり（このまま進める） | YAML の項目と仕様書を書いた。第 2 段階の再実行の後に、変わりうる項目（IFC 8 件、DAT 2 件、DEC 2 件）でこの段を再実行する（「次へ」） |
| 2 | 押さえの結果が分からないとき、手配と降車場所の変更をいつまで確かめるか | T_hold_wait（60 秒）まで確かめ、間に合わなければ押さえを解放して手配をやめる（変更なら変えない）。乗客はその間取り消せる（DEC-52） | 下書きどおり（60 秒で打ち切る） | DEC-52 の選んだ案と T_hold_wait を確認済みにした（合意の記録があるまで下書き） |
| 3 | 前提 1: エラーの形とアカウントの作り方 | エラーは RFC 9457 に code、traceId、errors を足す（DEC-38）。乗客はメールアドレスとパスワードだけで作り、同じメールアドレスはその旨を示す（FR-01 AC2）。ドライバーは一度だけの設定の符号（24 時間）でパスワードを決める。最初の運営・エンジニアのアカウントは Secret Manager の一度だけの秘密で作る | 回答なし（選ばれなかった。推定のまま） | なし |
| 4 | 前提 2: セッション、写真、取り消し、一覧の配り方 | セッションは乗客とドライバーが 24 時間（最長 7 日）、運営とエンジニアが 1 時間（最長 8 時間）でログインごとにパスキー。顔写真は Turso に置く。取り消しは額を示してから確かめた額を送る（違えば 409）。ドライバーの一覧は SSE で丸ごと送る | 回答なし（選ばれなかった。推定のまま） | なし |
| 5 | 前提 3: お金、Stripe、回数の制限、地図 | 未払いは別の支払い手段で新しい PaymentIntent を自動で確定して払う（FND-29）。Stripe の顧客には内部の ID だけを送る（FND-26）。回数の制限はメモリで数え、作成とログインの失敗だけ Turso で数える。依頼の内容でドライバーから乗車場所までの経路を求める（FND-28） | 回答なし（推定のまま） | なし |

## 未解決の点

- 第 2 段階の未解決の指摘 FND-19〜26 と、この段の FND-28・29。第 1 段階の FND-27。答えによって「第 2 段階の未解決の指摘との関係」の項目が変わる。
- Cloud Run がブラウザの送った traceparent のトレース ID を入口の要求のログに使うか。入口のログが spanId を持つか。最初の配備で確かめる（DEC-44。違っても client_trace_id で結べる）。
- Stripe のテスト環境と Google Maps の正常な遅い応答（NFR-44 の確かめで測る。DEC-50）。
- 携帯の回線の区間の値（NFR-02 の予算。最初のデモの前の通しの確かめで SLI-02 を測る）。
- Google Maps Platform の規約の、経路と地点の内容をためておく制限（第 2 段階から持ち越し）。依頼の乗る場所と降りる場所の座標が Places の内容なら、DAT-06 の保持期間（T_pii_retention）より短い制限がかかりうる。
- チャットの種類（IFC-17 の形と IFC-19 の通知の経路）。
- R_fare の km と分の刻み、端数、消費税（DEC-41。丸めは料金のモジュール一か所）。
- 機能のしきい値（D_pickup_accuracy、D_arrival、D_dropoff、D_nearby_drivers、T_match_wait、T_noshow_wait、T_cancel_grace、V_moving、N_rating_levels、N_min_ratings）の値。値がなければ起動を止める（DEC-45）。
- iOS の Safari の Wake Lock、音、前面に戻ったときのつなぎ直し（実機で確かめる。NFR-20）。
- Turso の CLI の細かい形（IFC-22。第 4 段階）。

## 範囲外

- デモの開け閉め、復元、秘密の入れ替えの運用の手順書（第 2 段階から持ち越し）。設計は手順（IFC-11、IFC-12）と、その中の確かめまで。
- チャットの製品を選ぶこと。設計は中立の知らせの形（DEC-54）を決め、包みを一つにするまで。
- 法令と Google の規約の中身の確かめ（第 1 段階から持ち越し）。
- 参加者でない人の利用を許すかどうか（レビューの品質チェーンへの課題 2）。設計は回数の制限（DEC-55）まで。

## 次へ

1. 別の文脈で `design-review` を、この段（第 3 段階）について動かす。とくに、エラーの決まりと結果が分からないとき（IFC-02、03、06、13）、遅延の予算、持ち主（DAT-13 と DEC-05 の例外）、受け入れ基準のトレースを読んでもらう。
2. `architecture-drivers-to-architecture` を再実行し、FND-19〜26 とこの段の FND-28・29 を片付ける。第 1 段階の FND-27 は `requirements-to-architecture-drivers` を再実行する。そのあと、この段を再実行して「変わりうる項目」に追随する。
3. `high-level-design-to-detailed-design` を、コンポーネントごとに動かす。勧める順は、インタフェースを最も多く提供するサーバー ELM-04、毎日の処理 ELM-05、乗客の Web アプリ ELM-01、ドライバーの Web アプリ ELM-02、管理とエンジニアの画面 ELM-03、配備の仕組み ELM-06、手元の保守の手順 ELM-22。
4. 品質チェーンへの課題は、この段の 1〜3 が品質チェーンの第 2 段階（1 は第 3 段階も）に関わる。
