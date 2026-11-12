import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, start } from './helpers.js';

// The sidebar's conversations and the message box, as Canvas renders them.
const card = (id) =>
  `<a href="/conversations/${id}?backend=local"><div data-testid="conversation-card"></div></a>`;
const BODY = `${card(A)}${card(B)}<div data-testid="chat-input" contenteditable="true" tabindex="0"></div><textarea></textarea>`;
const ON = { keyboardShortcuts: true };

function press(page, key, options = {}, target = page.document.body) {
  const event = new page.window.KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}
const help = (page) => page.document.getElementById('openhands-extras-shortcuts');

test('Keyboard shortcuts are off by default', async (t) => {
  const { page, host } = await start(t, { body: BODY });
  press(page, '?');
  press(page, 'ArrowDown', { altKey: true });

  assert.equal(help(page), null);
  assert.deepEqual(host.navigations, []);
});

test('? lists the shortcuts, and Esc closes the list', async (t) => {
  const { page } = await start(t, { body: BODY, settings: ON });
  assert.ok(press(page, '?').defaultPrevented);
  const dialog = help(page).querySelector('[role="dialog"]');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.match(dialog.textContent, /Focus the message box/);
  assert.equal(page.document.activeElement, dialog.querySelector('button'));

  press(page, 'Escape', {}, page.document.activeElement);
  assert.equal(help(page), null);
});

test('/ focuses the message box', async (t) => {
  const { page } = await start(t, { body: BODY, settings: ON });
  press(page, '/');

  assert.equal(
    page.document.activeElement,
    page.document.querySelector('[data-testid="chat-input"]'),
  );
});

test('Alt+↑ and Alt+↓ open the previous and next conversation', async (t) => {
  const { page, host } = await start(t, {
    path: `/conversations/${B}`,
    body: BODY,
    settings: ON,
  });
  press(page, 'ArrowUp', { altKey: true });
  press(page, 'ArrowDown', { altKey: true });

  // By the sidebar's own link, which carries the backend.
  assert.deepEqual(host.navigations, [`/conversations/${A}?backend=local`]);
});

test('Alt+N starts a new chat, on any keyboard layout', async (t) => {
  const { page, host } = await start(t, { body: BODY, settings: ON });
  // As on a Mac, where ⌥N types a dead key.
  press(page, 'Dead', { altKey: true, code: 'KeyN' });

  assert.deepEqual(host.navigations, ['/conversations']);
});

test('leaves keys typed into a field, and ones Canvas handled, alone', async (t) => {
  const { page } = await start(t, { body: BODY, settings: ON });
  const field = page.document.querySelector('textarea');
  assert.equal(press(page, '?', {}, field).defaultPrevented, false);
  assert.equal(press(page, '?', {}, page.document.querySelector('[contenteditable]')).defaultPrevented, false);

  const handled = new page.window.KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true });
  handled.preventDefault();
  page.document.body.dispatchEvent(handled);
  assert.equal(help(page), null);
});

test('closes the list when switched off', async (t) => {
  const { page } = await start(t, { body: BODY, settings: ON });
  press(page, '?');
  await page.changeSettings({});

  assert.equal(help(page), null);
  press(page, '?');
  assert.equal(help(page), null);
});

test("leaves keys to Canvas's own dialogs, and to fields like the settings switches", async (t) => {
  const { page, host } = await start(t, {
    body: `${BODY}<input type="checkbox" role="switch">`,
    settings: ON,
  });
  press(page, '?', {}, page.document.querySelector('[role="switch"]'));
  assert.ok(help(page), 'a switch is no text field');
  press(page, 'Escape');

  page.document.body.insertAdjacentHTML('beforeend', '<div role="dialog" aria-modal="true"></div>');
  press(page, '?');
  press(page, 'ArrowDown', { altKey: true });
  assert.equal(help(page), null);
  assert.deepEqual(host.navigations, []);
});

test('the list keeps keys from Canvas while open, without blocking the browser', async (t) => {
  const { page } = await start(t, { body: BODY, settings: ON });
  const heard = [];
  page.window.document.addEventListener('keydown', (event) => heard.push(event.key));
  press(page, '?');

  const find = press(page, 'f', { ctrlKey: true }, page.document.activeElement);
  assert.equal(find.defaultPrevented, false);
  assert.deepEqual(heard, ['?'], 'only the key that opened it');
});

test('/ is left to the browser where there is no message box', async (t) => {
  const { page } = await start(t, { body: '', settings: ON });
  assert.equal(press(page, '/').defaultPrevented, false);
});
