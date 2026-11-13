import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, setupPage } from './helpers.js';

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

const rules = (page) => [...(page.document.getElementById('openhands-extras-focused-new-chat')?.sheet?.cssRules ?? [])];
const ruleFor = (page, id) =>
  rules(page).find((rule) => page.document.getElementById(id).matches(rule.selectorText));

test('Focused new chat is off by default', async (t) => {
  const page = setupPage(t, { body: BODY });
  await activateExtension(page, fakeHost());

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
