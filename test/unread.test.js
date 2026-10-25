import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, flush, start } from './helpers.js';

const READ = 'openhands-extras:read';
// Canvas's links have dashes, which the Agent Server's ids drop.
const dashed = (id) =>
  `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
// The sidebar's conversation cards, as Canvas renders them.
const card = (id, title) =>
  `<a href="/conversations/${dashed(id)}?backend=local"><div data-testid="conversation-card"><div><span data-testid="conversation-status-working"></span><p data-testid="conversation-card-title">${title}</p></div></div></a>`;
const SIDEBAR = `<div data-testid="conversation-panel">${card(A, 'Alpha')}${card(B, 'Beta')}</div>`;

const EARLIER = '2026-10-24T10:00:00.000000Z';
const LATER = '2026-10-24T11:00:00.000000Z';
const LATEST = '2026-10-24T12:00:00.000000Z';

// The titles marked unread, in sidebar order.
const unread = (page) =>
  [...page.document.querySelectorAll('[data-extras-unread]')].map(
    (dot) => dot.previousElementSibling.textContent,
  );

const open = (t, { path = '/apps', settings = { unreadMarkers: true }, ...options } = {}) =>
  start(t, {
    path,
    body: SIDEBAR,
    settings,
    updated: { [A]: EARLIER, [B]: EARLIER },
    ...options,
  });

test('counts everything so far as read, then marks what changes', async (t) => {
  const { page, host } = await open(t);
  assert.deepEqual(unread(page), []);
  assert.equal(JSON.parse(page.window.localStorage.getItem(READ)).since, Date.parse(EARLIER));

  host.updated[A] = LATER;
  await page.check();
  assert.deepEqual(unread(page), ['Alpha']);
  const dot = page.document.querySelector('[data-extras-unread]');
  assert.equal(dot.textContent, 'Unread', 'named for screen readers');
  assert.equal(host.requests.at(-1), `/api/conversations?ids=${A}&ids=${B}`);
});

test('clears a conversation once you open it, and keeps it read as you watch', async (t) => {
  const { page, host } = await open(t);
  host.updated[A] = LATER;
  await page.check();
  assert.deepEqual(unread(page), ['Alpha']);

  page.navigate(`/conversations/${dashed(A)}`);
  await page.check();
  assert.deepEqual(unread(page), []);

  host.updated[A] = LATEST;
  await page.check();
  page.navigate('/apps');
  await page.check();
  assert.deepEqual(unread(page), []);
});

test('marks the open conversation when it changes while you are away', async (t) => {
  const { page, host } = await open(t, { path: `/conversations/${dashed(A)}` });
  // In another app, with Canvas still on screen.
  page.focused = false;
  host.updated[A] = LATER;
  await page.check();
  assert.deepEqual(unread(page), ['Alpha']);

  page.returnToTab();
  await flush();
  assert.deepEqual(unread(page), []);
});

test('shares what you have read with your other windows', async (t) => {
  const { page, host } = await open(t);
  host.updated[A] = LATER;
  host.updated[B] = LATER;
  await page.check();
  assert.deepEqual(unread(page), ['Alpha', 'Beta']);

  // Another window opened Beta.
  const state = JSON.parse(page.window.localStorage.getItem(READ));
  state.seen[B] = Date.parse(LATER);
  page.window.localStorage.setItem(READ, JSON.stringify(state));
  page.window.dispatchEvent(new page.window.StorageEvent('storage', { key: READ }));
  assert.deepEqual(unread(page), ['Alpha']);
});

test('asks for nothing while off, and forgets what was read when switched off', async (t) => {
  const { page, host } = await open(t, { settings: {} });
  await page.check();
  await page.wait(60_000);
  assert.deepEqual(host.requests, []);

  await page.changeSettings({ unreadMarkers: true });
  host.updated[A] = LATER;
  await page.check();
  assert.deepEqual(unread(page), ['Alpha']);

  await page.changeSettings({});
  assert.deepEqual(unread(page), []);
  assert.equal(page.window.localStorage.getItem(READ), null);
});

test('checks the sidebar every 30 seconds, and removes its marks when disabled', async (t) => {
  const { page, host } = await open(t);
  host.updated[B] = LATER;
  await page.wait(30_000);
  assert.deepEqual(unread(page), ['Beta']);

  page.dispose();
  assert.deepEqual(unread(page), []);
});

test('shares one request with the agent status on each page change', async (t) => {
  const { page, host } = await open(t, {
    path: `/conversations/${dashed(B)}`,
    settings: { unreadMarkers: true, notifications: true },
  });
  const loads = () => host.requests.filter((path) => path.startsWith('/api/conversations?'));
  assert.deepEqual(loads(), [`/api/conversations?ids=${B}&ids=${A}`]);

  await page.check();
  assert.equal(loads().length, 2);
});

test('rests while the tab is hidden, and checks at once when it shows again', async (t) => {
  const { page, host } = await open(t);
  page.hidden = true;
  const requests = host.requests.length;
  host.updated[A] = LATER;
  await page.check();
  await page.wait(60_000);
  assert.equal(host.requests.length, requests);

  page.returnToTab();
  await flush();
  assert.equal(host.requests.length, requests + 1);
  assert.deepEqual(unread(page), ['Alpha']);
});
