# 設計のレビュー: 配車サービスの概略設計（第 3 段階）

状態: 回答反映済み · 更新: 2026-11-13 · 入力の基準: 890bb9f · レビュー: b6feab9 からの差分のレビュー · 文脈: 別の文脈 · レビューした項目: 変わった DEC-35、DEC-42、DEC-44〜DEC-46、IFC-03、IFC-07、IFC-10、IFC-11、IFC-13、IFC-17、IFC-21、DAT-07、DAT-11〜DAT-13、DAT-20、DAT-26、HND-18（第 4 段階が状態と resolution を書いたもの）と、第 3 段階の報告の変わった節（概要、入力、設計の決定とインタフェースの注、SLI の出どころ、端から端の流れの CUJ-01、CUJ-03、CUJ-08、CUJ-15、DRV-01、DRV-07、遅延の予算とタイムアウト、画面の CUJ-01、CUJ-03、CUJ-08、CUJ-15、データ、要素をまたぐ状態、受け入れ基準のたどり、指摘、申し送り、決めたこと、未確認の仮定、次）。それにつながる DAT-01、DAT-05、DAT-06、DAT-08、DAT-09、DAT-14〜DAT-19、DAT-22、DEC-39、HND-16、HND-17、HND-19、IFC-01、IFC-12、IFC-14、IFC-24、IFC-25 は、活動が要る所を読んだ。共通の約束事が変わったため、B8 は IFC-01〜IFC-25 のすべて。指摘 FND-34〜FND-48、仮定 DAS-06、DAS-10〜DAS-16、QAS-25、QAS-32、QAS-33、QAS-54、品質チェーンへの要求 QCR-07、QCR-08

## 概要
第 3 段階の三度目のレビューで、前のレビュー（b6feab9。質問 1 の答えを当てた実行）からの差分のレビュー。第 3 段階は、第 4 段階の ELM-02 のレビューが出した中の指摘 FND-45 と、軽微の指摘 FND-36〜FND-41 を受け入れて項目を変えた（890bb9f）。このレビューは、その変わった項目と、それにつながる項目と報告の節を見た。設計を書いた会話とは別の文脈で、成果物だけを読んだ。指摘は 1 件で、軽微、`architecture-to-high-level-design` 宛て。尋ねた点はなく、前のレビューの決めたこと 1 はそのまま効いている。

- FND-49（軽微）: 報告の CUJ-08 の流れの最後の opt が、処理されなかった決済の後に同じ冪等キーでやり直しても新しい試みの結果を受けると描き、同じキーには同じ 503 PAYMENT_SERVICE_UNAVAILABLE を返す IFC-03 と DEC-42 に合わない。

重大か中の問題は見つからなかった。FND-45 を受けた変更は、EXT-01 が実行の前に退けた（処理されなかった）お金の操作の試みに、押さえ、押さえ直し、決済、返金、押さえの解除と料金の請求、支払い方法の登録のどれでも出口を持たせた。処理されなかったとするのは、試みの最初の状態を変える呼び出しを EXT-01 が実行の前に退けた答えだけで、同じキーの送り直しと確かめで受けたものと見分けられない答えは結果が分からないままなので、効いたかもしれない試みを済まなかったと示すことはなく、新しい試みを作ってもお金は一度だけ動く。外部を呼ぶ操作の 503 はキーの答えで、同じキーの送り直しは新しい試みを作らない。受けたインスタンスは EXT-01 の待ちを答えの期限から結果の取引の分を引いた時刻で終えるので、取引 A が予算を超えても期限までに答える。SLI-14 の区間は同じたどる ID の最初の要求から、SLI-12 は処理されなかった後に新しい試みで続けた処理を一つと数え、どちらも規則のとおり。残るリスクは、処理されなかったとする答えの範囲（DEC-45 の応答を左右する点。答えの一つ一つの分け方は第 4 段階の判断表）、結果の取引の遅い裾（DEC-42 の応答を左右する点）、処理されない原因が続く間の異常（DEC-45 の失うもの）で、どれも第 3 段階が項目に書いている。このレビューは品質チェーンへの要求を出しても答えてもおらず、反映を見つけた要求もない。

## 行ったことと結果
| # | 行ったこと | したこと | 結果 | 指摘 |
|---|---|---|---|---|
| B1 | 受け入れ基準のたどり | 変わった IFC（IFC-03、IFC-07、IFC-10、IFC-11、IFC-13、IFC-17、IFC-21）と変わった流れ（CUJ-01、CUJ-03、CUJ-08、CUJ-15、DRV-01、DRV-07）が担う FR の基準を見た。IFC-11 と IFC-03 だけで有効な FR の多くを担うため、受け入れ基準のたどりの表の 202 行すべてを、名指す IFC がその FR を functions に持つか、名指す符号、出来事、操作が IFC、DEC、DAT にあるか、指す流れの節があるか、行の数が FR の基準の数と合うかでスクリプトで確かめた。行の変わった FR-29 の 4、FR-39 の 2、FR-46 の 4、FR-50 の 3 と、処理されなかった試みの出口がかかわる FR-29、FR-30、FR-39、FR-40、FR-46、FR-54 の基準と、区間の始まりが変わった FR-53 の 1 と 2 を、IFC の操作と流れで読み直した | 202 行のどれも、名指す IFC がその FR を担い、符号、出来事、操作があり、指す節があり、行の数は有効な FR 53 の基準の数と合う。処理されなかった押さえは押さえられていないので依頼を受け付けない（FR-54 の 1）。処理されなかった決済は、済んでいないことと理由をドライバーと乗客に示し、ドライバーがやり直せるので、FR-29 の 4 を満たす（カードは拒否されていないので、乗客の支払い方法の変更を待たない）。処理されなかった返金は、済んでいないことと理由を担当者に示し、残りの額を確かめ直してやり直せ、済まなかったこととともに記録する（FR-39 の 2、FR-40 の 1、FR-50 の 3）。登録の読み出しが処理されなかったときは分からないとする（FR-46 の 4）。処理されなかった試みは何も実行していないので、料金を新しい試みで続けても一度だけ（FR-54 の 9）。SLI-14 の区間の始まりを変えても、示した時刻と示せなかった記録の操作（FR-53）は変わらない。たどれない基準はない | なし |
| B2 | 遅延の予算の計算し直し | 道に変わった IFC がある NFR-07 の予算（依頼の道の IFC-03、流れの IFC-11、流れの後の Web Push の IFC-21。どれも値は変わっていない）と、変わった失敗の流れ（受けたインスタンスが答える前に止まった取り消しと許諾の SLI-14 の区間）とエラーバジェットを、項目の値からスクリプトで計算し直した（「B2 遅延の予算の計算し直し」）。NFR-19 と NFR-34 の道（IFC-05、DAT-21、IFC-09）は変わっていない | 報告と合う。依頼の道は 7 ホップの 99.29 パーセンタイルで 4.10 秒と余裕 0.90 秒、ほかの変化は 5 ホップの 99.00 パーセンタイルで 2.00 秒と余裕 3.00 秒、流れの後の Web Push の道は 4.50 秒と余裕 0.50 秒、ふだんの示した時刻の報告は 1.5 秒で待ちの 2 秒より短い。止まったインスタンスの取り消しと許諾は、端末が 10 秒のタイムアウトの後に送り直して書き、同じたどる ID の最初の要求から数えると 11.0 秒以上（端末からの送りと記録を読む間隔を入れて 12.5 秒）で、悪いイベント 1 件として数えに残る。ウィンドウの乗車 2〜6 回では、悪いイベント 1 件がエラーバジェットの 111〜333% で、報告が NFR-07 自身の計算として挙げるとおり | なし |
| B3 | エラーの決まり | 変わった IFC の加わった誤り（IFC-03 の押さえ、押さえ直し、決済の 503 PAYMENT_SERVICE_UNAVAILABLE、IFC-07 の登録を始める 503 と読み出しが処理されなかった 202、IFC-13 の 503 と refundId と retry、IFC-17 の処理されなかったの分け方）と、DEC-35 の 503 の送り直しの決まり、DEC-45 の処理されなかった試みの出口を、報告の CUJ-01、CUJ-03、CUJ-08、CUJ-15、DRV-01、DRV-07 の流れと、DAT-07、DAT-11、DAT-12、DAT-05、DAT-08 の状態遷移図でたどり、何も起きていないと示す所を探した | どの場合にも信号と呼ぶ側のすることがある。処理されなかったとするのは、試みの最初の状態を変える呼び出しを EXT-01 が実行の前に退けた答え（鍵の 401、権限の 403、実行の前の 400）だけで、EXT-01 はそのキーに結果を残さない（報告の「入力」の Stripe の文書）。待ちのうちの同じキーの送り直し、確かめの読み出しと送り直しで受けたときと、見分けられない 400 は結果が分からないままなので、効いたかもしれない試みを済まなかったと示すことはない。何も押さえず請求していないと示すのは、EXT-01 が実行していないと答えたときだけ。処理されなかった試みの後の新しい試みは、済んだか結果が分からない試みを一つまでとする決まり（DEC-10、DEC-45）のまま二重にならず、外部を呼ぶ操作の 503 はキーの答えなので、同じキーの送り直しは新しい試みを作らない。押さえの解除と料金の請求は期限の処理が新しい試みで続け、鍵の誤りのように続く原因の間は異常が続く（DEC-45 の失うもの）。欠けは、報告の CUJ-08 の流れの最後の opt が、処理されなかった決済の後の同じキーのやり直しにも新しい試みの結果を答えると描き、IFC-03 と DEC-42（同じキーには同じ 503）と食い違うこと | FND-49 |
| B4 | タイムアウトの確かめ | 変わった IFC を含む道（お金の道の IFC-03、IFC-07、IFC-13 から IFC-17、NFR-07 の道の IFC-03、IFC-11 から IFC-21）のタイムアウトと待ちを、最初の呼ぶ側から最後の呼ばれる側まで、IFC-17 の加わった決まり（受けたインスタンスの EXT-01 の待ちを、最初に送ってから 8.5 秒と、answerDueAt から結果を書く取引の 0.1 秒を引いた時刻の早い方で終え、二回目の呼び出しのタイムアウトをその残りで切る）を入れてスクリプトでたどり、変わった申し送り HND-18 を読んだ | 順は端末と ELM-02 の 15 秒 ＞ ELM-03 の答えの期限 8.8 秒 ＞ EXT-01 の待ち 8.5 秒 ＞ 一回 4 秒のまま。取引 A が予算の 0.1 秒を超えても（0.3、0.5、1.0 秒）、結果を書く取引が予算のうちなら答えは answerDueAt の 8.8 秒まで。そのとき切られる二回目のタイムアウト（3.8、3.6、3.1 秒）は押さえのホップの予算 2.0 秒より長く、健全な呼び出しを切らない。結果を書く取引が 0.3 秒なら答えは期限の 0.2 秒後で、その間の送り直しの答えが残ることは DEC-42 の失うものと応答を左右する点にある。登録の読み直しの期限 8.7 秒は取引 A を数えていないが、同じ決まりで待ちが 8.6 秒に終わるので、予算どおりなら期限までに答える。決済の答えは期限の 8.8 秒（結果の取引が遅れても 9.0 秒）で、T_payment_response の 10 秒のうち。処理されなかった押さえの解除と料金の請求の新しい試みは確かめと同じ間隔（待ちの後 30 秒〜10 分ごと）で、期限の処理を拾う間隔 5 秒より長い。SLO のしきい値をタイムアウトにした所はない。HND-18 は第 4 段階が MOD-01 で決め（ELM-02 のタイムアウト 15 秒、DAS-16）、ELM-03 の期限（HND-19）を 10 秒より短くする枠は、DEC-46 の決め方と各 IFC の timing の枠のとおり | なし |
| B5 | 出来事のインタフェース | 変わった IFC-11 の ride.charge_settled（決済サービスが処理せず決済が済んでいないこと）を、届け方、重なりの扱い、順のかぎ、版で読んだ | 加わった中身は、決済の試みの結果を書く取引で出来事の記録に書く状態の変化で、ほかの出来事と同じに at-least-once で届き、eventId で重なりを捨て、一つの依頼の出来事は書いた順で、つなぎ直せば続きから届く。種類ごとの版 v と DEC-41 の扱いは変わらない。欠けはない | なし |
| B6 | データの実体 | 範囲の DAT-07、DAT-11、DAT-12、DAT-13、DAT-20、DAT-26 と、変わった IFC が読み書きする DAT-05、DAT-08、DAT-09、DAT-17〜DAT-19 の書き手、読む所、整合の取り方、保持期間、扱いの区分を読んだ | どれも書き手は ELM-03 だけ。加わった読み（DAT-20 の changeReceivedAt を作る取引が同じたどる ID の DAT-19 を読む、返金のやり直しの取引が DAT-12 と DAT-11 で残りの額を確かめ直す）は ELM-03 の中のもので、DAT-19 は受けたときに書くので、最初の要求の記録はその前にある。加わった属性（DAT-20 の traceId）は整合の取り方が使い、個人の情報でなく、区分は社内のまま。保持期間と区分は変わらない | なし |
| B7 | SLI の出どころ | 変わった出どころ（IFC-10 の SLI-14 の区間の始まりと項目の traceId、DAT-13 の SLI-12 の処理のまとめ方）と、範囲の IFC と DAT の出どころ（IFC-03 の SLI-01〜SLI-03、SLI-05、SLI-06、IFC-11 の SLI-01〜SLI-03、DAT-07 の SLI-08、SLI-09、DAT-11 の SLI-11）が処理されなかった試みをどう数えるかを、SLI の数える単位の出来事、見る位置、数え方の規則に照らした | SLI-14 の区間は、変化を書いた要求ではなく、同じたどる ID の境界の出来事のうち最も早く受けた時刻から始まる。DEC-42 と DEC-43 は利用者の一回の操作を一つの冪等キーとその送り直しとし（新しいキーは新しい操作）、規則の「システムがその操作を受けた時刻」をその最初の受けた時刻と読んだもので、数え方を変えない。DAT-19 は受けたときに書くので、止まったインスタンスが受けた最初の要求も残る。SLI-12 は、処理されなかった後に新しい試みで続けた処理を一つと数え（同じ処理を指すものは一つ）、処理されなかった試みだけで終わった処理は、システムの記録だけにある処理として GOOD でない（GOOD は両方にあるもの）。どちらも規則のとおり。SLI-01 と SLI-06 は 503 PAYMENT_SERVICE_UNAVAILABLE を含む操作を GOOD としない（自身の誤りも外部の失敗も GOOD でない）。SLI-11 は押さえられずに受け付けなかった依頼を外すので、処理されなかった押さえは入らない。欠けはない | なし |
| B8 | 共通の約束事 | 共通の約束事（DEC-35、DEC-42、DEC-44）が変わったため、IFC-01〜IFC-25 のすべての符号と状態の組、ヘッダー、503 の扱い、冪等キーを、変わった約束事に照らし、符号と状態の組をスクリプトで並べ、DEC-35、DEC-42、DEC-44 と POL-04 の境を読んだ | 誤りの信号に書かれた 60 の符号（項目の誤りの符号を含む）は、どれも状態の組が一つ（PAYMENT_SERVICE_UNAVAILABLE は IFC-03、IFC-07、IFC-13 で 503）。最初の答えを示すヘッダーは X-Idempotent-Replayed で DEC-44 の決まりに合い、古い名前を使う IFC、DEC、DAT、MOD はない。冪等キーのある操作で外部を呼ぶのは、EXT-01 を呼ぶ IFC-03 の四つ、IFC-07 の二つ、IFC-13 の二つだけで、その 503（PAYMENT_SERVICE_UNAVAILABLE、HOLD_UNCONFIRMED、REHOLD_UNCONFIRMED）の呼ぶ側のすることは、どれも同じキーで送り直さず新しいキーでし直すとし、DEC-35 に合う。MAP_SERVICE_UNAVAILABLE は冪等キーのない読むだけの操作にだけある。共通の約束事は、エラーを渡す所、ログの書き方、設定と秘密の値、文言の置き場所を POL-04 に残したまま。変わった約束事から外れる IFC はない | なし |
| B9 | 要素をまたぐ状態 | 変わった状態遷移図（DAT-07、DAT-11、DAT-26、DAT-12、DAT-05、DAT-08）を、処理されなかった試みの移り先と、お金がまだ動きうる状態を終わりにしていないかで確かめた | DAT-11 の not_processed は何も実行されていない終わりで、確かめで受けたときは unknown のままなので、お金が動きうる試みを終わりにしない。DAT-07 は、押さえが処理されなかった依頼を not_accepted に移し、決済が処理されなかった依頼を destination_arrived にとどめてドライバーのやり直しを出口にし、押さえの解除と料金の請求が処理されなかった終わりの状態は、moneySettled が偽のまま期限の処理の新しい試みで出る。DAT-12 は refund_failed に移り、出口は担当者のやり直し。DAT-08 は not_applied に、DAT-05 は abandoned に移る。行き止まりも、お金を隠した終わりの状態もない | なし |
| B10 | 仕様書と IFC | 変わった IFC を POL-05 の項に照らし、HND-16 を読んだ | ELM-03 が提供する変わった IFC（IFC-03、IFC-07、IFC-10、IFC-11、IFC-13）は一つ目の項（コードから生成）で、HND-16 が origin と bounds（DEC-35〜DEC-45）でスキーマを実装に送る。IFC-17 と IFC-21 は持ち主の文書の項。ifc/specs/ は空のまま。食い違いはない | なし |
| E1 | 指摘を読む | 状態が変わった FND-36〜FND-41、FND-45（どれも受け入れ）と、加わった FND-42〜FND-44、FND-46〜FND-48 を読み、受け入れた指摘の変更が項目にあるかを確かめた。この報告の道で出した未解決の FND-34 は確かめずに挙げ直す | FND-36（IFC-10、DAT-20）、FND-37（IFC-17、DEC-42、DAT-26）、FND-38（IFC-11、IFC-21、DEC-46 の premises）、FND-39（DEC-42、DEC-44）、FND-40（報告の DRV-01 の流れ）、FND-41（IFC-21、IFC-10）、FND-45（DEC-35、DEC-45、IFC-03、IFC-07、IFC-11、IFC-13、IFC-17、DAT-07、DAT-11〜DAT-13 と、報告の流れ、画面、状態遷移図）の変更はどれも項目にあり、変えた項目の basis_note が引く。加わった指摘は第 2b 段階（FND-42）と第 4 段階（FND-43、FND-44、FND-46〜FND-48）宛てで、第 3 段階の項目を対象にしない。第 3 段階が第 2 段階に出した FND-35 は今も成り立つ。前のレビューの後に退けられた指摘はなく、項目の値が前の値に戻ったものもない（status.py の --since b6feab9） | なし |
| E2 | 前提の確かめ | 範囲の項目の本文と assumptions が頼る DAS、QAS、共有する事実、品質チェーンへの要求を、premises と照らした | IFC-11 は QAS-25 と QAS-54 を、IFC-21 と DEC-46 は QAS-54 を挙げ（FND-38）、IFC-10、DAT-20、IFC-11、IFC-21、DEC-46 は QAS-54 の答え（決めたこと 1、QCR-08）を basis_note に引く。IFC-10 と DAT-20 は、ほかに未確認の仮定がなく推定。DEC-45 が加えた想定（EXT-01 は実行の前に退けた要求のキーに結果を残さない）は Stripe の文書によるもので、DEC-45 は EXT-01 を挙げる。DAS-10 は処理されなかった解除と料金の請求の新しい試みの間隔を含む。IFC-03 は QCR-07 を挙げる。欠けはない | なし |
| E3 | 仮定の評価し直し | ファイルが変わった DAS-10、加わった DAS-16 と、変わった項目（第 4 段階の MOD-01〜MOD-19 を含む）が premises で名指す DAS-06、DAS-11〜DAS-15、QAS-25、QAS-32、QAS-33、QAS-54 を、依存する項目と後の段階への影響から評価し直し、範囲の項目が依存する未回答の品質チェーンへの要求 QCR-07 の影響を見直した | DAS-10（DEC-46、IFC-17）は、新しい試みの間隔を含めても、外れれば試みが増えるか遅れるだけでお金は二重に動かず、中、低のまま。DAS-11（DEC-46、IFC-05、IFC-11、IFC-19）、DAS-12（DAT-13、DEC-46、IFC-15）、DAS-14（DEC-39、DEC-42）、DAS-15（DEC-46、IFC-11、IFC-21）は中、低、DAS-13（DEC-42）は低、低、DAS-06（DEC-09、ELM-05、IFC-17）は中、中のまま。DAS-16（第 4 段階、MOD-01。ELM-03 の期限を 10 秒より短くする枠を HND-19 に足す）は中、低のまま。QAS-25（DEC-46、DRV-03、IFC-11）、QAS-32、QAS-33 は中、低。QAS-54 は依存する項目が七つで高、中だが、決めたこと 1 で尋ねて成り立つと答えを受けており、尋ね直さない。高のものはほかになく、尋ねた点はない。QCR-07 は、答えが違っても境界の出来事の同じ項目から数え、DEC-35 の変更（外部を呼ぶ操作の 503 は同じキーで送り直さない）でもそれは変わらないので、低のまま | なし |
| E4 | 事業の判断の確かめ | 範囲の項目の暫定の設計上の値、リスクを受け入れる決定、確定の種類か高の点の先送り、変わった申し送り HND-18 を読んだ。前のレビューの後に第 3 段階が退けた指摘はない | 加わった値は、処理されなかった解除と料金の請求の新しい試みの間隔（確かめと同じ値、DAS-10）と、待ちを切る結果の取引の予算 0.1 秒（DEC-46 の値、DAS-11）で、どちらも DAS にある。DEC-42 が答えの期限に余裕を足さず、結果の取引が遅れたときに送り直しの答えが残ることを失うものとしたのは、お金が二重に動かない作りの中の引き換えで、事業のリスクを受け入れる決定ではない。DEC-45 が答えの一つ一つの分け方を第 4 段階の判断表に残すことは前からあり、第 4 段階の確定の種類（結果が分からない状態を確かめる判断表）が受け持つ。HND-18 は第 4 段階が決めた | なし |
| E5 | 写しを探す | 変わった項目の加わった文を、品質チェーンの statement、受け入れ基準、SLI の定義、共有する事実の値と照らした | 写しはない。IFC-03、IFC-13、DEC-45 は FR を ID と基準の番号で引き、DAT-13 は SLI-12 の数え方の規則を短い名で引いて、それをどう実現するかを書く | なし |
| E6 | 確かめを求める点 | 確かめた項目が変わった HND-01（IFC-03、IFC-17）と HND-02（DAT-07）を読んだ。品質チェーンの項目の basis_note と、確かめを求める申し送りは変わっていない | IFC-03 と IFC-17 の basis_note は今も HND-01（決済の答えの期限 8.8 秒が T_payment_response のうち）を確かめ、IFC-17 の加わった決まりでも答えは期限までで、結果の取引が遅れても 9.0 秒。DAT-07 は HND-02（二つの位置は WGS84）を確かめたまま | なし |
| E7 | 申し送りの確かめ | 第 3 段階が書いて変わった HND-18 を、第 3 段階の確定の種類と bounds に照らした | HND-18 は、第 4 段階が状態と resolution を書いただけで、what、bounds、origin は変わらない。ELM-02 の呼び出し（IFC-01、IFC-10、IFC-12、IFC-14）は時間のしきい値の SLO の道にもお金を動かす道にもなく（返金の IFC-13 は第 3 段階が値を持つ）、第 3 段階の確定の種類でない。bounds は両立し、第 4 段階はその中で決めた | なし |
| E8 | 品質チェーンのものを決めていないか | 変わった項目と予算を、ゲート、目標、しきい値、受け入れ基準、SLI の数え方の変更を探して読んだ | ない。SLI-14 の区間の始まり（IFC-10、DAT-20）と SLI-12 の処理のまとめ方（DAT-13）は、どちらも規則を実現するもので、数え方を変えない（B7）。予算はしきい値を分けるだけ | なし |

### B2 遅延の予算の計算し直し
項目の値（DEC-46 の parameters、IFC-03、IFC-07、IFC-11、IFC-13、IFC-17、IFC-21 の timing、DEC-46 の応答を左右する点の押さえのホップ）から、このレビューのスクリプト（作業用で、リポジトリには置かない）で計算し直した出力。

```text
### NFR-07 (normal paths; IFC-03, IFC-04, IFC-11, IFC-21 values unchanged in this diff)
== request -> driver list (hold inside): hops 7, per-hop percentile 99.29; hops 4.10 + fixed wait 0.00 = 4.10 s; threshold 5.00; margin 0.90 -> fits
== accept / cancel / other accept / pickup arrival -> counterpart: hops 5, per-hop percentile 99.00; hops 2.00 + fixed wait 0.00 = 2.00 s; threshold 5.00; margin 3.00 -> fits
== stream open, no display time within the wait -> Web Push: hops 5, per-hop percentile 99.00; hops 2.50 + fixed wait 2.00 = 4.50 s; threshold 5.00; margin 0.50 -> fits
   normal display report after the stream write: 1.5 s < wait 2.0 s: True
### NFR-07 failure path changed in this diff: receiving instance stopped before writing a cancel or accept
   first request at 0.0 s; device re-sends after 10.0 s; shown at >= 11.0 s (lower bound, as the report) or about 12.5 s with the up-link and the log read
   interval counted from the earliest receipt of the same trace ID (IFC-10, DAT-20): 11.0 s > 5.0 s -> one bad event, not dropped
   window with 2 rides: valid 6, budget 0.30 events; one bad = 333% of the budget
   window with 6 rides: valid 18, budget 0.90 events; one bad = 111% of the budget
### money path (IFC-03, IFC-07, IFC-13, IFC-17)
   EXT-01 user-facing wait from the first send: 4.0 + 0.5 + 4.0 = 8.5 s (IFC-17): True
   answer deadline (hold, re-hold, payment, refund) = answerDueAt: 8.8 s; payment vs T_payment_response 10 s: margin 1.2 s
   registration completion answer deadline: 8.7 s
   device and ELM-02 timeouts 15 s > deadline + allowance 13.8 s: True
   order: 15 > 8.8 > 8.5 > 4.0: True
   new IFC-17 rule: the wait ends at min(first send + 8.5, answerDueAt - result txn 0.1)
   hold/payment/refund      txn A 0.1, result txn 0.1: first send 0.2, wait ends 8.7, 2nd call timeout 4.0, answer 8.8 vs answerDueAt 8.8 -> by answerDueAt
   hold/payment/refund      txn A 0.3, result txn 0.1: first send 0.4, wait ends 8.7, 2nd call timeout 3.8, answer 8.8 vs answerDueAt 8.8 -> by answerDueAt
   hold/payment/refund      txn A 0.5, result txn 0.1: first send 0.6, wait ends 8.7, 2nd call timeout 3.6, answer 8.8 vs answerDueAt 8.8 -> by answerDueAt
   hold/payment/refund      txn A 1.0, result txn 0.1: first send 1.1, wait ends 8.7, 2nd call timeout 3.1, answer 8.8 vs answerDueAt 8.8 -> by answerDueAt
   hold/payment/refund      txn A 0.3, result txn 0.3: first send 0.4, wait ends 8.7, 2nd call timeout 3.8, answer 9.0 vs answerDueAt 8.8 -> after by 0.2 s
   registration completion  txn A 0.1, result txn 0.1: first send 0.2, wait ends 8.6, 2nd call timeout 3.9, answer 8.7 vs answerDueAt 8.7 -> by answerDueAt
   registration completion  txn A 0.3, result txn 0.1: first send 0.4, wait ends 8.6, 2nd call timeout 3.7, answer 8.7 vs answerDueAt 8.7 -> by answerDueAt
   registration completion  txn A 0.5, result txn 0.1: first send 0.6, wait ends 8.6, 2nd call timeout 3.5, answer 8.7 vs answerDueAt 8.7 -> by answerDueAt
   registration completion  txn A 1.0, result txn 0.1: first send 1.1, wait ends 8.6, 2nd call timeout 3.0, answer 8.7 vs answerDueAt 8.7 -> by answerDueAt
   registration completion  txn A 0.3, result txn 0.3: first send 0.4, wait ends 8.6, 2nd call timeout 3.7, answer 8.9 vs answerDueAt 8.7 -> after by 0.2 s
   healthy EXT-01 hold hop budget 2.0 s < shortest cut 2nd call timeout above: True
   checks and new attempts for not-processed releases and fee captures: [30, 60, 120, 240, 480, 600] s after the wait, then every 600 s; pickup 5 s <= 30 s: True
```

予算の数と余裕、止まったインスタンスの失敗の流れ、エラーバジェット、お金の道の期限と順は報告と合う。報告の計算は止まったインスタンスの区間の下限（11.0 秒）だけを示すが、端末からの送りと記録を読む間隔を足しても同じく悪いイベント 1 件になる。登録の読み直しは、報告の期限 8.7 秒が取引 A を数えていないため、取引 A を 0.1 秒とすると待ちは最初の読み出しから 8.4 秒で終わり、二回目の読み出しが 3.9 秒に切られる。それでも答えは期限までで、押さえのホップの予算より長いので、指摘にしない。

## 指摘
<!-- generated: findings -->
| FND | 名前 | 重さ | 宛先 | 対象 |
|---|---|---|---|---|
| FND-34 | 境界の SLI を ELM-03 の入口の記録だけで数えるため、ELM-03 が止まっている間にプラットフォームが答えた操作がどこにも数えられない | 軽微 | architecture-drivers-to-architecture | DEC-23 |
| FND-49 | 報告の CUJ-08 の流れが、処理されなかった決済の後に同じ冪等キーでやり直しても新しい試みの結果を受けると描く | 軽微 | architecture-to-high-level-design | IFC-03 |
<!-- /generated -->

この報告の道で出した未解決の指摘は、このレビューの FND-49 と、前の全体のレビューの FND-34（第 2 段階宛て）。前のレビューの FND-36〜FND-40 は受け入れられた。退けられて出し直さなかった指摘はない。

## 決めたこと
| # | 質問 | 回答 | 項目 |
|---|---|---|---|
| 1 | 品質チェーンの QAS-54 のとおり、依頼、許諾、取り消し、迎車の到着を相手の画面に示した時刻を記録する機能（FR-53）を今期作るとしてよいか。 | 作る。QAS-54 は成り立つ（下書きどおり。試行の模擬回答） | QAS-54、QCR-08、E3、DRV-03、DRV-26、IFC-10、IFC-11、IFC-21、DAT-20、DEC-46、HND-17 |

決めたこと 1 は前のレビューが尋ねたもので、今も効いている。答えは QCR-08（回答済み）が品質チェーンの第 2 段階に運び、品質チェーンが当てるまで、QAS-54 を premises に挙げる項目は QAS-54 を前提に残したまま basis_note でこの答えを引く（第 3 段階の IFC-10、IFC-11、IFC-21、DAT-20、DEC-46 は引いた。第 1 段階の DRV-03、DRV-26 は、その段階が次に走るときに引く）。このレビューは質問をしていない。

## 未確認の仮定
<!-- generated: assumptions -->
| ID | 名前 | 種類 | 影響の広さ | 重大さ | 依存する項目 |
|---|---|---|---|---|---|
| QAS-54 | 状態の変化を相手の画面に示した時刻の記録（FRP-11）を今期作る | 暫定の決定 | 高 | 中 | DAT-20、DEC-46、DRV-03、DRV-26、IFC-10、IFC-11、IFC-21 |
| DAS-13 | 端末が送り直す操作は 24 時間のうちに送られるとみて、冪等キーを 24 時間持つ | 暫定の決定 | 低 | 低 | DEC-42 |
| DAS-10 | EXT-01 への呼び出しのタイムアウト、同じキーでのやり直し、待ち、確かめの間隔を暫定に採る | 暫定の決定 | 中 | 低 | DEC-46、IFC-17 |
| DAS-11 | 端末、通信、自身の処理の時間と、流れ、位置、着く見込みの間隔を暫定に採る | 暫定の決定 | 中 | 低 | DEC-46、IFC-05、IFC-11、IFC-19 |
| DAS-12 | 日々の処理の時刻と照合で読む期間、期限の来た処理を拾う間隔を暫定に採る | 暫定の決定 | 中 | 低 | DAT-13、DEC-46、IFC-15 |
| DAS-14 | 一覧の既定と最大の件数と、動いているキーへの送り直しに待たせる時間を暫定に採る | 暫定の決定 | 中 | 低 | DEC-39、DEC-42 |
| DAS-15 | 流れで送った変化を Web Push でも知らせるまでの待ちと、Web Push を送る呼び出しと配信の時間を暫定に採る | 暫定の決定 | 中 | 低 | DEC-46、IFC-11、IFC-21 |
| QAS-25 | 依頼の状態の変化を届ける速さのしきい値と最初の目標値 | 暫定の決定 | 中 | 低 | DEC-46、DRV-03、IFC-11 |
| QAS-32 | 決済の記録と決済サービスの処理の一致の最初の目標値と突き合わせの時点 | 暫定の決定 | 中 | 低 | DAT-13、DRV-07、IFC-15 |
| QAS-33 | 決済の結果を示すまでの速さのしきい値 | 暫定の決定 | 中 | 低 | DEC-46、DRV-07、IFC-03 |
| DAS-06 | EXT-01 のテスト環境で、後で確定する押さえ、一部の確定、取り消し、返金を円で使える | 判断 | 中 | 中 | DEC-09、ELM-05、IFC-17 |
<!-- /generated -->

第 3 段階の項目と、この報告の道で出した指摘が premises で名指す未確認の仮定で、影響の広さと重大さは E3 で評価し直したとおり。DAS の評価は変えていない。QAS の値は品質チェーンのファイルには書かず、ここに示す（QAS-54 は影響の広さを高とし、決めたこと 1 で尋ねて成り立つと答えを受けた。品質チェーンが QCR-08 を当てるまで、QAS-54 は品質チェーンでは未確認のまま。QAS-32 は、外れても照合の時刻と読む期間（DAT-13、IFC-15）を直すだけなので、重大さを低とした）。このレビューが書いた仮定はなく、指摘はどの仮定にも頼らない。第 4 段階の DAS-16 は第 3 段階の項目が依存しないため、この表にないが、E3 で評価し直した（中、低のまま）。

## 未解決の点
- `scripts/check.py` は、レビューを始めたとき、範囲の項目（第 3 段階）に問題を報告せず、IFC-22 の functions の FR-05 と FR-45 がその提供側の ELM-01 にないことを FND-35 待ちとして示した。範囲の外では、生成する表が古いことを `requirements-to-architecture-drivers`（1-architecture-drivers.md）、`architecture-drivers-to-architecture`（2-architecture.md）、`architecture-to-technical-policy`（2b-technical-policy.md）、`high-level-design-to-detailed-design`（4-detailed-design/ELM-02.md）に 1 件ずつ、`design-review` に 2 件（この報告と reviews/4-detailed-design-ELM-02.md）報告した。`design-review` の 2 件は、このレビューが `scripts/tables.py` で直した（reviews/4-detailed-design-ELM-02.md は、受け入れられた FND-45 が未解決の指摘の表から外れ、QAS-54 と QAS-25 に依存する項目が増えたため）。今は、ほかの 4 件に加えて `architecture-to-high-level-design` に 1 件（3-high-level-design.md の指摘の表が古い。このレビューが FND-49 を出したため）を報告し、それぞれの段階が次の実行で `scripts/tables.py` を走らせれば直る。
- このレビューも、第 3 段階の報告が引く公開の文書（Stripe、Google Maps Platform、RFC 8030、RFC 8291、RFC 8292）を読み直していない。B3 の処理されなかったの分け方（EXT-01 は実行の前に退けた要求のキーに結果を残さない）、同じキーで送り直した登録の取引が同じものを返すこと（DEC-45）、Web Push の送り直し（IFC-21）は、報告と項目に書かれたその中身に頼る。
- 予算のホップとタイムアウトの値（DAS-10、DAS-11、DAS-15）、DAS-03（ホーム画面に加えた Web アプリの振る舞い）、DAS-06（Stripe のテスト環境で使える機能）は、実機とアカウントでしか確かめられず（何も配備しない、TC-09）、このレビューも確かめていない。リリースの前に測るゲートは QCR-06 で品質チェーンに求められている。
- 変わっていない所に、重大に見える問題は見つからなかった。
