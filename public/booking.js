// 予約受付開始日の計算。日付はすべて日本時間の 'YYYY-MM-DD' 文字列で扱う。
//
// rule.type
//   months_first    … 利用月の n か月前の1日から（例 3 → 7月の利用は4/1から）
//   months_same_day … 利用日の n か月前の同じ日から（その月にない日は月末）
//   days_before     … 利用日の n 日前から
//   season          … シーズン分をまとめて受付（日付は計算できない）
//   none            … 予約不要
//   unknown         … まだ調べていない
//
// 返り値 { state, opensOn, opensAt, daysLeft, label }
//   state: 'open'（受付中） | 'soon'（受付前） | 'past'（利用日が過ぎた） | 'season' | 'none' | 'unknown'

const pad = (n) => String(n).padStart(2, '0');
const toUTC = (iso) => Date.parse(iso + 'T00:00:00Z');
const fromUTC = (t) => new Date(t).toISOString().slice(0, 10);
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m は 1〜12

export function opensOn(rule, stay) {
  const y = Number(stay.slice(0, 4)), m = Number(stay.slice(5, 7)), d = Number(stay.slice(8, 10));
  const n = Number(rule.n);
  if (rule.type === 'months_first' || rule.type === 'months_same_day') {
    let mm = m - n, yy = y;
    while (mm < 1) { mm += 12; yy -= 1; }
    const dd = rule.type === 'months_first' ? 1 : Math.min(d, lastDay(yy, mm));
    return `${yy}-${pad(mm)}-${pad(dd)}`;
  }
  if (rule.type === 'days_before') return fromUTC(toUTC(stay) - n * 86400000);
  return null;
}

/** now は { iso: 'YYYY-MM-DD', hm: 'HH:MM' }（日本時間） */
export function bookingStatus(rule, stay, now) {
  if (stay < now.iso) return { state: 'past', label: '過ぎた日です' };
  if (rule.type === 'none') return { state: 'none', label: '予約不要' };
  if (rule.type === 'season') return { state: 'season', label: 'シーズン分をまとめて受付・公式で確認' };
  const on = opensOn(rule, stay);
  if (!on) return { state: 'unknown', label: '受付開始日は公式で確認' };
  const at = rule.time || '';
  const started = on < now.iso || (on === now.iso && (!at || now.hm >= at));
  if (started) return { state: 'open', opensOn: on, opensAt: at, label: '予約受付中' };
  const daysLeft = Math.round((toUTC(on) - toUTC(now.iso)) / 86400000);
  const md = `${Number(on.slice(5, 7))}/${Number(on.slice(8, 10))}`;
  return {
    state: 'soon', opensOn: on, opensAt: at, daysLeft,
    label: `${md}${at ? ' ' + at : ''} 受付開始` + (daysLeft === 0 ? '（今日）' : `（あと${daysLeft}日）`),
  };
}

/** 日本時間の今 */
export function jstNow(date = new Date()) {
  const d = new Date(date.getTime() + 9 * 3600e3);
  return { iso: d.toISOString().slice(0, 10), hm: d.toISOString().slice(11, 16) };
}

export const addDays = (iso, n) => fromUTC(toUTC(iso) + n * 86400000);
