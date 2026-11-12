import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, flush, setupPage } from './helpers.js';

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
  const page = setupPage(t, { head: HEAD, body: BODY });
  await activateExtension(page, fakeHost());

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
  const page = setupPage(t, { head: HEAD, body: BODY, settings: ON });
  await activateExtension(page, fakeHost());

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
  const page = setupPage(t, {
    head: `${HEAD}<link rel="manifest" href="/site.webmanifest">`,
    body: BODY,
    settings: ON,
  });
  await activateExtension(page, fakeHost());

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
