import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPage, fakeHost, activateExtension, settle } from './helpers.js';

const ID = '0123456789abcdef0123456789abcdef';

// Chat items as Canvas renders them: an event row in its own item, or after
// the agent's message in the same item.
const row = (title, status = '') =>
  `<div class="flex flex-col gap-1.5 my-1 py-1 text-sm w-full"><div class="flex items-center justify-between font-normal text-muted"><div data-testid="generic-event-message-title" class="flex items-center"><span>${title}</span><button type="button" aria-label="Expand"><svg></svg></button></div><div class="flex items-center">${status}</div></div></div>`;
const item = (...children) => `<div>${children.join('')}</div>`;
const message = (text) => `<div class="agent-message">${text}</div>`;
const TIMEOUT =
  '<span class="flex-shrink-0"><svg data-testid="status-icon"></svg></span>';

function openChat(t, items, settings = { quietActivity: true }) {
  const page = setupPage(t, {
    url: `https://canvas.test/conversations/${ID}`,
    body: `<div data-testid="chat-scroll-container">${items.join('')}</div>`,
  });
  page.settings(settings);
  return page;
}

const chat = (page) => page.document.querySelector('[data-testid="chat-scroll-container"]');
const toggles = (page) => [...page.document.querySelectorAll('[data-extras-thinking]')];
const pulsing = (page) =>
  toggles(page).map((toggle) => toggle.querySelector('span').classList.contains('animate-pulse'));
// What you'd see, top to bottom.
const shown = (page) =>
  [...chat(page).querySelectorAll('[data-testid="generic-event-message-title"], .agent-message, [data-extras-thinking]')]
    .filter((element) => !element.closest('[data-extras-quiet]:not([data-extras-shown])'))
    .map((element) => element.textContent.replace(/\s+/g, ' ').trim());

test('folds Running and Reading entries into Thinking, keeping the rest', async (t) => {
  const page = openChat(t, [
    item(message('On it.')),
    item(row('Running <strong>ls</strong>')),
    item(row('Reading <code>README.md</code>')),
    item(row('Editing <code>extension.js</code>')),
    item(message('Let me check the tests.'), row('Running <strong>npm test</strong>')),
    item(row('Ran <strong>npm test</strong>')),
    item(row('Running <strong>sleep 999</strong>', TIMEOUT)),
    item(row('Running a Python command')),
    item(message('All done.')),
  ]);
  await activateExtension(page, fakeHost());

  assert.deepEqual(shown(page), [
    'On it.',
    'Thinking',
    'Editing extension.js',
    'Let me check the tests.',
    'Thinking',
    'Running sleep 999',
    'Thinking',
    'All done.',
  ]);
  assert.ok(page.document.getElementById('openhands-extras-quiet-activity'));
});

test("keeps the chat list's own children as Canvas rendered them", async (t) => {
  const items = [
    item(row('Running <strong>ls</strong>')),
    item(message('Let me check.'), row('Reading <code>a.js</code>')),
    item(row('Running <strong>npm test</strong>')),
    item(message('Done.')),
  ];
  const page = openChat(t, items);
  const before = [...chat(page).children];
  await activateExtension(page, fakeHost());

  assert.deepEqual([...chat(page).children], before);
  assert.equal(toggles(page).length, 2);
  assert.ok(toggles(page).every((toggle) => toggle.parentElement.parentElement === chat(page)));
  assert.deepEqual(shown(page), ['Thinking', 'Let me check.', 'Thinking', 'Done.']);
});

test('expands a Thinking entry to show what it folded, and collapses it again', async (t) => {
  const page = openChat(t, [
    item(row('Running <strong>ls</strong>')),
    item(row('Reading <code>a.js</code>')),
    item(message('Done.')),
  ]);
  await activateExtension(page, fakeHost());
  const [thinking] = toggles(page);
  const button = thinking.querySelector('button');
  const chevron = () => thinking.querySelector('path').getAttribute('d').slice(0, 12);
  assert.equal(chevron(), 'M201.4 374.6');

  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(chevron(), 'M201.4 137.4');
  assert.deepEqual(shown(page), ['Running ls', 'Reading a.js', 'Thinking', 'Done.']);

  // It stays open as Canvas re-renders.
  page.mutate();
  await settle();
  assert.deepEqual(shown(page), ['Running ls', 'Reading a.js', 'Thinking', 'Done.']);

  button.click();
  assert.deepEqual(shown(page), ['Thinking', 'Done.']);
});

test('pulses the last Thinking while the open conversation is running', async (t) => {
  const page = openChat(t, [item(message('On it.')), item(row('Running <strong>ls</strong>'))]);
  const host = fakeHost({ statuses: { [ID]: 'running' } });
  await activateExtension(page, host);
  await settle();
  assert.deepEqual(shown(page), ['On it.', 'Thinking']);
  assert.deepEqual(pulsing(page), [true]);

  // The next event joins the same stretch, whose toggle moves into it.
  chat(page).insertAdjacentHTML('beforeend', item(row('Reading <code>a.js</code>')));
  await settle();
  assert.equal(chat(page).lastElementChild.lastElementChild, toggles(page)[0]);
  assert.equal(toggles(page).length, 1);

  // A message from the agent ends the stretch, which stays as history.
  chat(page).insertAdjacentHTML('beforeend', item(message('Found it.')));
  await settle();
  assert.deepEqual(shown(page), ['On it.', 'Thinking', 'Found it.']);
  assert.deepEqual(pulsing(page), [false]);

  // As does the run ending.
  chat(page).insertAdjacentHTML('beforeend', item(row('Running <strong>git status</strong>')));
  await settle();
  assert.deepEqual(pulsing(page), [false, true]);
  host.statuses[ID] = 'finished';
  page.checkNow();
  await settle();
  assert.deepEqual(pulsing(page), [false, false]);
});

test("uses Canvas's translations for the page's language", async (t) => {
  const page = openChat(t, [
    item(row('Führt <strong>ls</strong> aus')),
    item(row('Running <strong>ls</strong>')),
  ]);
  page.document.documentElement.lang = 'de';
  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(url);
    return {
      ok: true,
      json: async () => ({
        ACTION_MESSAGE$RUN: 'Führt <cmd>{{command}}</cmd> aus',
        THINKING$TITLE: 'Denkt nach',
      }),
    };
  };
  await activateExtension(page, fakeHost());
  await settle();

  assert.deepEqual(fetched, ['/locales/de/openhands.json']);
  // English stays the fallback for titles German doesn't translate.
  assert.deepEqual(shown(page), ['Denkt nach']);
});

test('leaves the chat alone while off, and restores it when disabled', async (t) => {
  const page = openChat(t, [item(row('Running <strong>ls</strong>'))], {});
  await activateExtension(page, fakeHost());
  assert.deepEqual(shown(page), ['Running ls']);

  page.settings({ quietActivity: true });
  page.checkNow();
  toggles(page)[0].querySelector('button').click();
  assert.deepEqual(shown(page), ['Running ls', 'Thinking']);

  page.settings({});
  page.checkNow();
  assert.deepEqual(shown(page), ['Running ls']);
  assert.equal(page.document.querySelector('[data-extras-quiet], [data-extras-shown]'), null);
  assert.equal(page.document.getElementById('openhands-extras-quiet-activity'), null);
});

test('a second copy of the app stops the first, rather than fighting it', async (t) => {
  const page = openChat(t, [
    item(row('Running <strong>ls</strong>')),
    item(message('Done.')),
  ]);
  const first = await activateExtension(page, fakeHost());
  // A fresh copy of the module, as Canvas imports one per activation.
  const { activate } = await import(`../extension.js?second=${Date.now()}`);
  const second = activate(fakeHost());
  page.mutate();
  await settle();

  assert.equal(toggles(page).length, 1);
  assert.deepEqual(shown(page), ['Thinking', 'Done.']);
  first();
  assert.equal(toggles(page).length, 1, "the first copy's late dispose leaves the second alone");
  second();
  second();
  assert.equal(toggles(page).length, 0);
});

test('says Thinking on the activity chip while it shows a folded title', async (t) => {
  const page = openChat(t, [item(message('On it.'))]);
  page.document.body.insertAdjacentHTML(
    'beforeend',
    '<div data-testid="live-activity-chip" role="status"><span aria-hidden="true" class="size-1.5"></span><span class="min-w-0 truncate">Running <strong>ls</strong></span></div>',
  );
  await activateExtension(page, fakeHost());
  const chip = page.document.querySelector('[data-testid="live-activity-chip"]');
  const canvasLabel = chip.children[1];
  const visible = () =>
    [...chip.children]
      .filter((child) => !child.matches('[data-extras-quiet]'))
      .map((child) => child.textContent)
      .join('|');
  assert.equal(visible(), '|Thinking');
  assert.equal(chip.lastElementChild.className, 'min-w-0 truncate');

  // React updates its own label, which shows again for anything else.
  canvasLabel.innerHTML = 'Editing <code>a.js</code>';
  await settle();
  assert.equal(visible(), '|Editing a.js');

  canvasLabel.innerHTML = 'Reading <code>b.js</code>';
  await settle();
  assert.equal(visible(), '|Thinking');

  page.settings({});
  page.checkNow();
  assert.equal(visible(), '|Reading b.js');
});

test('a translation that arrives after disabling changes nothing', async (t) => {
  const page = openChat(t, [item(row('Führt <strong>ls</strong> aus'))]);
  page.document.documentElement.lang = 'de';
  let release;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      release = () =>
        resolve({
          ok: true,
          json: async () => ({ ACTION_MESSAGE$RUN: 'Führt <cmd>{{command}}</cmd> aus' }),
        });
    });
  const dispose = await activateExtension(page, fakeHost());
  dispose();
  release();
  await settle();

  assert.equal(toggles(page).length, 0);
  assert.equal(page.document.querySelector('[data-extras-quiet]'), null);
  assert.equal(page.document.getElementById('openhands-extras-quiet-activity'), null);
});

test("leaves rows alone when Canvas's markup doesn't have their wrapper", async (t) => {
  const page = openChat(t, [
    // The title's grandparent is the chat, or the item itself.
    '<div><div data-testid="generic-event-message-title"><span>Running ls</span></div></div>',
    '<div><div><div data-testid="generic-event-message-title"><span>Reading a.js</span></div></div></div>',
    item(message('Done.')),
  ]);
  await activateExtension(page, fakeHost());

  assert.equal(page.document.querySelector('[data-extras-quiet]'), null);
  assert.equal(toggles(page).length, 0);
  assert.deepEqual(shown(page), ['Running ls', 'Reading a.js', 'Done.']);
});

test('the Thinking toggle has a focus ring and a pulse that respects reduced motion', async (t) => {
  const page = openChat(t, [item(row('Running <strong>ls</strong>'))]);
  await activateExtension(page, fakeHost({ statuses: { [ID]: 'running' } }));
  await settle();
  const [thinking] = toggles(page);
  const button = thinking.querySelector('button');
  for (const name of ['focus-visible:outline-2', 'focus-visible:outline-offset-2', 'focus-visible:outline-focus']) {
    assert.ok(button.classList.contains(name), name);
  }
  const label = thinking.querySelector('span');
  assert.deepEqual(
    ['animate-pulse', 'motion-reduce:animate-none'].map((name) => label.classList.contains(name)),
    [true, true],
  );
});
