// Keyboard shortcuts.

import { el, FOCUS_RING, OWN_ATTR } from './dom.js';
import {
  canvasBase,
  openConversationId,
  sidebarConversations,
} from './canvas.js';
import { settings } from './settings.js';

// Keyboard shortcuts for what Canvas's own ⌘K command menu doesn't cover,
// and a list of them on ?. Keys typed into a field are left alone, as are
// ones Canvas already handled.
const HELP_ID = 'openhands-extras-shortcuts';
const COMPOSER = '[data-testid="chat-input"]';
const isApple = () => /Mac|iPhone|iPad/.test(window.navigator.platform ?? '');
const typing = (target) =>
  !!target?.closest?.(
    'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, select, [contenteditable]:not([contenteditable="false"])',
  );

// One of Canvas's own dialogs, which keeps keys to itself.
const canvasDialogOpen = () =>
  [...document.querySelectorAll('[aria-modal="true"]')].some(
    (dialog) => !dialog.closest(`#${HELP_ID}`),
  );

// Opens the list of shortcuts, while Keyboard shortcuts runs.
export let showShortcuts = null;

function shortcutList() {
  const mod = isApple() ? '⌘' : 'Ctrl';
  const alt = isApple() ? '⌥' : 'Alt';
  return [
    ['?', 'Show these shortcuts'],
    ['/', 'Focus the message box'],
    [`${alt} ↑`, 'Open the previous conversation in the sidebar'],
    [`${alt} ↓`, 'Open the next conversation in the sidebar'],
    [`${alt} N`, 'Start a new chat'],
    [`${mod} K`, "Open Canvas's command menu, e.g. to toggle the sidebar"],
    ['Esc', 'Close this list'],
  ];
}

export function keyboardShortcuts(host) {
  let returnFocus = null;
  const help = () => document.getElementById(HELP_ID);

  function closeHelp() {
    if (!help()) return;
    help().remove();
    returnFocus?.focus?.();
    returnFocus = null;
  }

  function openHelp() {
    returnFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.id = HELP_ID;
    overlay.setAttribute(OWN_ATTR, '');
    overlay.style.cssText =
      'position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgb(0 0 0 / 0.5);';
    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="${HELP_ID}-title" class="w-full max-w-md rounded-xl border border-border bg-base-secondary p-6 text-contrast">
        <h2 id="${HELP_ID}-title" class="text-lg font-semibold">Keyboard shortcuts</h2>
        <dl class="mt-4 flex flex-col gap-2 text-sm"></dl>
        <button type="button" class="mt-6 cursor-pointer rounded-sm text-sm underline ${FOCUS_RING}">Close</button>
      </div>`;
    overlay.querySelector('dl').append(
      ...shortcutList().map(([keys, action]) =>
        el(
          'div',
          'flex items-baseline justify-between gap-4',
          el('dt', '', el('kbd', 'rounded-sm border border-border px-1.5 py-0.5 font-mono text-xs', keys)),
          el('dd', 'text-right text-tertiary-light', action),
        ),
      ),
    );
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeHelp();
    });
    const close = overlay.querySelector('button');
    close.addEventListener('click', closeHelp);
    document.body.append(overlay);
    close.focus();
  }

  function focusComposer() {
    const input = document.querySelector(COMPOSER);
    if (!input) return;
    input.focus();
    const range = document.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  // The sidebar's conversations, in order, from the open one, by their own
  // links, which carry Canvas's backend.
  function openNeighbour(step) {
    const conversations = sidebarConversations();
    if (!conversations.length) return;
    const index = conversations.findIndex(({ key }) => key === openConversationId());
    const next =
      conversations[index === -1 ? (step > 0 ? 0 : conversations.length - 1) : index + step]?.url;
    const basePath = new URL(canvasBase()).pathname;
    if (next) host.navigate(`/${(next.pathname + next.search).slice(basePath.length)}`);
  }

  // Alt+↑ and Alt+↓ work in the message box too, so you can move on from a
  // conversation as you write; the others type text there.
  function actionFor(event, inField) {
    if (event.ctrlKey || event.metaKey) return null;
    if (event.altKey) {
      if (event.shiftKey) return null;
      if (event.key === 'ArrowUp') return () => openNeighbour(-1);
      if (event.key === 'ArrowDown') return () => openNeighbour(1);
      if (event.code === 'KeyN' && !inField) return () => host.navigate('/conversations');
      return null;
    }
    if (inField) return null;
    if (event.key === '?') return openHelp;
    if (event.key === '/' && document.querySelector(COMPOSER)) return focusComposer;
    return null;
  }

  // Keys are heard before Canvas's own handlers, so the list, which is modal,
  // can keep them from Canvas while it's open.
  function onKeyDown(event) {
    if (help()) {
      event.stopPropagation();
      if (['Escape', '?', 'Tab'].includes(event.key)) event.preventDefault();
      if (event.key === 'Escape' || event.key === '?') closeHelp();
      else if (event.key === 'Tab') help().querySelector('button').focus();
      return;
    }
    if (!settings.keyboardShortcuts || event.defaultPrevented || event.isComposing) return;
    if (canvasDialogOpen()) return;
    const action = actionFor(event, typing(event.target));
    if (!action) return;
    event.preventDefault();
    action();
  }

  window.addEventListener('keydown', onKeyDown, true);
  showShortcuts = openHelp;
  return {
    refresh() {
      if (!settings.keyboardShortcuts) closeHelp();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown, true);
      if (showShortcuts === openHelp) showShortcuts = null;
      closeHelp();
    },
  };
}
