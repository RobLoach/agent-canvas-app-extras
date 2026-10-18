import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPage, fakeHost, activateExtension, settle } from './helpers.js';

const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

// Open conversation A with a run going, as seen by the extension.
async function watchRun(t, settings = { notifications: true }) {
  const page = setupPage(t, {
    url: `https://canvas.test/conversations/${A}`,
    head: '<title>Release</title>',
  });
  page.settings(settings);
  const host = fakeHost({
    statuses: { [A]: 'running', [B]: 'idle' },
    titles: { [A]: 'Release', [B]: 'Other' },
    finalResponse: 'All tests pass.',
  });
  await activateExtension(page, host);
  await settle();
  return { page, host };
}

async function finish(page, host, id = A, status = 'finished') {
  host.statuses[id] = status;
  page.checkNow();
  await settle();
}

test('notifies with the final reply when a run finishes in a background tab', async (t) => {
  const { page, host } = await watchRun(t);
  page.hidden = true;
  await finish(page, host);

  assert.equal(page.notifications.length, 1);
  const [notification] = page.notifications;
  assert.equal(notification.title, 'Release');
  assert.equal(notification.options.body, 'All tests pass.');
  assert.equal(notification.options.tag, `openhands-extras-${A}`);
});

test('notifies when the window is visible but not focused', async (t) => {
  const { page, host } = await watchRun(t);
  page.focused = false;
  await finish(page, host, A, 'waiting_for_confirmation');

  assert.deepEqual(
    page.notifications.map((notification) => notification.options.body),
    ['Needs your confirmation'],
  );
});

test('stays quiet while you are watching the conversation', async (t) => {
  const { page, host } = await watchRun(t);
  await finish(page, host);

  assert.equal(page.notifications.length, 0);
});

test('stays quiet when notifications are off', async (t) => {
  const { page, host } = await watchRun(t, { tabStatus: true });
  page.hidden = true;
  await finish(page, host);

  assert.equal(page.notifications.length, 0);
});

test('follows a run after you open another conversation, then opens it on click', async (t) => {
  const { page, host } = await watchRun(t);
  page.navigate(`/conversations/${B}`);
  page.checkNow();
  await settle();
  assert.equal(host.requests.at(-1), `/api/conversations?ids=${A}&ids=${B}`);

  await finish(page, host, A, 'error');
  assert.equal(page.notifications.length, 1);
  assert.equal(page.notifications[0].options.body, 'Stopped with an error');

  page.notifications[0].onclick();
  assert.deepEqual(host.navigations, [`/conversations/${A}`]);
  assert.ok(page.notifications[0].closed);

  host.requests.length = 0;
  page.checkNow();
  await settle();
  assert.deepEqual(host.requests, [`/api/conversations?ids=${B}`]);
});

test('does not navigate when the notification is for the open conversation', async (t) => {
  const { page, host } = await watchRun(t);
  page.hidden = true;
  await finish(page, host);

  page.notifications[0].onclick();
  assert.deepEqual(host.navigations, []);
});
