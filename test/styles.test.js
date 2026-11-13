import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activateExtension,
  cssRules,
  fakeHost,
  flush,
  openSettings,
  setupPage,
  start,
  styleRule,
} from './helpers.js';

// The switches that are only a style.

describe('Wide chat', () => {
  const BODY = `<div data-agent-server-ui>
    <div id="thread" class="w-full min-w-0 max-w-200 h-full flex flex-col min-h-0"></div>
    <div id="settings" class="mx-auto flex w-full min-w-0 max-w-200 flex-col gap-6"></div>
  </div>`;

  const wideSelector = (document) =>
    document
      .getElementById('openhands-extras-wide-chat')
      ?.textContent.split('{')[0]
      .trim();

  test('is off by default', async (t) => {
    const { page } = await start(t, { body: BODY });

    assert.equal(wideSelector(page.document), undefined);
  });

  test('widens the chat thread but not other max-w-200 columns', async (t) => {
    const page = setupPage(t, { body: BODY, settings: { wideChat: true } });
    const dispose = await activateExtension(page, fakeHost());

    const selector = wideSelector(page.document);
    assert.ok(page.document.getElementById('thread').matches(selector));
    assert.ok(!page.document.getElementById('settings').matches(selector));

    dispose();
    assert.equal(wideSelector(page.document), undefined);
  });
});

describe('Focused new chat', () => {
  // Canvas's new chat page (HomeChatLauncher), before and while a chat starts.
  const launcher = (id, starting) => `
    <div id="${id}" data-testid="home-chat-launcher" class="flex w-full flex-col items-center ${starting ? 'h-full min-h-0 py-4' : 'pt-[max(4rem,28vh)] pb-10'}">
      <div class="flex w-full max-w-200 flex-col gap-4 md:px-4">
        <div id="${id}-title" class="flex w-full justify-center">
          <div class="flex w-full flex-col items-center gap-2 py-2">
            <h1>What do you want to work on?</h1>
            <p data-testid="home-header-subtitle">Investigate, implement, debug, test, review, or automate work across your codebase.</p>
          </div>
        </div>
        <div id="${id}-toggle" class="flex w-full justify-center"><div>Chat | Automate</div></div>
        <div id="${id}-input" class="w-full"><div data-testid="chat-input"></div></div>
      </div>
    </div>`;
  const BODY = launcher('home') + launcher('starting', true);

  const rules = (page) => cssRules(page, 'openhands-extras-focused-new-chat');
  const ruleFor = (page, id) => styleRule(page, 'openhands-extras-focused-new-chat', id);

  test('Focused new chat is off by default', async (t) => {
    const { page } = await start(t, { body: BODY });

    assert.deepEqual(rules(page), []);
  });

  test('hides the heading and tagline, and starts the page at the top', async (t) => {
    const page = setupPage(t, { body: BODY, settings: { focusedNewChat: true } });
    const dispose = await activateExtension(page, fakeHost());

    assert.equal(ruleFor(page, 'home-title').style.display, 'none');
    for (const id of ['home-toggle', 'home-input']) assert.equal(ruleFor(page, id), undefined, id);
    assert.equal(ruleFor(page, 'home').style.paddingTop, '2rem');
    assert.equal(ruleFor(page, 'starting'), undefined, 'not while a chat starts');

    dispose();
    assert.deepEqual(rules(page), []);
  });
});

describe('Mobile fixes', () => {
  // Canvas's ModalBackdrop and ManifestSubpageLayout, its shell, a button it
  // shows on hover, a conversation's hover preview, as they render, and this
  // app's own shortcuts list, which is styled on its own.
  const BODY = `
    <div id="shell" data-testid="root-layout" class="h-screen flex flex-col md:flex-row overflow-hidden p-0"></div>
    <div class="group"><button id="hover-button" class="opacity-0 group-hover:opacity-100">Remove</button></div>
    <div id="preview-tooltip" class="max-w-none overflow-visible rounded-xl border border-border bg-base-secondary p-0 text-contrast shadow-xl"><div data-testid="conversation-card-preview"></div></div>
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

  const rules = (page) => cssRules(page, 'openhands-extras-mobile-fixes');
  const styled = (page, id) =>
    rules(page).some((rule) => page.document.getElementById(id).matches(rule.selectorText));

  test('Mobile fixes are off by default', async (t) => {
    const { page } = await start(t, { body: BODY });

    assert.deepEqual(rules(page), []);
  });

  test("keeps Canvas's dialogs on screen, the Automate tabs at their width, and the sidebar full width", async (t) => {
    const { page } = await start(t, { body: BODY, settings: { mobileFixes: true } });

    for (const id of ['frame', 'body', 'tab', 'drawer', 'shell', 'hover-button', 'preview-tooltip']) {
      assert.ok(styled(page, id), id);
    }
    const shell = rules(page).find((rule) => page.document.getElementById('shell').matches(rule.selectorText));
    assert.equal(shell.style.getPropertyValue('height'), '100dvh');
    const drawer = rules(page).find((rule) => page.document.getElementById('drawer').matches(rule.selectorText));
    assert.equal(drawer.style.getPropertyValue('width'), '100%');
    assert.ok(!styled(page, 'modal'));
    assert.ok(!styled(page, 'command-menu'), "Canvas's command menu has its own layout");
    assert.match(
      page.document.getElementById('openhands-extras-mobile-fixes').textContent,
      /@media \(max-width: 767px\)/,
    );
    assert.match(
      page.document.getElementById('openhands-extras-mobile-fixes').textContent,
      /@media \(hover: none\)/,
    );
    assert.ok(
      ![...page.document.querySelectorAll('#openhands-extras-shortcuts *')].some((element) =>
        rules(page).some((rule) => element.matches(rule.selectorText)),
      ),
    );

    await page.changeSettings({});
    assert.deepEqual(rules(page), []);
  });
});

describe('Accessibility switches', () => {
  // Canvas's markup: a link it underlines only on hover, a sidebar row, an
  // icon button, and plain text.
  const BODY = `
    <a id="hover-link" href="/docs" class="text-link hover:underline">Docs</a>
    <a id="row" href="/conversations" class="flex h-9 min-h-9 items-center">New chat</a>
    <button id="icon" aria-label="Close" class="h-7 w-7"></button>
    <span id="text">Text</span>`;
  const STYLES = {
    reduceMotion: 'openhands-extras-reduce-motion',
    clearFocus: 'openhands-extras-clear-focus',
    biggerTapTargets: 'openhands-extras-bigger-tap-targets',
  };

  test('the accessibility switches are off by default', async (t) => {
    const { page } = await start(t, { body: BODY });

    for (const id of Object.values(STYLES)) assert.equal(page.document.getElementById(id), null, id);
  });

  test('Reduce motion ends every animation and transition at once', async (t) => {
    const { page } = await start(t, { body: BODY, settings: { reduceMotion: true } });

    const rule = styleRule(page, STYLES.reduceMotion, 'text');
    assert.equal(rule.style.getPropertyValue('animation-duration'), '0.01ms');
    assert.equal(rule.style.getPropertyPriority('transition-duration'), 'important');
  });

  test('Clear links and focus underlines hover-only links and rings focus', async (t) => {
    const { page } = await start(t, { body: BODY, settings: { clearFocus: true } });

    assert.equal(
      styleRule(page, STYLES.clearFocus, 'hover-link').style.getPropertyValue('text-decoration-line'),
      'underline',
    );
    assert.ok(cssRules(page, STYLES.clearFocus).some((rule) => rule.selectorText === ':focus-visible'));
  });

  test('Bigger tap targets sizes controls on touch screens only', async (t) => {
    const page = setupPage(t, { body: BODY, settings: { biggerTapTargets: true } });
    const dispose = await activateExtension(page, fakeHost());

    assert.match(
      page.document.getElementById(STYLES.biggerTapTargets).textContent,
      /@media \(pointer: coarse\)/,
    );
    for (const id of ['row', 'icon']) {
      assert.ok(styleRule(page, STYLES.biggerTapTargets, id), id);
    }
    assert.ok(
      cssRules(page, STYLES.biggerTapTargets).some(
        (rule) =>
          page.document.getElementById('icon').matches(rule.selectorText) &&
          rule.style.getPropertyValue('min-width') === '2.75rem',
      ),
    );
    assert.equal(styleRule(page, STYLES.biggerTapTargets, 'text'), undefined);

    dispose();
    assert.equal(page.document.getElementById(STYLES.biggerTapTargets), null);
  });
});

describe('Font size', () => {
  const SETTINGS_URL = 'https://canvas.test/extensions/agent-canvas-app-extras/settings';
  const style = (page) => page.document.getElementById('openhands-extras-font-size')?.textContent;
  const select = (page) => page.document.querySelector('[data-testid="extras-fontSize-select"]');
  function choose(page, value) {
    select(page).value = value;
    select(page).dispatchEvent(new page.window.Event('change', { bubbles: true }));
  }

  test('Font size starts at the default, leaving the page alone', async (t) => {
    const page = setupPage(t, { url: SETTINGS_URL });
    await openSettings(page);

    assert.equal(style(page), undefined);
    assert.equal(select(page).value, 'default');
    assert.equal(select(page).labels[0].textContent, 'Font size');
    assert.deepEqual(
      [...select(page).options].map((option) => option.textContent),
      ['Smallest', 'Smaller', 'Small', 'Default', 'Large', 'Larger', 'Largest'],
    );
  });

  test("scales the page's root font size, and saves the choice", async (t) => {
    const page = setupPage(t, { url: SETTINGS_URL });
    await openSettings(page);

    choose(page, 'larger');
    await flush();
    assert.equal(style(page), 'html { font-size: 125%; }');
    assert.equal(JSON.parse(page.window.localStorage.getItem('openhands-extras:settings')).fontSize, 'larger');

    choose(page, 'smallest');
    await flush();
    assert.equal(style(page), 'html { font-size: 75%; }');

    choose(page, 'default');
    await flush();
    assert.equal(style(page), undefined);
  });

  test('applies a saved size on load, and ignores one it does not know', async (t) => {
    const page = setupPage(t, { settings: { fontSize: 'small' } });
    const dispose = await activateExtension(page, fakeHost());
    assert.equal(style(page), 'html { font-size: 93.75%; }');

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
    assert.equal(select(page).value, 'default');
  });
});
