import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPage, fakeHost, activateExtension } from './helpers.js';

const BODY = `<div data-agent-server-ui>
  <div id="thread" class="w-full min-w-0 max-w-200 h-full flex flex-col min-h-0"></div>
  <div id="settings" class="mx-auto flex w-full min-w-0 max-w-200 flex-col gap-6"></div>
</div>`;

const wideSelector = (document) =>
  document
    .getElementById('openhands-extras-wide-canvas')
    ?.textContent.split('{')[0]
    .trim();

test('Wide canvas is off by default', async (t) => {
  const page = setupPage(t, { body: BODY });
  await activateExtension(page, fakeHost());

  assert.equal(wideSelector(page.document), undefined);
});

test('Wide canvas widens the chat thread but not other max-w-200 columns', async (t) => {
  const page = setupPage(t, { body: BODY, settings: { wideCanvas: true } });
  const dispose = await activateExtension(page, fakeHost());

  const selector = wideSelector(page.document);
  assert.ok(page.document.getElementById('thread').matches(selector));
  assert.ok(!page.document.getElementById('settings').matches(selector));

  dispose();
  assert.equal(wideSelector(page.document), undefined);
});
