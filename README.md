# 燃やせ！はしごキャンプ

埼玉県のキャンプ場について、「泊まりたい日の予約がもう始まっているか／いつ始まるか」をまとめて見るための個人用サイトです。はしごシネマ・はしごミュージアム・はしご寄席と同じ作りです。

- **さがす** … 泊まる日を選ぶと、エリアごとのキャンプ場を「予約受付中 → これから受付（近い順）→ 受付日が不明」の順に並べます
- **キャンプ＋温泉** … となり・場内に日帰り温泉があるキャンプ場の組み合わせ
- **エリアめぐり** … 同じエリアで2〜3泊、1泊ごとにキャンプ場を変える計画を組みます

## 仕組み

```
data/campsites.csv・onsen.csv（手で編集）──┐
data/availability/*.json（空き状況・任意）──┴─ scripts/build.mjs ─> public/data/*.json ─> public/（静的サイト）
```

- 受付開始日は **閲覧したときにブラウザで計算** します（`public/booking.js`）。キャンプ場のサイトへは自動でアクセスしません
- GitHub Actions が毎日 5:20（日本時間）と、main への push のたびに作り直して Cloudflare Pages の `hashigo-camp` に公開します

## キャンプ場データ（data/campsites.csv）

| 列 | 内容 |
|---|---|
| `id` | st001 のような固定ID（変えない） |
| `area` | 秩父・長瀞／飯能／越生・毛呂山／比企・嵐山／本庄・熊谷／川越・さいたま／久喜・行田／越谷・草加／県東部 |
| `kind` | 宿泊／無料河原／BBQ など。画面に出すのは「宿泊」だけ |
| `rule_type` | 受付ルールの型（下の表） |
| `rule_n` | 何か月前・何日前か |
| `rule_time` | 受付開始時刻（例 `00:00`、`12:00`）。不明なら空 |
| `rule_note` | 画面にそのまま出す説明文（例「3か月前の1日 0:00（電話は8:45〜）」） |
| `rule_status` | 確認済／推定／未確認／未調査 |
| `reserve_platform` | 予約窓口（なっぷ、489ban、公式、電話 など） |
| `official_url` | 確認できた公式サイト。空なら画面は「公式をさがす」（検索リンク）になる |
| `rakuten_hotel_no` | 楽天トラベルの施設番号（空き状況を取るとき用） |

| `rule_type` | 意味 | 例 |
|---|---|---|
| `months_first` | 利用月の n か月前の1日から | ケニーズ（3）、スプラッシュガーデン（2） |
| `months_same_day` | 利用日の n か月前の同じ日から | PICA秩父（3） |
| `days_before` | 利用日の n 日前から | 満願ビレッジ・ウォーターパーク長瀞（120） |
| `season` | シーズン分をまとめて受付 | リバーパーク上長瀞 |
| `none` | 予約不要 | 無料の河原 |
| `unknown` | まだ調べていない | — |

受付ルールがわかったら、その行の `rule_type`・`rule_n`・`rule_time`・`rule_note`・`rule_status` を書き換えて push するだけです。`node scripts/build.mjs` が書式の間違いを見つけたら止まります。

## ローカルで動かす

```bash
npm test             # 受付開始日の計算テスト
npm run build        # CSV → public/data/*.json
npm run serve        # http://localhost:8080
```

## 公開（Cloudflare Pages）初回の設定

1. GitHub に `hashigo-camp` リポジトリを作って push
2. Settings → Secrets and variables → Actions に登録
   - `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`（はしごシネマと同じもの）
   - `RAKUTEN_APP_ID`、`RAKUTEN_ACCESS_KEY`（取得後。なくても動く）
3. Actions タブで「データ更新・公開」を手動実行 → `https://hashigo-camp.pages.dev`
4. 独自ドメイン `hashigo-camp.com` を Pages に接続し、pages.dev は Cloudflare Access で自分だけに

## 空き状況（今後）

`scripts/availability/run.mjs` が取得元ごとに `data/availability/{source}.json` を書き、build がまとめます。値は `ok`（空きあり）／`few`（残りわずか）／`full`（満室）で、カードにバッジで出ます。取得元ごとの扱いは `docs/terms.md`。

## 掲載中止のご依頼があったとき

`data/campsites.csv` の該当行の `kind` を `掲載中止` に変えて push します（画面には「宿泊」だけ出るので消えます。行を残すのは、あとで誰かが足し直さないようにするため）。
