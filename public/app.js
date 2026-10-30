import { isHoliday } from './holidays.js';
import { bookingStatus, jstNow, addDays } from './booking.js';
// 燃やせ！はしごキャンプ — キャンプ場の予約受付状況、キャンプ＋温泉、エリアめぐり

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const AREA_ORDER = ['秩父・長瀞', '飯能', '越生・毛呂山', '比企・嵐山', '本庄・熊谷', '川越・さいたま', '久喜・行田', '越谷・草加', '県東部', 'その他'];
const STATE_ORDER = { open: 0, soon: 1, season: 2, unknown: 3, none: 4, past: 5 };

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても表示は続ける */ } },
};

const state = {
  camps: [], onsen: [], byId: new Map(),
  view: store.get('hashigo-camp:view', 'find'),
  area: store.get('hashigo-camp:area', '秩父・長瀞'),
  date: null,
  nights: 2,
  route: {},             // エリアめぐり：{ 'YYYY-MM-DD': campsiteId }
  knownOnly: false,
};

const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const dow = (iso) => new Date(iso + 'T12:00:00Z').getUTCDay();
const mdw = (iso) => `${md(iso)}（${DOW[dow(iso)]}${isHoliday(iso) ? '・祝' : ''}）`;
const gmaps = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const gsearch = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

/** 泊まる日の候補：土曜と祝日の前日を、今日から8つ */
function stayCandidates(from) {
  const out = [];
  for (let d = from; out.length < 8; d = addDays(d, 1)) {
    if (dow(d) === 6 || (isHoliday(addDays(d, 1)) && dow(d) !== 6)) out.push(d);
  }
  return out;
}

/* ---------- 共通の部品 ---------- */
const statusOf = (c, date = state.date) => bookingStatus(c.rule, date, jstNow());

function pill(st) {
  return `<span class="pill pill--${st.state}">${esc(st.label)}</span>`;
}

function availBadge(c, date) {
  const v = c.availability?.days?.[date];
  if (!v) return '';
  const label = { ok: '空きあり', few: '残りわずか', full: '満室' }[v] || v;
  return `<span class="avail avail--${v}">${label}</span>`;
}

function campCard(c, date = state.date, { pickFor } = {}) {
  const st = statusOf(c, date);
  const official = c.url
    ? `<a class="btn" href="${esc(c.url)}" target="_blank" rel="noopener">公式サイト</a>`
    : `<a class="btn btn--ghost" href="${esc(gsearch(c.name + ' キャンプ場 予約'))}" target="_blank" rel="noopener">公式をさがす</a>`;
  const picked = pickFor && state.route[pickFor] === c.id;
  return `<article class="card${picked ? ' card--picked' : ''}" data-state="${st.state}">
    <div class="card__head">
      <h3 class="card__name">${esc(c.name)}</h3>
      <div class="card__badges">${pill(st)}${availBadge(c, date)}</div>
    </div>
    <dl class="card__meta">
      ${c.ruleNote ? `<div><dt>受付</dt><dd>${esc(c.ruleNote)}</dd></div>` : ''}
      ${c.platform ? `<div><dt>予約</dt><dd>${esc(c.platform)}</dd></div>` : ''}
      ${c.season ? `<div><dt>営業</dt><dd>${esc(c.season)}</dd></div>` : ''}
      ${c.onsen ? `<div><dt>温泉</dt><dd>${esc(c.onsen)}</dd></div>` : ''}
      ${c.note ? `<div><dt>メモ</dt><dd>${esc(c.note)}</dd></div>` : ''}
    </dl>
    <div class="card__links">
      ${official}
      <a class="btn btn--ghost" href="${esc(gmaps(c.name + ' ' + c.pref))}" target="_blank" rel="noopener">地図</a>
      ${pickFor ? `<button type="button" class="btn btn--pick" data-pick="${c.id}" data-night="${pickFor}" aria-pressed="${picked}">${picked ? '選択中' : 'ここに泊まる'}</button>` : ''}
    </div>
  </article>`;
}

const sortCamps = (list, date = state.date) => list
  .map((c) => ({ c, st: statusOf(c, date) }))
  .sort((a, b) => (STATE_ORDER[a.st.state] - STATE_ORDER[b.st.state]) || ((a.st.daysLeft ?? 0) - (b.st.daysLeft ?? 0)) || a.c.name.localeCompare(b.c.name, 'ja'))
  .map((x) => x.c);

const inArea = (c) => state.area === 'すべて' || c.area === state.area;
const stayable = (c) => c.kind === '宿泊';

/* ---------- 日付・エリア ---------- */
function renderDays() {
  const today = jstNow().iso;
  const days = stayCandidates(today);
  if (!state.date || state.date < today) state.date = days[0];
  $('#stayDate').value = state.date;
  $('#stayDate').min = today;
  $('#days').innerHTML = days.map((iso) => {
    const w = dow(iso);
    const hol = isHoliday(addDays(iso, 1)) ? '祝前' : DOW[w];
    const showMonth = iso === days[0] || Number(iso.slice(8)) <= 7;
    return `<button class="day" type="button" data-date="${iso}" data-dow="${w}" ${iso === state.date ? 'aria-current="date"' : ''} aria-label="${md(iso)} ${DOW[w]}曜に泊まる">
      <span class="day__m">${showMonth ? Number(iso.slice(5, 7)) + '月' : ''}</span>
      <span class="day__d">${Number(iso.slice(8))}</span>
      <span class="day__w">${hol}</span></button>`;
  }).join('');
}

function renderAreas() {
  const counts = new Map();
  for (const c of state.camps) if (stayable(c)) counts.set(c.area, (counts.get(c.area) || 0) + 1);
  const areas = AREA_ORDER.filter((a) => counts.has(a));
  const all = state.view === 'route' ? areas : ['すべて', ...areas];
  if (!all.includes(state.area)) state.area = all[0];
  $('#areas').innerHTML = all.map((a) => `<button type="button" class="chip" data-area="${esc(a)}" aria-pressed="${a === state.area}">${esc(a)}${a === 'すべて' ? '' : `<span class="chip__n">${counts.get(a)}</span>`}</button>`).join('');
}

/* ---------- さがす ---------- */
function renderFind() {
  const list = sortCamps(state.camps.filter((c) => inArea(c) && stayable(c)));
  const shown = state.knownOnly ? list.filter((c) => ['open', 'soon'].includes(statusOf(c).state)) : list;
  const n = (s) => list.filter((c) => statusOf(c).state === s).length;
  return `<div class="summary">
      <p><strong>${mdw(state.date)}</strong>に泊まるなら：受付中 <b class="num">${n('open')}</b> ・ これから受付 <b class="num">${n('soon')}</b> ・ 受付日が不明 <b class="num">${n('unknown') + n('season')}</b></p>
      <label class="toggle"><input type="checkbox" id="knownOnly" ${state.knownOnly ? 'checked' : ''}> 受付開始日がわかるキャンプ場だけ</label>
    </div>
    <div class="grid">${shown.map((c) => campCard(c)).join('') || '<p class="empty">条件に合うキャンプ場がありません</p>'}</div>`;
}

/* ---------- キャンプ＋温泉 ---------- */
function renderOnsen() {
  const rows = state.onsen.filter((o) => state.area === 'すべて' || o.area === state.area);
  if (!rows.length) return '<p class="empty">このエリアの温泉はまだ登録していません</p>';
  return `<p class="lead">キャンプ場のとなり・場内にある日帰り温泉と、同じエリアのキャンプ場の組み合わせです。</p>` + rows.map((o) => {
    const pairs = o.pairIds.map((id) => state.byId.get(id)).filter(Boolean);
    const others = sortCamps(state.camps.filter((c) => c.area === o.area && stayable(c) && !o.pairIds.includes(c.id)))
      .filter((c) => ['open', 'soon'].includes(statusOf(c).state)).slice(0, 4);
    return `<section class="combo">
      <header class="combo__head">
        <h2 class="combo__name"><span class="combo__icon" aria-hidden="true">♨</span>${esc(o.name)}</h2>
        <p class="combo__sub">${esc(o.town)} ・ <a href="${esc(gmaps(o.name))}" target="_blank" rel="noopener">地図</a></p>
      </header>
      ${pairs.length ? `<h3 class="combo__label">セットで泊まる（${esc(o.pairNote)}）</h3><div class="grid">${pairs.map((c) => campCard(c)).join('')}</div>` : `<p class="combo__note">${esc(o.pairNote)}</p>`}
      ${others.length ? `<details class="combo__more"><summary>同じエリアで受付日がわかるキャンプ場（${others.length}）</summary><div class="grid">${others.map((c) => campCard(c)).join('')}</div></details>` : ''}
    </section>`;
  }).join('');
}

/* ---------- エリアめぐり ---------- */
function renderRoute() {
  const nights = Array.from({ length: state.nights }, (_, i) => addDays(state.date, i));
  for (const k of Object.keys(state.route)) if (!nights.includes(k)) delete state.route[k];
  const camps = state.camps.filter((c) => c.area === state.area && stayable(c));
  const plan = nights.map((d, i) => {
    const c = state.byId.get(state.route[d]);
    return `<li><span class="plan__n">${i + 1}泊目</span><span class="plan__d">${mdw(d)}</span><span class="plan__c">${c ? esc(c.name) : '<em>未選択</em>'}</span>${c ? pill(statusOf(c, d)) : ''}</li>`;
  }).join('');
  return `<div class="route-bar">
      <p>${esc(state.area)}で <select id="nights" aria-label="泊数">${[2, 3].map((n) => `<option value="${n}" ${n === state.nights ? 'selected' : ''}>${n}泊</option>`).join('')}</select> しながら、1泊ごとにキャンプ場を変えて回ります。</p>
      <ol class="plan">${plan}</ol>
    </div>` + nights.map((d, i) => `<section class="night">
      <h2 class="night__title"><span class="plan__n">${i + 1}泊目</span>${mdw(d)}</h2>
      <div class="grid">${sortCamps(camps, d).filter((c) => statusOf(c, d).state !== 'past').map((c) => campCard(c, d, { pickFor: d })).join('')}</div>
    </section>`).join('');
}

/* ---------- 描画 ---------- */
function render() {
  document.querySelectorAll('.view button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  renderDays();
  renderAreas();
  const main = $('#main');
  main.innerHTML = state.view === 'onsen' ? renderOnsen() : state.view === 'route' ? renderRoute() : renderFind();
}

function bind() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.view) { state.view = t.dataset.view; store.set('hashigo-camp:view', state.view); render(); }
    else if (t.dataset.date) { state.date = t.dataset.date; render(); }
    else if (t.dataset.area) { state.area = t.dataset.area; store.set('hashigo-camp:area', state.area); render(); }
    else if (t.dataset.pick) {
      const n = t.dataset.night;
      state.route[n] = state.route[n] === t.dataset.pick ? undefined : t.dataset.pick;
      if (!state.route[n]) delete state.route[n];
      render();
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'stayDate' && e.target.value) { state.date = e.target.value; render(); }
    if (e.target.id === 'knownOnly') { state.knownOnly = e.target.checked; render(); }
    if (e.target.id === 'nights') { state.nights = Number(e.target.value); render(); }
  });
}

async function main() {
  try {
    const [c, o] = await Promise.all([
      fetch(`data/campsites.json?t=${Date.now()}`).then((r) => r.json()),
      fetch(`data/onsen.json?t=${Date.now()}`).then((r) => r.json()),
    ]);
    state.camps = c.campsites;
    state.onsen = o.onsen;
    state.byId = new Map(state.camps.map((x) => [x.id, x]));
    $('#builtAt').textContent = `データ更新 ${new Date(c.builtAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    bind();
    render();
  } catch (err) {
    $('#main').innerHTML = `<p class="empty">データを読み込めませんでした（${esc(err.message)}）</p>`;
  }
}
main();
