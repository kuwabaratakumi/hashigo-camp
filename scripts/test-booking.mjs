// node scripts/test-booking.mjs
import assert from 'node:assert/strict';
import { opensOn, bookingStatus } from '../public/booking.js';

const now = { iso: '2026-10-30', hm: '10:00' };
const t = (rule, stay) => bookingStatus(rule, stay, now);

// 3か月前の1日：2027/1/16 の利用 → 2026/10/1（受付中）、2027/2/6 → 2026/11/1（あと2日）
assert.equal(opensOn({ type: 'months_first', n: 3 }, '2027-01-16'), '2026-10-01');
assert.equal(t({ type: 'months_first', n: 3 }, '2027-01-16').state, 'open');
assert.equal(t({ type: 'months_first', n: 3 }, '2027-02-06').label, '11/1 受付開始（あと2日）');
// 年をまたぐ：2027/2 の2か月前 → 2026/12/1
assert.equal(opensOn({ type: 'months_first', n: 2 }, '2027-02-20'), '2026-12-01');
// 同日：5/31 の3か月前 → 2/28（2月に31日はない）
assert.equal(opensOn({ type: 'months_same_day', n: 3 }, '2027-05-31'), '2027-02-28');
// 120日前
assert.equal(opensOn({ type: 'days_before', n: 120 }, '2027-02-27'), '2026-10-30');
// 当日の時刻：12:00 開始で今は 10:00 → まだ
assert.equal(t({ type: 'days_before', n: 120, time: '12:00' }, '2027-02-27').label, '10/30 12:00 受付開始（今日）');
assert.equal(t({ type: 'days_before', n: 120 }, '2027-02-27').state, 'open');
// そのほか
assert.equal(t({ type: 'none' }, '2026-11-07').state, 'none');
assert.equal(t({ type: 'season' }, '2026-11-07').state, 'season');
assert.equal(t({ type: 'unknown' }, '2026-11-07').state, 'unknown');
assert.equal(t({ type: 'months_first', n: 3 }, '2026-10-29').state, 'past');
console.log('booking.js: all tests passed');
