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
  assert.deepEqual(host.requests.slice(1), [`/api/conversations?ids=${A}`, COUNT_PATH]);
});
