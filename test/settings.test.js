import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, flush, setupPage } from './helpers.js';

const CARDS = `
  <article data-testid="canvas-extension-card-demo-page"><header></header><footer></footer></article>
  <article id="card" data-testid="canvas-extension-card-agent-canvas-app-extras">
    <header></header><p>Description</p><footer></footer>
  </article>`;
const SETTINGS_PATH = '/extensions/agent-canvas-app-extras/settings';
const SETTINGS_URL = `https://canvas.test${SETTINGS_PATH}`;
// Customize's menu, as Canvas renders it.
const MENU =
  '<div id="menu"><a data-testid="sidebar-extensions-/plugins" href="/plugins">Plugins</a><a data-testid="sidebar-extensions-/apps" href="/apps">Apps</a></div>';

const section = (page) => page.document.getElementById('openhands-extras-settings');
const switchFor = (page, key) =>
  page.document.querySelector(`[data-testid="extras-${key}-switch"]`);
const hintFor = (page, key) =>
  page.document.getElementById(
    switchFor(page, key).getAttribute('aria-describedby'),
  ).textContent;
const stored = (page) =>
  JSON.parse(page.window.localStorage.getItem('openhands-extras:settings'));

// The app with its settings page open, as Canvas mounts it. Returns the app's
// disposer.
async function openSettings(page, host = fakeHost()) {
  const dispose = await activateExtension(page, host);
  const container = page.document.createElement('div');
  page.document.body.append(container);
  host.pages.get('settings')({ container, path: '', navigate: host.navigate });
  await flush();
  return dispose;
}

const SWITCH_KEYS = [
  'wideCanvas',
  'responsiveTables',
  'quietActivity',
  'keyboardShortcuts',
  'tabStatus',
  'notifications',
  'confirmationSound',
  'unreadMarkers',
  'installableApp',
  'mobileFixes',
  'usagePage',
];

test('links its card on Customize > Apps to the settings page', async (t) => {
  const page = setupPage(t, { body: CARDS });
  const host = fakeHost();
  const dispose = await activateExtension(page, host);

  const card = page.document.getElementById('card');
  assert.equal(card.querySelector('footer').previousElementSibling, section(page));
  assert.equal(
    page.document.querySelector('[data-testid="canvas-extension-card-demo-page"]')
      .children.length,
    2,
  );
  const link = section(page).querySelector('[data-testid="extras-open-settings"]');
  assert.equal(link.getAttribute('href'), SETTINGS_URL);
  link.click();
  assert.deepEqual(host.navigations, [SETTINGS_PATH]);

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

test("adds Extras under Apps in Customize's menu", async (t) => {
  const page = setupPage(t, { body: MENU });
  const host = fakeHost();
  const dispose = await activateExtension(page, host);

  const links = [...page.document.querySelectorAll('#menu > a')];
  assert.deepEqual(links.map((link) => link.textContent), ['Plugins', 'Apps', 'Extras']);
  links[2].click();
  assert.deepEqual(host.navigations, [SETTINGS_PATH]);

  // The compact menu renders its links when opened.
  page.document.body.insertAdjacentHTML('beforeend', MENU.replace('id="menu"', 'id="compact"'));
  await flush();
  assert.equal(page.document.querySelector('#compact > a:last-child').textContent, 'Extras');

  dispose();
  assert.equal(page.document.querySelector('[data-testid="sidebar-extensions-extras"]'), null);
});

test("hides the settings page's sidebar link, and the usage page's while it's off", async (t) => {
  const page = setupPage(t);
  await activateExtension(page, fakeHost());
  const style = () => page.document.getElementById('openhands-extras-sidebar').textContent;
  assert.match(style(), /agent-canvas-app-extras-settings/);
  assert.match(style(), /agent-canvas-app-extras-usage/);

  await page.changeSettings({ usagePage: true });
  assert.doesNotMatch(style(), /agent-canvas-app-extras-usage/);
});

test('lists every switch under its group on the settings page, beside Customize', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  const host = fakeHost();
  await openSettings(page, host);

  const headings = [...page.document.querySelectorAll('h3')].map((h) => h.textContent);
  assert.deepEqual(headings, ['Chat', 'Status and notifications', 'App']);
  for (const key of SWITCH_KEYS) {
    assert.equal(switchFor(page, key).checked, false, key);
    assert.ok(hintFor(page, key), `${key} has a description`);
  }
  const current = page.document.querySelector('aside [aria-current="page"]');
  assert.equal(current.textContent, 'Extras');
  page.document.querySelector('aside a').click();
  assert.deepEqual(host.navigations, ['/mcp']);
});

test('redraws the switches when another tab changes the settings', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  await openSettings(page);

  await page.changeSettings({ wideCanvas: true });
  assert.equal(switchFor(page, 'wideCanvas').checked, true);
});

test('saves and applies a switch', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  await openSettings(page);

  switchFor(page, 'wideCanvas').click();
  await flush();

  assert.equal(stored(page).wideCanvas, true);
  assert.ok(page.document.getElementById('openhands-extras-wide-canvas'));
});

test('turns notifications back off when the browser denies permission', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  page.permission = 'default';
  page.permissionAnswer = 'denied';
  await openSettings(page);

  switchFor(page, 'notifications').click();
  await flush();

  assert.equal(switchFor(page, 'notifications').checked, false);
  assert.match(hintFor(page, 'notifications'), /blocked/);
  assert.equal(stored(page).notifications, false);
});

test('explains when notifications are on but permission was revoked', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL, settings: { notifications: true } });
  page.permission = 'denied';
  await openSettings(page);

  assert.equal(switchFor(page, 'notifications').checked, true);
  assert.match(hintFor(page, 'notifications'), /blocked/);
});

test('presents each setting as a switch, with a hint read out as it changes', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  await openSettings(page);

  for (const key of ['wideCanvas', 'notifications']) {
    const input = switchFor(page, key);
    assert.equal(input.getAttribute('role'), 'switch', key);
    assert.equal(input.closest('label').querySelector('div'), null, 'only phrasing content in a label');
    const hint = page.document.getElementById(input.getAttribute('aria-describedby'));
    assert.equal(hint.getAttribute('aria-live'), 'polite', key);
  }
});

test('ignores a switch that finishes changing after the app is disabled', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL, settings: { wideCanvas: true } });
  page.permission = 'default';
  let answer;
  page.window.Notification.requestPermission = () =>
    new Promise((resolve) => {
      answer = () => {
        page.permission = 'granted';
        resolve('granted');
      };
    });
  const dispose = await openSettings(page);
  switchFor(page, 'notifications').click();
  await flush();

  // Disabled while the permission prompt is still open.
  dispose();
  answer();
  await flush();
  assert.equal(page.document.getElementById('openhands-extras-wide-canvas'), null);
  assert.deepEqual(stored(page), { wideCanvas: true });
});

test('resets the settings, turning every feature off', async (t) => {
  const page = setupPage(t, {
    url: SETTINGS_URL,
    settings: { wideCanvas: true, tabStatus: true },
  });
  await openSettings(page);
  assert.ok(page.document.getElementById('openhands-extras-wide-canvas'));

  page.document.querySelector('[data-testid="extras-reset-settings"]').click();
  await flush();

  assert.equal(page.window.localStorage.getItem('openhands-extras:settings'), null);
  assert.equal(page.document.getElementById('openhands-extras-wide-canvas'), null);
  assert.equal(switchFor(page, 'wideCanvas').checked, false);
  assert.equal(switchFor(page, 'tabStatus').checked, false);
});

test('a reset while the permission prompt is open keeps every switch off', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  let answer;
  page.window.Notification.requestPermission = () =>
    new Promise((resolve) => {
      answer = () => {
        page.permission = 'granted';
        resolve('granted');
      };
    });
  await openSettings(page);
  switchFor(page, 'notifications').click();
  await flush();

  page.document.querySelector('[data-testid="extras-reset-settings"]').click();
  answer();
  await flush();
  assert.equal(page.window.localStorage.getItem('openhands-extras:settings'), null);
  assert.equal(switchFor(page, 'notifications').checked, false);
});

test('turns on the switches that merged ones moved into', async (t) => {
  const page = setupPage(t, {
    url: SETTINGS_URL,
    settings: { appBadge: true, themeColor: true },
  });
  await openSettings(page);

  assert.equal(switchFor(page, 'tabStatus').checked, true);
  assert.equal(switchFor(page, 'installableApp').checked, true);

  switchFor(page, 'tabStatus').click();
  await flush();
  const saved = JSON.parse(page.window.localStorage.getItem('openhands-extras:settings'));
  assert.equal(saved.tabStatus, false);
  assert.equal(saved.installableApp, true);
  assert.equal('appBadge' in saved || 'themeColor' in saved, false);
});

test('keeps redrawing after Canvas cleans up an earlier mount late', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  const host = fakeHost();
  await activateExtension(page, host);
  const mount = () => {
    const container = page.document.createElement('div');
    page.document.body.append(container);
    return host.pages.get('settings')({ container, path: '', navigate: host.navigate });
  };
  const first = mount();
  mount();
  first();

  await page.changeSettings({ wideCanvas: true });
  assert.equal(switchFor(page, 'wideCanvas').checked, true);
});

test('shows the keyboard shortcuts, and links back to Customize on small screens', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  const host = fakeHost();
  await openSettings(page, host);

  page.document.querySelector('[data-testid="extras-show-shortcuts"]').click();
  assert.ok(page.document.getElementById('openhands-extras-shortcuts'));

  const back = [...page.document.querySelectorAll('a')].find((a) => a.textContent === '← Customize');
  assert.ok(back.classList.contains('lg:hidden'));
  back.click();
  assert.deepEqual(host.navigations, ['/apps']);
});
