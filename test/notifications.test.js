import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  A,
  B,
  activateExtension,
  fakeHost,
  flush,
  setupPage,
  start,
} from './helpers.js';

const UNSEEN = 'openhands-extras:unseen';
const unseen = (page) => page.window.localStorage.getItem(UNSEEN);

// Open conversation A with a run going, as seen by the extension.
const watchRun = (t, settings = { notifications: true }) =>
  start(t, {
    path: `/conversations/${A}`,
    head: '<title>Release</title>',
    settings,
    statuses: { [A]: 'running', [B]: 'idle' },
    titles: { [A]: 'Release', [B]: 'Other' },
    finalResponse: 'All tests pass.',
  });

async function finish(page, host, id = A, status = 'finished') {
  host.statuses[id] = status;
  await page.check();
}

// The app on Customize > Apps with unseen runs stored, and a host that
// answers status requests with respond(path).
async function withUnseen(t, ids, respond) {
  const page = setupPage(t, { settings: { appBadge: true } });
  page.window.localStorage.setItem(UNSEEN, JSON.stringify(ids));
  const host = fakeHost();
  host.agentServer.request = async ({ path }) =>
    path.startsWith('/api/conversations?') ? respond() : 0;
  await activateExtension(page, host);
  return page;
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
  await page.check();
  assert.equal(host.requests.at(-1), `/api/conversations?ids=${A}&ids=${B}`);

  await finish(page, host, A, 'error');
  assert.equal(page.notifications.length, 1);
  assert.equal(page.notifications[0].options.body, 'Stopped with an error');

  page.notifications[0].onclick();
  assert.deepEqual(host.navigations, [`/conversations/${A}`]);
  assert.ok(page.notifications[0].closed);

  host.requests.length = 0;
  await page.check();
  assert.deepEqual(host.requests, [`/api/conversations?ids=${B}`]);
});

test('does not navigate when the notification is for the open conversation', async (t) => {
  const { page, host } = await watchRun(t);
  page.hidden = true;
  await finish(page, host);

  page.notifications[0].onclick();
  assert.deepEqual(host.navigations, []);
});

test('strips Markdown from the final reply and cuts it on a word', async (t) => {
  const { page, host } = await watchRun(t);
  page.hidden = true;
  const words = Array(60).fill('word').join(' ');
  host.agentServer.request = async ({ path }) =>
    path.endsWith('/agent_final_response')
      ? { response: `## Done\n\n- Fixed **the** \`bug\` in [extension.js](https://x.test)\n\n\`\`\`js\ncode();\n\`\`\`\n${words}` }
      : [{ execution_status: 'finished', title: 'Release' }];
  await page.check();

  const body = page.notifications[0].options.body;
  assert.ok(body.startsWith('Done Fixed the bug in extension.js word word'), body);
  assert.ok(body.endsWith('word…'), body);
  assert.ok(Array.from(body).length <= 201, body);
});

test('chimes when a run needs confirmation while you are away', async (t) => {
  const { page, host } = await watchRun(t, { confirmationSound: true });
  page.hidden = true;
  await finish(page, host, A, 'waiting_for_confirmation');

  assert.deepEqual(page.tones, [880, 660]);
  assert.equal(page.notifications.length, 0);
});

test('does not chime while you are watching or when a run finishes', async (t) => {
  const { page, host } = await watchRun(t, { confirmationSound: true });
  await finish(page, host, A, 'waiting_for_confirmation');
  page.hidden = true;
  await finish(page, host, A, 'finished');

  assert.deepEqual(page.tones, []);
});

test('badges the app icon with the runs that need you until you open them', async (t) => {
  const { page, host } = await watchRun(t, { appBadge: true });
  assert.equal(page.badge, 0);

  page.navigate(`/conversations/${B}`);
  await page.check();
  await finish(page, host, A, 'waiting_for_confirmation');
  assert.equal(page.badge, 1);

  await finish(page, host, A, 'finished');
  assert.equal(page.badge, 1);

  page.navigate(`/conversations/${A}`);
  await page.check();
  assert.equal(page.badge, 0);
});

test('badges a run that ends while you are away, and clears when you return', async (t) => {
  const { page, host } = await watchRun(t, { appBadge: true });
  await finish(page, host, A, 'waiting_for_confirmation');
  assert.equal(page.badge, 1, 'waiting for confirmation counts anywhere');

  await finish(page, host, A, 'finished');
  assert.equal(page.badge, 0, 'not when it ends while you watch');

  await finish(page, host, A, 'running');
  page.hidden = true;
  await finish(page, host, A, 'finished');
  assert.equal(page.badge, 1);

  page.returnToTab();
  assert.equal(page.badge, 0);
});

test('clears the app icon badge when switched off', async (t) => {
  const { page, host } = await watchRun(t, { appBadge: true });
  page.hidden = true;
  await finish(page, host);
  assert.equal(page.badge, 1);

  await page.changeSettings({});
  assert.equal(page.badge, 0);
});

test('counts conversations waiting for confirmation that this tab never saw', async (t) => {
  const { page, host } = await watchRun(t, { appBadge: true });
  await finish(page, host, B, 'waiting_for_confirmation');
  assert.equal(page.badge, 1);
});

test('remembers unseen runs across reloads and shares them between windows', async (t) => {
  const { page, host } = await watchRun(t, { appBadge: true });
  page.hidden = true;
  await finish(page, host);
  assert.equal(unseen(page), JSON.stringify([A]));

  // A fresh load of the app, as after a reload, starts from the stored runs.
  page.dispose();
  page.badge = undefined;
  await activateExtension(page, host);
  assert.equal(page.badge, 1);

  // Another window opened the run.
  page.window.localStorage.removeItem(UNSEEN);
  page.window.dispatchEvent(new page.window.StorageEvent('storage', { key: UNSEEN }));
  assert.equal(page.badge, 0);
});

test('drops unseen runs that were resumed or deleted elsewhere', async (t) => {
  const page = await withUnseen(t, [A, B], () => [{ execution_status: 'running' }, null]);

  assert.equal(unseen(page), null);
  assert.equal(page.badge, 0);
});

test('keeps the unseen runs when the server answers unexpectedly', async (t) => {
  let answer = { detail: 'Bad gateway' };
  const page = await withUnseen(t, [A], () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  assert.equal(unseen(page), JSON.stringify([A]));
  assert.equal(page.badge, 1);

  answer = new Error('Offline');
  await page.check();
  assert.equal(unseen(page), JSON.stringify([A]));
});

test('a notification the browser refuses is not an unhandled error', async (t) => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  t.after(() => process.off('unhandledRejection', onUnhandled));
  const { page, host } = await watchRun(t);
  // As on Android, where only service workers may show notifications.
  class Refusing {
    static permission = 'granted';
    constructor() {
      throw new TypeError('Illegal constructor');
    }
  }
  page.window.Notification = Refusing;
  globalThis.Notification = Refusing;
  page.hidden = true;
  await finish(page, host);
  await flush();
  assert.deepEqual(unhandled, []);
});

test('closes its audio when disabled', async (t) => {
  const { page, host } = await watchRun(t, { confirmationSound: true });
  page.hidden = true;
  await finish(page, host, A, 'waiting_for_confirmation');
  assert.deepEqual(page.tones, [880, 660]);

  page.dispose();
  assert.equal(page.audioClosed, true);
});

test("says the status in Canvas's language", async (t) => {
  const { page, host } = await watchRun(t);
  page.document.documentElement.lang = 'de';
  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(url);
    return {
      ok: true,
      json: async () => ({
        CHAT_INTERFACE$AGENT_AWAITING_USER_CONFIRMATION_MESSAGE:
          'Agent wartet auf die Bestätigung des Benutzers für die ausstehende Aktion.',
      }),
    };
  };
  page.hidden = true;
  await finish(page, host, A, 'waiting_for_confirmation');
  await finish(page, host, A, 'running');
  await finish(page, host, A, 'stuck');

  assert.deepEqual(
    page.notifications.map((notification) => notification.options.body),
    [
      'Agent wartet auf die Bestätigung des Benutzers für die ausstehende Aktion.',
      // Untranslated, it stays English.
      'Got stuck',
    ],
  );
  assert.deepEqual(fetched, ['/locales/de/openhands.json'], 'fetched once');
});
