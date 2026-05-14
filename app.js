/* ============================================================
   TaskFlow – app.js
   ============================================================ */

// ---------- State ----------
let tasks = [];
let currentFilter = 'all';
let currentCatFilter = 'all';
let editingId = null;
let selectedCat = 'personal';
let selectedPri = 'medium';
let editSelectedCat = 'personal';
let editSelectedPri = 'medium';

const STORAGE_KEY = 'taskflow_tasks_v2';

// ---------- DOM refs ----------
const taskInput      = document.getElementById('taskInput');
const addBtn         = document.getElementById('addBtn');
const taskList       = document.getElementById('taskList');
const emptyState     = document.getElementById('emptyState');
const progressBar    = document.getElementById('progressBar');
const progressText   = document.getElementById('progressText');
const statsDone      = document.getElementById('statsDone');
const statsTotal     = document.getElementById('statsTotal');
const headerDate     = document.getElementById('headerDate');
const clearDoneBtn   = document.getElementById('clearDoneBtn');
const catFilter      = document.getElementById('catFilter');
const dueDateInput   = document.getElementById('dueDateInput');

// Modal
const modalOverlay   = document.getElementById('modalOverlay');
const modalClose     = document.getElementById('modalClose');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalSaveBtn   = document.getElementById('modalSaveBtn');
const editInput      = document.getElementById('editInput');
const editDueDateInput = document.getElementById('editDueDateInput');

// ---------- Init ----------
function init() {
  loadTasks();
  renderDate();
  renderAll();
  bindEvents();
}

// ---------- Render date ----------
function renderDate() {
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  headerDate.textContent = now.toLocaleDateString('vi-VN', opts);
}

// ---------- Load / Save ----------
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch {
    tasks = [];
  }
}
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ---------- Generate ID ----------
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Add Task ----------
function addTask() {
  const text = taskInput.value.trim();
  if (!text) {
    taskInput.focus();
    taskInput.classList.add('shake');
    setTimeout(() => taskInput.classList.remove('shake'), 500);
    return;
  }
  const task = {
    id:        genId(),
    text,
    completed: false,
    category:  selectedCat,
    priority:  selectedPri,
    dueDate:   dueDateInput.value || null,
    createdAt: Date.now(),
  };
  tasks.unshift(task);
  saveTasks();
  taskInput.value = '';
  dueDateInput.value = '';
  renderAll();
}

// ---------- Toggle ----------
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  renderAll();
}

// ---------- Delete ----------
function deleteTask(id) {
  const el = document.querySelector(`.task-item[data-id="${id}"]`);
  if (el) {
    el.classList.add('removing');
    el.addEventListener('animationend', () => {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      renderAll();
    }, { once: true });
  }
}

// ---------- Open Edit Modal ----------
function openEdit(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingId = id;
  editInput.value = task.text;
  editDueDateInput.value = task.dueDate || '';
  setEditCat(task.category);
  setEditPri(task.priority);
  modalOverlay.classList.add('open');
  setTimeout(() => editInput.focus(), 100);
}
function closeModal() {
  modalOverlay.classList.remove('open');
  editingId = null;
}
function saveEdit() {
  if (!editingId) return;
  const text = editInput.value.trim();
  if (!text) return;
  const task = tasks.find(t => t.id === editingId);
  if (!task) return;
  task.text     = text;
  task.category = editSelectedCat;
  task.priority = editSelectedPri;
  task.dueDate  = editDueDateInput.value || null;
  saveTasks();
  renderAll();
  closeModal();
}

// ---------- Clear completed ----------
function clearCompleted() {
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  renderAll();
}

// ---------- Category & Priority pills ----------
function bindPills(containerId, setter, type) {
  document.getElementById(containerId).addEventListener('click', e => {
    const pill = e.target.closest(`[data-${type}]`);
    if (!pill) return;
    document.querySelectorAll(`#${containerId} [data-${type}]`).forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    setter(pill.dataset[type]);
  });
}

function setEditCat(cat) {
  editSelectedCat = cat;
  document.querySelectorAll('#editCategorySelect [data-cat]').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === cat);
  });
}
function setEditPri(pri) {
  editSelectedPri = pri;
  document.querySelectorAll('#editPrioritySelect [data-pri]').forEach(p => {
    p.classList.toggle('active', p.dataset.pri === pri);
  });
}

// ---------- Filter ----------
function getFilteredTasks() {
  return tasks.filter(task => {
    const matchStatus =
      currentFilter === 'all' ||
      (currentFilter === 'active'    && !task.completed) ||
      (currentFilter === 'completed' &&  task.completed);
    const matchCat =
      currentCatFilter === 'all' || task.category === currentCatFilter;
    return matchStatus && matchCat;
  });
}

// ---------- Render ----------
function renderAll() {
  renderStats();
  renderTasks();
}

function renderStats() {
  const total = tasks.length;
  const done  = tasks.filter(t => t.completed).length;
  statsDone.textContent  = done;
  statsTotal.textContent = total;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  progressBar.style.width = pct + '%';
  progressText.textContent = pct + '%';
}

const catLabels = {
  personal: '👤 Cá nhân',
  work:     '💼 Công việc',
  study:    '📚 Học tập',
  health:   '❤️ Sức khỏe',
  other:    '🌀 Khác',
};
const priLabels = {
  low:    '🟢 Thấp',
  medium: '🟡 Trung bình',
  high:   '🔴 Cao',
};

function formatDue(dateStr) {
  if (!dateStr) return null;
  const due  = new Date(dateStr + 'T23:59:59');
  const now  = new Date();
  const diff = due - now;
  const overdue = diff < 0;
  const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const label = due.toLocaleDateString('vi-VN', opts);
  return { label, overdue };
}

function renderTasks() {
  const filtered = getFilteredTasks();
  taskList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.style.display = 'flex';
    emptyState.style.flexDirection = 'column';
    emptyState.style.alignItems = 'center';
    return;
  }
  emptyState.style.display = 'none';

  filtered.forEach(task => {
    const dueInfo = formatDue(task.dueDate);

    const item = document.createElement('div');
    item.className = 'task-item' + (task.completed ? ' completed' : '');
    item.dataset.id       = task.id;
    item.dataset.priority = task.priority;

    item.innerHTML = `
      <div class="task-checkbox ${task.completed ? 'checked' : ''}"
           role="checkbox"
           aria-checked="${task.completed}"
           aria-label="Đánh dấu hoàn thành"
           tabindex="0"
           id="chk-${task.id}">
      </div>
      <div class="task-body">
        <div class="task-text">${escapeHtml(task.text)}</div>
        <div class="task-meta-row">
          <span class="tag-cat">${catLabels[task.category] || task.category}</span>
          <span class="tag-priority ${task.priority}">${priLabels[task.priority] || task.priority}</span>
          ${dueInfo ? `<span class="tag-due ${dueInfo.overdue && !task.completed ? 'overdue' : ''}">📅 ${dueInfo.label}${dueInfo.overdue && !task.completed ? ' · Quá hạn' : ''}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="action-btn edit"   aria-label="Chỉnh sửa" id="edit-${task.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="action-btn delete" aria-label="Xóa" id="del-${task.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    `;

    // Checkbox click / keypress
    const chk = item.querySelector('.task-checkbox');
    chk.addEventListener('click', () => toggleTask(task.id));
    chk.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTask(task.id); }
    });

    // Edit
    item.querySelector('.action-btn.edit').addEventListener('click', () => openEdit(task.id));

    // Delete
    item.querySelector('.action-btn.delete').addEventListener('click', () => deleteTask(task.id));

    taskList.appendChild(item);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- Bind Events ----------
function bindEvents() {
  // Add
  addBtn.addEventListener('click', addTask);
  taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Category & Priority pills (add form)
  bindPills('categorySelect', v => { selectedCat = v; }, 'cat');
  bindPills('prioritySelect', v => { selectedPri = v; }, 'pri');

  // Edit modal pills
  document.getElementById('editCategorySelect').addEventListener('click', e => {
    const pill = e.target.closest('[data-cat]');
    if (!pill) return;
    setEditCat(pill.dataset.cat);
  });
  document.getElementById('editPrioritySelect').addEventListener('click', e => {
    const pill = e.target.closest('[data-pri]');
    if (!pill) return;
    setEditPri(pill.dataset.pri);
  });

  // Filters
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderAll();
    });
  });

  catFilter.addEventListener('change', () => {
    currentCatFilter = catFilter.value;
    renderAll();
  });

  // Clear done
  clearDoneBtn.addEventListener('click', clearCompleted);

  // Modal
  modalClose.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  modalSaveBtn.addEventListener('click', saveEdit);
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });
  editInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') closeModal();
  });
}

// ---------- Shake animation ----------
const shakeCSS = `@keyframes shake {
  0%,100%{ transform: translateX(0); }
  20%{ transform: translateX(-6px); }
  40%{ transform: translateX(6px); }
  60%{ transform: translateX(-4px); }
  80%{ transform: translateX(4px); }
}
.shake { animation: shake 0.4s ease; border-color: rgba(239,68,68,0.6) !important; }`;
const styleTag = document.createElement('style');
styleTag.textContent = shakeCSS;
document.head.appendChild(styleTag);

// ---------- Start ----------
init();
