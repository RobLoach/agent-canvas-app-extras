import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, setupPage } from './helpers.js';

// Canvas's ModalBackdrop and ManifestSubpageLayout, as they render, and this
// app's own shortcuts list, which is styled on its own.
const BODY = `
  <div id="modal" role="dialog" aria-modal="true" tabindex="-1" class="fixed inset-0 flex items-center justify-center outline-none z-60">
    <div class="fixed inset-0 bg-black opacity-60"></div>
    <div id="frame" class="relative"><div id="body" class="w-96"></div></div>
  </div>
  <aside id="drawer" data-testid="sidebar-mobile-drawer" class="fixed inset-y-0 left-0 z-50 flex w-[min(300px,85vw)] flex-col"></aside>
  <nav data-testid="automations-navbar-mobile" class="lg:hidden flex gap-1 overflow-x-auto"><a id="tab" href="/automations">Dashboard</a></nav>
  <div id="openhands-extras-shortcuts"><div role="dialog" aria-modal="true" class="relative"></div></div>
  <div role="dialog" aria-modal="true" class="fixed inset-0 z-70 flex items-start justify-center px-3">
    <button class="absolute inset-0 cursor-default"></button>
    <div id="command-menu" class="relative overflow-hidden rounded-2xl"></div>
  </div>`;

// The style's rules, inside its phone-width media query.
const rules = (page) =>
  [...(page.document.getElementById('openhands-extras-mobile-fixes')?.sheet?.cssRules ?? [])]
    .flatMap((rule) => (rule.media ? [...rule.cssRules] : [rule]));
const styled = (page, id) =>
  rules(page).some((rule) => page.document.getElementById(id).matches(rule.selectorText));

test('Mobile fixes are off by default', async (t) => {
  const page = setupPage(t, { body: BODY });
  await activateExtension(page, fakeHost());

  assert.deepEqual(rules(page), []);
});

test("keeps Canvas's dialogs on screen, the Automate tabs at their width, and the sidebar full width", async (t) => {
  const page = setupPage(t, { body: BODY, settings: { mobileFixes: true } });
  await activateExtension(page, fakeHost());

  for (const id of ['frame', 'body', 'tab', 'drawer']) assert.ok(styled(page, id), id);
  const drawer = rules(page).find((rule) => page.document.getElementById('drawer').matches(rule.selectorText));
  assert.equal(drawer.style.getPropertyValue('width'), '100%');
  assert.ok(!styled(page, 'modal'));
  assert.ok(!styled(page, 'command-menu'), "Canvas's command menu has its own layout");
  assert.match(
    page.document.getElementById('openhands-extras-mobile-fixes').textContent,
    /@media \(max-width: 767px\)/,
  );
  assert.ok(
    ![...page.document.querySelectorAll('#openhands-extras-shortcuts *')].some((element) =>
      rules(page).some((rule) => element.matches(rule.selectorText)),
    ),
  );

  await page.changeSettings({});
  assert.deepEqual(rules(page), []);
});
