import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, setupPage } from './helpers.js';

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

// The rules of a style, including those inside media queries.
const rules = (page, id) =>
  [...(page.document.getElementById(id)?.sheet?.cssRules ?? [])].flatMap((rule) =>
    rule.media ? [...rule.cssRules] : [rule],
  );
const ruleFor = (page, id, elementId) =>
  rules(page, id).find((rule) => page.document.getElementById(elementId).matches(rule.selectorText));

test('the accessibility switches are off by default', async (t) => {
  const page = setupPage(t, { body: BODY });
  await activateExtension(page, fakeHost());

  for (const id of Object.values(STYLES)) assert.equal(page.document.getElementById(id), null, id);
});

test('Reduce motion ends every animation and transition at once', async (t) => {
  const page = setupPage(t, { body: BODY, settings: { reduceMotion: true } });
  await activateExtension(page, fakeHost());

  const rule = ruleFor(page, STYLES.reduceMotion, 'text');
  assert.equal(rule.style.getPropertyValue('animation-duration'), '0.01ms');
  assert.equal(rule.style.getPropertyPriority('transition-duration'), 'important');
});

test('Clear links and focus underlines hover-only links and rings focus', async (t) => {
  const page = setupPage(t, { body: BODY, settings: { clearFocus: true } });
  await activateExtension(page, fakeHost());

  assert.equal(
    ruleFor(page, STYLES.clearFocus, 'hover-link').style.getPropertyValue('text-decoration-line'),
    'underline',
  );
  assert.ok(rules(page, STYLES.clearFocus).some((rule) => rule.selectorText === ':focus-visible'));
});

test('Bigger tap targets sizes controls on touch screens only', async (t) => {
  const page = setupPage(t, { body: BODY, settings: { biggerTapTargets: true } });
  const dispose = await activateExtension(page, fakeHost());

  assert.match(
    page.document.getElementById(STYLES.biggerTapTargets).textContent,
    /@media \(pointer: coarse\)/,
  );
  for (const id of ['row', 'icon']) {
    assert.ok(ruleFor(page, STYLES.biggerTapTargets, id), id);
  }
  assert.ok(
    rules(page, STYLES.biggerTapTargets).some(
      (rule) =>
        page.document.getElementById('icon').matches(rule.selectorText) &&
        rule.style.getPropertyValue('min-width') === '2.75rem',
    ),
  );
  assert.equal(ruleFor(page, STYLES.biggerTapTargets, 'text'), undefined);

  dispose();
  assert.equal(page.document.getElementById(STYLES.biggerTapTargets), null);
});
