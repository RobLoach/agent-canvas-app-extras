import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, flush, setupPage } from './helpers.js';

const CARDS = `
  <article data-testid="canvas-extension-card-demo-page"><header></header><footer></footer></article>
  <article id="card" data-testid="canvas-extension-card-agent-canvas-app-extras">
    <header></header><p>Description</p><footer></footer>
  </article>`;

const section = (page) => page.document.getElementById('openhands-extras-settings');
const switchFor = (page, key) =>
  page.document.querySelector(`[data-testid="extras-${key}-switch"]`);
const hintFor = (page, key) =>
  page.document.getElementById(
    switchFor(page, key).getAttribute('aria-describedby'),
  ).textContent;
const stored = (page) =>
  JSON.parse(page.window.localStorage.getItem('openhands-extras:settings'));

test('adds the settings above its own card footer on Customize > Apps', async (t) => {
  const page = setupPage(t, { body: CARDS });
  const dispose = await activateExtension(page, fakeHost());

  const card = page.document.getElementById('card');
  assert.equal(section(page).parentElement, card);
  assert.equal(card.querySelector('footer').previousElementSibling, section(page));
  assert.equal(
    page.document.querySelector('[data-testid="canvas-extension-card-demo-page"]')
      .children.length,
    2,
  );
  for (const key of ['wideCanvas', 'tabStatus', 'notifications', 'confirmationSound', 'appBadge', 'themeColor', 'quietActivity']) {
    assert.equal(switchFor(page, key).checked, false, key);
    assert.ok(hintFor(page, key), `${key} has a description`);
  }

  dispose();
  assert.equal(section(page), null);
});

test('stays out of the card on other pages', async (t) => {
  const page = setupPage(t, { url: 'https://canvas.test/conversations/x', body: CARDS });
  await activateExtension(page, fakeHost());
  page.mutate();
  await flush();

  assert.equal(section(page), null);
});

test('moves back above the footer when Canvas inserts before it', async (t) => {
  const page = setupPage(t, { body: CARDS });
  await activateExtension(page, fakeHost());

  const footer = page.document.querySelector('#card > footer');
  footer.before(page.document.createElement('section'));
  await flush();

  assert.equal(footer.previousElementSibling, section(page));
  assert.equal(page.document.querySelectorAll('#openhands-extras-settings').length, 1);
});

test('saves and applies a switch', async (t) => {
  const page = setupPage(t, { body: CARDS });
  await activateExtension(page, fakeHost());

  switchFor(page, 'wideCanvas').click();
  await flush();

  assert.equal(stored(page).wideCanvas, true);
  assert.ok(page.document.getElementById('openhands-extras-wide-canvas'));
});

test('turns notifications back off when the browser denies permission', async (t) => {
  const page = setupPage(t, { body: CARDS });
  page.permission = 'default';
  page.permissionAnswer = 'denied';
  await activateExtension(page, fakeHost());

  switchFor(page, 'notifications').click();
  await flush();

  assert.equal(switchFor(page, 'notifications').checked, false);
  assert.match(hintFor(page, 'notifications'), /blocked/);
  assert.equal(stored(page).notifications, false);
});

test('explains when notifications are on but permission was revoked', async (t) => {
  const page = setupPage(t, { body: CARDS, settings: { notifications: true } });
  page.permission = 'denied';
  await activateExtension(page, fakeHost());

  assert.equal(switchFor(page, 'notifications').checked, true);
  assert.match(hintFor(page, 'notifications'), /blocked/);
});

test('presents each setting as a switch, with a hint read out as it changes', async (t) => {
  const page = setupPage(t, { body: CARDS });
  await activateExtension(page, fakeHost());

  for (const key of ['wideCanvas', 'notifications']) {
    const input = switchFor(page, key);
    assert.equal(input.getAttribute('role'), 'switch', key);
    assert.equal(input.closest('label').querySelector('div'), null, 'only phrasing content in a label');
    const hint = page.document.getElementById(input.getAttribute('aria-describedby'));
    assert.equal(hint.getAttribute('aria-live'), 'polite', key);
  }
});
