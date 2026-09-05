'use strict';

/* =========================================================
   XP Tracker — дані та розрахунки
   Дві незалежні лінії: РЕЖИМ (синій) і ДИСТРИБУЦІЯ (зелений)
   ========================================================= */

const STORAGE_KEY = 'xp-tracker-v1';

/* ---------- константи ---------- */

const REGIME = [
  { id: 'sleep',    label: 'Ліг спати об 11 вечора', xp: 2 },
  { id: 'ritual',   label: 'Ритуал входу в роботу', sub: 'кофеїн / темрява', xp: 1 },
  { id: 'blackout', label: 'Peripheral Blackout', sub: 'мінімум одна сесія в темряві з яскравим монітором', xp: 2 },
  { id: 'zero',     label: 'Нуль рішень на побут', sub: 'та сама їжа, той самий одяг', xp: 1 },
  { id: 'dopamine', label: 'Дофамінове завантаження', sub: 'соцмережі й розваги тільки в кінці дня', xp: 2 },
  { id: 'deadline', label: 'Штучний дедлайн на головну задачу', sub: 'закон Паркінсона', xp: 2 },
  { id: 'nottodo',  label: 'Not-to-do list дотримано', xp: 1 },
  { id: 'action',   label: 'Action Bias', sub: 'почав робити раніше, ніж дороблено план', xp: 1 },
  { id: 'emotions', label: 'Емоції в роботу, а не в прокрастинацію', xp: 1 },
  { id: 'journal',  label: 'XP-щоденник заповнений', sub: 'ставиться сама, коли є хоч один запис', xp: 2, auto: true },
];
const REGIME_MAX = REGIME.reduce((s, r) => s + r.xp, 0); // 15

const DIST = [
  { id: 'videos',  label: 'Відео випущено', xp: 5 },
  { id: 'posts',   label: 'Постів у Telegram', xp: 5 },
  { id: 'hooks',   label: 'Нових хуків протестовано', xp: 3 },
  { id: 'replies', label: 'Відповів на всі коменти й діреки', xp: 2, bool: true },
];

/* Ранги. Умови — поведінка, не чисті XP. */
const RANKS = [
  { name: 'Basic Bitch', regime: 0,  weeks: 0 },
  { name: 'NPC',         regime: 50, weeks: 1 },
  { name: 'Normie',      regime: 70, weeks: 4, regular: true },
  { name: 'Grinder',     regime: 80, weeks: 4,  videos: 40,  posts: 20, hooks: 15 },
  { name: 'Operator',    regime: 80, weeks: 8,  videos: 80,  posts: 40, hooks: 30, convGrowth: true },
  { name: 'Chad',        regime: 80, weeks: 12, videos: 120, posts: 60, hooks: 45, income: 300000 },
];
const REGULAR_VIDEOS_PER_WEEK = 3; // «регулярність випуску» для Normie
const DECAY_PER_IDLE_WEEK = 0.02;  // просідання річної лінії

const MONTHS_NOM = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const MONTHS_GEN = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const MONTHS_SHORT = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
const WD_SHORT = ['нд','пн','вт','ср','чт','пт','сб'];
const WD_FULL = ['неділя','понеділок','вівторок','середа','четвер','п’ятниця','субота'];

/* ---------- дати ---------- */

const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d || 1); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); x.setHours(0, 0, 0, 0); return x; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function weekStart(d) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; } // понеділок
function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function today() { return startOfDay(new Date()); }
function sameDay(a, b) { return dkey(a) === dkey(b); }

function fmtDate(d) { return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; }
function fmtDateFull(d) { return `${WD_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; }
function fmtRange(ws) {
  const we = addDays(ws, 6);
  if (ws.getMonth() === we.getMonth()) return `${ws.getDate()}–${we.getDate()} ${MONTHS_GEN[ws.getMonth()]}`;
  return `${fmtDate(ws)} – ${fmtDate(we)}`;
}
function fmtNum(n, digits = 1) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return Number(n).toLocaleString('uk-UA', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtInt(n) { return fmtNum(n, 0); }
function fmtPct(n) { return `${Math.round(n)}%`; }
function fmtSigned(n, digits = 1) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const s = fmtNum(Math.abs(n), digits);
  if (n > 0) return `+${s}`;
  if (n < 0) return `−${s}`;
  return s;
}

/* ---------- стан ---------- */

function emptyDay() { return { regime: {}, dist: { videos: 0, posts: 0, hooks: 0, replies: false }, journal: [], progress: '', closed: false }; }
function emptyWeek() { return { views: 0, subs: 0, regs: 0, top: '', systems: {}, max: '', min: '', reviewed: false }; }
function emptyMonth() { return { goal: '', goalSaved: false, subtract: '', identity: '', negviz: '', negvizSaved: false, payout: 0 }; }
function emptyYear() { return { revision: '', phases: {}, expenses: '', obligations: '' }; }

function defaultState() {
  return { version: 1, days: {}, weeks: {}, months: {}, years: {}, notToDo: [], hooks: [] };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    }
  } catch (e) { console.warn('Не вдалося прочитати збережені дані', e); }
  return defaultState();
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.error('Не вдалося зберегти', e); }
}

/* читання без створення записів — щоб порожні дні не засмічували історію */
function getDay(key) { return state.days[key] ? normDay(state.days[key]) : emptyDay(); }
function normDay(d) {
  if (!d.regime) d.regime = {};
  if (!d.dist) d.dist = { videos: 0, posts: 0, hooks: 0, replies: false };
  if (!d.journal) d.journal = [];
  if (d.progress === undefined) d.progress = '';
  return d;
}
function day(key) { if (!state.days[key]) state.days[key] = emptyDay(); return normDay(state.days[key]); }

function getWeek(key) { return Object.assign(emptyWeek(), state.weeks[key] || {}); }
function week(key) { if (!state.weeks[key]) state.weeks[key] = emptyWeek(); return state.weeks[key]; }

function getMonth(key) { return Object.assign(emptyMonth(), state.months[key] || {}); }
function month(key) { if (!state.months[key]) state.months[key] = emptyMonth(); return state.months[key]; }

function getYear(key) { return Object.assign(emptyYear(), state.years[key] || {}); }
function year(key) { if (!state.years[key]) state.years[key] = emptyYear(); return state.years[key]; }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- XP за день ---------- */

function regimeChecked(d, id) {
  if (id === 'journal') return (d.journal || []).length > 0;
  return !!(d.regime || {})[id];
}
function dayRegimeXP(d) { return REGIME.reduce((s, r) => s + (regimeChecked(d, r.id) ? r.xp : 0), 0); }
function dayDistXP(d) {
  const x = d.dist || {};
  return (x.videos || 0) * 5 + (x.posts || 0) * 5 + (x.hooks || 0) * 3 + (x.replies ? 2 : 0);
}

/* Денна норма дистрибуції — від наступного рангу з нормами (мінімум Grinder). */
function dailyTarget(level, date) {
  const idx = Math.min(5, Math.max(3, level + 1));
  const r = RANKS[idx];
  const dim = daysInMonth(date);
  const t = {
    rank: r.name,
    videos: Math.ceil(r.videos / dim),
    posts: Math.ceil(r.posts / dim),
    hooks: Math.ceil(r.hooks / dim),
  };
  t.xp = t.videos * 5 + t.posts * 5 + t.hooks * 3 + 2;
  return t;
}

/* ---------- тиждень ---------- */

function weekDayKeys(ws) { return Array.from({ length: 7 }, (_, i) => dkey(addDays(ws, i))); }

function weekStats(ws, targetXP) {
  const keys = weekDayKeys(ws);
  const st = { ws, keys, regime: 0, dist: 0, videos: 0, posts: 0, hooks: 0, perDay: [] };
  keys.forEach(k => {
    const d = getDay(k);
    const r = dayRegimeXP(d), x = dayDistXP(d);
    st.regime += r; st.dist += x;
    st.videos += d.dist.videos || 0;
    st.posts += d.dist.posts || 0;
    st.hooks += d.dist.hooks || 0;
    st.perDay.push({ key: k, regime: r, dist: x });
  });
  st.regimePct = st.regime / (REGIME_MAX * 7) * 100;
  st.distPct = targetXP ? st.dist / (targetXP * 7) * 100 : 0;
  return st;
}

function countRange(from, to, field) {
  let n = 0;
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) n += getDay(dkey(d)).dist[field] || 0;
  return n;
}
function xpRange(from, to) {
  let regime = 0, dist = 0;
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) { const x = getDay(dkey(d)); regime += dayRegimeXP(x); dist += dayDistXP(x); }
  return { regime, dist };
}

/* ---------- воронка ---------- */

function convPer1k(views, regs) { return views > 0 ? regs / views * 1000 : null; }
function weekConv(w) { return convPer1k(w.views, w.regs); }

/* Тижні місяця: тиждень належить місяцю, в якому його четвер (як ISO). */
function monthWeekStarts(mk) {
  const first = parseKey(mk + '-01');
  const res = [];
  let ws = weekStart(addDays(first, -3));
  for (let i = 0; i < 7; i++) {
    const thu = addDays(ws, 3);
    if (thu.getMonth() === first.getMonth() && thu.getFullYear() === first.getFullYear()) res.push(ws);
    ws = addDays(ws, 7);
  }
  return res;
}
function monthFunnel(mk) {
  const agg = { views: 0, subs: 0, regs: 0 };
  monthWeekStarts(mk).forEach(ws => { const w = getWeek(dkey(ws)); agg.views += w.views || 0; agg.subs += w.subs || 0; agg.regs += w.regs || 0; });
  agg.conv = convPer1k(agg.views, agg.regs);
  return agg;
}
function monthCounts(mk) {
  const first = parseKey(mk + '-01');
  const last = new Date(first.getFullYear(), first.getMonth(), daysInMonth(first));
  return {
    videos: countRange(first, last, 'videos'),
    posts: countRange(first, last, 'posts'),
    hooks: countRange(first, last, 'hooks'),
    xp: xpRange(first, last),
  };
}

/* Головний показник: реєстрації на 1000 переглядів + динаміка. */
function mainIndicator(now) {
  const curWs = weekStart(now);
  let cur = null, curWsFound = null;
  for (let i = 0; i < 52; i++) {
    const ws = addDays(curWs, -7 * i);
    const w = getWeek(dkey(ws));
    if (w.views > 0) { cur = weekConv(w); curWsFound = ws; break; }
  }
  let prev = null;
  if (curWsFound) {
    for (let i = 1; i < 52; i++) {
      const ws = addDays(curWsFound, -7 * i);
      const w = getWeek(dkey(ws));
      if (w.views > 0) { prev = weekConv(w); break; }
    }
  }
  const thisMonth = monthFunnel(mkey(now));
  const prevMonth = monthFunnel(mkey(addMonths(now, -1)));
  return {
    value: cur,
    weekLabel: curWsFound ? fmtRange(curWsFound) : null,
    isCurrentWeek: curWsFound ? sameDay(curWsFound, curWs) : false,
    vsWeek: (cur !== null && prev !== null) ? cur - prev : null,
    vsMonth: (thisMonth.conv !== null && prevMonth.conv !== null) ? thisMonth.conv - prevMonth.conv : null,
    monthConv: thisMonth.conv,
    prevMonthConv: prevMonth.conv,
  };
}

/* ---------- виплати ---------- */

function payoutsTrailing(endDate, months) {
  let s = 0;
  for (let i = 0; i < months; i++) s += Number(getMonth(mkey(addMonths(endDate, -i))).payout) || 0;
  return s;
}

/* ---------- ранги ---------- */

function weeklyPace(monthly) { return Math.round(monthly * 7 / 30); }

/* Умови переходу на ранг lvl, оцінені по тижню з понеділком ws (останній завершений). */
function rankConditions(lvl, ws) {
  const r = RANKS[lvl];
  const conds = [];
  const weekEnd = addDays(ws, 6);
  const weeks = [];
  for (let i = 0; i < r.weeks; i++) weeks.push(weekStats(addDays(ws, -7 * i)));

  let streak = 0;
  for (const w of weeks) { if (w.regimePct >= r.regime) streak++; else break; }
  conds.push({
    label: r.weeks === 1 ? `Тиждень ${r.regime}%+ по Режиму` : `${r.weeks} тижні${r.weeks >= 5 ? 'в' : ''} поспіль ${r.regime}%+ по Режиму`,
    ok: weeks.length > 0 && streak >= r.weeks,
    value: `${streak} з ${r.weeks}`,
    line: 'regime',
  });
  if (r.regular) {
    const okWeeks = weeks.filter(w => w.videos >= REGULAR_VIDEOS_PER_WEEK).length;
    conds.push({ label: `Регулярність: ${REGULAR_VIDEOS_PER_WEEK}+ відео щотижня`, ok: okWeeks >= r.weeks, value: `${okWeeks} з ${r.weeks}`, line: 'dist' });
  }
  if (r.videos) {
    const n = countRange(addDays(weekEnd, -29), weekEnd, 'videos');
    conds.push({ label: `${r.videos} відео за 30 днів`, ok: n >= r.videos, value: `${n} з ${r.videos}`, line: 'dist' });
  }
  if (r.convGrowth) {
    let m = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), 1);
    if (weekEnd.getDate() !== daysInMonth(weekEnd)) m = addMonths(m, -1);
    const c0 = monthFunnel(mkey(m)).conv, c1 = monthFunnel(mkey(addMonths(m, -1))).conv, c2 = monthFunnel(mkey(addMonths(m, -2))).conv;
    const ok = c0 !== null && c1 !== null && c2 !== null && c0 > c1 && c1 > c2;
    conds.push({ label: 'Конверсія росте 2 місяці поспіль', ok, value: [c2, c1, c0].map(c => fmtNum(c)).join(' · '), line: 'dist' });
  }
  if (r.income) {
    const s = payoutsTrailing(weekEnd, 12);
    conds.push({ label: '$300 000 з рефки за рік', ok: s >= r.income, value: `$${fmtInt(s)}`, line: 'dist' });
  }
  return { ok: conds.every(c => c.ok), conds };
}

/* Чи тиждень нижче порогу поточного рангу (для втрати рангу). */
function weekBelowRank(st, level) {
  if (level <= 0) return false;
  const r = RANKS[level];
  let below = st.regimePct < r.regime;
  if (r.videos) below = below || st.videos < weeklyPace(r.videos);
  return below;
}

/* Детерміновано перераховуємо ранг з усієї історії по завершених тижнях. */
function computeRank(now) {
  const dayKeys = Object.keys(state.days).sort();
  const weekKeys = Object.keys(state.weeks).sort();
  const firstKey = [dayKeys[0], weekKeys[0]].filter(Boolean).sort()[0];
  const res = { level: 0, belowStreak: 0, history: [], lastWeek: null };
  if (!firstKey) return res;
  const curWs = weekStart(now);
  let level = 0, below = 0;
  for (let ws = weekStart(parseKey(firstKey)); ws < curWs; ws = addDays(ws, 7)) {
    const st = weekStats(ws);
    res.lastWeek = ws;
    if (level > 0) {
      below = weekBelowRank(st, level) ? below + 1 : 0;
      if (below >= 2) { level--; below = 0; res.history.push({ week: dkey(ws), level, dir: 'down' }); continue; }
    }
    if (level < RANKS.length - 1 && rankConditions(level + 1, ws).ok) {
      level++; below = 0; res.history.push({ week: dkey(ws), level, dir: 'up' });
    }
  }
  res.level = level;
  res.belowStreak = below;
  return res;
}

/* ---------- річна лінія з просіданням ---------- */

function yearLines(y, now) {
  const start = weekStart(new Date(y, 0, 1));
  const curWs = weekStart(now);
  const endWs = y < now.getFullYear() ? weekStart(new Date(y, 11, 31)) : curWs;
  let regime = 0, dist = 0;
  for (let ws = start; ws <= endWs; ws = addDays(ws, 7)) {
    const st = weekStats(ws);
    const isCurrent = sameDay(ws, curWs);
    if (st.regime > 0) regime += st.regime; else if (!isCurrent) regime *= (1 - DECAY_PER_IDLE_WEEK);
    if (st.dist > 0) dist += st.dist; else if (!isCurrent) dist *= (1 - DECAY_PER_IDLE_WEEK);
  }
  return { regime: Math.round(regime), dist: Math.round(dist) };
}

function yearByMonth(y) {
  return Array.from({ length: 12 }, (_, m) => {
    const c = monthCounts(`${y}-${pad(m + 1)}`);
    return { m, regime: c.xp.regime, dist: c.xp.dist, videos: c.videos };
  });
}

/* ---------- місячний рівень (тільки дистрибуція) ---------- */

function monthLevel(mk) {
  const c = monthCounts(mk);
  let lvl = null;
  for (let i = RANKS.length - 1; i >= 3; i--) {
    const r = RANKS[i];
    if (c.videos >= r.videos && c.posts >= r.posts && c.hooks >= r.hooks) { lvl = i; break; }
  }
  const nextIdx = lvl === null ? 3 : Math.min(lvl + 1, RANKS.length - 1);
  return { level: lvl, name: lvl === null ? 'Нижче Grinder' : RANKS[lvl].name, next: RANKS[nextIdx], nextIdx, counts: c, maxed: lvl === RANKS.length - 1 };
}

/* ---------- експорт / імпорт ---------- */

function exportJSON() { return JSON.stringify(state, null, 2); }
function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !parsed.days) throw new Error('Це не файл XP Tracker');
  state = Object.assign(defaultState(), parsed);
  saveState();
}
