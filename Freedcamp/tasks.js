/**
 * tasks.js — Task Command Center with Bell Notifications + Gemini AI
 */

const API_KEY = 'e73ea921952c4777e10be30ec793968f4b61fc08';
const api = new FreedcampAPI(API_KEY);

let state = { projects: [], milestones: [], tasks: [], users: [] };
let selectedArea = 'all';
let selectedProjectId = 'all';
let prioFilter = 'all';
let searchQuery = '';
let sortCol = 'priority';
let sortDir = 'asc';
let currentPage = 1;
const PAGE_SIZE = 30;

// ── Utilities ─────────────────────────────────────────────────────────────────

const formatDate = ts => {
  if (!ts || ts === '0') return '—';
  return new Date(+ts * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const projectName = id => {
  const p = state.projects.find(p => String(p.id || p.project_id) === String(id));
  return p ? (p.project_name || p.title || p.name || `Project ${id}`) : `Project ${id}`;
};

// ── Dismissed Alerts (localStorage) ───────────────────────────────────────────

const DISMISSED_KEY = 'fc_dismissed_alerts';
function getDismissed() { try { return JSON.parse(localStorage.getItem(DISMISSED_KEY)) || []; } catch { return []; } }
function addDismissed(id) { const arr = getDismissed(); if (!arr.includes(id)) { arr.push(id); localStorage.setItem(DISMISSED_KEY, JSON.stringify(arr)); } }
function resetDismissed() { localStorage.removeItem(DISMISSED_KEY); renderNotifications(); }

// ── Alert Generation ──────────────────────────────────────────────────────────

function generateAlerts(tasks) {
  const now = Date.now();
  const alerts = [];
  const active = tasks.filter(t => t.status != 1 && t.progress != 100);

  // 1. Overdue tasks — most overdue first
  active
    .filter(t => t.due_ts && (+t.due_ts * 1000) < now)
    .sort((a, b) => (+a.due_ts) - (+b.due_ts))
    .forEach(t => {
      const days = Math.ceil((now - +t.due_ts * 1000) / 86400000);
      alerts.push({
        id: `overdue-${t.id}`, type: 'critical', icon: '🔴',
        title: `${days}d Overdue: ${t.title}`,
        desc: `${t.assigned_to_fullname || 'Unassigned'} · ${projectName(t.project_id)}`,
        tags: ['Overdue', projectName(t.project_id)], score: 1000 + days
      });
    });

  // 2. High-priority due within 3 days
  active
    .filter(t => (t.priority_title || '').toLowerCase() === 'high' && t.due_ts)
    .filter(t => { const d = (+t.due_ts * 1000 - now) / 86400000; return d >= 0 && d <= 3; })
    .forEach(t => {
      const days = Math.ceil((+t.due_ts * 1000 - now) / 86400000);
      alerts.push({
        id: `highprio-${t.id}`, type: 'warning', icon: '🟠',
        title: `High Priority in ${days}d: ${t.title}`,
        desc: `${t.assigned_to_fullname || 'Unassigned'} · ${projectName(t.project_id)}`,
        tags: ['High Priority', `Due in ${days}d`], score: 800 + (3 - days) * 100
      });
    });

  // 3. Unassigned with due dates
  active
    .filter(t => !t.assigned_to_id && t.due_ts)
    .sort((a, b) => (+a.due_ts) - (+b.due_ts))
    .slice(0, 10) // Cap to prevent noise
    .forEach(t => {
      alerts.push({
        id: `unassigned-${t.id}`, type: 'warning', icon: '👤',
        title: `Unassigned: ${t.title}`,
        desc: `Due ${formatDate(t.due_ts)} · ${projectName(t.project_id)}`,
        tags: ['Unassigned', projectName(t.project_id)], score: 500
      });
    });

  // 4. High/Medium priority with no due date
  active
    .filter(t => !t.due_ts && ['high','medium'].includes((t.priority_title || '').toLowerCase()))
    .slice(0, 8)
    .forEach(t => {
      alerts.push({
        id: `nodue-${t.id}`, type: 'info', icon: '📅',
        title: `No Due Date: ${t.title}`,
        desc: `${t.priority_title} priority · ${projectName(t.project_id)}`,
        tags: ['No Due Date', t.priority_title], score: 300
      });
    });

  alerts.sort((a, b) => b.score - a.score);
  return alerts;
}

// ── Notification Panel Rendering ──────────────────────────────────────────────

function renderNotifications() {
  const list = document.getElementById('notif-list');
  list.innerHTML = '';

  const { tasks } = getActiveData();
  const allAlerts = generateAlerts(tasks);
  const dismissed = getDismissed();
  const visible = allAlerts.filter(a => !dismissed.includes(a.id));

  // Update badge
  const badge = document.getElementById('notif-badge');
  const bell = document.getElementById('notif-bell');
  if (visible.length > 0) {
    badge.textContent = visible.length > 99 ? '99+' : visible.length;
    badge.classList.remove('hidden');
    bell.classList.add('has-alerts');
  } else {
    badge.classList.add('hidden');
    bell.classList.remove('has-alerts');
  }

  if (visible.length === 0) {
    list.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">✅</div>
        <div class="notif-empty-title">All Clear!</div>
        <div class="notif-empty-desc">No pending alerts. Great work!</div>
      </div>`;
    return;
  }

  // Group: Critical → Warning → Info
  const groups = [
    { type: 'critical', label: '🚨 Critical' },
    { type: 'warning', label: '⚠️ Needs Attention' },
    { type: 'info', label: 'ℹ️ FYI' }
  ];

  groups.forEach(group => {
    const items = visible.filter(a => a.type === group.type);
    if (items.length === 0) return;

    const label = document.createElement('div');
    label.className = 'notif-section-label';
    label.textContent = `${group.label} (${items.length})`;
    list.appendChild(label);

    items.forEach(alert => {
      const el = document.createElement('div');
      el.className = `notif-item ${alert.type}`;
      el.innerHTML = `
        <span class="notif-icon">${alert.icon}</span>
        <div class="notif-body">
          <div class="notif-title">${alert.title}</div>
          <div class="notif-desc">${alert.desc}</div>
          <div class="notif-tags">${alert.tags.map(t => `<span class="notif-tag">${t}</span>`).join('')}</div>
        </div>
        <button class="notif-dismiss" title="Dismiss">✕</button>
      `;
      el.querySelector('.notif-dismiss').addEventListener('click', (e) => {
        e.stopPropagation();
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        setTimeout(() => { addDismissed(alert.id); renderNotifications(); }, 200);
      });
      list.appendChild(el);
    });
  });

  // Add AI insights at the bottom
  renderAIInsightsInPanel(list, tasks);
}

function toggleNotifPanel(open) {
  const panel = document.getElementById('notif-panel');
  const overlay = document.getElementById('notif-overlay');
  if (open === undefined) open = !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
}

// ── Gemini AI ─────────────────────────────────────────────────────────────────

let geminiCache = null;

async function fetchGeminiInsights(tasks) {
  const active = tasks.filter(t => t.status != 1 && t.progress != 100);
  const now = Date.now();
  const overdue = active.filter(t => t.due_ts && (+t.due_ts * 1000) < now);
  const highPrio = active.filter(t => (t.priority_title || '').toLowerCase() === 'high');
  const unassigned = active.filter(t => !t.assigned_to_id);

  const summary = `Active: ${active.length}, Overdue: ${overdue.length}, High priority: ${highPrio.length}, Unassigned: ${unassigned.length}
Projects: ${[...new Set(active.map(t => projectName(t.project_id)))].slice(0, 10).join(', ')}
Top 5 overdue: ${overdue.slice(0, 5).map(t => `"${t.title}" (${Math.ceil((now - +t.due_ts * 1000) / 86400000)}d, ${t.assigned_to_fullname || 'unassigned'})`).join('; ')}`;

  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `You are a project management AI for a CEO. Analyze this data and give exactly 3 brief, actionable recommendations (1-2 sentences each). Return as JSON array: [{"title":"short title","desc":"brief advice"}]\n\nData:\n${summary}`
      })
    });
    if (!res.ok) throw new Error('API unavailable');
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (match) geminiCache = JSON.parse(match[0]).slice(0, 3);
  } catch {
    // Fallback: rule-based insights
    geminiCache = [];
    const now = Date.now();
    const active = tasks.filter(t => t.status != 1 && t.progress != 100);
    const overdue = active.filter(t => t.due_ts && (+t.due_ts * 1000) < now);
    if (overdue.length > 0) geminiCache.push({ title: `Clear ${overdue.length} Overdue Tasks`, desc: `Start with "${overdue[0].title}" — ${Math.ceil((now - +overdue[0].due_ts * 1000) / 86400000)}d overdue.` });
    const unassigned = active.filter(t => !t.assigned_to_id);
    if (unassigned.length > 0) geminiCache.push({ title: `Assign ${unassigned.length} Orphaned Tasks`, desc: 'Tasks without owners drift. Assign those with due dates first.' });
    const noDue = active.filter(t => !t.due_ts);
    if (noDue.length > 0) geminiCache.push({ title: `Schedule ${noDue.length} Undated Tasks`, desc: 'Tasks without deadlines lack urgency. Prioritize the high-priority ones.' });
    if (geminiCache.length < 3) geminiCache.push({ title: 'Balance Team Workload', desc: 'Check if work is evenly distributed across team members.' });
    geminiCache = geminiCache.slice(0, 3);
  }
  return geminiCache;
}

async function renderAIInsightsInPanel(list, tasks) {
  // Loading indicator
  const loader = document.createElement('div');
  loader.className = 'notif-section-label';
  loader.textContent = '✨ AI Insights (loading…)';
  list.appendChild(loader);

  const insights = await fetchGeminiInsights(tasks);
  loader.textContent = `✨ AI Recommendations (${insights.length})`;

  insights.forEach(insight => {
    const el = document.createElement('div');
    el.className = 'notif-item ai-insight';
    el.innerHTML = `
      <span class="notif-icon">✨</span>
      <div class="notif-body">
        <div class="notif-title">${insight.title}</div>
        <div class="notif-desc">${insight.desc}</div>
        <div class="notif-tags"><span class="notif-tag">AI Insight</span></div>
      </div>
    `;
    list.appendChild(el);
  });

  // Also render on the main page banner
  renderAIBanner(insights);
}

function renderAIBanner(insights) {
  const banner = document.getElementById('ai-insight-banner');
  if (!banner || !insights.length) return;
  banner.innerHTML = `
    <div class="ai-banner-card">
      <div class="ai-banner-icon">✨</div>
      <div class="ai-banner-content">
        <div class="ai-banner-label">Gemini Recommendations</div>
        <div class="ai-banner-items">
          ${insights.map(i => `<div><div class="ai-banner-item-title">${i.title}</div><div class="ai-banner-item-desc">${i.desc}</div></div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

// ── Filtered Data ─────────────────────────────────────────────────────────────

function getActiveData() {
  let projects = state.projects;
  if (selectedArea !== 'all') projects = projects.filter(p => p.group_name === selectedArea);
  if (selectedProjectId !== 'all') projects = projects.filter(p => String(p.id) === String(selectedProjectId));
  const pIds = new Set(projects.map(p => String(p.id)));
  return { projects, tasks: state.tasks.filter(t => pIds.has(String(t.project_id))) };
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function renderStats() {
  const bar = document.getElementById('task-stats-bar');
  bar.innerHTML = '';
  const now = Date.now();
  const { tasks } = getActiveData();
  const active = tasks.filter(t => t.status != 1 && t.progress != 100);
  const overdue = active.filter(t => t.due_ts && (+t.due_ts * 1000) < now);
  const highPrio = active.filter(t => (t.priority_title || '').toLowerCase() === 'high');
  const dueSoon = active.filter(t => t.due_ts && (+t.due_ts * 1000 - now) / 86400000 <= 3 && (+t.due_ts * 1000) >= now);
  const unassigned = active.filter(t => !t.assigned_to_id);

  [
    { val: active.length, label: 'Active Tasks', color: 'var(--txt)' },
    { val: overdue.length, label: 'Overdue', color: 'var(--red)' },
    { val: highPrio.length, label: 'High Priority', color: 'var(--red)' },
    { val: dueSoon.length, label: 'Due Soon (3d)', color: 'var(--orange)' },
    { val: unassigned.length, label: 'Unassigned', color: '#a78bfa' },
  ].forEach(s => {
    const card = document.createElement('div');
    card.className = 'task-stat-card';
    card.innerHTML = `<span class="tsc-val" style="color:${s.color}">${s.val}</span><span class="tsc-lbl">${s.label}</span>`;
    bar.appendChild(card);
  });
}

// ── Filters ───────────────────────────────────────────────────────────────────

function renderAreaFilter() {
  const select = document.getElementById('area-select');
  if (!select) return;
  const groups = [...new Set(state.projects.map(p => p.group_name).filter(Boolean))].sort();
  select.innerHTML = '<option value="all">All Areas</option>';
  groups.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; if (g === selectedArea) o.selected = true; select.appendChild(o); });
}

function renderProjectFilter() {
  const select = document.getElementById('project-select');
  if (!select) return;
  let projects = state.projects;
  if (selectedArea !== 'all') projects = projects.filter(p => p.group_name === selectedArea);
  const seen = new Set();
  projects = projects.filter(p => { const k = String(p.id); if (seen.has(k)) return false; seen.add(k); return true; });
  select.innerHTML = '<option value="all">All Projects</option>';
  projects.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.project_name || p.title || 'Untitled'; if (String(p.id) === String(selectedProjectId)) o.selected = true; select.appendChild(o); });
}

// ── Task Table ────────────────────────────────────────────────────────────────

function getFilteredTasks() {
  const { tasks } = getActiveData();
  let active = tasks.filter(t => t.status != 1 && t.progress != 100);
  if (prioFilter !== 'all') active = active.filter(t => (t.priority_title || '').toLowerCase() === prioFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    active = active.filter(t => (t.title || '').toLowerCase().includes(q) || (t.assigned_to_fullname || '').toLowerCase().includes(q) || projectName(t.project_id).toLowerCase().includes(q));
  }

  const prioMap = { 'high': 0, 'medium': 1, 'low': 2 };
  active.sort((a, b) => {
    let va, vb;
    switch (sortCol) {
      case 'priority': va = prioMap[(a.priority_title || '').toLowerCase()] ?? 3; vb = prioMap[(b.priority_title || '').toLowerCase()] ?? 3; break;
      case 'title': return sortDir === 'asc' ? (a.title||'').localeCompare(b.title||'') : (b.title||'').localeCompare(a.title||'');
      case 'project': return sortDir === 'asc' ? projectName(a.project_id).localeCompare(projectName(b.project_id)) : projectName(b.project_id).localeCompare(projectName(a.project_id));
      case 'assignee': va = (a.assigned_to_fullname||'zzz'); vb = (b.assigned_to_fullname||'zzz'); return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      case 'due': va = a.due_ts ? +a.due_ts : Infinity; vb = b.due_ts ? +b.due_ts : Infinity; break;
      default: va = 0; vb = 0;
    }
    return sortDir === 'asc' ? (va - vb) : (vb - va);
  });
  return active;
}

function renderTaskTable() {
  const tbody = document.getElementById('task-table-body');
  const tasks = getFilteredTasks();
  const totalPages = Math.ceil(tasks.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = 1;
  const start = (currentPage - 1) * PAGE_SIZE;
  const page = tasks.slice(start, start + PAGE_SIZE);
  const now = Date.now();

  tbody.innerHTML = '';
  if (!page.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="tasks-empty">No tasks match your filters.</td></tr>';
    renderPagination(0, 0); return;
  }

  page.forEach(t => {
    const prio = (t.priority_title || '').toLowerCase();
    const prioClass = prio === 'high' ? 'high' : prio === 'medium' ? 'medium' : prio === 'low' ? 'low' : 'none';
    let dueHtml = '—', dueClass = '';
    if (t.due_ts) {
      const days = Math.ceil((+t.due_ts * 1000 - now) / 86400000);
      if (days < 0) { dueHtml = `${formatDate(t.due_ts)} (${Math.abs(days)}d overdue)`; dueClass = 'due-overdue'; }
      else if (days <= 3) { dueHtml = `${formatDate(t.due_ts)} (${days}d)`; dueClass = 'due-soon'; }
      else { dueHtml = formatDate(t.due_ts); dueClass = 'due-normal'; }
    }
    const isOverdue = t.due_ts && (+t.due_ts * 1000) < now;
    const statusLabel = isOverdue ? 'Overdue' : t.status == 2 ? 'In Progress' : 'Not Started';
    const statusClass = isOverdue ? 'overdue' : t.status == 2 ? 'in-progress' : 'not-started';
    const fcUrl = t.url || `https://freedcamp.com/view/${t.project_id}/tasks/${t.id}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="prio-dot ${prioClass}"></span>${t.priority_title || '—'}</td>
      <td class="td-title"><a href="${fcUrl}" target="_blank">${t.title || 'Untitled'}</a></td>
      <td>${projectName(t.project_id)}</td>
      <td>${t.assigned_to_fullname || '<span style="color:var(--txt3)">Unassigned</span>'}</td>
      <td class="${dueClass}">${dueHtml}</td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
    `;
    tbody.appendChild(tr);
  });
  renderPagination(tasks.length, totalPages);
}

function renderPagination(total, totalPages) {
  const wrap = document.getElementById('task-pagination');
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, total);
  wrap.innerHTML = `
    <div class="page-info">${total > 0 ? `Showing ${start}–${end} of ${total} tasks` : 'No tasks'}</div>
    <div class="page-btns">
      <button class="page-btn" id="prev-page" ${currentPage <= 1 ? 'disabled' : ''}>← Prev</button>
      <button class="page-btn" id="next-page" ${currentPage >= totalPages ? 'disabled' : ''}>Next →</button>
    </div>`;
  document.getElementById('prev-page')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTaskTable(); } });
  document.getElementById('next-page')?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderTaskTable(); } });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function showLoading(v) { document.getElementById('loading-overlay').style.display = v ? 'flex' : 'none'; }

async function loadData() {
  showLoading(true);
  try {
    state = await api.getDashboardData();
    renderAreaFilter();
    renderProjectFilter();
    renderStats();
    renderNotifications();
    renderTaskTable();
    document.getElementById('last-updated').textContent =
      `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch (err) {
    document.getElementById('error-banner').textContent = `Error: ${err.message}`;
    document.getElementById('error-banner').style.display = 'block';
  } finally { showLoading(false); }
}

function renderAll() { renderStats(); renderNotifications(); renderTaskTable(); }

// ── Events ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const d = new Date();
  document.getElementById('date-chip').textContent =
    d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  // Bell toggle
  document.getElementById('notif-bell')?.addEventListener('click', () => toggleNotifPanel());
  document.getElementById('notif-close')?.addEventListener('click', () => toggleNotifPanel(false));
  document.getElementById('notif-overlay')?.addEventListener('click', () => toggleNotifPanel(false));

  // Filters
  document.getElementById('area-select')?.addEventListener('change', (e) => {
    selectedArea = e.target.value; selectedProjectId = 'all';
    renderProjectFilter(); currentPage = 1; renderAll();
  });
  document.getElementById('project-select')?.addEventListener('change', (e) => {
    selectedProjectId = e.target.value; currentPage = 1; renderAll();
  });

  // Priority pills
  document.querySelectorAll('.prio-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      prioFilter = pill.dataset.prio;
      document.querySelectorAll('.prio-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active'); currentPage = 1; renderTaskTable();
    });
  });

  // Search
  let st;
  document.getElementById('task-search')?.addEventListener('input', (e) => {
    clearTimeout(st);
    st = setTimeout(() => { searchQuery = e.target.value.trim(); currentPage = 1; renderTaskTable(); }, 300);
  });

  // Table sorting
  document.querySelectorAll('.task-table thead th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortCol = col; sortDir = 'asc'; }
      document.querySelectorAll('.task-table thead th').forEach(h => h.classList.remove('sorted'));
      th.classList.add('sorted'); renderTaskTable();
    });
  });

  // Refresh & Reset
  document.getElementById('refresh-btn')?.addEventListener('click', loadData);
  document.getElementById('reset-alerts-btn')?.addEventListener('click', resetDismissed);

  checkAuthState(() => loadData());
});
