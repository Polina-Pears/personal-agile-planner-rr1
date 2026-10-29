'use strict';
(() => {
  const M = window.PlannerModel;
  const $ = id => document.getElementById(id);
  const key = 'personal-agile-planner-v1';
  const labels = { backlog: 'Бэклог', todo: 'К выполнению', progress: 'В работе', done: 'Готово' };
  const priorityLabels = { high: 'Высокий', normal: 'Обычный', low: 'Низкий' };
  let state = M.empty();
  let storageProblem = false;
  try { const raw = localStorage.getItem(key); if (raw) state = M.importJson(raw); }
  catch (_) { storageProblem = true; notify('Не удалось прочитать сохранённые данные. Импортируйте резервную копию или создайте новые задачи.', true); }
  function notify(message, error = false) { $('notice').textContent = message; $('notice').className = error ? 'visible error-notice' : 'visible'; }
  function commit(next, message) {
    try { localStorage.setItem(key, M.exportJson(next)); }
    catch (_) { throw new Error('Браузер не сохранил изменения. Освободите место или разрешите локальное хранение.'); }
    state = next; storageProblem = false; render(); notify(message);
  }
  function option(value, label) { const el = document.createElement('option'); el.value = value; el.textContent = label; return el; }
  function refreshSprints() {
    const filterValue = $('sprint-filter').value;
    $('sprint-filter').replaceChildren(option('all', 'Все задачи'), option('none', 'Без спринта'));
    $('task-sprint').replaceChildren(option('', 'Без спринта'));
    for (const sprint of state.sprints) { $('sprint-filter').append(option(sprint.id, sprint.name)); $('task-sprint').append(option(sprint.id, sprint.name)); }
    $('sprint-filter').value = [...$('sprint-filter').options].some(o => o.value === filterValue) ? filterValue : 'all';
  }
  function openTask(task = null) {
    $('task-form').reset(); $('task-error').textContent = '';
    $('task-heading').textContent = task ? 'Редактирование задачи' : 'Новая задача';
    $('task-id').value = task ? task.id : crypto.randomUUID();
    if (task) {
      for (const field of ['title', 'description', 'priority', 'points', 'status']) $('task-' + field).value = task[field];
      $('task-sprint').value = task.sprintId || '';
    } else if (!['all', 'none'].includes($('sprint-filter').value)) $('task-sprint').value = $('sprint-filter').value;
    $('task-dialog').showModal(); $('task-title').focus();
  }
  function card(task) {
    const article = document.createElement('article'); article.className = 'card';
    const meta = document.createElement('div'); meta.className = 'card-meta';
    const badge = document.createElement('span'); badge.className = 'badge ' + task.priority; badge.textContent = priorityLabels[task.priority];
    const estimate = document.createElement('span'); estimate.textContent = task.points + ' б.'; meta.append(badge, estimate);
    const title = document.createElement('h3'); title.textContent = task.title;
    article.append(meta, title);
    if (task.description) { const description = document.createElement('p'); description.textContent = task.description; article.append(description); }
    const sprint = state.sprints.find(s => s.id === task.sprintId);
    if (sprint) { const tag = document.createElement('small'); tag.textContent = sprint.name; article.append(tag); }
    const select = document.createElement('select'); select.setAttribute('aria-label', 'Статус задачи ' + task.title);
    for (const status of M.statuses) select.append(option(status, labels[status])); select.value = task.status;
    select.addEventListener('change', () => { try { commit(M.moveTask(state, task.id, select.value), 'Статус задачи изменён.'); } catch (e) { select.value = task.status; notify(e.message, true); } });
    const actions = document.createElement('div'); actions.className = 'card-actions';
    const edit = document.createElement('button'); edit.textContent = 'Изменить'; edit.setAttribute('aria-label', 'Изменить задачу ' + task.title); edit.addEventListener('click', () => openTask(task));
    const remove = document.createElement('button'); remove.textContent = 'Удалить'; remove.className = 'remove'; remove.setAttribute('aria-label', 'Удалить задачу ' + task.title); remove.addEventListener('click', () => {
      if (confirm('Удалить задачу «' + task.title + '»?')) { try { commit(M.deleteTask(state, task.id), 'Задача удалена.'); } catch (e) { notify(e.message, true); } }
    });
    actions.append(edit, remove); article.append(select, actions); return article;
  }
  function render() {
    refreshSprints();
    const sprint = $('sprint-filter').value, priority = $('priority-filter').value;
    const visible = state.tasks.filter(t => (sprint === 'all' || (sprint === 'none' ? !t.sprintId : t.sprintId === sprint)) && (priority === 'all' || t.priority === priority));
    for (const status of M.statuses) {
      const tasks = visible.filter(t => t.status === status);
      $('count-' + status).textContent = tasks.length; $('list-' + status).replaceChildren(...tasks.map(card));
      if (!tasks.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Пока нет задач'; $('list-' + status).append(empty); }
    }
    $('total-count').textContent = visible.length;
    $('active-count').textContent = state.tasks.filter(t => t.status === 'progress').length + ' / 3';
    const done = visible.filter(t => t.status === 'done'); $('done-count').textContent = done.length; $('done-points').textContent = done.reduce((sum, t) => sum + t.points, 0);
    const selectedSprint = state.sprints.find(s => s.id === sprint);
    $('sprint-info').textContent = (selectedSprint ? selectedSprint.name + ' · ' + selectedSprint.start + ' — ' + selectedSprint.end : sprint === 'none' ? 'Задачи без спринта' : 'Все задачи') + ' · В работе одновременно не более 3 задач';
  }
  $('new-task').addEventListener('click', () => openTask());
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  $('task-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const next = M.saveTask(state, { id: $('task-id').value, title: $('task-title').value, description: $('task-description').value, priority: $('task-priority').value, points: Number($('task-points').value), status: $('task-status').value, sprintId: $('task-sprint').value || null });
      commit(next, 'Задача сохранена.'); $('task-dialog').close();
    } catch (e) { $('task-error').textContent = e.message; }
  });
  $('new-sprint').addEventListener('click', () => { $('sprint-form').reset(); $('sprint-error').textContent = ''; $('sprint-dialog').showModal(); });
  $('sprint-form').addEventListener('submit', event => {
    event.preventDefault();
    try { const id = crypto.randomUUID(); commit(M.addSprint(state, { id, name: $('sprint-name').value, start: $('sprint-start').value, end: $('sprint-end').value }), 'Спринт создан.'); $('sprint-filter').value = id; render(); $('sprint-dialog').close(); }
    catch (e) { $('sprint-error').textContent = e.message; }
  });
  $('sprint-filter').addEventListener('change', render); $('priority-filter').addEventListener('change', render);
  $('export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([M.exportJson(state)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'agile-planner.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('Резервная копия подготовлена.');
  });
  $('import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async () => {
    const file = $('import-file').files[0]; if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Файл должен быть меньше 5 МБ.');
      const next = M.importJson(await file.text());
      if (confirm('Заменить текущие задачи и спринты данными из файла?')) commit(next, 'Данные импортированы.');
    } catch (e) { notify(e.message, true); }
    finally { $('import-file').value = ''; }
  });
  render(); if (storageProblem) $('notice').className = 'visible error-notice';
})();
