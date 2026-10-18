import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPage, fakeHost, activateExtension, settle } from './helpers.js';

const ID = '0123456789abcdef0123456789abcdef';
const HEAD = '<title>My chat</title><link rel="icon" type="image/svg+xml" href="/favicon.svg">';

function openConversation(t, settings = { tabStatus: true }) {
  const page = setupPage(t, { url: `https://canvas.test/conversations/${ID}`, head: HEAD });
  page.settings(settings);
  return page;
}

// "canvas" for Canvas's own favicon, otherwise the badge dot's colour.
function iconColor(page) {
  const links = page.document.querySelectorAll('link[rel~="icon"]');
  assert.equal(links.length, 1, 'only Canvas\'s icon link');
  const href = links[0].getAttribute('href');
  return href === '/favicon.svg'
    ? 'canvas'
    : decodeURIComponent(href).match(/fill="(#[0-9a-f]+)"/)[1];
}

test('does nothing while switched off', async (t) => {
  const page = openConversation(t, {});
  const host = fakeHost({ statuses: { [ID]: 'running' } });
  await activateExtension(page, host);
  page.mutate();
  await settle();

  assert.deepEqual(host.requests, []);
  assert.equal(page.document.title, 'My chat');
  assert.equal(iconColor(page), 'canvas');
});

test('badges a running conversation without replacing Canvas\'s title node', async (t) => {
  const page = openConversation(t);
  const titleNode = page.document.querySelector('title').firstChild;
  await activateExtension(page, fakeHost({ statuses: { [ID]: 'running' } }));
  await settle();

  assert.equal(page.document.title, '⏳ My chat');
  assert.equal(page.document.querySelector('title').firstChild, titleNode);
  assert.equal(iconColor(page), '#3b82f6');
  assert.deepEqual(page.fetched, ['https://canvas.test/favicon.svg']);
  assert.match(
    decodeURIComponent(page.document.querySelector('link').getAttribute('href')),
    /<image href="data:image\/svg\+xml;base64,/,
  );

  // Canvas renames the conversation by updating the same text node.
  titleNode.nodeValue = 'Renamed';
  await settle();
  assert.equal(page.document.title, '⏳ Renamed');
});

test('shows a finished badge until you come back to the tab', async (t) => {
  const page = openConversation(t);
  const host = fakeHost({ statuses: { [ID]: 'running' } });
  await activateExtension(page, host);
  await settle();

  page.hidden = true;
  host.statuses[ID] = 'finished';
  page.checkNow();
  await settle();
  assert.equal(page.document.title, '✅ My chat');
  assert.equal(iconColor(page), '#22c55e');

  page.returnToTab();
  await settle();
  assert.equal(page.document.title, 'My chat');
  assert.equal(iconColor(page), 'canvas');
});

test('only shows finished after seeing the run', async (t) => {
  const page = openConversation(t);
  await activateExtension(page, fakeHost({ statuses: { [ID]: 'finished' } }));
  await settle();

  assert.equal(page.document.title, 'My chat');
  assert.equal(iconColor(page), 'canvas');
});

test('leaves a title that already starts with a badge emoji alone', async (t) => {
  const page = openConversation(t);
  page.document.querySelector('title').firstChild.nodeValue = '✅ Release checklist';
  const host = fakeHost({ statuses: { [ID]: 'idle' } });
  await activateExtension(page, host);
  await settle();
  assert.equal(page.document.title, '✅ Release checklist');

  host.statuses[ID] = 'running';
  page.checkNow();
  await settle();
  assert.equal(page.document.title, '⏳ ✅ Release checklist');
});

test('re-badges the icon when React resets its href', async (t) => {
  const page = openConversation(t);
  await activateExtension(page, fakeHost({ statuses: { [ID]: 'running' } }));
  await settle();

  page.document.querySelector('link').setAttribute('href', '/favicon.svg');
  await settle();
  assert.equal(iconColor(page), '#3b82f6');
});

test('restores the title and icon and stops checking when disabled', async (t) => {
  const page = openConversation(t);
  const host = fakeHost({ statuses: { [ID]: 'running' } });
  const dispose = await activateExtension(page, host);
  await settle();

  dispose();
  const requests = host.requests.length;
  page.mutate();
  page.checkNow();
  await settle();

  assert.equal(page.document.title, 'My chat');
  assert.equal(iconColor(page), 'canvas');
  assert.equal(host.requests.length, requests);
});

test('does not check outside conversation pages', async (t) => {
  const page = setupPage(t, { url: 'https://canvas.test/apps', head: HEAD });
  page.settings({ tabStatus: true, notifications: true });
  const host = fakeHost();
  await activateExtension(page, host);
  page.mutate();
  await settle();

  assert.deepEqual(host.requests, []);
});
