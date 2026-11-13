import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, flush, setupPage, start } from './helpers.js';

const HEAD = '<meta name="viewport" content="width=device-width, initial-scale=1">';
const BODY =
  '<div data-agent-server-ui data-color-theme="dark" style="background-color: rgb(10, 20, 30)"><div data-testid="root-layout"></div></div>';
const ON = { installableApp: true };

const link = (page) => page.document.getElementById('openhands-extras-manifest');
const manifest = (page) =>
  JSON.parse(
    decodeURIComponent(
      link(page).getAttribute('href').replace('data:application/manifest+json,', ''),
    ),
  );
const viewport = (page) =>
  page.document.querySelector('meta[name="viewport"]').getAttribute('content');
const meta = (page, name) =>
  page.document.querySelector(`meta[name="${name}"]`)?.content;
const safeArea = (page) => page.document.getElementById('openhands-extras-safe-area');

test('Installable app is off by default', async (t) => {
  const { page } = await start(t, { head: HEAD, body: BODY });

  assert.equal(link(page), null);
  assert.equal(viewport(page), 'width=device-width, initial-scale=1');
});

test('links a manifest, iOS tags and safe-area padding, and removes them when disabled', async (t) => {
  const page = setupPage(t, { head: HEAD, body: BODY, settings: ON });
  const dispose = await activateExtension(page, fakeHost());

  assert.equal(link(page).rel, 'manifest');
  const app = manifest(page);
  assert.equal(app.name, 'OpenHands');
  assert.equal(app.id, 'https://canvas.test/');
  assert.equal(app.start_url, 'https://canvas.test/');
  assert.equal(app.scope, 'https://canvas.test/');
  assert.equal(app.display, 'standalone');
  assert.equal(app.theme_color, 'rgb(10, 20, 30)');
  assert.deepEqual(app.icons, [
    {
      src: 'https://canvas.test/favicon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any',
    },
  ]);
  assert.equal(meta(page, 'apple-mobile-web-app-capable'), 'yes');
  assert.equal(meta(page, 'apple-mobile-web-app-title'), 'OpenHands');
  assert.equal(
    viewport(page),
    'width=device-width, initial-scale=1, viewport-fit=cover',
  );
  assert.ok(
    page.document
      .querySelector('[data-testid="root-layout"]')
      .matches(safeArea(page).textContent.split('{')[0]),
  );

  dispose();
  assert.equal(link(page), null);
  assert.equal(meta(page, 'apple-mobile-web-app-capable'), undefined);
  assert.equal(safeArea(page), null);
  assert.equal(viewport(page), 'width=device-width, initial-scale=1');
});

test('adds the manifest link with its rel, as Chromium needs', async (t) => {
  const page = setupPage(t, { head: HEAD, body: BODY, settings: ON });
  const added = [];
  new page.window.MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) added.push(node.getAttribute('rel'));
    }
  }).observe(page.document.head, { childList: true });
  await activateExtension(page, fakeHost());

  assert.ok(added.includes('manifest'));
});

test('follows the theme in the manifest colours', async (t) => {
  const { page } = await start(t, { head: HEAD, body: BODY, settings: ON });

  page.document.querySelector('[data-color-theme]').style.backgroundColor =
    'rgb(250, 250, 250)';
  page.mutate();
  await flush();
  assert.equal(manifest(page).background_color, 'rgb(250, 250, 250)');
});

test("uses Canvas's base path", async (t) => {
  const page = setupPage(t, { head: HEAD, body: BODY, settings: ON });
  page.window.__reactRouterContext = { basename: '/canvas' };
  await activateExtension(page, fakeHost());

  const app = manifest(page);
  assert.equal(app.start_url, 'https://canvas.test/canvas/');
  assert.equal(app.scope, 'https://canvas.test/canvas/');
  assert.equal(app.icons[0].src, 'https://canvas.test/canvas/favicon.svg');
});

test('stands down when Canvas links a manifest itself', async (t) => {
  const { page } = await start(t, {
    head: `${HEAD}<link rel="manifest" href="/site.webmanifest">`,
    body: BODY,
    settings: ON,
  });

  assert.equal(link(page), null);
  assert.equal(safeArea(page), null);
  assert.equal(viewport(page), 'width=device-width, initial-scale=1');
});

test("draws Canvas's icon as PNGs where the browser can", async (t) => {
  const page = setupPage(t, { head: HEAD, body: BODY, settings: ON });
  const { window } = page;
  window.Image = class {
    set src(url) {
      this.url = url;
      setImmediate(() => this.onload());
    }
  };
  window.HTMLCanvasElement.prototype.getContext = () => ({
    fillRect() {},
    drawImage() {},
  });
  window.HTMLCanvasElement.prototype.toDataURL = function () {
    return `data:image/png;base64,${this.width}`;
  };
  await activateExtension(page, fakeHost());

  assert.deepEqual(
    manifest(page).icons.map(({ sizes, type, purpose }) => `${sizes} ${type} ${purpose}`),
    [
      '192x192 image/png any',
      '512x512 image/png any',
      '512x512 image/png maskable',
      'any image/svg+xml any',
    ],
  );
  assert.equal(
    page.document.getElementById('openhands-extras-touch-icon').getAttribute('href'),
    'data:image/png;base64,180',
  );
});

test('adds New chat and Settings shortcuts, and reuses the open window', async (t) => {
  const page = setupPage(t, { head: HEAD, body: BODY, settings: ON });
  page.window.__reactRouterContext = { basename: '/canvas' };
  await activateExtension(page, fakeHost());

  const app = manifest(page);
  assert.deepEqual(app.shortcuts, [
    { name: 'New chat', url: 'https://canvas.test/canvas/conversations' },
    { name: 'Settings', url: 'https://canvas.test/canvas/settings' },
  ]);
  assert.deepEqual(app.launch_handler, { client_mode: ['focus-existing', 'auto'] });
});

test('takes launches into the open window, under the base path', async (t) => {
  const page = setupPage(t, { head: HEAD, body: BODY, settings: ON });
  page.window.__reactRouterContext = { basename: '/canvas' };
  let consumer = null;
  page.window.launchQueue = { setConsumer: (next) => (consumer = next) };
  const host = fakeHost();
  const dispose = await activateExtension(page, host);

  consumer({ targetURL: 'https://canvas.test/canvas/settings' });
  consumer({ targetURL: 'https://canvas.test/canvas/conversations' });
  assert.deepEqual(host.navigations, ['/settings', '/conversations']);

  await page.changeSettings({});
  consumer({ targetURL: 'https://canvas.test/canvas/settings' });
  assert.equal(host.navigations.length, 2);

  dispose();
  consumer({ targetURL: 'https://canvas.test/canvas/settings' });
  assert.equal(host.navigations.length, 2);
});

test('links the manifest only once its icons are drawn', async (t) => {
  const page = setupPage(t, { head: HEAD, body: BODY, settings: ON });
  let loaded = null;
  page.window.Image = class {
    set src(url) {
      loaded = () => this.onerror();
    }
  };
  await activateExtension(page, fakeHost());

  assert.equal(link(page), null);
  assert.equal(meta(page, 'apple-mobile-web-app-capable'), 'yes');

  loaded();
  await flush();
  assert.equal(manifest(page).icons.length, 1);
});

const THEME_BODY =
  '<div data-agent-server-ui data-color-theme="dark" style="background-color: rgb(10, 20, 30)"></div>';
const themeColor = (page) => page.document.querySelector('meta[name="theme-color"]');

test('matches the theme-color to Canvas and follows theme changes', async (t) => {
  const page = setupPage(t, { body: THEME_BODY, settings: { installableApp: true } });
  // As in Canvas, <body> is marked too, and comes first.
  page.document.body.setAttribute('data-agent-server-ui', '');
  await activateExtension(page, fakeHost());
  assert.equal(themeColor(page).content, 'rgb(10, 20, 30)');
  assert.equal(page.document.head.firstElementChild, themeColor(page));

  const root = page.document.querySelector('[data-color-theme]');
  root.setAttribute('data-color-theme', 'light');
  root.style.backgroundColor = 'rgb(250, 250, 250)';
  await flush();
  assert.equal(themeColor(page).content, 'rgb(250, 250, 250)');
});

test('follows a re-mounted theme root', async (t) => {
  const { page } = await start(t, { body: THEME_BODY, settings: { installableApp: true } });

  page.document.body.innerHTML =
    '<div data-agent-server-ui style="background-color: rgb(1, 2, 3)"></div>';
  await flush();
  assert.equal(themeColor(page).content, 'rgb(1, 2, 3)');
});

test('leaves the theme-color alone while off, and removes it when disabled', async (t) => {
  const page = setupPage(t, { body: THEME_BODY });
  const dispose = await activateExtension(page, fakeHost());
  assert.equal(themeColor(page), null);

  await page.changeSettings({ installableApp: true });
  assert.ok(themeColor(page));

  dispose();
  assert.equal(themeColor(page), null);
});

test('does not rebuild the manifest as the chat changes', async (t) => {
  const { page } = await start(t, { head: HEAD, body: BODY, settings: ON });
  let styles = 0;
  const { getComputedStyle } = page.window;
  page.window.getComputedStyle = (...args) => {
    styles += 1;
    return getComputedStyle(...args);
  };

  page.mutate();
  page.mutate();
  await flush();
  assert.equal(styles, 0);
});
