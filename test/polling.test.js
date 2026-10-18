import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPage, fakeHost, activateExtension } from './helpers.js';

const ID = '0123456789abcdef0123456789abcdef';

// Lets pending promises and observer callbacks run without moving the mocked
// clock.
const flush = () => new Promise((resolve) => setImmediate(resolve));

async function openConversation(t, settings, status) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
  const page = setupPage(t, { url: `https://canvas.test/conversations/${ID}` });
  page.settings(settings);
  const host = fakeHost({ statuses: { [ID]: status } });
  await activateExtension(page, host);
  await flush();
  return { page, host };
}

test('polls every 15 seconds while a run is going', async (t) => {
  const { host } = await openConversation(t, { tabStatus: true }, 'running');
  assert.equal(host.requests.length, 1);

  t.mock.timers.tick(15000);
  await flush();
  assert.equal(host.requests.length, 2);
});

test('stops polling once nothing is running', async (t) => {
  const { host } = await openConversation(t, { tabStatus: true }, 'running');
  host.statuses[ID] = 'finished';
  t.mock.timers.tick(15000);
  await flush();
  const requests = host.requests.length;

  t.mock.timers.tick(60 * 60 * 1000);
  await flush();
  assert.equal(host.requests.length, requests);
});

test('does not poll an idle conversation', async (t) => {
  const { host } = await openConversation(t, { notifications: true }, 'idle');

  t.mock.timers.tick(60 * 60 * 1000);
  await flush();
  assert.equal(host.requests.length, 1);
});

test('does not check at all while both status switches are off', async (t) => {
  const { page, host } = await openConversation(t, { wideCanvas: true }, 'running');
  page.mutate();
  page.returnToTab();
  await flush();

  t.mock.timers.tick(60 * 60 * 1000);
  await flush();
  assert.deepEqual(host.requests, []);
});
