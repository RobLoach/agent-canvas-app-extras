import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPage, fakeHost, activateExtension, settle } from './helpers.js';

const BODY =
  '<div data-agent-server-ui data-color-theme="dark" style="background-color: rgb(10, 20, 30)"></div>';
const meta = (page) => page.document.querySelector('meta[name="theme-color"]');

test('matches the theme-color to Canvas and follows theme changes', async (t) => {
  const page = setupPage(t, { body: BODY });
  // As in Canvas, <body> is marked too, and comes first.
  page.document.body.setAttribute('data-agent-server-ui', '');
  page.settings({ themeColor: true });
  await activateExtension(page, fakeHost());
  assert.equal(meta(page).content, 'rgb(10, 20, 30)');
  assert.equal(page.document.head.firstElementChild, meta(page));

  const root = page.document.querySelector('[data-color-theme]');
  root.setAttribute('data-color-theme', 'light');
  root.style.backgroundColor = 'rgb(250, 250, 250)';
  await settle();
  assert.equal(meta(page).content, 'rgb(250, 250, 250)');
});

test('follows a re-mounted theme root', async (t) => {
  const page = setupPage(t, { body: BODY });
  page.settings({ themeColor: true });
  await activateExtension(page, fakeHost());

  page.document.body.innerHTML =
    '<div data-agent-server-ui style="background-color: rgb(1, 2, 3)"></div>';
  await settle();
  assert.equal(meta(page).content, 'rgb(1, 2, 3)');
});

test('leaves the theme-color alone while off, and removes it when disabled', async (t) => {
  const page = setupPage(t, { body: BODY });
  const dispose = await activateExtension(page, fakeHost());
  assert.equal(meta(page), null);

  page.settings({ themeColor: true });
  page.checkNow();
  assert.ok(meta(page));

  dispose();
  assert.equal(meta(page), null);
});
