'use strict';

/* =========================================================
   XP Tracker — інтерфейс
   ========================================================= */

const ui = {
  tab: localStorage.getItem('xp-tracker-tab') || 'today',
  date: today(),                 // день на екрані «Сьогодні»
  weekStart: weekStart(today()), // тиждень на екрані «Тиждень»
  month: new Date(today().getFullYear(), today().getMonth(), 1),
  year: today().getFullYear(),
  journal: { q: '', from: '', to: '', type: 'all' },
  hooksFilter: 'all',
  entryType: 'fail',
};

const view = document.getElementById('view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- компоненти ---------- */

function ring(pct, cls, size = 116, stroke = 11) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct || 0));
  return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
    <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p / 100)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

function ringBlock(label, cls, pct, sub, size) {
  return `<div class="ring-block">
    <div class="ring-wrap">${ring(pct, cls, size)}<div class="ring-val">${Math.round(pct)}<small>%</small></div></div>
    <div class="ring-label ${cls}">${label}</div>
    <div class="ring-sub">${sub}</div>
  </div>`;
}

function twoRings(regimePct, distPct, regimeSub, distSub, size) {
  return `<div class="card"><div class="rings">
    ${ringBlock('Режим', 'blue', regimePct, regimeSub, size)}
    ${ringBlock('Дистрибуція', 'green', distPct, distSub, size)}
  </div></div>`;
}

function bar(cls, value, max, label, valueText) {
  const pct = max > 0 ? Math.min(100, value / max * 100) : 0;
  return `<div class="bar-row"><div class="bar-meta"><span>${label}</span><span>${valueText ?? `${value} з ${max}`}</span></div><div class="bar ${cls}"><i style="width:${pct}%"></i></div></div>`;
}

function head(title, sub, nav) {
  return `<div class="screen-head"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${nav ? `<div class="nav">${nav}</div>` : ''}</div>`;
}
function navButtons(action, canForward) {
  return `<button data-action="${action}" data-dir="-1" aria-label="Назад">‹</button><button data-action="${action}" data-dir="1" ${canForward ? '' : 'disabled'} aria-label="Вперед">›</button>`;
}

function textField(name, value, placeholder, extra = '') {
  return `<textarea class="field" data-field="${name}" placeholder="${esc(placeholder)}" ${extra}>${esc(value)}</textarea>`;
}

/* ---------- екран «Сьогодні» ---------- */

function renderToday() {
  const now = today();
  const d = ui.date;
  const key = dkey(d);
  const data = getDay(key);
  const isToday = sameDay(d, now);
  const rank = computeRank(now);
  const target = dailyTarget(rank.level, d);

  const regimeXP = dayRegimeXP(data);
  const distXP = dayDistXP(data);
  const regimePct = regimeXP / REGIME_MAX * 100;
  const distPct = Math.min(100, distXP / target.xp * 100);

  const kpi = mainIndicator(now);

  let html = head(isToday ? 'Сьогодні' : fmtDate(d), fmtDateFull(d), navButtons('day', !isToday));

  html += twoRings(regimePct, distPct, `${regimeXP} з ${REGIME_MAX} XP`, `${distXP} з ${target.xp} XP`);

  // головний показник
  html += `<div class="card kpi">
    <div class="kpi-label">Реєстрації на 1000 переглядів</div>
    <div class="kpi-value ${kpi.value === null ? 'empty' : ''}">${kpi.value === null ? '—' : fmtNum(kpi.value)}</div>
    <div class="kpi-deltas">
      <span>до минулого тижня <b class="${kpi.vsWeek > 0 ? 'green' : ''}">${fmtSigned(kpi.vsWeek)}</b></span>
      <span>до минулого місяця <b class="${kpi.vsMonth > 0 ? 'green' : ''}">${fmtSigned(kpi.vsMonth)}</b></span>
    </div>
    ${kpi.value === null ? `<p class="hint">Заповни воронку на екрані «Тиждень»</p>` : (kpi.isCurrentWeek ? '' : `<p class="hint">Останні дані: ${kpi.weekLabel}</p>`)}
  </div>`;

  // нагадування в неділю
  if (isToday && now.getDay() === 0) {
    const w = getWeek(dkey(weekStart(now)));
    if (!w.reviewed) {
      html += `<div class="banner"><div><div class="banner-text">Неділя. Час розбору тижня</div><div class="banner-sub">Воронка, топ-відео, прогон щоденника</div></div><button class="btn small" data-action="go" data-tab="week">Відкрити</button></div>`;
    }
  }

  // режим
  html += `<div class="card"><h2 class="card-title blue"><span>Режим</span><span class="xp">${regimeXP} XP</span></h2>`;
  REGIME.forEach(r => {
    const on = regimeChecked(data, r.id);
    html += `<div class="row">
      <button class="check ${on ? 'on' : ''}" data-action="${r.auto ? 'noop' : 'regime'}" data-id="${r.id}" ${r.auto ? 'disabled' : ''} aria-label="${esc(r.label)}"></button>
      <div class="row-main"><div class="row-label ${on ? 'done' : ''}">${r.label}</div>${r.sub ? `<div class="row-sub">${r.sub}</div>` : ''}</div>
      <span class="xp-badge blue ${on ? 'on' : ''}">${r.xp} XP</span>
    </div>`;
  });
  html += `</div>`;

  // XP-щоденник за день
  html += `<div class="card"><h2 class="card-title"><span>XP-щоденник</span><span class="xp">${data.journal.length ? `${data.journal.length} зап.` : ''}</span></h2>`;
  html += renderEntryForm(key);
  if (data.journal.length) {
    html += `<div style="margin-top:14px">` + data.journal.slice().reverse().map(e => renderEntry(e, key, false)).join('') + `</div>`;
  }
  html += `</div>`;

  // дистрибуція
  html += `<div class="card"><h2 class="card-title green"><span>Дистрибуція</span><span class="xp">${distXP} XP</span></h2>`;
  html += `<p class="hint top">Денна норма до ${target.rank}: ${target.videos} відео, ${target.posts} пост., ${target.hooks} хук.</p>`;
  DIST.forEach(x => {
    if (x.bool) {
      const on = !!data.dist.replies;
      html += `<div class="row">
        <div class="row-main"><div class="row-label">${x.label}</div></div>
        <span class="xp-badge green ${on ? 'on' : ''}">${x.xp} XP</span>
        <button class="switch green ${on ? 'on' : ''}" data-action="replies" aria-label="${esc(x.label)}"></button>
      </div>`;
    } else {
      const v = data.dist[x.id] || 0;
      html += `<div class="row">
        <div class="row-main"><div class="row-label">${x.label}</div><div class="row-sub">${x.xp} XP за одиницю</div></div>
        <div class="counter">
          <button data-action="count" data-id="${x.id}" data-delta="-1" ${v <= 0 ? 'disabled' : ''} aria-label="Менше">−</button>
          <span class="val ${v > 0 ? 'green' : ''}">${v}</span>
          <button data-action="count" data-id="${x.id}" data-delta="1" aria-label="Більше">+</button>
        </div>
      </div>`;
    }
  });
  html += `</div>`;

  // що просунуло справу
  html += `<div class="card"><h2 class="card-title">Що сьогодні реально просунуло справу</h2>
    ${textField('progress', data.progress, 'Одне речення. Обов’язково для закриття дня.', 'rows="2" style="min-height:64px"')}
    ${data.closed
      ? `<div class="status">День закрито</div>`
      : `<button class="btn" data-action="closeDay" ${data.progress.trim() ? '' : 'disabled'}>Закрити день</button>`}
  </div>`;

  return html;
}

function renderEntryForm(dayKey) {
  const t = ui.entryType;
  return `<div data-entry-form="${dayKey}">
    <div class="seg">
      <button class="${t === 'fail' ? 'active' : ''}" data-action="entryType" data-type="fail">Провал</button>
      <button class="${t === 'win' ? 'active' : ''}" data-action="entryType" data-type="win">Виграш</button>
    </div>
    <textarea class="field" data-entry="text" rows="2" placeholder="${t === 'fail' ? 'Що сталося' : 'Що спрацювало несподівано добре'}"></textarea>
    <div style="margin-top:8px">
      <textarea class="field" data-entry="system" rows="2" placeholder="${t === 'fail' ? 'Яку систему зробити, щоб не повторилось' : 'Як це масштабувати'}"></textarea>
    </div>
    <button class="btn secondary" data-action="addEntry" data-day="${dayKey}">Додати запис</button>
  </div>`;
}

function renderEntry(e, dayKey, withDate, weekKey) {
  const w = weekKey ? getWeek(weekKey) : null;
  const done = w ? !!w.systems[e.id] : false;
  return `<div class="entry">
    <div class="entry-head"><span class="tag ${e.type}">${e.type === 'fail' ? 'Провал' : 'Виграш'}</span><span>${withDate ? fmtDate(parseKey(dayKey)) : ''}</span></div>
    <div class="entry-text">${esc(e.text)}</div>
    ${e.system ? `<div class="entry-system">${esc(e.system)}</div>` : ''}
    <div class="entry-foot">
      ${weekKey ? `<button class="check small green ${done ? 'on' : ''}" data-action="systemDone" data-week="${weekKey}" data-id="${e.id}" aria-label="Впроваджено"></button><span>${e.type === 'fail' ? 'Систему впроваджено' : 'Масштабовано'}</span>` : ''}
      <span style="flex:1"></span>
      <button class="link muted" data-action="delEntry" data-day="${dayKey}" data-id="${e.id}">Видалити</button>
    </div>
  </div>`;
}

/* ---------- екран «Тиждень» ---------- */

function renderWeek() {
  const now = today();
  const ws = ui.weekStart;
  const wk = dkey(ws);
  const w = getWeek(wk);
  const rank = computeRank(now);
  const target = dailyTarget(rank.level, ws);
  const st = weekStats(ws, target.xp);
  const isCurrent = sameDay(ws, weekStart(now));
  const conv = weekConv(w);

  let html = head('Тиждень', fmtRange(ws) + (isCurrent ? ' · поточний' : ''), navButtons('week', !isCurrent));

  html += `<div class="card"><div class="rings">
    ${ringBlock('Режим', 'blue', st.regimePct, `${st.regime} з ${REGIME_MAX * 7} XP · ціль 80%`)}
    ${ringBlock('Дистрибуція', 'green', Math.min(100, st.distPct), `${st.dist} з ${target.xp * 7} XP`)}
  </div>
  <div class="strip">${st.perDay.map((p, i) => {
    const d = addDays(ws, i);
    const rh = Math.round(p.regime / REGIME_MAX * 100);
    const dh = Math.round(Math.min(100, p.dist / target.xp * 100));
    return `<div class="col ${sameDay(d, now) ? 'today' : ''}"><div class="bars"><i class="${rh ? 'blue' : ''}" style="height:${Math.max(6, rh * 0.48)}px"></i><i class="${dh ? 'green' : ''}" style="height:${Math.max(6, dh * 0.48)}px"></i></div><div class="dow">${WD_SHORT[d.getDay()]}</div></div>`;
  }).join('')}</div>
  <div class="stat-grid">
    <div class="stat"><div class="stat-v green">${st.videos}</div><div class="stat-l">відео</div></div>
    <div class="stat"><div class="stat-v green">${st.posts}</div><div class="stat-l">постів</div></div>
    <div class="stat"><div class="stat-v green">${st.hooks}</div><div class="stat-l">хуків</div></div>
  </div></div>`;

  // воронка
  const c1 = w.views > 0 ? w.subs / w.views * 100 : null;
  const c2 = w.subs > 0 ? w.regs / w.subs * 100 : null;
  html += `<div class="card"><h2 class="card-title">Розбір воронки</h2>
    <div class="funnel-step"><div class="fs-label">Перегляди</div><input class="field mono" type="number" inputmode="numeric" min="0" data-week-field="views" value="${w.views || ''}" placeholder="0"></div>
    <div class="funnel-step"><div class="fs-label">Підписки в TG<div class="fs-conv">${c1 === null ? '—' : fmtNum(c1, 2) + '% від переглядів'}</div></div><input class="field mono" type="number" inputmode="numeric" min="0" data-week-field="subs" value="${w.subs || ''}" placeholder="0"></div>
    <div class="funnel-step"><div class="fs-label">Реєстрації по рефці<div class="fs-conv">${c2 === null ? '—' : fmtNum(c2, 1) + '% від підписок'}</div></div><input class="field mono" type="number" inputmode="numeric" min="0" data-week-field="regs" value="${w.regs || ''}" placeholder="0"></div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-v">${conv === null ? '—' : fmtNum(conv)}</div><div class="stat-l">реєстрацій на 1000 переглядів</div></div>
      <div class="stat"><div class="stat-v">${c1 === null ? '—' : fmtNum(c1, 2) + '%'}</div><div class="stat-l">перегляд → підписка</div></div>
      <div class="stat"><div class="stat-v">${c2 === null ? '—' : fmtNum(c2, 1) + '%'}</div><div class="stat-l">підписка → реєстрація</div></div>
    </div>
  </div>`;

  // топ відео
  html += `<div class="card"><h2 class="card-title">Топ-2-3 відео тижня</h2>
    ${textField('week.top', w.top, 'Що зайшло і чому. Розбери на елементи: хук, тема, монтаж, заклик.', 'rows="4"')}
  </div>`;

  // прогон щоденника
  const entries = [];
  st.keys.forEach(k => getDay(k).journal.forEach(e => entries.push({ e, k })));
  html += `<div class="card"><h2 class="card-title"><span>Прогон XP-щоденника</span><span class="xp">${entries.length ? `${entries.length} зап.` : ''}</span></h2>`;
  html += entries.length ? entries.map(({ e, k }) => renderEntry(e, k, true, wk)).join('') : `<div class="empty">За цей тиждень записів немає</div>`;
  html += `</div>`;

  // незбалансований тиждень
  html += `<div class="card"><h2 class="card-title">Незбалансований наступний тиждень</h2>
    <div class="field-label">У що заливаюсь по повній</div>
    ${textField('week.max', w.max, 'Одна річ', 'rows="2" style="min-height:56px"')}
    <div class="field-label">Що в мінімум</div>
    ${textField('week.min', w.min, 'Усе інше', 'rows="2" style="min-height:56px"')}
    ${w.reviewed ? `<div class="status">Розбір тижня зроблено</div>` : `<button class="btn" data-action="reviewWeek">Розбір тижня зроблено</button>`}
  </div>`;
  return html;
}

/* ---------- екран «Місяць» ---------- */

function renderMonth() {
  const now = today();
  const m = ui.month;
  const mk = mkey(m);
  const data = getMonth(mk);
  const isCurrent = mk === mkey(now);
  const isPast = m < new Date(now.getFullYear(), now.getMonth(), 1);
  const lvl = monthLevel(mk);
  const c = lvl.counts;
  const funnel = monthFunnel(mk);
  const lastDay = new Date(m.getFullYear(), m.getMonth(), daysInMonth(m));
  const monthEnded = now >= lastDay;

  let html = head(MONTHS_NOM[m.getMonth()], `${m.getFullYear()}${isCurrent ? ' · поточний' : ''}`, navButtons('month', !isCurrent));

  // рівень
  html += `<div class="card">
    <h2 class="card-title green">Рівень місяця</h2>
    <div class="big-num">${lvl.name}</div>
    <p class="hint" style="margin-bottom:14px">Рахується тільки по дистрибуції. ${lvl.maxed ? 'Максимум.' : `Наступний: ${lvl.next.name}`}</p>
    ${bar('green', c.videos, lvl.next.videos, 'Відео')}
    ${bar('green', c.posts, lvl.next.posts, 'Пости')}
    ${bar('green', c.hooks, lvl.next.hooks, 'Хуки')}
    <div class="stat-grid">
      <div class="stat"><div class="stat-v">${fmtInt(c.xp.regime)}</div><div class="stat-l">XP режиму</div></div>
      <div class="stat"><div class="stat-v green">${fmtInt(c.xp.dist)}</div><div class="stat-l">XP дистрибуції</div></div>
      <div class="stat"><div class="stat-v">${funnel.conv === null ? '—' : fmtNum(funnel.conv)}</div><div class="stat-l">реєстр. на 1000</div></div>
    </div>
  </div>`;

  // ціль
  html += `<div class="card"><h2 class="card-title">Ціль місяця</h2>`;
  if (data.goalSaved && !monthEnded) {
    html += `<div class="status" style="margin-top:0">Ціль поставлена. Відкриється ${fmtDate(lastDay)}. Фокус на інпутах.</div>`;
  } else if (data.goalSaved) {
    html += `<div style="font-size:17px;white-space:pre-wrap">${esc(data.goal)}</div>`;
  } else if (isPast) {
    html += `<div class="empty">Ціль не ставилась</div>`;
  } else {
    html += `${textField('month.goal', data.goal, 'Одне речення. Після збереження ховається до кінця місяця.', 'rows="2" style="min-height:56px"')}
      <button class="btn" data-action="saveGoal" ${data.goal.trim() ? '' : 'disabled'}>Поставити і забути</button>`;
  }
  html += `</div>`;

  // not-to-do
  html += `<div class="card"><h2 class="card-title">Not-to-do list</h2>`;
  html += state.notToDo.length ? state.notToDo.map((t, i) => `<div class="row"><div class="row-main"><div class="row-label">${esc(t)}</div></div><button class="del" data-action="delNotToDo" data-i="${i}" aria-label="Прибрати">×</button></div>`).join('') : `<div class="empty">Порожньо. Що забороняєш собі робити?</div>`;
  html += `<div class="field-row"><input class="field" data-input="nottodo" placeholder="Додати пункт"><button class="btn small secondary" data-action="addNotToDo">Додати</button></div></div>`;

  // віднімання, ідентичність, негативна візуалізація
  html += `<div class="card"><h2 class="card-title">Дисципліна через віднімання</h2>
    ${textField('month.subtract', data.subtract, 'Що прибрати між собою і роботою', 'rows="3"')}</div>`;
  html += `<div class="card"><h2 class="card-title">Ідентичність</h2>
    <div class="field-label">Я — той тип людини, який...</div>
    ${textField('month.identity', data.identity, '…', 'rows="3"')}</div>`;

  html += `<div class="card"><h2 class="card-title">Негативна візуалізація</h2>`;
  if (data.negvizSaved) {
    html += `<div style="font-size:15px;white-space:pre-wrap;color:var(--sub)">${esc(data.negviz)}</div><div class="status">Один раз на місяць. Наступна — у наступному місяці.</div>`;
  } else if (isPast) {
    html += `<div class="empty">Не робилась</div>`;
  } else {
    html += `${textField('month.negviz', data.negviz, 'Що буде через рік, якщо нічого не зміниться. Пиши чесно.', 'rows="4"')}
      <button class="btn secondary" data-action="saveNegviz" ${data.negviz.trim() ? '' : 'disabled'}>Зберегти</button>
      <p class="hint">Після збереження — тільки читання до наступного місяця</p>`;
  }
  html += `</div>`;

  // виплати
  const per1k = funnel.views > 0 ? (Number(data.payout) || 0) / funnel.views * 1000 : null;
  html += `<div class="card"><h2 class="card-title">Виплати від брокера</h2>
    <div class="field-row"><input class="field mono" type="number" inputmode="decimal" min="0" step="0.01" data-month-field="payout" value="${data.payout || ''}" placeholder="0"><div class="field" style="width:auto;color:var(--sub)">USD</div></div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-v green">$${fmtInt(data.payout || 0)}</div><div class="stat-l">прийшло за місяць</div></div>
      <div class="stat"><div class="stat-v">${fmtInt(funnel.views)}</div><div class="stat-l">переглядів за місяць</div></div>
      <div class="stat"><div class="stat-v">${per1k === null ? '—' : '$' + fmtNum(per1k, 2)}</div><div class="stat-l">дохід на 1000 переглядів</div></div>
    </div>
    <p class="hint">Перегляди сумуються з тижневих розборів воронки</p>
  </div>`;
  return html;
}

/* ---------- екран «Рік» ---------- */

function renderYear() {
  const now = today();
  const y = ui.year;
  const data = getYear(String(y));
  const isCurrent = y === now.getFullYear();
  const rank = computeRank(now);
  const lines = yearLines(y, now);
  const byMonth = yearByMonth(y);

  let html = head(String(y), isCurrent ? 'поточний' : '', navButtons('year', !isCurrent));

  // ранг
  html += `<div class="card rank-big">
    <div class="rank-label">Ранг</div>
    <div class="rank-name">${RANKS[rank.level].name}</div>
    <div class="rank-xp"><span>Режим <b class="blue">${fmtInt(lines.regime)}</b></span><span>Дистрибуція <b class="green">${fmtInt(lines.dist)}</b></span></div>
    <div class="ladder">${RANKS.map((r, i) => `<span class="${i <= rank.level ? 'on' : ''}" title="${r.name}"></span>`).join('')}</div>
    <p class="hint">Річний XP. Тиждень без активності — мінус 2%</p>
  </div>`;

  // умови наступного рангу
  if (rank.level < RANKS.length - 1) {
    const nextLvl = rank.level + 1;
    const evalWs = addDays(weekStart(now), -7); // останній завершений тиждень
    const rc = rankConditions(nextLvl, evalWs);
    html += `<div class="card"><h2 class="card-title"><span>До рангу ${RANKS[nextLvl].name}</span><span class="xp">по завершених тижнях</span></h2>
      ${rc.conds.map(c => `<div class="cond"><span class="cond-dot ${c.ok ? 'ok' : ''}"></span><span class="cond-label">${c.label}</span><span class="cond-val">${c.value}</span></div>`).join('')}
    </div>`;
  }
  if (rank.level > 0) {
    const r = RANKS[rank.level];
    html += `<div class="card"><h2 class="card-title">Утримання рангу</h2>
      <div class="cond"><span class="cond-dot ${rank.belowStreak === 0 ? 'ok' : ''}"></span><span class="cond-label">Режим ${r.regime}%+ на тиждень${r.videos ? ` і ${weeklyPace(r.videos)}+ відео` : ''}</span><span class="cond-val">${rank.belowStreak === 0 ? 'у нормі' : `нижче ${rank.belowStreak} з 2 тижнів`}</span></div>
      <p class="hint">Два тижні поспіль нижче порогу — на один щабель нижче</p>
    </div>`;
  }

  // графік
  html += `<div class="card chart"><h2 class="card-title">Обидві лінії по місяцях</h2>${renderChart(byMonth)}
    <div class="legend"><span><i class="blue"></i>Режим</span><span><i class="green"></i>Дистрибуція</span></div></div>`;

  // ревізія
  html += `<div class="card"><h2 class="card-title">Велика ревізія напрямку</h2>
    ${textField('year.revision', data.revision, 'Чи та ніша. Чи та воронка. Що робити інакше в цьому році.', 'rows="5"')}</div>`;

  // контрбаланс
  html += `<div class="card"><h2 class="card-title">Контрбаланс</h2><p class="hint top">Фази екстремальної праці й фази відновлення</p><div class="phase-grid">`;
  for (let i = 0; i < 12; i++) {
    const v = data.phases[i] || '';
    html += `<div class="phase"><span>${MONTHS_SHORT[i]}</span><select data-phase="${i}">
      <option value="" ${v === '' ? 'selected' : ''}>—</option>
      <option value="extreme" ${v === 'extreme' ? 'selected' : ''}>Екстрим</option>
      <option value="normal" ${v === 'normal' ? 'selected' : ''}>Норма</option>
      <option value="recovery" ${v === 'recovery' ? 'selected' : ''}>Відновлення</option>
    </select></div>`;
  }
  html += `</div></div>`;

  // витрати
  html += `<div class="card"><h2 class="card-title">Витрати і зобов’язання</h2>
    <div class="field-label">Рівень витрат</div>
    ${textField('year.expenses', data.expenses, 'Скільки коштує місяць життя. Що можна зрізати.', 'rows="3"')}
    <div class="field-label">Зобов’язання</div>
    ${textField('year.obligations', data.obligations, 'Кому й що винен. Що тримає.', 'rows="3"')}</div>`;

  // дані
  html += `<div class="card"><h2 class="card-title">Дані</h2>
    <p class="hint top">Все зберігається локально в цьому браузері. Роби резервну копію.</p>
    <div class="btn-row"><button class="btn secondary" data-action="export">Експорт JSON</button><button class="btn secondary" data-action="import">Імпорт JSON</button></div>
    <input type="file" accept="application/json" id="importFile" hidden>
    <button class="btn danger" data-action="wipe">Стерти всі дані</button>
  </div>`;
  return html;
}

function renderChart(byMonth) {
  const W = 520, H = 180, padL = 8, padB = 22, padT = 10;
  const max = Math.max(1, ...byMonth.map(m => Math.max(m.regime, m.dist)));
  const gw = (W - padL * 2) / 12;
  const bw = Math.min(14, gw * 0.3);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Графік XP по місяцях">`;
  [0.5, 1].forEach(f => { const y = padT + (H - padT - padB) * (1 - f); s += `<line x1="${padL}" x2="${W - padL}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,0.08)"/>`; });
  byMonth.forEach((m, i) => {
    const x = padL + gw * i + gw / 2;
    const hR = (H - padT - padB) * m.regime / max;
    const hD = (H - padT - padB) * m.dist / max;
    s += `<rect x="${x - bw - 1.5}" y="${H - padB - hR}" width="${bw}" height="${hR}" rx="3" fill="#0A84FF"/>`;
    s += `<rect x="${x + 1.5}" y="${H - padB - hD}" width="${bw}" height="${hD}" rx="3" fill="#30D158"/>`;
    s += `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#8E8E93">${MONTHS_SHORT[i]}</text>`;
  });
  s += `<text x="${W - padL}" y="${padT + 10}" text-anchor="end" font-size="10" fill="#8E8E93">${fmtInt(max)} XP</text>`;
  return s + `</svg>`;
}

/* ---------- екран «Щоденник» ---------- */

function renderJournal() {
  const f = ui.journal;
  const all = [];
  Object.keys(state.days).forEach(k => getDay(k).journal.forEach(e => all.push({ e, k })));
  all.sort((a, b) => b.k.localeCompare(a.k) || (b.e.ts || 0) - (a.e.ts || 0));
  const q = f.q.trim().toLowerCase();
  const filtered = all.filter(({ e, k }) => {
    if (f.type !== 'all' && e.type !== f.type) return false;
    if (f.from && k < f.from) return false;
    if (f.to && k > f.to) return false;
    if (q && !(`${e.text} ${e.system || ''}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const fails = all.filter(x => x.e.type === 'fail').length;
  const wins = all.length - fails;

  let html = head('XP-щоденник', `${all.length} записів · ${fails} провалів · ${wins} виграшів`);

  html += `<div class="card"><h2 class="card-title">Новий запис · ${fmtDate(today())}</h2>${renderEntryForm(dkey(today()))}</div>`;

  html += `<div class="card">
    <input class="field" data-journal="q" value="${esc(f.q)}" placeholder="Пошук">
    <div class="field-row"><input class="field" type="date" data-journal="from" value="${f.from}"><input class="field" type="date" data-journal="to" value="${f.to}"></div>
    <div class="pill-row" style="margin-top:12px;margin-bottom:0">
      ${[['all', 'Усі'], ['fail', 'Провали'], ['win', 'Виграші']].map(([v, l]) => `<button class="pill ${f.type === v ? 'active' : ''}" data-action="journalType" data-type="${v}">${l}</button>`).join('')}
    </div>
  </div>`;

  html += `<div class="card">`;
  if (!filtered.length) html += `<div class="empty">${all.length ? 'Нічого не знайдено' : 'Записів ще немає'}</div>`;
  let lastKey = null;
  filtered.forEach(({ e, k }) => {
    if (k !== lastKey) { html += `<div class="date-group">${fmtDateFull(parseKey(k))}</div>`; lastKey = k; }
    html += renderEntry(e, k, false, dkey(weekStart(parseKey(k))));
  });
  html += `</div>`;
  return html;
}

/* ---------- екран «Банк хуків» ---------- */

function renderHooks() {
  const f = ui.hooksFilter;
  const list = state.hooks.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).filter(h => f === 'all' || (f === 'tested' ? h.tested : !h.tested));
  const tested = state.hooks.filter(h => h.tested).length;

  let html = head('Банк хуків', `${state.hooks.length} хуків · ${tested} протестовано`);
  html += `<div class="card"><h2 class="card-title">Новий хук</h2>
    <textarea class="field" data-hook="text" rows="2" placeholder="Текст хука"></textarea>
    <div class="field-row"><input class="field" data-hook="source" placeholder="Звідки"><button class="btn small secondary" data-action="addHook">Додати</button></div>
  </div>`;
  html += `<div class="pill-row">${[['all', 'Усі'], ['untested', 'Не протестовані'], ['tested', 'Протестовані']].map(([v, l]) => `<button class="pill ${f === v ? 'active' : ''}" data-action="hooksFilter" data-f="${v}">${l}</button>`).join('')}</div>`;
  html += `<div class="card">`;
  if (!list.length) html += `<div class="empty">${state.hooks.length ? 'Порожньо' : 'Хуків ще немає'}</div>`;
  list.forEach(h => {
    html += `<div class="row">
      <button class="check green ${h.tested ? 'on' : ''}" data-action="toggleHook" data-id="${h.id}" aria-label="Протестовано"></button>
      <div class="row-main"><div class="row-label ${h.tested ? 'done' : ''}">${esc(h.text)}</div><div class="row-sub">${esc(h.source || '—')}${h.testedAt ? ` · протестовано ${fmtDate(parseKey(h.testedAt))}` : ''}</div></div>
      <button class="del" data-action="delHook" data-id="${h.id}" aria-label="Видалити">×</button>
    </div>`;
  });
  html += `</div><p class="hint">Позначка «протестовано» додає +1 до сьогоднішнього лічильника хуків</p>`;
  return html;
}

/* ---------- рендер ---------- */

const SCREENS = { today: renderToday, week: renderWeek, month: renderMonth, year: renderYear, journal: renderJournal, hooks: renderHooks };

function render(keepScroll = true) {
  const y = window.scrollY;
  view.innerHTML = `<div class="fade">${SCREENS[ui.tab]()}</div>`;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
}

function go(tab) {
  ui.tab = tab;
  localStorage.setItem('xp-tracker-tab', tab);
  render(false);
}

/* ---------- дії ---------- */

const actions = {
  noop() {},
  go(el) { go(el.dataset.tab); },
  day(el) { const n = addDays(ui.date, +el.dataset.dir); if (n <= today()) { ui.date = n; render(false); } },
  week(el) { const n = addDays(ui.weekStart, 7 * +el.dataset.dir); if (n <= weekStart(today())) { ui.weekStart = n; render(false); } },
  month(el) { const n = addMonths(ui.month, +el.dataset.dir); if (n <= new Date(today().getFullYear(), today().getMonth(), 1)) { ui.month = n; render(false); } },
  year(el) { const n = ui.year + +el.dataset.dir; if (n <= today().getFullYear()) { ui.year = n; render(false); } },

  regime(el) { const d = day(dkey(ui.date)); d.regime[el.dataset.id] = !d.regime[el.dataset.id]; saveState(); render(); },
  replies() { const d = day(dkey(ui.date)); d.dist.replies = !d.dist.replies; saveState(); render(); },
  count(el) { const d = day(dkey(ui.date)); const id = el.dataset.id; d.dist[id] = Math.max(0, (d.dist[id] || 0) + +el.dataset.delta); saveState(); render(); },
  closeDay() { const d = day(dkey(ui.date)); if (!d.progress.trim()) return; d.closed = true; saveState(); render(); },

  entryType(el) { ui.entryType = el.dataset.type; render(); },
  addEntry(el) {
    const form = el.closest('[data-entry-form]');
    const text = form.querySelector('[data-entry="text"]').value.trim();
    const system = form.querySelector('[data-entry="system"]').value.trim();
    if (!text) { form.querySelector('[data-entry="text"]').focus(); return; }
    day(el.dataset.day).journal.push({ id: uid(), type: ui.entryType, text, system, ts: Date.now() });
    saveState(); render();
  },
  delEntry(el) {
    if (!confirm('Видалити запис?')) return;
    const d = day(el.dataset.day); d.journal = d.journal.filter(e => e.id !== el.dataset.id); saveState(); render();
  },
  systemDone(el) { const w = week(el.dataset.week); w.systems[el.dataset.id] = !w.systems[el.dataset.id]; saveState(); render(); },
  reviewWeek() { week(dkey(ui.weekStart)).reviewed = true; saveState(); render(); },

  saveGoal() { const m = month(mkey(ui.month)); if (!m.goal.trim()) return; m.goalSaved = true; saveState(); render(); },
  saveNegviz() { const m = month(mkey(ui.month)); if (!m.negviz.trim()) return; m.negvizSaved = true; saveState(); render(); },
  addNotToDo(el) {
    const inp = view.querySelector('[data-input="nottodo"]'); const v = inp.value.trim(); if (!v) return;
    state.notToDo.push(v); saveState(); render();
  },
  delNotToDo(el) { state.notToDo.splice(+el.dataset.i, 1); saveState(); render(); },

  journalType(el) { ui.journal.type = el.dataset.type; render(); },
  hooksFilter(el) { ui.hooksFilter = el.dataset.f; render(); },
  addHook() {
    const t = view.querySelector('[data-hook="text"]'); const s = view.querySelector('[data-hook="source"]');
    const text = t.value.trim(); if (!text) { t.focus(); return; }
    state.hooks.push({ id: uid(), text, source: s.value.trim(), tested: false, ts: Date.now() }); saveState(); render();
  },
  toggleHook(el) {
    const h = state.hooks.find(x => x.id === el.dataset.id); if (!h) return;
    const tk = dkey(today());
    if (!h.tested) { h.tested = true; h.testedAt = tk; day(tk).dist.hooks = (day(tk).dist.hooks || 0) + 1; }
    else { h.tested = false; const d = day(h.testedAt || tk); d.dist.hooks = Math.max(0, (d.dist.hooks || 0) - 1); h.testedAt = null; }
    saveState(); render();
  },
  delHook(el) { state.hooks = state.hooks.filter(x => x.id !== el.dataset.id); saveState(); render(); },

  export() {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `xp-tracker-${dkey(today())}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import() { document.getElementById('importFile').click(); },
  wipe() {
    if (!confirm('Стерти всі дані? Це не відміняється.')) return;
    if (!confirm('Точно? Зроби експорт спочатку.')) return;
    state = defaultState(); saveState(); render(false);
  },
};

view.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el);
});

/* текстові поля зберігаються на change (blur), без перерендеру */
function setField(name, value) {
  const [scope, field] = name.includes('.') ? name.split('.') : ['day', name];
  if (scope === 'day') { day(dkey(ui.date))[field] = value; }
  else if (scope === 'week') { week(dkey(ui.weekStart))[field] = value; }
  else if (scope === 'month') { month(mkey(ui.month))[field] = value; }
  else if (scope === 'year') { year(String(ui.year))[field] = value; }
  saveState();
}

view.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.field) {
    setField(t.dataset.field, t.value);
    // кнопки, що залежать від заповненості
    if (t.dataset.field === 'progress') { const b = view.querySelector('[data-action="closeDay"]'); if (b) b.disabled = !t.value.trim(); }
    if (t.dataset.field === 'month.goal') { const b = view.querySelector('[data-action="saveGoal"]'); if (b) b.disabled = !t.value.trim(); }
    if (t.dataset.field === 'month.negviz') { const b = view.querySelector('[data-action="saveNegviz"]'); if (b) b.disabled = !t.value.trim(); }
  }
  if (t.dataset.journal) { ui.journal[t.dataset.journal] = t.value; if (t.dataset.journal !== 'q') render(); else debounceRender(); }
});

view.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.weekField) { week(dkey(ui.weekStart))[t.dataset.weekField] = Math.max(0, Number(t.value) || 0); saveState(); render(); }
  if (t.dataset.monthField) { month(mkey(ui.month))[t.dataset.monthField] = Math.max(0, Number(t.value) || 0); saveState(); render(); }
  if (t.dataset.phase !== undefined) { year(String(ui.year)).phases[t.dataset.phase] = t.value; saveState(); }
  if (t.id === 'importFile' && t.files[0]) {
    const r = new FileReader();
    r.onload = () => { try { importJSON(r.result); render(false); } catch (err) { alert('Не вдалося імпортувати: ' + err.message); } };
    r.readAsText(t.files[0]);
  }
});

view.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.dataset.input === 'nottodo') { e.preventDefault(); actions.addNotToDo(); }
});

let renderTimer = null;
function debounceRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    const active = document.activeElement;
    const isSearch = active && active.dataset.journal === 'q';
    const pos = isSearch ? active.selectionStart : 0;
    render();
    if (isSearch) { const el = view.querySelector('[data-journal="q"]'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }
  }, 200);
}

document.getElementById('tabbar').addEventListener('click', e => {
  const b = e.target.closest('.tab'); if (b) go(b.dataset.tab);
});

/* новий день — повернутись на сьогодні */
let lastSeenDay = dkey(today());
function checkNewDay() {
  const n = today();
  if (dkey(n) === lastSeenDay) return;
  const wasOnYesterday = dkey(ui.date) === lastSeenDay;
  lastSeenDay = dkey(n);
  if (wasOnYesterday) { ui.date = n; ui.weekStart = weekStart(n); if (ui.tab === 'today') render(false); }
}
setInterval(checkNewDay, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });

render(false);

/* PWA: офлайн-кеш */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW', err));
}
