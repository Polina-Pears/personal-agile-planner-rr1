(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlannerModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const statuses = ['backlog', 'todo', 'progress', 'done'];
  const priorities = ['high', 'normal', 'low'];
  const points = [0, 1, 2, 3, 5, 8, 13];
  const copy = value => JSON.parse(JSON.stringify(value));
  const empty = () => ({ version: 1, tasks: [], sprints: [] });
  function fail(message) { throw new Error(message); }
  function text(value, max, label) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${label}: от 1 до ${max} символов.`);
    return value.trim();
  }
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function normalizeTask(task, state) {
    const result = {
      id: text(task.id, 100, 'Идентификатор'),
      title: text(task.title, 120, 'Название задачи'),
      description: typeof task.description === 'string' ? task.description.trim() : '',
      priority: task.priority,
      points: task.points,
      status: task.status,
      sprintId: task.sprintId || null
    };
    if (result.description.length > 2000) fail('Описание не должно превышать 2000 символов.');
    if (!priorities.includes(result.priority)) fail('Неизвестный приоритет.');
    if (!points.includes(result.points)) fail('Выберите оценку из списка.');
    if (!statuses.includes(result.status)) fail('Неизвестный статус.');
    if (result.sprintId !== null && !state.sprints.some(s => s.id === result.sprintId)) fail('Спринт не найден.');
    return result;
  }
  function normalizeSprint(sprint) {
    const result = { id: text(sprint.id, 100, 'Идентификатор'), name: text(sprint.name, 80, 'Название спринта'), start: sprint.start, end: sprint.end };
    if (!date(result.start) || !date(result.end)) fail('Укажите корректные даты спринта.');
    if (result.start > result.end) fail('Окончание спринта не может быть раньше начала.');
    return result;
  }
  function checkWip(tasks) {
    if (tasks.filter(t => t.status === 'progress').length > 3) fail('В работе уже 3 задачи. Завершите одну из них перед добавлением следующей.');
  }
  function validate(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.tasks) || !Array.isArray(value.sprints)) fail('Неподдерживаемый формат данных.');
    if (value.tasks.length > 10000 || value.sprints.length > 1000) fail('Файл слишком большой.');
    const state = { version: 1, tasks: [], sprints: value.sprints.map(normalizeSprint) };
    if (new Set(state.sprints.map(s => s.id)).size !== state.sprints.length) fail('Повторяются идентификаторы спринтов.');
    state.tasks = value.tasks.map(t => normalizeTask(t, state));
    if (new Set(state.tasks.map(t => t.id)).size !== state.tasks.length) fail('Повторяются идентификаторы задач.');
    checkWip(state.tasks);
    return state;
  }
  function saveTask(state, task) {
    const next = copy(state);
    const normalized = normalizeTask(task, next);
    const index = next.tasks.findIndex(t => t.id === normalized.id);
    if (index < 0) next.tasks.push(normalized); else next.tasks[index] = normalized;
    checkWip(next.tasks);
    return next;
  }
  function moveTask(state, id, status) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) fail('Задача не найдена.');
    return saveTask(state, { ...task, status });
  }
  function deleteTask(state, id) {
    if (!state.tasks.some(t => t.id === id)) fail('Задача не найдена.');
    return { ...copy(state), tasks: state.tasks.filter(t => t.id !== id).map(copy) };
  }
  function addSprint(state, sprint) {
    const normalized = normalizeSprint(sprint);
    if (state.sprints.some(s => s.id === normalized.id)) fail('Спринт уже существует.');
    const next = copy(state); next.sprints.push(normalized); return next;
  }
  function exportJson(state) { return JSON.stringify(validate(state), null, 2); }
  function importJson(raw) {
    if (typeof raw !== 'string' || raw.length > 5 * 1024 * 1024) fail('Файл должен быть меньше 5 МБ.');
    let value;
    try { value = JSON.parse(raw); } catch (_) { fail('Не удалось прочитать JSON.'); }
    return validate(value);
  }
  return { statuses, priorities, points, empty, validate, saveTask, moveTask, deleteTask, addSprint, exportJson, importJson };
});
