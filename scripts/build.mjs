// data/*.csv（編集用）→ public/data/*.json（公開用）
//   node scripts/build.mjs
// 空き状況（data/availability/*.json）があれば、キャンプ場ごとにまとめて入れる。
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RULE_TYPES = new Set(['months_first', 'months_same_day', 'days_before', 'season', 'none', 'unknown']);

/** ダブルクォート・改行入りにも対応する最小限のCSV読み込み */
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((v) => v !== ''));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, ''), (r[i] ?? '').trim()])));
}

const read = async (f) => parseCsv(await fs.readFile(path.join(root, 'data', f), 'utf8'));

async function loadAvailability() {
  const dir = path.join(root, 'data', 'availability');
  const out = {};
  let files = [];
  try { files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')); } catch { return out; }
  for (const f of files) {
    const a = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
    // { source, fetchedAt, campsites: { st001: { '2026-11-07': 'ok' | 'few' | 'full' } } }
    for (const [id, days] of Object.entries(a.campsites || {})) {
      out[id] ??= { sources: [], days: {} };
      out[id].sources.push({ source: a.source, fetchedAt: a.fetchedAt });
      Object.assign(out[id].days, days);
    }
  }
  return out;
}

async function main() {
  const errors = [];
  const camps = await read('campsites.csv');
  const onsen = await read('onsen.csv');
  const ids = new Set();
  for (const c of camps) {
    if (ids.has(c.id)) errors.push(`id が重複: ${c.id}`);
    ids.add(c.id);
    if (!RULE_TYPES.has(c.rule_type)) errors.push(`${c.id} ${c.name}: rule_type が不正 (${c.rule_type})`);
    if (['months_first', 'months_same_day', 'days_before'].includes(c.rule_type) && !(Number(c.rule_n) > 0)) errors.push(`${c.id} ${c.name}: rule_n が必要`);
    if (c.rule_time && !/^\d{2}:\d{2}$/.test(c.rule_time)) errors.push(`${c.id} ${c.name}: rule_time は HH:MM`);
  }
  for (const o of onsen) for (const p of o.pair_ids.split(/\s+/).filter(Boolean)) if (!ids.has(p)) errors.push(`温泉 ${o.name}: pair_ids の ${p} がない`);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

  const avail = await loadAvailability();
  const campsites = camps.map((c) => ({
    id: c.id, name: c.name, pref: c.pref, area: c.area || 'その他', kind: c.kind,
    rule: { type: c.rule_type, ...(c.rule_n && { n: Number(c.rule_n) }), ...(c.rule_time && { time: c.rule_time }) },
    ruleNote: c.rule_note, ruleStatus: c.rule_status, platform: c.reserve_platform,
    url: c.official_url, season: c.season, onsen: c.onsen, note: c.note, source: c.source,
    ...(avail[c.id] && { availability: avail[c.id] }),
  }));
  const onsenOut = onsen.map((o) => ({ id: o.id, name: o.name, area: o.area, town: o.town, pairIds: o.pair_ids.split(/\s+/).filter(Boolean), pairNote: o.pair_note, source: o.source }));

  const out = path.join(root, 'public', 'data');
  await fs.mkdir(out, { recursive: true });
  const builtAt = new Date().toISOString();
  await fs.writeFile(path.join(out, 'campsites.json'), JSON.stringify({ builtAt, campsites }));
  await fs.writeFile(path.join(out, 'onsen.json'), JSON.stringify({ builtAt, onsen: onsenOut }));
  const known = campsites.filter((c) => ['months_first', 'months_same_day', 'days_before'].includes(c.rule.type)).length;
  console.log(`キャンプ場 ${campsites.length}件（受付開始日が計算できる ${known}件）／温泉 ${onsenOut.length}件／空き状況あり ${Object.keys(avail).length}件`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
