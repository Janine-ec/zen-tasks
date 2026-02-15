// =============================================================
// Zen Tasks - App logic
// =============================================================

(function () {
  'use strict';

  // --- All views ---
  const views = {
    home:       document.getElementById('home-view'),
    chat:       document.getElementById('chat-view'),
    tasks:      document.getElementById('tasks-view'),
    taskDetail: document.getElementById('task-detail-view'),
    settings:   document.getElementById('settings-view'),
    account:    document.getElementById('account-view'),
    about:      document.getElementById('about-view'),
  };

  // --- DOM refs ---
  const menuBtn      = document.getElementById('menu-btn');
  const menuOverlay  = document.getElementById('menu-overlay');
  const menuClose    = document.getElementById('menu-close');
  const menuItems    = document.querySelectorAll('.menu-item');
  const btnAdd       = document.getElementById('btn-add');
  const btnClear     = document.getElementById('btn-clear');
  const chatBack     = document.getElementById('chat-back');
  const chatTitle    = document.getElementById('chat-title');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput    = document.getElementById('chat-input');
  const chatSend     = document.getElementById('chat-send');
  const chatVoice    = document.getElementById('chat-voice');
  const tasksScroll  = document.getElementById('tasks-scroll');
  const tasksTabs    = document.querySelectorAll('.tasks-tab');
  const sortBtns     = document.querySelectorAll('.sort-btn');
  const taskDetailContent = document.getElementById('task-detail-content');
  const homeTopTasks = document.getElementById('home-top-tasks');
  const toggleDark   = document.getElementById('toggle-dark-mode');
  const toggleTop    = document.getElementById('toggle-top-tasks');
  const toastContainer = document.getElementById('toast-container');

  // --- State ---
  let currentMode = null;
  let chatHistory = [];
  let sending = false;
  let activeFilter = 'active';
  let activeSort = 'urgency';
  let sortAsc = false;
  let allTasks = [];

  // --- Settings (localStorage) ---
  function loadSettings() {
    if (localStorage.getItem('zen-dark') === 'true') {
      document.body.classList.add('dark');
      toggleDark.checked = true;
    }
    if (localStorage.getItem('zen-top-tasks') === 'true') {
      toggleTop.checked = true;
    }
  }

  toggleDark.addEventListener('change', () => {
    document.body.classList.toggle('dark', toggleDark.checked);
    localStorage.setItem('zen-dark', toggleDark.checked);
  });

  toggleTop.addEventListener('change', () => {
    localStorage.setItem('zen-top-tasks', toggleTop.checked);
    refreshTopTasks();
  });

  // --- View switching ---
  function showView(name) {
    Object.values(views).forEach((v) => v.classList.remove('active'));
    views[name].classList.add('active');
    menuBtn.style.display = name === 'home' ? '' : 'none';
    menuOverlay.classList.remove('open');
  }

  // --- Toast ---
  function showToast(message, type) {
    const t = document.createElement('div');
    t.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
    t.textContent = message;
    toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // --- Escape HTML ---
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // =============================================================
  // MENU
  // =============================================================

  menuBtn.addEventListener('click', () => menuOverlay.classList.add('open'));
  menuClose.addEventListener('click', () => menuOverlay.classList.remove('open'));
  menuOverlay.addEventListener('click', (e) => {
    if (e.target === menuOverlay || e.target === menuOverlay.querySelector('::before')) {
      menuOverlay.classList.remove('open');
    }
  });

  menuItems.forEach((item) => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      menuOverlay.classList.remove('open');
      if (page === 'tasks') {
        showView('tasks');
        loadTasksList();
      } else {
        showView(page);
      }
    });
  });

  // Back buttons
  document.querySelectorAll('.back-to-home').forEach((btn) => {
    btn.addEventListener('click', () => {
      showView('home');
      refreshTopTasks();
    });
  });

  document.querySelectorAll('.back-to-tasks').forEach((btn) => {
    btn.addEventListener('click', () => showView('tasks'));
  });

  // =============================================================
  // CHAT
  // =============================================================

  const PLACEHOLDERS = {
    add: "Brain dump your to do list, give me deadlines, urgency, details \u2014 I'll take care of the rest!",
    clear: "Want me to suggest a task you can do right now? Or tell me if you\u2019ve marked something off the list or want to remove an item",
  };

  function openChat(mode) {
    currentMode = mode;
    chatHistory = [];
    chatMessages.innerHTML = '';
    chatInput.value = '';
    chatInput.disabled = false;
    sending = false;

    chatTitle.textContent = mode === 'add' ? 'Add a task' : 'Clear a task';
    chatInput.placeholder = PLACEHOLDERS[mode];

    showView('chat');
    chatInput.focus();
  }

  function addAIMessage(text) {
    const div = document.createElement('div');
    div.className = 'msg msg-ai';
    div.textContent = text;
    chatMessages.appendChild(div);
    scrollChat();
  }

  function addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'msg msg-user';
    div.textContent = text;
    chatMessages.appendChild(div);
    scrollChat();
  }

  function showThinking() {
    const div = document.createElement('div');
    div.className = 'msg msg-thinking';
    div.id = 'thinking-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(div);
    scrollChat();
  }

  function hideThinking() {
    const el = document.getElementById('thinking-indicator');
    if (el) el.remove();
  }

  function scrollChat() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || sending) return;

    sending = true;
    chatInput.value = '';
    chatInput.disabled = true;

    addUserMessage(text);
    chatHistory.push({ role: 'user', content: text });
    showThinking();

    try {
      const data = await API.sendMessage(text, chatHistory, currentMode);
      hideThinking();

      // Support multiple reply messages (one per task action)
      const replies = data.replies || (data.reply ? [data.reply] : [data.message || 'Done!']);
      replies.forEach((r) => {
        addAIMessage(r);
        chatHistory.push({ role: 'assistant', content: r });
      });

      if (data.done) {
        showToast(currentMode === 'add' ? 'Tasks saved!' : 'Updated!', 'success');
      }
    } catch (err) {
      hideThinking();
      addAIMessage("Sorry, something went wrong. Please try again.");
      showToast('Connection error', 'error');
    } finally {
      sending = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  }

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  chatSend.addEventListener('click', sendMessage);
  chatBack.addEventListener('click', () => {
    showView('home');
    refreshTopTasks();
  });

  // Voice
  if (Voice.supported) {
    Voice.onResult((transcript) => { chatInput.value = transcript; sendMessage(); });
    Voice.onStateChange((on) => chatVoice.classList.toggle('listening', on));
    chatVoice.addEventListener('click', () => Voice.toggle());
  } else {
    chatVoice.style.opacity = '0.3';
    chatVoice.style.cursor = 'default';
  }

  // =============================================================
  // TASKS LIST
  // =============================================================

  function formatDue(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const diff = Math.round((d - new Date()) / 86400000);
    if (diff < 0) return { label: 'Overdue', cls: 'badge-overdue' };
    if (diff === 0) return { label: 'Today', cls: 'badge-due' };
    if (diff === 1) return { label: 'Tomorrow', cls: 'badge-due' };
    return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: 'badge-due' };
  }

  function isSnoozed(task) {
    if (!task.snoozed_until) return false;
    return new Date(task.snoozed_until) > new Date();
  }

  function renderTaskRow(task) {
    const row = document.createElement('div');
    row.className = 'task-row';
    row.dataset.id = task.id;

    let badges = '';
    badges += `<span class="badge badge-u${task.urgency || 3}">U${task.urgency || 3}</span>`;
    badges += `<span class="badge badge-i${task.importance || 3}">I${task.importance || 3}</span>`;
    const due = formatDue(task.due_date);
    if (due) badges += `<span class="badge ${due.cls}">${due.label}</span>`;
    if (isSnoozed(task)) badges += `<span class="badge badge-snoozed">Snoozed</span>`;
    if (task.status === 'completed') badges += `<span class="badge badge-closed">Done</span>`;
    if (task.status === 'deleted') badges += `<span class="badge badge-deleted">Removed</span>`;

    row.innerHTML = `
      <span class="task-row-title">${esc(task.title)}</span>
      <span class="task-row-meta">${badges}</span>
    `;

    row.addEventListener('click', () => openTaskDetail(task));
    return row;
  }

  function sortTasks(tasks) {
    const sorted = [...tasks];
    sorted.sort((a, b) => {
      let va, vb;
      if (activeSort === 'title') {
        va = (a.title || '').toLowerCase();
        vb = (b.title || '').toLowerCase();
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (activeSort === 'due_date') {
        va = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        vb = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      } else {
        va = a[activeSort] || 0;
        vb = b[activeSort] || 0;
      }
      return sortAsc ? va - vb : vb - va;
    });
    // Snoozed tasks always at the bottom
    sorted.sort((a, b) => (isSnoozed(a) ? 1 : 0) - (isSnoozed(b) ? 1 : 0));
    return sorted;
  }

  function renderTasksList(tasks) {
    tasksScroll.innerHTML = '';
    if (tasks.length === 0) {
      tasksScroll.innerHTML = `<div class="empty-state"><p>${
        activeFilter === 'active' ? 'No active tasks. Enjoy the calm!' : 'No closed tasks yet.'
      }</p></div>`;
      return;
    }
    sortTasks(tasks).forEach((t) => tasksScroll.appendChild(renderTaskRow(t)));
  }

  async function loadTasksList() {
    tasksScroll.innerHTML = '<div class="spinner"></div>';
    try {
      const status = activeFilter === 'active' ? 'pending' : 'completed';
      const data = await API.listTasks(status);
      allTasks = Array.isArray(data) ? data : data.tasks || [];
      renderTasksList(allTasks);
    } catch (err) {
      tasksScroll.innerHTML = '<div class="empty-state"><p>Could not load tasks.</p></div>';
      showToast('Failed to load tasks', 'error');
    }
  }

  tasksTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tasksTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.filter;
      loadTasksList();
    });
  });

  sortBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const sort = btn.dataset.sort;
      if (activeSort === sort) {
        sortAsc = !sortAsc;
      } else {
        activeSort = sort;
        sortAsc = false;
      }
      sortBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      btn.innerHTML = btn.dataset.sort.replace('_', ' ').replace(/^\w/, c => c.toUpperCase()) +
        `<span class="sort-arrow">${sortAsc ? '\u2191' : '\u2193'}</span>`;
      renderTasksList(allTasks);
    });
  });

  // =============================================================
  // TASK DETAIL
  // =============================================================

  function openTaskDetail(task) {
    const due = task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'None';

    let html = `
      <div class="detail-title">${esc(task.title)}</div>
      ${task.description ? `<div class="detail-desc">${esc(task.description)}</div>` : ''}
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-field-label">Urgency</div><div class="detail-field-value">${task.urgency || 3} / 5</div></div>
        <div class="detail-field"><div class="detail-field-label">Importance</div><div class="detail-field-value">${task.importance || 3} / 5</div></div>
        <div class="detail-field"><div class="detail-field-label">Deadline</div><div class="detail-field-value">${due}</div></div>
        <div class="detail-field"><div class="detail-field-label">Duration</div><div class="detail-field-value">${task.estimated_minutes ? task.estimated_minutes + ' min' : 'Unknown'}</div></div>
        <div class="detail-field"><div class="detail-field-label">Status</div><div class="detail-field-value">${esc(task.status)}</div></div>
        <div class="detail-field"><div class="detail-field-label">Location</div><div class="detail-field-value">${esc(task.location) || 'Anywhere'}</div></div>
        <div class="detail-field"><div class="detail-field-label">Energy</div><div class="detail-field-value">${esc(task.energy_level) || 'Medium'}</div></div>
        <div class="detail-field"><div class="detail-field-label">Splittable</div><div class="detail-field-value">${task.can_be_split ? 'Yes' : 'No'}</div></div>
      </div>
    `;

    if (task.tags && task.tags.length) {
      html += `<div class="detail-section-title">Tags</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px">`;
      task.tags.forEach((t) => { html += `<span class="badge" style="background:var(--accent-bg);color:var(--accent)">${esc(t)}</span>`; });
      html += `</div>`;
    }

    // AI conversation history
    const convo = task.ai_conversation;
    if (convo && Array.isArray(convo) && convo.length > 0) {
      html += `<div class="detail-section-title">Conversation</div><div class="detail-conversation">`;
      convo.forEach((msg) => {
        const cls = msg.role === 'user' ? 'detail-conv-user' : 'detail-conv-ai';
        html += `<div class="detail-conv-msg ${cls}">${esc(msg.content)}</div>`;
      });
      html += `</div>`;
    }

    taskDetailContent.innerHTML = html;
    showView('taskDetail');
  }

  // =============================================================
  // TOP TASKS ON HOMEPAGE
  // =============================================================

  async function refreshTopTasks() {
    if (localStorage.getItem('zen-top-tasks') !== 'true') {
      homeTopTasks.style.display = 'none';
      return;
    }
    homeTopTasks.style.display = '';
    homeTopTasks.innerHTML = '<div class="spinner"></div>';

    try {
      const data = await API.listTasks('pending');
      const tasks = (Array.isArray(data) ? data : data.tasks || [])
        .filter((t) => !isSnoozed(t))
        .sort((a, b) => ((b.urgency || 0) + (b.importance || 0)) - ((a.urgency || 0) + (a.importance || 0)))
        .slice(0, 3);

      homeTopTasks.innerHTML = '';
      if (tasks.length === 0) {
        homeTopTasks.style.display = 'none';
        return;
      }

      tasks.forEach((task) => {
        const row = document.createElement('div');
        row.className = 'top-task-row';
        row.innerHTML = `
          <span class="top-task-title">${esc(task.title)}</span>
          <button class="top-task-btn top-task-btn-done" data-id="${task.id}" title="Complete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button class="top-task-btn top-task-btn-snooze" data-id="${task.id}" title="Snooze">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
        `;
        homeTopTasks.appendChild(row);
      });
    } catch (err) {
      homeTopTasks.style.display = 'none';
    }
  }

  // Delegated events for top tasks
  homeTopTasks.addEventListener('click', async (e) => {
    const doneBtn = e.target.closest('.top-task-btn-done');
    if (doneBtn) {
      try {
        await API.sendMessage('I have completed this task', [{ role: 'system', content: 'Task ID: ' + doneBtn.dataset.id }], 'clear');
        showToast('Task completed!', 'success');
        refreshTopTasks();
      } catch (err) {
        showToast('Failed to complete task', 'error');
      }
      return;
    }

    const snoozeBtn = e.target.closest('.top-task-btn-snooze');
    if (snoozeBtn) {
      // Close any existing dropdown
      document.querySelectorAll('.snooze-dropdown').forEach((d) => d.remove());
      const dropdown = document.createElement('div');
      dropdown.className = 'snooze-dropdown';
      dropdown.innerHTML = `
        <button class="snooze-option" data-hours="1">1 hour</button>
        <button class="snooze-option" data-hours="24">1 day</button>
        <button class="snooze-option" data-hours="168">1 week</button>
        <button class="snooze-option" data-hours="720">1 month</button>
      `;
      snoozeBtn.appendChild(dropdown);

      dropdown.addEventListener('click', async (ev) => {
        const opt = ev.target.closest('.snooze-option');
        if (!opt) return;
        ev.stopPropagation();
        const hours = parseInt(opt.dataset.hours);
        const until = new Date(Date.now() + hours * 3600000).toISOString();
        try {
          await API.sendMessage(`Snooze this task for ${opt.textContent}`, [{ role: 'system', content: `Task ID: ${snoozeBtn.dataset.id}, snoozed_until: ${until}` }], 'clear');
          showToast(`Snoozed for ${opt.textContent}`, 'success');
          refreshTopTasks();
        } catch (err) {
          showToast('Failed to snooze', 'error');
        }
        dropdown.remove();
      });

      // Close on outside click
      setTimeout(() => {
        document.addEventListener('click', function close(ev) {
          if (!dropdown.contains(ev.target)) {
            dropdown.remove();
            document.removeEventListener('click', close);
          }
        });
      }, 0);
      return;
    }
  });

  // =============================================================
  // HOME EVENTS
  // =============================================================

  btnAdd.addEventListener('click', () => openChat('add'));
  btnClear.addEventListener('click', () => openChat('clear'));

  // =============================================================
  // INIT
  // =============================================================

  loadSettings();
  refreshTopTasks();

})();
