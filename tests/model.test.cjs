const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/model.js');
const task = (id, extra = {}) => ({ id, title: 'Подготовить план', description: '', priority: 'normal', points: 3, status: 'backlog', sprintId: null, ...extra });
const sprint = { id: 's1', name: 'Спринт 1', start: '2026-10-29', end: '2026-11-11' };
test('создание задачи сохраняет исходное состояние неизменным', () => {
  const before = M.empty(), after = M.saveTask(before, task('1'));
  assert.equal(before.tasks.length, 0); assert.equal(after.tasks.length, 1);
});
test('редактирование обновляет задачу без дубликата', () => {
  const state = M.saveTask(M.empty(), task('1'));
  const edited = M.saveTask(state, task('1', { title: 'Уточнить план', points: 5 }));
  assert.equal(edited.tasks.length, 1); assert.equal(edited.tasks[0].points, 5); assert.equal(state.tasks[0].points, 3);
});
test('пустое и слишком длинное название отклоняются', () => {
  for (const title of ['', '   ', 'а'.repeat(121)]) assert.throws(() => M.saveTask(M.empty(), task('1', { title })));
});
test('неизвестные статус приоритет и оценка отклоняются', () => {
  for (const extra of [{ status: 'unknown' }, { priority: 'critical' }, { points: 4 }]) assert.throws(() => M.saveTask(M.empty(), task('1', extra)));
});
test('ограничение WIP отклоняет четвёртую задачу в работе', () => {
  let state = M.empty(); for (let i = 0; i < 3; i++) state = M.saveTask(state, task(String(i), { status: 'progress' }));
  assert.throws(() => M.saveTask(state, task('4', { status: 'progress' })), /уже 3 задачи/);
  assert.equal(M.moveTask(state, '0', 'progress').tasks.length, 3);
});
test('завершение освобождает место в WIP', () => {
  let state = M.empty(); for (let i = 0; i < 3; i++) state = M.saveTask(state, task(String(i), { status: 'progress' }));
  state = M.moveTask(state, '0', 'done'); state = M.saveTask(state, task('4', { status: 'progress' }));
  assert.equal(state.tasks.filter(t => t.status === 'progress').length, 3);
});
test('удаление убирает только выбранную задачу', () => {
  let state = M.saveTask(M.empty(), task('1')); state = M.saveTask(state, task('2'));
  assert.deepEqual(M.deleteTask(state, '1').tasks.map(t => t.id), ['2']); assert.equal(state.tasks.length, 2);
});
test('задачу нельзя связать с отсутствующим спринтом', () => {
  assert.throws(() => M.saveTask(M.empty(), task('1', { sprintId: 'missing' })), /Спринт не найден/);
  const state = M.addSprint(M.empty(), sprint); assert.equal(M.saveTask(state, task('1', { sprintId: 's1' })).tasks[0].sprintId, 's1');
});
test('проверяются календарные даты и порядок дат спринта', () => {
  for (const extra of [{ start: '2026-02-30' }, { end: '2025-11-01' }, { start: '' }]) assert.throws(() => M.addSprint(M.empty(), { ...sprint, ...extra }));
});
test('экспорт и импорт полностью восстанавливают состояние', () => {
  const state = M.saveTask(M.addSprint(M.empty(), sprint), task('1', { sprintId: 's1', description: 'Учебный пример' }));
  assert.deepEqual(M.importJson(M.exportJson(state)), state);
});
test('повторяющиеся идентификаторы и нарушенный WIP при импорте отклоняются', () => {
  assert.throws(() => M.importJson(JSON.stringify({ version: 1, tasks: [task('1'), task('1')], sprints: [] })), /Повторяются/);
  assert.throws(() => M.importJson(JSON.stringify({ version: 1, tasks: [0, 1, 2, 3].map(i => task(String(i), { status: 'progress' })), sprints: [] })), /уже 3 задачи/);
});
test('повреждённый JSON и неизвестная версия отклоняются', () => {
  assert.throws(() => M.importJson('{broken'), /JSON/); assert.throws(() => M.importJson('{"version":2,"tasks":[],"sprints":[]}'), /формат/);
});
test('описание с разметкой остаётся обычным текстом данных', () => {
  const state = M.saveTask(M.empty(), task('1', { description: '<script>alert(1)</script>' }));
  assert.equal(M.importJson(M.exportJson(state)).tasks[0].description, '<script>alert(1)</script>');
});
test('слишком длинное описание и отсутствующая задача отклоняются', () => {
  assert.throws(() => M.saveTask(M.empty(), task('1', { description: 'а'.repeat(2001) })));
  assert.throws(() => M.moveTask(M.empty(), 'unknown', 'done')); assert.throws(() => M.deleteTask(M.empty(), 'unknown'));
});
