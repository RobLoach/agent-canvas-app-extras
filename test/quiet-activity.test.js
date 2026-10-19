import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPage, fakeHost, activateExtension, settle } from './helpers.js';

// Chat items as Canvas renders them: an event row in its own item, or after
// the agent's message in the same item.
const row = (title) =>
  `<div class="flex flex-col gap-1.5 my-1 py-1 text-sm w-full"><div class="flex items-center justify-between font-normal text-muted"><div data-testid="generic-event-message-title" class="flex items-center"><span>${title}</span></div><div class="flex items-center"></div></div></div>`;
const item = (...children) => `<div>${children.join('')}</div>`;
const message = (text) => `<div class="agent-message">${text}</div>`;
const CHIP =
  '<div data-testid="live-activity-chip" role="status">Running Terminal</div>';

function openChat(t, items, { settings = { quietActivity: true }, running = false } = {}) {
  const page = setupPage(t, {
    url: 'https://canvas.test/conversations/0123456789abcdef0123456789abcdef',
    body: `<div data-testid="chat-scroll-container">${items.join('')}</div>${running ? CHIP : ''}`,
  });
  page.settings(settings);
  return page;
}

const chat = (page) => page.document.querySelector('[data-testid="chat-scroll-container"]');
const shown = (page) =>
  [...chat(page).querySelectorAll('[data-testid="generic-event-message-title"], .agent-message, #openhands-extras-thinking')]
    .filter((element) => !element.closest('[data-extras-quiet]'))
    .map((element) => element.textContent.replace(/\s+/g, ' ').trim());
const thinking = (page) => page.document.getElementById('openhands-extras-thinking');

test('hides Running and Reading entries but keeps edits and messages', async (t) => {
  const page = openChat(t, [
    item(row('Running <strong>ls</strong>')),
    item(row('Reading <code>README.md</code>')),
    item(row('Ran <strong>ls</strong>')),
    item(row('Read <code>README.md</code>')),
    item(row('Editing <code>extension.js</code>')),
    item(message('Let me check the tests.'), row('Running <strong>npm test</strong>')),
    item(message('All done.')),
  ]);
  await activateExtension(page, fakeHost());

  assert.deepEqual(shown(page), [
    'Editing extension.js',
    'Let me check the tests.',
    'All done.',
  ]);
  assert.equal(page.document.querySelectorAll('[data-extras-quiet]').length, 9, '5 rows, and the 4 items with nothing left');
  assert.equal(thinking(page), null, 'not while nothing is running');
  assert.ok(page.document.getElementById('openhands-extras-quiet-activity'));
});

test('shows Thinking at the bottom while the agent works through hidden entries', async (t) => {
  const page = openChat(t, [item(message('On it.')), item(row('Running <strong>ls</strong>'))], { running: true });
  await activateExtension(page, fakeHost());
  assert.deepEqual(shown(page), ['On it.', 'Thinking']);
  assert.equal(chat(page).lastElementChild, thinking(page));

  // Canvas appends the next event after Thinking; it moves back to the bottom.
  chat(page).insertAdjacentHTML('beforeend', item(row('Reading <code>a.js</code>')));
  await settle();
  assert.equal(chat(page).lastElementChild, thinking(page));
  assert.equal(page.document.querySelectorAll('#openhands-extras-thinking').length, 1);

  // A message from the agent replaces it.
  chat(page).insertAdjacentHTML('beforeend', item(message('Found it.')));
  await settle();
  assert.equal(thinking(page), null);

  // As does the run ending.
  chat(page).insertAdjacentHTML('beforeend', item(row('Running <strong>git status</strong>')));
  await settle();
  assert.ok(thinking(page));
  page.document.querySelector('[data-testid="live-activity-chip"]').remove();
  await settle();
  assert.equal(thinking(page), null);
});

test('leaves the chat alone while off, and restores it when disabled', async (t) => {
  const items = [item(row('Running <strong>ls</strong>'))];
  const page = openChat(t, items, { settings: {}, running: true });
  await activateExtension(page, fakeHost());
  assert.deepEqual(shown(page), ['Running ls']);

  page.settings({ quietActivity: true });
  page.checkNow();
  assert.deepEqual(shown(page), ['Thinking']);

  page.settings({});
  page.checkNow();
  assert.deepEqual(shown(page), ['Running ls']);
  assert.equal(page.document.querySelector('[data-extras-quiet]'), null);
  assert.equal(page.document.getElementById('openhands-extras-quiet-activity'), null);
});
