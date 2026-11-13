# 設計のレビュー: 配車サービスの詳細設計（第 4 段階、ELM-03 配車サーバー）

状態: 回答反映済み · 更新: 2026-11-14 · 入力の基準: 32d40c9 · レビュー: ddc4894 からの差分のレビュー · 文脈: 別の文脈 · レビューした項目: 変わった MOD-26、MOD-45、MOD-56、MOD-58、MOD-59 と、ELM-03 の報告（4-detailed-design/ELM-03.md）の変わった節（概要、入力、モジュールの段落、型の ReholdInProgress、RideMoneyFacts、MoneyChange、MOD-26 の並行性とエラー、MOD-45 の判断表 C とその段落、MOD-56 の押さえ直しの印と「期限の後の答えと遅れた結果の取引の順」と判断表 C の found_late の行と並行性とエラー、MOD-58 の期限の後の答え、MOD-59 の期限の後の答えと並行性とエラー、データの rides の行と取引の表、確かめ方の「遅れた結果の取引と期限の後の答え」、指摘、決めたこと、次）、詳細設計の索引の見出し。つながる項目は、変わった契約を使う所と状態を分ける所を読んだ（MOD-26 の registerRoute に期限の後の答え方を登録する MOD-43 と MOD-57、MOD-42 の sendWaiting と結果の取引と判断表 B、C、MOD-45 の settleHold、MOD-56 の判断表 B、D、E、MOD-59 の判断表 A）。確かめに使った入力の DEC-08、DEC-42、DEC-45、IFC-03、DAT-07、DAT-08、DAT-11、DAT-26、POL-02、POL-03、FR-04、FR-46、FR-47、FR-54、DRV-02、DRV-07、SLI-01 は、どれも前のレビューの後に変わっておらず、行ったことが要る所を読んだ。指摘 FND-61、FND-66、FND-74〜FND-76（E1）、仮定 DAS-23（E3）

## 概要
第 4 段階の ELM-03（配車サーバー）の 3 回目のレビューで、前のレビュー（ddc4894）からの差分のレビュー。設計を書いた会話とは別の文脈で、成果物だけを読んだ。範囲は、この段階が中の FND-75 と軽微な FND-76 を受け入れて変えた五つのモジュール（MOD-26、MOD-45、MOD-56、MOD-58、MOD-59）、ELM-03 の報告と索引の見出し（32d40c9）。前のレビューの後に docs/quality/、前の段階の項目、申し送りは変わっていない。

指摘は 2 件で、中 1 件、軽微 1 件、どちらも `high-level-design-to-detailed-design` 宛て。

- FND-77（中）: FND-75 の直し方で、MOD-26 は持ち主の期限の後の答え方を answerOverdue の一つの取引の中で呼ばない形に決め、持ち主の書き込みの取引とキーの書き込みは別の取引になった。押さえ（MOD-58）で、期限の後の答えが依頼を not_accepted にした後、キーを書く前に受けたインスタンスの遅れた結果の取引が押さえを済ませて確定すると、その取引の答えを決める行がなく、MOD-58 の post のとおり 201 がキーに残る。送り直しと受けたインスタンスはどちらも 201 を受け、依頼は not_accepted のまま押さえは解かれる（FR-04 の 1、FR-54 の 3、IFC-03、DRV-02。お金は動かない）。
- FND-78（軽微）: MOD-56 に加えた不変条件は依頼の今の押さえを解くのを ended と decide に限るが、MOD-45 に加えた不変条件では受け付けなかった依頼の今の押さえは押さえの試みで、MOD-58 の期限の後の答えと判断表 C が found_late で解く。報告の「データ」の rides の行は受け付けた依頼に限っており、こちらと合う。

受け入れた 2 件の変更はどちらも項目にある。FND-75 の順（遅れた結果の取引が送り直しの check の後、期限の後の答えの前に確定する）は、押さえ、支払い方法の変更、降りる場所の変更の承認のどれでも閉じ、期限の後の答えは遅れた結果の取引が書いた依頼の今の押さえ、受け付けた依頼、当てた変更を覆さない。FND-76 で、押さえ直しの印と今の押さえを読み書きするのは rides の持ち主の MOD-45 の操作だけになった。主なリスクは、FND-75 の直し方が持ち主の期限の後の答えとキーの書き込みを別の取引にしたことで、押さえでは、その間に確定した遅れた結果の取引の答えが、期限の後の答えの書いた依頼と食い違いうること（FND-77）。押さえ直しの二つの経路は、印がこの試みでない行が同じ間で 503 REHOLD_UNCONFIRMED と答えるので合う。質問はなく、仮定は書いておらず、品質チェーンへの要求は出しても答えても反映を見つけてもいない。

## 行ったことと結果
| # | 行ったこと | したこと | 結果 | 指摘 |
|---|---|---|---|---|
| C1 | 割り当ての確かめ | 範囲のモジュール（変わった MOD-26、MOD-45、MOD-56、MOD-58、MOD-59 と、MOD-26 の registerRoute につながる MOD-43、MOD-57）の functions、realizes、verification を報告の割り当てと照らした。変わった受け入れ基準、利用する操作、SLI の出どころはない | どのモジュールも functions と realizes は変わらない。加わった確かめ方の行が挙げる FR（MOD-56 の FR-46 の 5 と FR-54 の 5、MOD-59 の FR-47 の 2 と FR-54 の 4、5、報告の場面の FR-54 の 3〜5、FR-46 の 5、FR-47 の 2）は、それぞれのモジュールの functions にある。MOD-45 に加わった moneyFacts、claimRehold、clearRehold はモジュールの中の操作で、IFC の操作の受け持ちを変えない（check.py も、提供する操作がどれも一つのモジュールに当たることを確かめた） | なし |
| C2 | モジュールの深さ | 変わった五つのモジュールの depth、depth_reason と部分を見た | どれも確定のまま理由が成り立つ（MOD-45 は加わった印の操作でも同時に動く仕事と状態を分ける）。加わった操作はどれも事前条件、事後条件、誤りを持ち、MOD-45 の判断表 C、不変条件、確かめ方に印が加わり、MOD-56、MOD-58、MOD-59 の期限の後の答えの契約と確かめ方がそろう。欠けた部分はない | なし |
| C3 | 状態遷移図 | 範囲のモジュールの状態遷移図（MOD-45 の依頼、DAT-08 に従う MOD-59 の変更）と、押さえ直しの印（空、この試みで答えの期限のうち、期限の後）を、加わった出来事（claimRehold、clearRehold、押さえを替える applyMoney、期限の後の答え、遅れた結果の取引、確かめで分かった結果）がどの状態でも定まるか、出口があるかで見た。押さえの holding から not_accepted への矢印と、not_accepted の依頼に遅れて済んだ押さえも見た | 印はどの状態でもどの出来事にもすることがあり（MOD-45 の判断表 C の四つの行と applyMoney の条件）、期限の後の答え、結果の取引、確かめのどれかが空にし、空にされなくても期限の後は効かない。変更は reholding から期限の後の答えか結果の取引で applied か not_applied に着き、applied の変更への期限の後の答えは何も変えない。not_accepted の依頼に遅れて済んだ押さえは、MOD-45 の判断表 C のとおり状態を変えずに MOD-56 が解き、状態は定まる（そのときの受けたインスタンスの答えは C6） | なし（FND-77 は C6） |
| C4 | 判断表 | 変わった判断表（MOD-45 C の印を取る行と空にする行、MOD-56 C の found_late の行）の組を数え、上から当てる表は順も見た | MOD-45 C の claimRehold は、印（空、この試み、ほかの試み）と答えの期限（今以前、今より後）の組のうち、空と、どの試みの印でも期限が今以前の組が 1 行目に、ほかの試みで期限が今より後の組が 2 行目に当たる。この試みで期限が今より後の組はどの行にも当たらないが、claimRehold は同じ取引 A で作った試みで呼ばれ、印がその試みであることはない。clearRehold は三つの印に一行ずつ当たる。MOD-56 C は、済んだ押さえ直しの押さえがその取引で読んだ依頼の今の押さえなら found_late の行に当たらず最後の行（結果を書くだけ）に当たり、ほかの組は前のとおり一行に当たる | なし |
| C5 | モジュールの依存 | 変わったモジュールへの依存とそこからの依存を、報告の図の機能のディレクトリと POL-02 の規則に照らした。加わった呼び出し（MOD-56 から MOD-45 の moneyFacts、claimRehold、clearRehold、MOD-58 から MOD-45 の moneyFacts、MOD-59 から MOD-56 の rehold を通した claimRehold）と、rides の列を読み書きする所を見た | depends_on は変わらず、加わった呼び出しはどれも前からある依存の中で、booking/ から charges/ と rides/ へ、charges/ から rides/ への下向き。押さえ直しの印と今の押さえを読み書きするのは rides/ の MOD-45 の操作だけになり、FND-76 の、charges/ が rides の列を読み書きする道はなくなった（POL-02 の表の規則、DEC-08 のポート）。循環はない（check.py） | なし |
| C6 | 並行性と冪等性 | 変わった期限の後の答え（MOD-56、MOD-58、MOD-59）と MOD-26 の answerOverdue を、受けたインスタンスの遅れた結果の取引、確かめ、ほかの押さえ直しと重ねた。押さえ、支払い方法の変更、降りる場所の変更の承認の三つの経路の四つの結果と、持ち主の取引（T1）、遅れた結果の取引（T2）、MOD-26 のキーの書き込み（T3）の三つの順を、項目の決まりでスクリプトでたどった（「C6 期限の後の答えと遅れた結果の取引の順のたどり」）。答えの期限を過ぎた一つ目の押さえ直しが替えた後に二つ目が印を取って替える順と、MOD-26 の registerRoute の事前条件に縛られる MOD-43 と MOD-57 の期限の後の答えも見た | FND-75 の順（T2、T1、T3）は三つの経路のどれでも閉じた。押さえ直しの期限の後の答えは依頼の今の押さえを読み、遅れた結果の取引が替えた押さえを解かずに 200 と決め、押さえの期限の後の答えは受け付けた依頼に何も書かずに 201 と決める。T1、T3、T2 の順は、遅れた結果の取引が先の答えを受けて合う。36 の組のうち食い違うのは一つで、押さえが済んで T1、T2、T3 の順のとき、遅れた結果の取引が not_accepted の依頼にキーの 201 を書き、後の T3 はそれを返す（押さえ直しは、MOD-56 の判断表 B と MOD-59 の判断表 A の印がこの試みでない行が 503 REHOLD_UNCONFIRMED と答えるので合う）。一つ目の押さえ直しが期限の後に替えた押さえを二つ目が替えた後の一つ目の期限の後の答えは、その押さえの解除がすでにあれば作らないので、二重の解除はない。MOD-43 と MOD-57 の期限の後の答え方は、項目が書く限り何も書かない（MOD-43 の判断表 A の期限の後の行）か、判断表に書かれていない（MOD-57 の返金を作る経路）ので、事前条件との食い違いは見つけられない（「未解決の点」） | FND-77 |
| C7 | データ | 報告の「データ」の rides の変わった行と加わった行（受け付けた依頼の今の押さえを解く試みは ended と decide だけ）と取引の表を、MOD-45、MOD-56、MOD-58、MOD-59 の契約と不変条件に照らした | 加わった行は、解除を作る取引が同じ BEGIN IMMEDIATE の取引で state と hold_attempt_id を読むことで保たれ、契約と合う。印の書き手と読み手が MOD-45 だけであることも契約と合う。食い違いは、MOD-56 に加えた不変条件が依頼の今の押さえを解くのを ended と decide に限り、受け付けた依頼に限っていないこと（MOD-45 の不変条件では受け付けなかった依頼の今の押さえは押さえの試みで、MOD-58 の期限の後の答えと MOD-56 の判断表 C が found_late で解く）。ほかのコンポーネントが直接読む表とマイグレーションは変わらない | FND-78 |
| C8 | 設計上の値 | 対象の変更なし | | |
| C9 | 確かめ方 | 変わったモジュールの verification と、報告の「確かめ方」の加わった場面（遅れた結果の取引と期限の後の答え）を、変わった契約と判断表の行に照らした | 加わった契約と行には確かめ方がある（MOD-45 の印の行、MOD-56 と MOD-59 の二つの順、MOD-58 の T2 が先の順、MOD-26 の場面）。欠けは、押さえで T1、T2、T3 の順を確かめる場面がないこと（報告の場面は、逆の順でも受けたインスタンスが同じ答えを返すとする）。POL-03 の差し込みは依頼の状態の条件つきの書き込みの直前で止めるので、その順を作るにはキーの書き込みの前で止める所が要る。FND-77 の直し方に加えた | なし（FND-77 に含めた） |
| C10 | 共通の約束事と技術方針 | 変わったモジュールの契約、型、答え、確かめ方を、共通の約束事（DEC-35、DEC-42、DEC-45）と POL-02、POL-03 に照らした | 期限の後の答えの符号（200、201、402、503 の PAYMENT_SERVICE_UNAVAILABLE、HOLD_UNCONFIRMED、REHOLD_UNCONFIRMED）は IFC-03 と DEC-45 のとおりで、先に書いた答えを残すことは DEC-42 のとおり。rides の列は rides/ の adapters/ だけが読み書きし（POL-02）、依頼の状態は DEC-08 のポートを通す。確かめ方は POL-03 の結合の層、依頼の状態を書くポートの差し込み、EXT-01 と時計の偽物を使う。ほかのキーの操作に 409 OPERATION_IN_PROGRESS で答える点は、未解決の FND-74 が扱っており、重ねて出さない | なし |
| E1 | 指摘を読む | 状態が変わった FND-75、FND-76（受け入れ）の resolution を変わった項目で確かめ、対象が範囲にある FND-61、FND-66（受け入れ）と、範囲のモジュールが待つ FND-74（未解決、第 3 段階宛て）を読んだ | FND-75、FND-76 の変更はどちらも項目にあり、変えた項目の basis_note に引かれている（check.py も確かめた）。FND-75 は案の一つ目（found_late を依頼の今の押さえでない押さえに限る）を採って押さえ（MOD-58）にも広げ、二つ目（answerOverdue の一つの取引の中でキーを先に読み、まだ in_progress なら持ち主を呼ぶ）は MOD-43 が EXT-01 を呼ぶ理由で採らなかった。採らなかった案が閉じていたはずの間に FND-77 がある。FND-76 は案の一つ目のとおり。FND-61、FND-66 の変更はそのまま残る。FND-74 は今も成り立ち、重ねて出さない。この報告の道で出して未解決の指摘は、このレビューの FND-77、FND-78 のほかにない。退けられた指摘はない | なし |
| E2 | 前提の確かめ | 変わった項目の加わった本文が頼るもの（DEC-08、DEC-42、DEC-45、POL-02、IFC-03 の答え、DAS-23、CON-08）を、premises とスクリプトで照らした | 加わった本文は、仮定にも品質チェーンの共有する事実と仮定にも新しく頼らない。MOD-59 の DAS-23、MOD-45 と MOD-56 の CON-08 は前のとおり挙がる。範囲の項目が新しく頼る未回答か回答済みの品質チェーンへの要求はない。欠けはない | なし |
| E3 | 仮定の評価し直し | 変わった項目が premises で名指す DAS-23 を、依存する項目と後の段階への影響から評価し直した。ファイルが変わった DAS と QAS はなく、範囲の項目が依存する品質チェーンへの要求もない。このレビューの指摘は仮定に頼らない | DAS-23 は中、低のまま（依存は MOD-43、MOD-59 で、変更は見積もりの有効期間と登録を見捨てる時間に触れない）。ファイルは変えていない。高のものはなく、尋ねた点はない | なし |
| E4 | 事業の判断の確かめ | 変わった項目の暫定の値、リスクを受け入れる決定、確定の種類か高の点の先送りと、前のレビューの後にこの段階が退けた指摘を見た | 加わった値、負債、先送りはない。この段階は指摘を退けていない（FND-75 の案の一つを理由を書いて採らなかったが、指摘は受け入れた） | なし |
| E5 | 写しを探す | 変わった MOD と報告の加わった行を、品質チェーンの文（FR の受け入れ基準、QR、NFR、SLI ほか）と 30 字ずつスクリプトで照らした | 写しはない | なし |
| E6 | 確かめを求める点 | 対象の変更なし | | |
| E7 | 申し送りの確かめ | 対象の変更なし | | |
| E8 | 品質チェーンのものを決めていないか | 変わった項目の確かめ方と契約、報告の加わった場面を、ゲート、目標、しきい値、受け入れ基準、SLI の数え方の変更を探して読んだ | ない。加わった確かめは部分の確かめ方で、マージやリリースの条件にしていない | なし |

C8 は、変わった値、変わった IFC の timing と予算、この段階に送られたタイムアウトがない。E6 は品質チェーンの basis_note と申し送りに新しいか変わった点がなく、確かめる項目も変わっていない。E7 はこの段階が ELM-03 で書いた申し送りが変わっていない。

### C6 期限の後の答えと遅れた結果の取引の順のたどり
同じキーの送り直しの check が overdue を読んだ後の三つの取引を、項目の決まりのとおりに順に当てた（このレビューの作業用のスクリプトで、リポジトリには置かない）。T1 は持ち主の期限の後の答えの書き込みの取引（MOD-58、MOD-56、MOD-59 の overdueAnswer。settleRehold を含む）、T2 は受けたインスタンスの遅れた結果の取引（試みは unknown のときだけ移り、キーは in_progress のときだけ書く）、T3 は MOD-26 の answerOverdue のキーの書き込み。T1 の後に T3 が来るのは同じ送り直しの中の順で、T2 はその前、間、後のどこにも来うる（MOD-26 は持ち主を answerOverdue の一つの取引の中で呼ばない）。押さえの T2 の答えは MOD-58 の request の post（押さえたら 201、拒否 402、処理されなかった 503 PAYMENT_SERVICE_UNAVAILABLE、分からない 503 HOLD_UNCONFIRMED）、押さえ直しの T2 の答えは MOD-56 の判断表 B と MOD-59 の判断表 A。合うとは、キーの答えが依頼（押さえは受け付けたか、押さえ直しは今の押さえと変更）と合い、依頼の今の押さえを解かないこと。

```text
hold succeeded T2-T1-T3 key 201 ride searching releases 0 OK
hold succeeded T1-T2-T3 key 201 ride not_accepted releases 1 MISMATCH
hold succeeded T1-T3-T2 key 503 HOLD_UNCONFIRMED ride not_accepted releases 1 OK
hold refused T2-T1-T3 key 402 ride not_accepted releases 0 OK
hold refused T1-T2-T3 key 402 ride not_accepted releases 0 OK
hold refused T1-T3-T2 key 503 HOLD_UNCONFIRMED ride not_accepted releases 0 OK
hold not_processed T2-T1-T3 key 503 PSU ride not_accepted releases 0 OK
hold not_processed T1-T2-T3 key 503 PSU ride not_accepted releases 0 OK
hold not_processed T1-T3-T2 key 503 HOLD_UNCONFIRMED ride not_accepted releases 0 OK
hold unknown T2-T1-T3 key 503 HOLD_UNCONFIRMED ride not_accepted releases 0 OK
hold unknown T1-T2-T3 key 503 HOLD_UNCONFIRMED ride not_accepted releases 0 OK
hold unknown T1-T3-T2 key 503 HOLD_UNCONFIRMED ride not_accepted releases 0 OK
rehold-meth succeeded T2-T1-T3 key 200 current R relR 0 relH1 1 OK
rehold-meth succeeded T1-T2-T3 key 503 REHOLD_UNCONFIRMED current H1 relR 1 relH1 0 OK
rehold-meth succeeded T1-T3-T2 key 503 REHOLD_UNCONFIRMED current H1 relR 1 relH1 0 OK
rehold-meth refused T2-T1-T3 key 402 current H1 relR 0 relH1 0 OK
rehold-meth refused T1-T2-T3 key 402 current H1 relR 0 relH1 0 OK
rehold-meth refused T1-T3-T2 key 503 REHOLD_UNCONFIRMED current H1 relR 0 relH1 0 OK
rehold-meth not_processed T2-T1-T3 key 503 PSU current H1 relR 0 relH1 0 OK
rehold-meth not_processed T1-T2-T3 key 503 PSU current H1 relR 0 relH1 0 OK
rehold-meth not_processed T1-T3-T2 key 503 REHOLD_UNCONFIRMED current H1 relR 0 relH1 0 OK
rehold-meth unknown T2-T1-T3 key 503 REHOLD_UNCONFIRMED current H1 relR 0 relH1 0 OK
rehold-meth unknown T1-T2-T3 key 503 REHOLD_UNCONFIRMED current H1 relR 0 relH1 0 OK
rehold-meth unknown T1-T3-T2 key 503 REHOLD_UNCONFIRMED current H1 relR 0 relH1 0 OK
rehold-dest succeeded T2-T1-T3 key 200 current R relR 0 relH1 1 change applied OK
rehold-dest succeeded T1-T2-T3 key 503 REHOLD_UNCONFIRMED current H1 relR 1 relH1 0 change not_applied OK
rehold-dest succeeded T1-T3-T2 key 503 REHOLD_UNCONFIRMED current H1 relR 1 relH1 0 change not_applied OK
rehold-dest refused T2-T1-T3 key 402 current H1 relR 0 relH1 0 change not_applied OK
rehold-dest refused T1-T2-T3 key 402 current H1 relR 0 relH1 0 change not_applied OK
rehold-dest refused T1-T3-T2 key 503 REHOLD_UNCONFIRMED current H1 relR 0 relH1 0 change not_applied OK
rehold-dest not_processed T2-T1-T3 key 503 PSU current H1 relR 0 relH1 0 change not_applied OK
rehold-dest not_processed T1-T2-T3 key 503 PSU current H1 relR 0 relH1 0 change not_applied OK
rehold-dest not_processed T1-T3-T2 key 503 REHOLD_UNCONFIRMED current H1 relR 0 relH1 0 change not_applied OK
rehold-dest unknown T2-T1-T3 key 503 REHOLD_UNCONFIRMED current H1 relR 0 relH1 0 change not_applied OK
rehold-dest unknown T1-T2-T3 key 503 REHOLD_UNCONFIRMED current H1 relR 0 relH1 0 change not_applied OK
rehold-dest unknown T1-T3-T2 key 503 REHOLD_UNCONFIRMED current H1 relR 0 relH1 0 change not_applied OK
mismatches: 1
```

H1 は依頼の前の押さえ、R は押さえ直しの試みの押さえ、PSU は PAYMENT_SERVICE_UNAVAILABLE、relR と relH1 はその押さえの解除の試みの数。T2、T1、T3 の行がそろって合うことは、FND-75 の道が閉じたことを示す。食い違う一行は FND-77 の道で、押さえ直しの同じ順（T1、T2、T3）が合うのは、T2 が印の食い違いを読んで 503 REHOLD_UNCONFIRMED と答える行が MOD-56 の判断表 B と MOD-59 の判断表 A にあるため。押さえには、依頼が holding でないと読んだ T2 の答えを決める行がない。

## 指摘
<!-- generated: findings -->
| FND | 名前 | 重さ | 宛先 | 対象 |
|---|---|---|---|---|
| FND-77 | 押さえの期限の後の答えが依頼を not_accepted にした後、MOD-26 がキーを書く前に受けたインスタンスの遅れた結果の取引が確定すると、押さえが済んだその取引の 201 がキーに残り、受け付けなかった依頼に 201 と答える | 中 | high-level-design-to-detailed-design | MOD-58、MOD-26 |
| FND-78 | MOD-56 に加えた不変条件は依頼の今の押さえを解くのを ended と decide に限るが、受け付けなかった依頼の今の押さえは押さえの期限の後の答えと判断表 C が found_late で解く | 軽微 | high-level-design-to-detailed-design | MOD-56 |
<!-- /generated -->

この報告の道で出して未解決の指摘は、このレビューの FND-77、FND-78。前のレビューの FND-75、FND-76 はこの段階が受け入れた。退けられて出し直さなかった指摘はない。

## 決めたこと
| # | 質問 | 回答 | 項目 |
|---|---|---|---|

このレビューは質問をしていない。レビューの判断に要る事実で入力にないものはなく、評価し直した仮定に高のものはなく、品質チェーンへの要求も出していない。前のレビューにも決めたことはない。

## 未確認の仮定
<!-- generated: assumptions -->
| ID | 名前 | 種類 | 影響の広さ | 重大さ | 依存する項目 |
|---|---|---|---|---|---|
| QAS-54 | 状態の変化を相手の画面に示した時刻の記録（FRP-11）を今期作る | 暫定の決定 | 高 | 中 | DAT-20、DEC-46、DRV-03、DRV-26、IFC-10、IFC-11、IFC-21 |
| DAS-18 | 前もって作る鍵の日数、鍵をメモリに持つ長さ、仮の名の長さを暫定に採る | 暫定の決定 | 低 | 低 | MOD-23 |
| DAS-19 | 期限の来た処理を取る長さ、一度に取る数、失敗の後の間を暫定に採る | 暫定の決定 | 低 | 低 | MOD-31 |
| DAS-21 | Web Push の知らせの TTL、流れのない相手と決めるまでの待ち、2 秒のタイマーの上限を暫定に採る | 暫定の決定 | 低 | 低 | MOD-33 |
| DAS-24 | 確認コードの長さと、合わない試みで照らし合わせを止める回数と時間を暫定に採る | 暫定の決定 | 低 | 低 | MOD-46 |
| DAS-25 | 迎車の到着に使う位置の確からしさの上限を暫定に採る | 暫定の決定 | 低 | 低 | MOD-47 |
| DAS-28 | 異常を見つけて知らせる間隔とまとめ方の値を暫定に採る | 暫定の決定 | 低 | 低 | MOD-67 |
| DAS-05 | エンジニアは異常の知らせを Web アプリへの Web Push とその一覧で受け、想定の本番のプラットフォームからの知らせはメールで受ける | 判断 | 中 | 低 | DEC-20、MOD-67 |
| DAS-10 | EXT-01 への呼び出しのタイムアウト、同じキーでのやり直し、待ち、確かめの間隔を暫定に採る | 暫定の決定 | 中 | 低 | DEC-46、IFC-17 |
| DAS-11 | 端末、通信、自身の処理の時間と、流れ、位置、着く見込みの間隔を暫定に採る | 暫定の決定 | 中 | 低 | DEC-46、IFC-05、IFC-11、IFC-19 |
| DAS-12 | 日々の処理の時刻と照合で読む期間、期限の来た処理を拾う間隔を暫定に採る | 暫定の決定 | 中 | 低 | DAT-13、DEC-46、IFC-15 |
| DAS-15 | 流れで送った変化を Web Push でも知らせるまでの待ちと、Web Push を送る呼び出しと配信の時間を暫定に採る | 暫定の決定 | 中 | 低 | DEC-46、IFC-11、IFC-21 |
| DAS-16 | ELM-02 の呼び出しのタイムアウトと、答えのない操作の送り直し、持つ長さと数を暫定に採る | 暫定の決定 | 中 | 低 | MOD-01、MOD-20 |
| DAS-17 | ELM-03 が答える期限、入口の回数の限り、外からの生存確認の値を暫定に採る | 暫定の決定 | 中 | 低 | MOD-01、MOD-20 |
| DAS-20 | 日々の処理の時間の上限、期限を過ぎた処理を拾う終わり、呼び出しの期限と再試行、要求の時間の上限、終えた記録を待つ時間、一覧の 1 ページと一つの取引の行の数を暫定に採る | 暫定の決定 | 中 | 低 | MOD-32、MOD-44、MOD-68 |
| DAS-22 | サインインに続けて失敗したときに止める回数と時間、セッションの長さ、設定の符号の有効期間と形、パスワードの長さを暫定に採る | 暫定の決定 | 低 | 中 | MOD-36 |
| DAS-23 | 確かめられない支払い方法の登録を見捨てるまでの時間と、降りる場所の変更の見積もりの有効期間を暫定に採る | 暫定の決定 | 中 | 低 | MOD-43、MOD-59 |
| DAS-26 | 走っているかの判断に使う位置の新しさと窓を暫定に採る | 暫定の決定 | 低 | 中 | MOD-48 |
| DAS-27 | 参加者の iPhone の Safari が返す速さで、V_moving_lock の上と下を分けられる | 判断 | 低 | 中 | MOD-48 |
| QAS-25 | 依頼の状態の変化を届ける速さのしきい値と最初の目標値 | 暫定の決定 | 中 | 低 | DEC-46、DRV-03、IFC-11 |
| QAS-32 | 決済の記録と決済サービスの処理の一致の最初の目標値と突き合わせの時点 | 暫定の決定 | 中 | 低 | DAT-13、DRV-07、IFC-15 |
| QAS-33 | 決済の結果を示すまでの速さのしきい値 | 暫定の決定 | 中 | 低 | DEC-46、DRV-07、IFC-03 |
| DAS-06 | EXT-01 のテスト環境で、後で確定する押さえ、一部の確定、取り消し、返金を円で使える | 判断 | 中 | 中 | DEC-09、ELM-05、IFC-17 |
<!-- /generated -->

ELM-03 のモジュールが premises で名指す仮定と、ELM-03 が使う IFC と DEC が名指す仮定。このレビューが評価し直したのは、変わった MOD-59 が名指す DAS-23 で、評価は変わらない（E3）。ほかの行は範囲の項目が名指していないので評価し直しておらず、前のレビューの評価のまま。QAS の値は品質チェーンのファイルには書かず、ここに示す（QAS-54 は第 3 段階のレビューの決めたこと 1 で成り立つと答えを受け、QCR-08 が品質チェーンに運ぶ。品質チェーンが当てるまで、品質チェーンでは未確認のまま）。このレビューが書いた仮定はなく、指摘はどちらも仮定に頼らない。

## 未解決の点
- `scripts/check.py` は、レビューを始めたとき、範囲の項目（第 4 段階の ELM-03 のモジュールと報告）に問題を報告しなかった。このレビューの指摘を書いた後は、ELM-03 の報告の指摘の表が FND-77、FND-78 を持たないため古くなり（`high-level-design-to-detailed-design`、1 件）、第 4 段階の ELM-03 の次の実行が書き直す。範囲の外では、生成する表が古いことを `requirements-to-architecture-drivers`（1-architecture-drivers.md）、`architecture-drivers-to-architecture`（2-architecture.md）、`architecture-to-technical-policy`（2b-technical-policy.md）、`architecture-to-high-level-design`（3-high-level-design.md）に 1 件ずつ、`architecture-drivers-to-architecture` に DEC-05、DEC-18、ELM-08 の basis の 3 件を報告し、IFC-22 の functions の FR-05 と FR-45 を FND-35 待ちとして示した。`design-review` には、第 4 段階の ELM-02 のレビューの報告の生成する表が古いことの 1 件が残る。ELM-02 の実行（eb55336）で MOD-01 が DAS-17 を名指したことによるもので、このレビューの commit に入れると ELM-02 のレビューの次の差分のレビューの基準が eb55336 の変更より後に動くため、前のレビューと同じく書き直していない（次の ELM-02 のレビューが書き直す）。
- MOD-26 の registerRoute の事前条件は期限の後の答え方を登録する MOD-43 と MOD-57 も縛るが、MOD-57 の返金を作る経路の期限の後の答え方は判断表に書かれておらず、MOD-43 の登録の完了の経路は判断表 B の状態の行から読むだけなので、このレビューは T1、T2、T3 の順を MOD-43 と MOD-57 についてたどれていない（FND-77 の案が、この段階に確かめるよう書いた）。
- 何も配備しない（TC-09）ため、想定の本番の Secret Manager の版の付け方と最初の版を使う置き方、Cloud Scheduler の OIDC の印の確かめ（Google の署名の鍵をどこから読むかを含む）、Cloud Run の要求の時間の上限は、公開の文書と設計の入力から読み、どの層も確かめていない。EXT-01 の登録の取引が、確かめる前と確かめの失敗の後のどちらも requires_payment_method を示して失敗のときだけ last_setup_error を持つことも、MOD-42 と MOD-43 が挙げる EXT-01 の決まりとして読み、このレビューは確かめていない（契約の層が試験の環境で確かめうる）。
- 第 3 段階に宛てた軽微な FND-59、FND-60、FND-74 は未解決で、MOD-56 の判断表 D、MOD-26、MOD-43、MOD-56、MOD-59 が今の DEC-42 と DEC-45 のとおりに待つ。
- 報告のモジュールの図の矢印と depends_on は、機能のディレクトリの間の循環をスクリプトで照らし、図が描かない個々の矢印までは照らしていない（図の文が略すと書く）。このレビューは、変わった呼び出しが depends_on の中にあることだけを見た。
