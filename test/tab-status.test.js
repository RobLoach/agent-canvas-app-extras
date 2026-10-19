import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, COUNT_PATH, flush, start } from './helpers.js';

const HEAD = '<link rel="icon" type="image/svg+xml" href="/favicon.svg">';

// Conversation A open with the given title, as Canvas renders it.
const openA = (t, { title = 'My chat', settings = { tabStatus: true }, ...options } = {}) =>
  start(t, {
    path: `/conversations/${A}`,
    head: `<title>${title}</title>${HEAD}`,
    settings,
    ...options,
  });

const setTitle = (page, text) => {
  page.document.querySelector('title').firstChild.nodeValue = text;
};

// "canvas" for Canvas's own favicon, otherwise the badge dot's colour.
function iconColor(page) {
  const links = page.document.querySelectorAll('link[rel~="icon"]');
  assert.equal(links.length, 1, "only Canvas's icon link");
  const href = links[0].getAttribute('href');
  return href === '/favicon.svg'
    ? 'canvas'
    : decodeURIComponent(href).match(/fill="(#[0-9a-f]+)"/)[1];
}

test('does nothing while switched off', async (t) => {
  const { page, host } = await openA(t, { settings: {}, statuses: { [A]: 'running' } });
  await page.check();

  assert.deepEqual(host.requests, []);
  assert.equal(page.document.title, 'My chat');
  assert.equal(iconColor(page), 'canvas');
});

test("badges a running conversation without replacing Canvas's title node", async (t) => {
  const { page } = await openA(t, { statuses: { [A]: 'running' } });
  const titleNode = page.document.querySelector('title').firstChild;

  assert.equal(page.document.title, '⏳ My chat');
  assert.equal(iconColor(page), '#3b82f6');
  assert.deepEqual(page.fetched, ['https://canvas.test/favicon.svg']);
  assert.match(
    decodeURIComponent(page.document.querySelector('link').getAttribute('href')),
    /<image href="data:image\/svg\+xml;base64,/,
  );

  // Canvas renames the conversation by updating the same text node.
  titleNode.nodeValue = 'Renamed';
  await flush();
  assert.equal(page.document.title, '⏳ Renamed');
  assert.equal(page.document.querySelector('title').firstChild, titleNode);
});

test('shows a finished badge until you come back to the tab', async (t) => {
  const { page, host } = await openA(t, { statuses: { [A]: 'running' } });
  page.hidden = true;
  host.statuses[A] = 'finished';
  await page.check();
  assert.equal(page.document.title, '✅ My chat');
  assert.equal(iconColor(page), '#22c55e');

  page.returnToTab();
  await flush();
  assert.equal(page.document.title, 'My chat');
  assert.equal(iconColor(page), 'canvas');
});

test('only shows finished after seeing the run', async (t) => {
  const { page } = await openA(t, { statuses: { [A]: 'finished' } });

  assert.equal(page.document.title, 'My chat');
  assert.equal(iconColor(page), 'canvas');
});

test('leaves a title that already starts with a badge emoji alone', async (t) => {
  const { page, host } = await openA(t, { title: '✋ Release checklist' });
  assert.equal(page.document.title, '✋ Release checklist');

  host.statuses[A] = 'running';
  await page.check();
  assert.equal(page.document.title, '⏳ ✋ Release checklist');
});

test('does not repeat a badge emoji the title already starts with', async (t) => {
  const { page, host } = await openA(t, {
    title: '✅🔧 Miscellaneous Request',
    statuses: { [A]: 'running' },
  });
  assert.equal(page.document.title, '⏳ ✅🔧 Miscellaneous Request');

  host.statuses[A] = 'finished';
  await page.check();
  assert.equal(page.document.title, '✅🔧 Miscellaneous Request');
  assert.equal(iconColor(page), '#22c55e');
});

test('re-badges the icon when React resets its href', async (t) => {
  const { page } = await openA(t, { statuses: { [A]: 'running' } });
  page.document.querySelector('link').setAttribute('href', '/favicon.svg');
  await flush();
  assert.equal(iconColor(page), '#3b82f6');
});

test('restores the title and icon and stops checking when disabled', async (t) => {
  const { page, host } = await openA(t, { statuses: { [A]: 'running' } });
  page.dispose();
  const requests = host.requests.length;
  await page.check();
  await page.wait(60_000);

  assert.equal(page.document.title, 'My chat');
  assert.equal(iconColor(page), 'canvas');
  assert.equal(host.requests.length, requests);
});

test('only counts waiting conversations outside conversation pages', async (t) => {
  const { page, host } = await start(t, {
    head: HEAD,
    settings: { tabStatus: true, notifications: true },
  });
  await page.check();

  assert.deepEqual(host.requests, [COUNT_PATH, COUNT_PATH]);
});

test('numbers the tab icon dot with the conversations that need you', async (t) => {
  const { page, host } = await openA(t, {
    statuses: { [A]: 'idle', [B]: 'waiting_for_confirmation' },
  });
  assert.equal(iconColor(page), '#f59e0b');
  const href = decodeURIComponent(page.document.querySelector('link').getAttribute('href'));
  assert.match(href, />1<\/text>/);

  host.statuses[B] = 'running';
  await page.check();
  assert.equal(iconColor(page), 'canvas');
});

test('counts runs still going in conversations you navigated away from', async (t) => {
  const { page, host } = await openA(t, { statuses: { [A]: 'running', [B]: 'running' } });
  page.navigate(`/conversations/${B}`);
  await page.check();
  assert.equal(page.document.title, '⏳2 My chat');

  host.statuses[B] = 'finished';
  await page.check();
  assert.equal(page.document.title, '✅ ⏳1 My chat');

  host.statuses[A] = 'finished';
  await page.check();
  assert.equal(page.document.title, '✅ My chat');
});

test("replaces Canvas's own status emoji instead of adding a second", async (t) => {
  const { page, host } = await openA(t, {
    title: '🟢 My chat | OpenHands',
    statuses: { [A]: 'running' },
  });
  assert.equal(page.document.title, '⏳ My chat | OpenHands');

  // Canvas shows ✅ while waiting for confirmation too; ours says what it is.
  host.statuses[A] = 'waiting_for_confirmation';
  setTitle(page, '✅ My chat | OpenHands');
  await page.check();
  assert.equal(page.document.title, '✋ My chat | OpenHands');

  // With no badge of ours, Canvas's comes back.
  host.statuses[A] = 'idle';
  await page.check();
  page.returnToTab();
  await flush();
  assert.equal(page.document.title, '✅ My chat | OpenHands');
});

test('drops a status emoji the conversation title already starts with', async (t) => {
  const { page } = await openA(t, {
    title: '✅ ✅🔧 Miscellaneous Request | OpenHands',
    statuses: { [A]: 'finished' },
  });
  assert.equal(page.document.title, '✅🔧 Miscellaneous Request | OpenHands');
});

test("leaves Canvas's title as it is while tab status is off", async (t) => {
  const { page } = await openA(t, {
    title: '✅ ✅🔧 Miscellaneous Request | OpenHands',
    settings: { notifications: true },
    statuses: { [A]: 'running' },
  });
  assert.equal(page.document.title, '✅ ✅🔧 Miscellaneous Request | OpenHands');
});

test('takes its badges and title changes back when disabled', async (t) => {
  const { page } = await openA(t, {
    title: '✅ ✅🔧 Misc | OpenHands',
    settings: { tabStatus: true, appBadge: true },
    statuses: { [A]: 'running', [B]: 'waiting_for_confirmation' },
  });
  assert.equal(iconColor(page), '#3b82f6');
  assert.equal(page.badge, 1);
  assert.equal(page.document.title, '⏳ ✅🔧 Misc | OpenHands');

  page.dispose();
  assert.equal(page.badge, 0);
  assert.equal(iconColor(page), 'canvas');
  assert.equal(page.document.title, '✅ ✅🔧 Misc | OpenHands');
});

test("redraws the dot on Canvas's own icon when that changes", async (t) => {
  const { page, host } = await openA(t, { statuses: { [A]: 'running' } });
  assert.equal(iconColor(page), '#3b82f6');

  // Canvas switches icons, e.g. with its theme.
  page.document.querySelector('link').setAttribute('href', '/favicon-light.svg');
  await flush();
  host.statuses[A] = 'finished';
  await page.check();
  assert.equal(iconColor(page), '#22c55e');
  assert.deepEqual(page.fetched, [
    'https://canvas.test/favicon.svg',
    'https://canvas.test/favicon-light.svg',
  ]);
});
