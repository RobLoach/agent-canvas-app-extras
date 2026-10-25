import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, COUNT_PATH, start } from './helpers.js';

const statusChecks = (host) => host.requests.filter((path) => path !== COUNT_PATH);
const counts = (host) => host.requests.filter((path) => path === COUNT_PATH);

const openA = (t, settings, status) =>
  start(t, { path: `/conversations/${A}`, settings, statuses: { [A]: status } });

test('polls every 15 seconds while a run is going', async (t) => {
  const { page, host } = await openA(t, { tabStatus: true }, 'running');
  assert.equal(statusChecks(host).length, 1);

  await page.wait(15_000);
  assert.equal(statusChecks(host).length, 2);
});

test('stops polling once nothing is running', async (t) => {
  const { page, host } = await openA(t, { notifications: true }, 'running');
  host.statuses[A] = 'finished';
  await page.wait(15_000);
  const requests = host.requests.length;

  await page.wait(60 * 60 * 1000);
  assert.equal(host.requests.length, requests);
});

test('refreshes the waiting count every 30 seconds while counting', async (t) => {
  const { page, host } = await openA(t, { appBadge: true }, 'idle');
  assert.equal(counts(host).length, 1);

  await page.wait(30_000);
  assert.equal(counts(host).length, 2);
});

test('does not poll an idle conversation', async (t) => {
  const { page, host } = await openA(t, { notifications: true }, 'idle');

  await page.wait(60 * 60 * 1000);
  assert.equal(host.requests.length, 1);
});

test('checks at most every 3 seconds, catching up after the gap', async (t) => {
  const { page, host } = await openA(t, { notifications: true }, 'idle');
  page.mutate();
  page.mutate();
  await page.wait(1000);
  assert.equal(host.requests.length, 1);

  await page.wait(2000);
  assert.equal(host.requests.length, 2, 'one check for both changes');
});

test('does not check at all while no status switch is on', async (t) => {
  const { page, host } = await openA(t, { wideCanvas: true }, 'running');
  page.returnToTab();
  await page.check();
  await page.wait(60 * 60 * 1000);
  assert.deepEqual(host.requests, []);
});

test('only checks at once for switches that need statuses', async (t) => {
  const { page, host } = await openA(t, { notifications: true }, 'idle');
  await page.changeSettings({ notifications: true, wideCanvas: true });
  await page.changeSettings({ notifications: true, wideCanvas: true, themeColor: true });
  assert.equal(host.requests.length, 1);

  await page.changeSettings({ notifications: true, wideCanvas: true, tabStatus: true });
  assert.deepEqual(host.requests.slice(1).sort(), [COUNT_PATH, `/api/conversations?ids=${A}`].sort());
});

test('a status switch turned on while a check waits out the gap checks once', async (t) => {
  const { page, host } = await openA(t, { notifications: true }, 'idle');
  await page.wait(1000);
  page.mutate();
  await page.wait(0);
  await page.changeSettings({ notifications: true, tabStatus: true });
  assert.equal(statusChecks(host).length, 2);

  await page.wait(5000);
  assert.equal(statusChecks(host).length, 2, 'not again when the gap is up');
});

test('fetches the waiting count every 30 seconds even while a run is going', async (t) => {
  const { page, host } = await openA(t, { tabStatus: true }, 'running');
  for (let quarter = 0; quarter < 4; quarter++) await page.wait(15_000);
  assert.equal(statusChecks(host).length, 5, 'statuses every 15 seconds');
  assert.equal(counts(host).length, 3, 'the count every 30');
});

test('fetches the count at once when a run it follows starts waiting', async (t) => {
  const { page, host } = await openA(t, { appBadge: true }, 'running');
  host.statuses[A] = 'waiting_for_confirmation';
  await page.check();
  assert.equal(counts(host).length, 2);
  assert.equal(page.badge, 1);
});
