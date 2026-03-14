/**
 * app.js — CEO Dashboard application logic
 */

const API_KEY = 'e73ea921952c4777e10be30ec793968f4b61fc08';
const api = new FreedcampAPI(API_KEY);
let charts = {};
let state = { projects: [], milestones: [], tasks: [], users: [] };
let msFilter = 'all';

// ── Utilities ─────────────────────────────────────────────────────────────────

const formatDate = ts => {
  if (!ts || ts === '0') return '—';
  return new Date(+ts * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const msDaysLeft = ts => {
  if (!ts || ts === '0') return null;
  return Math.ceil((+ts * 1000 - Date.now()) / 86400000);
};

const getMsStatus = m => {
  if (m.completed == 1 || m.status == 1) return 'completed';
  const due = m.due_date ? +m.due_date * 1000 : null;
  if (due && due < Date.now()) return 'overdue';
  return 'in-progress';
};

const projectName = id => {
  const p = state.projects.find(p => String(p.id || p.project_id) === String(id));
  return p ? (p.project_name || p.title || p.name || `Project ${id}`) : `Project ${id}`;
};

const userName = (id, task) => {
  // Prefer name embedded directly in the task object
  if (task && task.assigned_to_fullname) return task.assigned_to_fullname;
  if (!id || id === 'unassigned') return 'Unassigned';
  const u = state.users.find(u => String(u.id) === String(id));
  return u ? (u.name || u.username || u.full_name || `User ${id}`) : `User ${id}`;
};

const avatarColor = name => {
  const palette = ['#4e9eff','#00e5a0','#ff5e7e','#a78bfa','#ffb740','#00b4d8','#ec4899','#f59e0b'];
  let h = 0; for (const c of name) h = (h << 5) - h + c.charCodeAt(0);
  return palette[Math.abs(h) % palette.length];
};

const initials = name => name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';

// ── Health Score ──────────────────────────────────────────────────────────────

function computeHealth(ms, tasks) {
  const totalMs = ms.length;
  const doneMs  = ms.filter(m => getMsStatus(m) === 'completed').length;
  const overdueMs = ms.filter(m => getMsStatus(m) === 'overdue').length;
  const totalT  = tasks.length;
  const doneT   = tasks.filter(t => t.completed == 1 || t.status == 1).length;

  if (!totalMs && !totalT) return 50;
  const msScore   = totalMs ? (doneMs / totalMs) * 100 : 50;
  const overduePenalty = totalMs ? (overdueMs / totalMs) * 30 : 0;
  const taskScore = totalT  ? (doneT / totalT) * 100 : 50;
  return Math.max(0, Math.min(100, Math.round(msScore * 0.5 + taskScore * 0.5 - overduePenalty)));
}

function gradeFromScore(s) {
  if (s >= 90) return { grade: 'A+', color: '#00e5a0' };
  if (s >= 80) return { grade: 'A',  color: '#00e5a0' };
  if (s >= 70) return { grade: 'B',  color: '#4e9eff' };
  if (s >= 55) return { grade: 'C',  color: '#ffb740' };
  return { grade: 'D', color: '#ff5e7e' };
}

function renderHealth() {
  const score = computeHealth(state.milestones, state.tasks);
  const { grade, color } = gradeFromScore(score);
  document.getElementById('health-score').textContent = score;
  document.getElementById('health-grade').textContent = grade;
  document.getElementById('health-grade').style.color = color;

  const overdueMs = state.milestones.filter(m => getMsStatus(m) === 'overdue').length;
  document.getElementById('health-meta').innerHTML =
    overdueMs > 0
      ? `<span style="color:#ff5e7e">⚠ ${overdueMs} overdue milestone${overdueMs>1?'s':''}</span>`
      : `<span style="color:#00e5a0">✓ On track</span>`;

  if (charts.health) charts.health.destroy();
  charts.health = new Chart(document.getElementById('health-chart'), {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [score, 100 - score],
        backgroundColor: [color, 'rgba(255,255,255,0.05)'],
        borderWidth: 0, borderRadius: 6
      }]
    },
    options: { cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 1000 } }
  });
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

function renderKPIs() {
  const ms = state.milestones;
  const t  = state.tasks;
  const done  = ms.filter(m => getMsStatus(m) === 'completed').length;
  const over  = ms.filter(m => getMsStatus(m) === 'overdue').length;

  // Active = not completed, not 100% progress
  const activeTasks  = t.filter(x => x.status != 1 && x.progress != 100);
  const overdueTasks = activeTasks.filter(x => x.due_ts && +x.due_ts * 1000 < Date.now());
  const memberIds    = new Set(activeTasks.map(x => x.assigned_to_id).filter(Boolean));

  document.getElementById('k-projects').textContent    = state.projects.length;
  document.getElementById('k-milestones').textContent  = ms.length;
  document.getElementById('k-ms-done').textContent     = `${done} / ${ms.length}`;
  document.getElementById('k-overdue').textContent     = over;
  document.getElementById('k-tasks-pct').textContent   = activeTasks.length;
  document.getElementById('k-tasks-sub').textContent   = `${overdueTasks.length} overdue`;
  document.getElementById('k-members').textContent     = memberIds.size || state.users.length;
}

// ── Milestone Doughnut ────────────────────────────────────────────────────────

function renderMilestoneChart() {
  const ms = state.milestones;
  const done = ms.filter(m => getMsStatus(m) === 'completed').length;
  const over = ms.filter(m => getMsStatus(m) === 'overdue').length;
  const prog = ms.filter(m => getMsStatus(m) === 'in-progress').length;

  document.getElementById('ms-inprogress-count').textContent = prog;

  if (charts.ms) charts.ms.destroy();
  charts.ms = new Chart(document.getElementById('ms-chart'), {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'In Progress', 'Overdue'],
      datasets: [{
        data: [done || 0, prog || 0, over || 0],
        backgroundColor: ['#00e5a0', '#4e9eff', '#ff5e7e'],
        borderWidth: 0, borderRadius: 5
      }]
    },
    options: { cutout: '70%', plugins: { legend: { display: false }, tooltip: { enabled: true } }, animation: { duration: 900 } }
  });

  document.getElementById('ms-status-row').innerHTML = `
    <div class="ms-stat"><span class="ms-dot" style="background:#00e5a0"></span><span class="ms-stat-num">${done}</span><span class="ms-stat-lbl">Done</span></div>
    <div class="ms-stat"><span class="ms-dot" style="background:#4e9eff"></span><span class="ms-stat-num">${prog}</span><span class="ms-stat-lbl">In Progress</span></div>
    <div class="ms-stat"><span class="ms-dot" style="background:#ff5e7e"></span><span class="ms-stat-num">${over}</span><span class="ms-stat-lbl">Overdue</span></div>
  `;
}

// ── Team Leaderboard ──────────────────────────────────────────────────────────

function renderLeaderboard() {
  const NOW = Date.now();
  const SOON = NOW + 7 * 86400000; // 7 days

  // Build per-person stats using ACTIVE tasks only
  const nameCache = {};
  const map = {};

  state.tasks.forEach(t => {
    const uid  = t.assigned_to_id || '__none__';
    const name = t.assigned_to_fullname || '';
    if (uid !== '__none__' && name && !nameCache[uid]) nameCache[uid] = name;
    if (!map[uid]) map[uid] = { id: uid, active: 0, overdue: 0, dueSoon: 0, notStarted: 0, inProgress: 0, activeTasks: [] };

    const isActive = t.status != 1 && t.progress != 100;
    if (!isActive) return;   // skip completed tasks entirely

    map[uid].active++;
    map[uid].activeTasks.push(t);

    const due = t.due_ts ? +t.due_ts * 1000 : null;
    if (due && due < NOW)         map[uid].overdue++;
    else if (due && due <= SOON)  map[uid].dueSoon++;

    if (t.status === 0 || t.status === '0') map[uid].notStarted++;
    else map[uid].inProgress++;
  });

  const members = Object.values(map)
    .filter(m => m.id !== '__none__' && m.active > 0)
    .map(m => ({ ...m, displayName: nameCache[m.id] || `User ${m.id}` }))
    // Sort: most overdue first, then most active tasks
    .sort((a, b) => b.overdue - a.overdue || b.active - a.active);

  if (!members.length) {
    document.getElementById('leaderboard').innerHTML =
      '<div class="empty-state">All tasks are completed — nothing active right now.</div>';
    document.getElementById('team-sub').textContent = '0 active members';
    return;
  }

  document.getElementById('team-sub').textContent =
    `${members.length} member${members.length !== 1 ? 's' : ''} · ${members.reduce((s,m)=>s+m.active,0)} live tasks`;

  const board = document.getElementById('leaderboard');
  board.innerHTML = '';

  // ── Alert: Unassigned active tasks ──────────────────────────────────────────
  const unassigned = state.tasks.filter(t =>
    t.status != 1 && t.progress != 100 && !t.assigned_to_id
  );
  if (unassigned.length > 0) {
    const names = [...new Set(unassigned.map(t => t.title || 'Untitled'))].slice(0, 3);
    const el = document.createElement('div');
    el.className = 'alert-card warn-unassigned';
    el.innerHTML = `
      <div class="alert-icon">👤</div>
      <div class="alert-info">
        <div class="alert-title">Unassigned Tasks</div>
        <div class="alert-sub">${names.join(' · ')}${unassigned.length > 3 ? ` +${unassigned.length - 3} more` : ''}</div>
      </div>
      <div class="alert-count">${unassigned.length}</div>
    `;
    board.appendChild(el);
  }

  // ── Alert: Active tasks with no due date ────────────────────────────────────
  const noDueDate = state.tasks.filter(t =>
    t.status != 1 && t.progress != 100 && !t.due_ts
  );
  if (noDueDate.length > 0) {
    const names = [...new Set(noDueDate.map(t => t.title || 'Untitled'))].slice(0, 3);
    const el = document.createElement('div');
    el.className = 'alert-card warn-nodue';
    el.innerHTML = `
      <div class="alert-icon">📅</div>
      <div class="alert-info">
        <div class="alert-title">No Due Date Set</div>
        <div class="alert-sub">${names.join(' · ')}${noDueDate.length > 3 ? ` +${noDueDate.length - 3} more` : ''}</div>
      </div>
      <div class="alert-count">${noDueDate.length}</div>
    `;
    board.appendChild(el);
  }

  // ── Individual scorecards ────────────────────────────────────────────────────
  members.forEach(m => {
    const name  = m.displayName;
    const color = avatarColor(name);
    const urgency = m.overdue > 0 ? 'urgent' : m.dueSoon > 0 ? 'soon' : 'ok';

    const card = document.createElement('div');
    card.className = `sc-card urgency-${urgency}`;
    card.innerHTML = `
      <div class="sc-header">
        <div class="sc-avatar" style="background:${color}">${initials(name)}</div>
        <div class="sc-info">
          <div class="sc-name">${name}</div>
          <div class="sc-active-label">${m.active} active task${m.active!==1?'s':''}</div>
        </div>
        <div class="sc-urgency-badge urgency-${urgency}">
          ${m.overdue > 0
            ? `<span>⚠ ${m.overdue} overdue</span>`
            : m.dueSoon > 0
              ? `<span>⏰ ${m.dueSoon} due soon</span>`
              : `<span>✓ On track</span>`}
        </div>
      </div>
      <div class="sc-stats">
        <div class="sc-stat">
          <span class="sc-stat-val" style="color:#4e9eff">${m.inProgress}</span>
          <span class="sc-stat-lbl">In Progress</span>
        </div>
        <div class="sc-stat">
          <span class="sc-stat-val" style="color:#ffb740">${m.notStarted}</span>
          <span class="sc-stat-lbl">Not Started</span>
        </div>
        <div class="sc-stat">
          <span class="sc-stat-val" style="color:#ff5e7e">${m.overdue}</span>
          <span class="sc-stat-lbl">Overdue</span>
        </div>
        <div class="sc-stat">
          <span class="sc-stat-val" style="color:#00e5a0">${m.dueSoon}</span>
          <span class="sc-stat-lbl">Due This Week</span>
        </div>
      </div>
    `;
    board.appendChild(card);
  });
}

// ── Milestone Cards ───────────────────────────────────────────────────────────

// ── Milestone Modal ──
function openMilestoneDrawer(ms) {
  const status = getMsStatus(ms);
  const tasks = state.tasks.filter(t => t.ms_id == ms.id);
  const doneTasks = tasks.filter(t => t.status == 1 || t.progress == 100);

  document.getElementById('ms-modal-title').textContent = ms.title || ms.name || 'Untitled';
  document.getElementById('ms-modal-project').textContent = projectName(ms.project_id);
  document.getElementById('ms-modal-tasks-total').textContent = tasks.length;
  document.getElementById('ms-modal-tasks-done').textContent = doneTasks.length;
  document.getElementById('ms-modal-due').textContent = formatDate(ms.due_date);
  document.getElementById('ms-modal-status').textContent = status.toUpperCase();
  document.getElementById('ms-modal-status').style.color = status === 'completed' ? '#00e5a0' : status === 'overdue' ? '#ff5e7e' : '#4e9eff';

  const listEl = document.getElementById('ms-modal-tasks-list');
  listEl.innerHTML = '';

  if (tasks.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No tasks linked to this milestone.</div>';
  } else {
    tasks.forEach(t => {
      const isDone = t.status == 1 || t.progress == 100;
      const isProgress = t.status == 2;
      const tStatus = isDone ? 'Done' : isProgress ? 'In Progress' : 'Not Started';
      const tClass = isDone ? 'tag-done' : isProgress ? 'tag-inprogress' : 'tag-notstarted';
      const fcUrl = t.url || `https://freedcamp.com/view/${t.project_id}/tasks/${t.id}`;

      const row = document.createElement('a');
      row.className = 'dt-row';
      row.href = fcUrl;
      row.target = '_blank';
      row.innerHTML = `
        <div class="dt-main">
          <span class="dt-title">${t.title || 'Untitled'}</span>
          <div class="dt-tags">
            <span class="dt-tag ${tClass}">${tStatus}</span>
            ${t.assigned_to_fullname ? `<span class="dt-tag tag-proj">${t.assigned_to_fullname}</span>` : ''}
          </div>
        </div>
        <div class="dt-link">↗</div>
      `;
      listEl.appendChild(row);
    });
  }

  document.getElementById('milestone-drawer').classList.add('open');
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMilestoneDrawer() {
  document.getElementById('milestone-drawer').classList.remove('open');
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderMilestoneCards() {
  const wrap = document.getElementById('ms-cards-wrap');
  wrap.innerHTML = '';

  let ms = msFilter === 'all' ? state.milestones : state.milestones.filter(m => getMsStatus(m) === msFilter);
  // Sort: overdue first, then by due date, then by name
  ms = [...ms].sort((a, b) => {
    const sa = getMsStatus(a), sb = getMsStatus(b);
    if (sa === 'overdue' && sb !== 'overdue') return -1;
    if (sb === 'overdue' && sa !== 'overdue') return 1;
    return (+a.due_date || Infinity) - (+b.due_date || Infinity);
  });

  if (!ms.length) {
    wrap.innerHTML = '<div class="empty-state">No milestones in this category.</div>';
    return;
  }

  ms.forEach(m => {
    const status  = getMsStatus(m);
    const name    = m.title || m.name || 'Untitled';
    const proj    = m.project_id ? projectName(m.project_id) : '—';
    const days    = msDaysLeft(m.due_date);
    const dateStr = formatDate(m.due_date);
    let daysLabel = '';
    if (status === 'in-progress' && days !== null) {
      daysLabel = days > 0 ? `${days}d left` : 'Due today';
    } else if (status === 'overdue' && days !== null) {
      daysLabel = `${Math.abs(days)}d overdue`;
    }

    const card = document.createElement('div');
    card.className = `ms-card ms-${status}`;
    card.style.cursor = 'pointer';
    card.title = 'Click to see milestone details and tasks';
    card.innerHTML = `
      <div class="ms-card-top">
        <span class="ms-status-dot status-${status}"></span>
        <span class="ms-card-name">${name}</span>
        ${daysLabel ? `<span class="ms-days-label ${status === 'overdue' ? 'red' : ''}">${daysLabel}</span>` : ''}
      </div>
      <div class="ms-card-bot">
        <span class="ms-project-tag">${proj}</span>
        <span class="ms-date-tag">${dateStr}</span>
      </div>
    `;
    card.addEventListener('click', () => openMilestoneDrawer(m));
    wrap.appendChild(card);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function showLoading(v) { document.getElementById('loading-overlay').style.display = v ? 'flex' : 'none'; }
function showError(msg) {
  const el = document.getElementById('error-banner');
  el.textContent = msg; el.style.display = msg ? 'block' : 'none';
}

async function loadData() {
  showLoading(true); showError('');
  try {
    const data = await api.getDashboardData();
    state = data;
    renderHealth();
    renderKPIs();
    renderMilestoneChart();
    renderLeaderboard();
    renderMilestoneCards();
    const now = new Date();
    document.getElementById('last-updated').textContent =
      `Last updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    document.getElementById('date-chip').textContent =
      now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    console.error(e);
    showError(`Error: ${e.message}`);
  } finally { showLoading(false); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refresh-btn').onclick = loadData;
  document.getElementById('ms-modal-close').onclick = closeMilestoneDrawer;
  document.getElementById('modal-overlay').onclick = closeMilestoneDrawer;
  document.addEventListener('keydown', e => { if (e.key==='Escape') closeMilestoneDrawer(); });

  // Milestone filter pills
  document.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      msFilter = btn.dataset.filter;
      renderMilestoneCards();
    });
  });

  // PROTECT ACCESS
  checkAuthState(() => {
    loadData();
  });
});
