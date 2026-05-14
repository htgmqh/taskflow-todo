/* ============================================================
   TaskFlow – app.js (Firebase version)
   ============================================================ */

// ---------- Firebase services ----------
const auth = firebase.auth();
const db   = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ---------- State ----------
let currentUser   = null;
let unsubscribeFn = null;   // Firestore listener cleanup
let tasks         = [];
let currentFilter    = 'all';
let currentCatFilter = 'all';
let editingId     = null;
let selectedCat   = 'personal';
let selectedPri   = 'medium';
let editSelectedCat = 'personal';
let editSelectedPri = 'medium';

// ---------- DOM refs ----------
const loginScreen    = document.getElementById('loginScreen');
const appWrapper     = document.getElementById('appWrapper');
const googleSignInBtn= document.getElementById('googleSignInBtn');
const signOutBtn     = document.getElementById('signOutBtn');
const userAvatar     = document.getElementById('userAvatar');
const userName       = document.getElementById('userName');
const userEmail      = document.getElementById('userEmail');
const userMenu       = document.getElementById('userMenu');
const syncBar        = document.getElementById('syncBar');
const syncDot        = syncBar.querySelector('.sync-dot');
const syncText       = document.getElementById('syncText');

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

const modalOverlay   = document.getElementById('modalOverlay');
const modalClose     = document.getElementById('modalClose');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalSaveBtn   = document.getElementById('modalSaveBtn');
const editInput      = document.getElementById('editInput');
const editDueDateInput = document.getElementById('editDueDateInput');

// ---------- Auth ----------
googleSignInBtn.addEventListener('click', () => {
  auth.signInWithPopup(googleProvider).catch(err => {
    console.error('Sign in error:', err);
    alert('Đăng nhập thất bại. Vui lòng thử lại.');
  });
});

signOutBtn.addEventListener('click', () => {
  if (unsubscribeFn) unsubscribeFn();
  auth.signOut();
});

// Toggle dropdown
userAvatar.addEventListener('click', () => userMenu.classList.toggle('open'));
document.addEventListener('click', e => {
  if (!userMenu.contains(e.target)) userMenu.classList.remove('open');
});

// Auth state
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    loginScreen.style.display  = 'none';
    appWrapper.style.display   = 'block';
    userAvatar.src   = user.photoURL || '';
    userName.textContent  = user.displayName || 'User';
    userEmail.textContent = user.email || '';
    renderDate();
    bindEvents();
    subscribeToTasks();
  } else {
    currentUser = null;
    if (unsubscribeFn) { unsubscribeFn(); unsubscribeFn = null; }
    loginScreen.style.display = 'flex';
    appWrapper.style.display  = 'none';
    tasks = [];
  }
});

// ---------- Firestore ----------
function getTasksRef() {
  return db.collection('users').doc(currentUser.uid).collection('tasks');
}

function subscribeToTasks() {
  showSync(true);
  if (unsubscribeFn) unsubscribeFn();

  unsubscribeFn = getTasksRef()
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      showSync(false);
      renderAll();
    }, err => {
      console.error('Firestore error:', err);
      showSync(false);
    });
}

function showSync(loading) {
  syncBar.style.display = 'flex';
  if (loading) {
    syncDot.classList.remove('synced');
    syncText.textContent = 'Đang đồng bộ...';
  } else {
    syncDot.classList.add('synced');
    syncText.textContent = 'Đã đồng bộ';
    setTimeout(() => { syncBar.style.display = 'none'; }, 2000);
  }
}

// ---------- CRUD ----------
async function addTask() {
  const text = taskInput.value.trim();
  if (!text) {
    taskInput.classList.add('shake');
    setTimeout(() => taskInput.classList.remove('shake'), 500);
    return;
  }
  showSync(true);
  try {
    await getTasksRef().add({
      text,
      completed: false,
      category:  selectedCat,
      priority:  selectedPri,
      dueDate:   dueDateInput.value || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    taskInput.value    = '';
    dueDateInput.value = '';
  } catch (e) {
    console.error('Add error:', e);
    alert('Lỗi thêm task. Kiểm tra kết nối mạng.');
    showSync(false);
  }
}

async function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  showSync(true);
  await getTasksRef().doc(id).update({ completed: !task.completed });
}

async function deleteTask(id) {
  const el = document.querySelector(`.task-item[data-id="${id}"]`);
  if (el) {
    el.classList.add('removing');
    await new Promise(r => el.addEventListener('animationend', r, { once: true }));
  }
  showSync(true);
  await getTasksRef().doc(id).delete();
}

async function saveEdit() {
  if (!editingId) return;
  const text = editInput.value.trim();
  if (!text) return;
  showSync(true);
  await getTasksRef().doc(editingId).update({
    text,
    category: editSelectedCat,
    priority: editSelectedPri,
    dueDate:  editDueDateInput.value || null,
  });
  closeModal();
}

async function clearCompleted() {
  const done = tasks.filter(t => t.completed);
  showSync(true);
  const batch = db.batch();
  done.forEach(t => batch.delete(getTasksRef().doc(t.id)));
  await batch.commit();
}

// ---------- Modal ----------
function openEdit(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingId = id;
  editInput.value        = task.text;
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
function setEditCat(cat) {
  editSelectedCat = cat;
  document.querySelectorAll('#editCategorySelect [data-cat]').forEach(p =>
    p.classList.toggle('active', p.dataset.cat === cat));
}
function setEditPri(pri) {
  editSelectedPri = pri;
  document.querySelectorAll('#editPrioritySelect [data-pri]').forEach(p =>
    p.classList.toggle('active', p.dataset.pri === pri));
}

// ---------- Render ----------
const catLabels = { personal:'👤 Cá nhân', work:'💼 Công việc', study:'📚 Học tập', health:'❤️ Sức khỏe', other:'🌀 Khác' };
const priLabels = { low:'🟢 Thấp', medium:'🟡 Trung bình', high:'🔴 Cao' };

function renderDate() {
  const now = new Date();
  headerDate.textContent = now.toLocaleDateString('vi-VN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

function getFiltered() {
  return tasks.filter(t => {
    const st = currentFilter === 'all' || (currentFilter==='active' && !t.completed) || (currentFilter==='completed' && t.completed);
    const ct = currentCatFilter === 'all' || t.category === currentCatFilter;
    return st && ct;
  });
}

function renderAll() {
  const total = tasks.length;
  const done  = tasks.filter(t => t.completed).length;
  statsDone.textContent  = done;
  statsTotal.textContent = total;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  progressBar.style.width = pct + '%';
  progressText.textContent = pct + '%';

  const filtered = getFiltered();
  taskList.innerHTML = '';
  emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

  filtered.forEach(task => {
    const dueInfo = formatDue(task.dueDate);
    const item = document.createElement('div');
    item.className = 'task-item' + (task.completed ? ' completed' : '');
    item.dataset.id       = task.id;
    item.dataset.priority = task.priority;
    item.innerHTML = `
      <div class="task-checkbox ${task.completed ? 'checked' : ''}" role="checkbox" aria-checked="${task.completed}" tabindex="0" id="chk-${task.id}"></div>
      <div class="task-body">
        <div class="task-text">${escapeHtml(task.text)}</div>
        <div class="task-meta-row">
          <span class="tag-cat">${catLabels[task.category] || task.category}</span>
          <span class="tag-priority ${task.priority}">${priLabels[task.priority] || task.priority}</span>
          ${dueInfo ? `<span class="tag-due ${dueInfo.overdue && !task.completed ? 'overdue' : ''}">📅 ${dueInfo.label}${dueInfo.overdue && !task.completed ? ' · Quá hạn' : ''}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="action-btn edit" aria-label="Chỉnh sửa" id="edit-${task.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="action-btn delete" aria-label="Xóa" id="del-${task.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`;

    const chk = item.querySelector('.task-checkbox');
    chk.addEventListener('click', () => toggleTask(task.id));
    chk.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleTask(task.id);} });
    item.querySelector('.action-btn.edit').addEventListener('click', () => openEdit(task.id));
    item.querySelector('.action-btn.delete').addEventListener('click', () => deleteTask(task.id));
    taskList.appendChild(item);
  });
}

function formatDue(dateStr) {
  if (!dateStr) return null;
  const due  = new Date(dateStr + 'T23:59:59');
  const overdue = due < new Date();
  return { label: due.toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric'}), overdue };
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function bindPills(containerId, setter, type) {
  document.getElementById(containerId).addEventListener('click', e => {
    const pill = e.target.closest(`[data-${type}]`);
    if (!pill) return;
    document.querySelectorAll(`#${containerId} [data-${type}]`).forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    setter(pill.dataset[type]);
  });
}

// ---------- Event Bindings ----------
function bindEvents() {
  addBtn.addEventListener('click', addTask);
  taskInput.addEventListener('keydown', e => { if(e.key==='Enter') addTask(); });

  bindPills('categorySelect', v => { selectedCat = v; }, 'cat');
  bindPills('prioritySelect', v => { selectedPri = v; }, 'pri');

  document.getElementById('editCategorySelect').addEventListener('click', e => {
    const pill = e.target.closest('[data-cat]');
    if (pill) setEditCat(pill.dataset.cat);
  });
  document.getElementById('editPrioritySelect').addEventListener('click', e => {
    const pill = e.target.closest('[data-pri]');
    if (pill) setEditPri(pill.dataset.pri);
  });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderAll();
    });
  });

  catFilter.addEventListener('change', () => { currentCatFilter = catFilter.value; renderAll(); });
  clearDoneBtn.addEventListener('click', clearCompleted);

  modalClose.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  modalSaveBtn.addEventListener('click', saveEdit);
  modalOverlay.addEventListener('click', e => { if(e.target===modalOverlay) closeModal(); });
  editInput.addEventListener('keydown', e => { if(e.key==='Enter') saveEdit(); if(e.key==='Escape') closeModal(); });
}

// Shake animation
const s = document.createElement('style');
s.textContent = `@keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-6px);}40%{transform:translateX(6px);}60%{transform:translateX(-4px);}80%{transform:translateX(4px);}}.shake{animation:shake 0.4s ease;border-color:rgba(239,68,68,0.6)!important;}`;
document.head.appendChild(s);
