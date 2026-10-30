// 空き状況の取得（差し込み口）。取得元ごとに data/availability/{source}.json を書き出し、
// scripts/build.mjs がキャンプ場データにまとめる。
//
// 出力形式:
//   { "source": "rakuten", "fetchedAt": "ISO日時",
//     "campsites": { "st015": { "2026-11-07": "ok", "2026-11-14": "full" } } }
//   値は ok（空きあり）/ few（残りわずか）/ full（満室）
//
// 取得元の方針（docs/terms.md も参照）
//   - 楽天トラベル：公式の空室検索API。campsites.csv の rakuten_hotel_no が入っている施設だけ取得する
//   - 489ban・なっぷ：掲載の許可を取れたキャンプ場だけ。許可なしには取得しない
//
// 楽天APIの仕様（2026年2月の改定後）の確認が済むまでは、キーがあっても何もしない。
const { RAKUTEN_APP_ID, RAKUTEN_ACCESS_KEY } = process.env;

if (!RAKUTEN_APP_ID || !RAKUTEN_ACCESS_KEY) {
  console.log('楽天のアプリID・アクセスキーが未設定なので、空き状況の取得はスキップします');
  process.exit(0);
}
console.log('TODO: 楽天トラベル空室検索APIの実装（アプリID取得後、2026年版の仕様を確認して書く）');
