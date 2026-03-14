/**
 * team.js — Dedicated Team Performance Dashboard (with clickable detail drawer)
 */

const API_KEY = 'e73ea921952c4777e10be30ec793968f4b61fc08';
const api     = new FreedcampAPI(API_KEY);
let state     = { projects: [], tasks: [] };
let sortMode  = 'overdue';
let membersCache = [];

// ── Utilities ──────────────────────────────────────────────────────────────
const NOW  = () => Date.now();
const SOON = () => NOW() + 7 * 86400000;

const formatDate = ts => {
  if (!ts) return '—';
  return new Date(+ts * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const daysLabel = ts => {
  if (!ts) return null;
  const diff = Math.ceil((+ts * 1000 - NOW()) / 86400000);
  if (diff < 0)   return { text: `${Math.abs(diff)}d overdue`, cls: 'tag-overdue' };
  if (diff === 0) return { text: 'Due today',    cls: 'tag-soon' };
  if (diff <= 7)  return { text: `${diff}d left`, cls: 'tag-soon' };
  return { text: `in ${diff}d`, cls: 'tag-ok' };
};

const avatarColor = name => {
  const p = ['#4e9eff','#00e5a0','#ff5e7e','#a78bfa','#ffb740','#00b4d8','#ec4899','#f59e0b'];
  let h = 0; for (const c of name) h = (h << 5) - h + c.charCodeAt(0);
  return p[Math.abs(h) % p.length];
};
const initials = name => name.split(' ').map(w => w[0]||'').join('').toUpperCase().slice(0,2)||'?';
const statusLabel = t => {
  if (String(t.status) === '1' || t.progress === 100) return { text: 'Completed', cls: 'tag-done' };
  if (String(t.status) === '2') return { text: 'In Progress', cls: 'tag-inprogress' };
  return { text: 'Not Started', cls: 'tag-notstarted' };
};

// ── Build member data ──────────────────────────────────────────────────────
function buildMembers() {
  const nameCache = {};
  const map = {};
  state.tasks.forEach(t => {
    const uid  = t.assigned_to_id || '__none__';
    const name = t.assigned_to_fullname || '';
    if (uid !== '__none__' && name && !nameCache[uid]) nameCache[uid] = name;
    if (!map[uid]) map[uid] = { id: uid, active:0, overdue:0, dueSoon:0, inProgress:0, notStarted:0, tasks:[] };
    const isActive = String(t.status) !== '1' && t.progress !== 100;
    if (!isActive) return;
    map[uid].active++;
    map[uid].tasks.push(t);
    const due = t.due_ts ? +t.due_ts * 1000 : null;
    if (due && due < NOW())        map[uid].overdue++;
    else if (due && due <= SOON()) map[uid].dueSoon++;
    if (!t.status || String(t.status) === '0') map[uid].notStarted++;
    else map[uid].inProgress++;
  });
  return Object.values(map)
    .filter(m => m.id !== '__none__' && m.active > 0)
    .map(m => ({ ...m, displayName: nameCache[m.id] || `User ${m.id}` }));
}

function sortMembers(members) {
  return [...members].sort((a,b) => {
    if (sortMode === 'overdue') return b.overdue - a.overdue || b.active - a.active;
    if (sortMode === 'active')  return b.active - a.active;
    if (sortMode === 'name')    return a.displayName.localeCompare(b.displayName);
    return 0;
  });
}

// ── Drawer ─────────────────────────────────────────────────────────────────
function openDrawer(member) {
  const color = avatarColor(member.displayName);
  const urgency = member.overdue > 0 ? 'urgent' : member.dueSoon > 0 ? 'soon' : 'ok';

  // Header
  const av = document.getElementById('drawer-avatar');
  av.textContent = initials(member.displayName);
  av.style.background = color;
  document.getElementById('drawer-name').textContent = member.displayName;
  document.getElementById('drawer-meta').textContent =
    `${member.active} active task${member.active!==1?'s':''} · ${member.overdue} overdue · ${member.dueSoon} due this week`;

  // KPIs
  document.getElementById('drawer-kpis').innerHTML = `
    <div class="dk-item"><span class="dk-val" style="color:#4e9eff">${member.inProgress}</span><span class="dk-lbl">In Progress</span></div>
    <div class="dk-item"><span class="dk-val" style="color:#ffb740">${member.notStarted}</span><span class="dk-lbl">Not Started</span></div>
    <div class="dk-item"><span class="dk-val" style="color:#ff5e7e">${member.overdue}</span><span class="dk-lbl">Overdue</span></div>
    <div class="dk-item"><span class="dk-val" style="color:#00e5a0">${member.dueSoon}</span><span class="dk-lbl">Due This Week</span></div>
  `;

  // Task list — sorted: overdue first, then by due date
  const tasks = [...member.tasks].sort((a, b) => {
    const aOver = a.due_ts && +a.due_ts * 1000 < NOW();
    const bOver = b.due_ts && +b.due_ts * 1000 < NOW();
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return 1;
    return (+a.due_ts || Infinity) - (+b.due_ts || Infinity);
  });

  const tasksEl = document.getElementById('drawer-tasks');
  tasksEl.innerHTML = '';
  tasks.forEach(t => {
    const dl  = t.due_ts ? daysLabel(t.due_ts) : null;
    const sl  = statusLabel(t);
    const proj = t.task_group_name || '—';
    const fcUrl = t.url || `https://freedcamp.com/view/${t.project_id}/tasks/${t.id}`;

    const row = document.createElement('a');
    row.className = 'dt-row';
    row.href = fcUrl;
    row.target = '_blank';
    row.rel = 'noopener';
    row.innerHTML = `
      <div class="dt-main">
        <span class="dt-title">${t.title || 'Untitled'}</span>
        <div class="dt-tags">
          <span class="dt-tag ${sl.cls}">${sl.text}</span>
          ${dl ? `<span class="dt-tag ${dl.cls}">${dl.text}</span>` : '<span class="dt-tag tag-nodue">No date</span>'}
          <span class="dt-tag tag-proj">${proj}</span>
          ${t.priority_title ? `<span class="dt-tag tag-priority">${t.priority_title}</span>` : ''}
        </div>
      </div>
      <div class="dt-due">${t.due_ts ? formatDate(t.due_ts) : '—'}</div>
      <div class="dt-link">↗</div>
    `;
    tasksEl.appendChild(row);
  });

  document.getElementById('member-drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  document.getElementById('member-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Render summary bar ─────────────────────────────────────────────────────
function renderSummary(members) {
  const all = state.tasks.filter(t => String(t.status) !== '1' && t.progress !== 100);
  document.getElementById('ts-members').textContent    = members.length;
  document.getElementById('ts-active').textContent     = all.length;
  document.getElementById('ts-overdue').textContent    = members.reduce((s,m)=>s+m.overdue,0);
  document.getElementById('ts-soon').textContent       = members.reduce((s,m)=>s+m.dueSoon,0);
  document.getElementById('ts-unassigned').textContent = all.filter(t=>!t.assigned_to_id).length;
  document.getElementById('ts-nodue').textContent      = all.filter(t=>!t.due_ts).length;
}

// ── Render alert cards ─────────────────────────────────────────────────────
function renderAlerts() {
  const all        = state.tasks.filter(t => String(t.status) !== '1' && t.progress !== 100);
  const unassigned = all.filter(t => !t.assigned_to_id);
  const noDue      = all.filter(t => !t.due_ts);
  const container  = document.getElementById('team-alerts');
  container.innerHTML = '';

  const makeAlert = (cls, icon, title, tasks) => {
    if (!tasks.length) return;
    const div = document.createElement('div');
    div.className = `team-alert-card ${cls}`;
    const rows = tasks.slice(0, 8).map(t => {
      const fcUrl = t.url || `https://freedcamp.com/view/${t.project_id}/tasks/${t.id}`;
      return `<a href="${fcUrl}" target="_blank" rel="noopener" class="ta-row">
        <span class="ta-proj">${t.task_group_name||'—'}</span>
        <span class="ta-name">${t.title||'Untitled'}</span>
        <span class="ta-link">↗</span>
      </a>`;
    }).join('');
    div.innerHTML = `
      <div class="ta-header">
        <span class="ta-icon">${icon}</span>
        <span class="ta-title">${title}</span>
        <span class="ta-count">${tasks.length} task${tasks.length!==1?'s':''}</span>
      </div>
      <div class="ta-list">${rows}${tasks.length > 8 ? `<div class="ta-more">+${tasks.length-8} more…</div>` : ''}</div>
    `;
    container.appendChild(div);
  };

  makeAlert('alert-unassigned','👤','Unassigned — needs an owner', unassigned);
  makeAlert('alert-nodue','📅','No Due Date — missing a deadline', noDue);
}

// ── Render member grid ─────────────────────────────────────────────────────
function renderGrid(members) {
  const grid = document.getElementById('team-grid');
  grid.innerHTML = '';
  if (!members.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">🎉 All tasks complete — nothing active right now.</div>';
    return;
  }
  sortMembers(members).forEach(m => {
    const color   = avatarColor(m.displayName);
    const urgency = m.overdue > 0 ? 'urgent' : m.dueSoon > 0 ? 'soon' : 'ok';
    const taskRows = [...m.tasks]
      .sort((a,b) => {
        const aO = a.due_ts && +a.due_ts*1000 < NOW();
        const bO = b.due_ts && +b.due_ts*1000 < NOW();
        if (aO && !bO) return -1; if (!aO && bO) return 1;
        return (+a.due_ts||Infinity) - (+b.due_ts||Infinity);
      })
      .map(t => {
        const dl  = t.due_ts ? daysLabel(t.due_ts) : null;
        const stat = String(t.status) === '2' ? 'in-progress' : 'not-started';
        return `<div class="tc-row">
          <span class="tc-dot status-${stat}"></span>
          <span class="tc-name" title="${t.title||''}">${t.title||'Untitled'}</span>
          <span class="tc-proj">${t.task_group_name||'—'}</span>
          ${dl ? `<span class="tc-tag ${dl.cls}">${dl.text}</span>` : '<span class="tc-tag tag-nodue">No date</span>'}
        </div>`;
      }).join('');

    const card = document.createElement('div');
    card.className = `member-card urgency-${urgency}`;
    card.title = 'Click to see full task breakdown';
    card.innerHTML = `
      <div class="mc-header">
        <div class="mc-avatar" style="background:${color}">${initials(m.displayName)}</div>
        <div class="mc-info">
          <div class="mc-name">${m.displayName}</div>
          <div class="mc-meta">${m.active} active task${m.active!==1?'s':''}</div>
        </div>
        <div class="mc-badge urgency-${urgency}">
          ${m.overdue>0?`⚠ ${m.overdue} overdue`:m.dueSoon>0?`⏰ ${m.dueSoon} due soon`:'✓ On track'}
        </div>
      </div>
      <div class="mc-kpis">
        <div class="mc-kpi"><span class="mc-kpi-val" style="color:#4e9eff">${m.inProgress}</span><span class="mc-kpi-lbl">In Progress</span></div>
        <div class="mc-kpi"><span class="mc-kpi-val" style="color:#ffb740">${m.notStarted}</span><span class="mc-kpi-lbl">Not Started</span></div>
        <div class="mc-kpi"><span class="mc-kpi-val" style="color:#ff5e7e">${m.overdue}</span><span class="mc-kpi-lbl">Overdue</span></div>
        <div class="mc-kpi"><span class="mc-kpi-val" style="color:#00e5a0">${m.dueSoon}</span><span class="mc-kpi-lbl">Due This Week</span></div>
      </div>
      <div class="mc-tasks">
        <div class="mc-tasks-header">Live Tasks <span class="mc-click-hint">Click card to open full detail ↗</span></div>
        ${taskRows}
      </div>
    `;
    card.addEventListener('click', () => openDrawer(m));
    grid.appendChild(card);
  });
}

function renderAll() {
  membersCache = buildMembers();
  renderSummary(membersCache);
  renderAlerts();
  renderGrid(membersCache);
}

// ── Init ───────────────────────────────────────────────────────────────────
function showLoading(v) { document.getElementById('loading-overlay').style.display = v?'flex':'none'; }
function showError(msg) { const el=document.getElementById('error-banner'); el.textContent=msg; el.style.display=msg?'block':'none'; }

async function loadData() {
  showLoading(true); showError('');
  try {
    const [projects, tasks] = await Promise.all([api.getProjects(), api.getTasks()]);
    state = { projects, tasks };
    renderAll();
    const now = new Date();
    document.getElementById('last-updated').textContent =
      `Last updated ${now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
    document.getElementById('date-chip').textContent =
      now.toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  } catch(e) { console.error(e); showError(`Error: ${e.message}`); }
  finally { showLoading(false); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refresh-btn').onclick = loadData;
  document.getElementById('drawer-close').onclick = closeDrawer;
  document.getElementById('drawer-overlay').onclick = closeDrawer;
  document.addEventListener('keydown', e => { if (e.key==='Escape') closeDrawer(); });

  document.querySelectorAll('.sort-pills .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-pills .pill').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      sortMode = btn.dataset.sort;
      renderGrid(membersCache);
    });
  });

  // PROTECT ACCESS
  checkAuthState(() => {
    loadData();
  });
});
