import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, flush, setupPage } from './helpers.js';

const SETTINGS_URL = 'https://canvas.test/extensions/agent-canvas-app-extras/settings';
const style = (page) => page.document.getElementById('openhands-extras-font-size')?.textContent;
const option = (page, value) =>
  page.document.querySelector(`[data-testid="extras-fontSize-${value}"]`);

async function openSettings(page) {
  const host = fakeHost();
  await activateExtension(page, host);
  const container = page.document.createElement('div');
  page.document.body.append(container);
  host.pages.get('settings')({ container, path: '', navigate: host.navigate });
  await flush();
}

test('Font size starts at the default, leaving the page alone', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  await openSettings(page);

  assert.equal(style(page), undefined);
  assert.equal(option(page, 'default').checked, true);
  const group = option(page, 'default').closest('fieldset');
  assert.equal(group.querySelector('legend').textContent, 'Font size');
});

test("scales the page's root font size, and saves the choice", async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL });
  await openSettings(page);

  option(page, 'larger').click();
  await flush();
  assert.equal(style(page), 'html { font-size: 125%; }');
  assert.equal(JSON.parse(page.window.localStorage.getItem('openhands-extras:settings')).fontSize, 'larger');
  assert.match(option(page, 'larger').closest('label').className, /bg-contrast/);

  option(page, 'default').click();
  await flush();
  assert.equal(style(page), undefined);
});

test('applies a saved size on load, and ignores one it does not know', async (t) => {
  const page = setupPage(t, { settings: { fontSize: 'small' } });
  const dispose = await activateExtension(page, fakeHost());
  assert.equal(style(page), 'html { font-size: 90%; }');

  await page.changeSettings({ fontSize: 'enormous' });
  assert.equal(style(page), undefined);

  await page.changeSettings({ fontSize: 'largest' });
  dispose();
  assert.equal(style(page), undefined);
});

test('Reset settings puts the size back', async (t) => {
  const page = setupPage(t, { url: SETTINGS_URL, settings: { fontSize: 'large' } });
  await openSettings(page);
  page.document.querySelector('[data-testid="extras-reset-settings"]').click();
  await flush();

  assert.equal(style(page), undefined);
  assert.equal(option(page, 'default').checked, true);
});
