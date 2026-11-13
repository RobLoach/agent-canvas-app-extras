// Collapse agent activity.

import {
  CHIP_LABEL_ATTR,
  FOCUS_RING,
  removeElement,
  setProperty,
  setStyle,
  THINKING_ATTR,
  toggleAttr,
} from './dom.js';
import {
  canvasLanguage,
  canvasTranslations,
  openConversationId,
} from './canvas.js';
import { settings } from './settings.js';

const COLLAPSE_STYLE_ID = 'openhands-extras-collapse-activity';
const FOLDED_ATTR = 'data-extras-folded';
const SHOWN_ATTR = 'data-extras-shown';
const EVENT_TITLE = '[data-testid="generic-event-message-title"]';

// Canvas's titles for commands and file reads, before and after, in English
// until its translations for the page's language load.
const FOLD_LABELS = {
  ACTION_MESSAGE$RUN: 'Running <cmd>{{command}}</cmd>',
  ACTION_MESSAGE$RUN_IPYTHON: 'Running a Python command',
  ACTION_MESSAGE$READ: 'Reading <path>{{path}}</path>',
  ACTION_MESSAGE$ACP_RUN: 'Running <cmd>{{title}}</cmd>',
  ACTION_MESSAGE$ACP_READ: 'Reading <cmd>{{title}}</cmd>',
  OBSERVATION_MESSAGE$RUN: 'Ran <cmd>{{command}}</cmd>',
  OBSERVATION_MESSAGE$RUN_IPYTHON: 'Ran a Python command',
  OBSERVATION_MESSAGE$READ: 'Read <path>{{path}}</path>',
};
const THINKING_KEY = 'THINKING$TITLE';

const LIGHTBULB_PATH = 'M11.3931 1.88021C10.78 1.37593 10.062 1.01489 9.29157 0.823438C8.52113 0.631981 7.71767 0.614934 6.9398 0.773542C5.90405 0.982756 4.95379 1.49492 4.20959 2.24506C3.46538 2.9952 2.96078 3.9495 2.7598 4.98688C2.61303 5.76469 2.6397 6.56531 2.83791 7.33163C3.03611 8.09795 3.40097 8.8111 3.90647 9.42021C4.37559 9.94959 4.64449 10.6266 4.66647 11.3335V13.3335C4.66647 13.864 4.87718 14.3727 5.25225 14.7478C5.62732 15.1228 6.13603 15.3335 6.66647 15.3335H9.33313C9.86356 15.3335 10.3723 15.1228 10.7473 14.7478C11.1224 14.3727 11.3331 13.864 11.3331 13.3335V11.4602C11.3555 10.6797 11.6423 9.92983 12.1465 9.33354C13.0299 8.24073 13.4463 6.84342 13.3052 5.44529C13.1642 4.04716 12.477 2.7612 11.3931 1.86687V1.88021ZM9.9998 13.3335C9.9998 13.5104 9.92956 13.6799 9.80454 13.8049C9.67951 13.93 9.50994 14.0002 9.33313 14.0002H6.66647C6.48965 14.0002 6.32009 13.93 6.19506 13.8049C6.07004 13.6799 5.9998 13.5104 5.9998 13.3335V12.6669H9.9998V13.3335ZM11.1131 8.50688C10.4428 9.30194 10.0517 10.2949 9.9998 11.3335H8.66647V9.33354C8.66647 9.15673 8.59623 8.98716 8.4712 8.86214C8.34618 8.73711 8.17661 8.66688 7.9998 8.66688C7.82299 8.66688 7.65342 8.73711 7.52839 8.86214C7.40337 8.98716 7.33313 9.15673 7.33313 9.33354V11.3335H5.9998C5.98221 10.3123 5.60443 9.33005 4.93313 8.56021C4.49023 8.02954 4.19239 7.39316 4.06867 6.71311C3.94495 6.03306 3.99957 5.33255 4.22719 4.6799C4.45481 4.02724 4.84768 3.4447 5.36748 2.98909C5.88728 2.53348 6.51627 2.22034 7.19313 2.08021C7.77483 1.96044 8.37591 1.9717 8.95271 2.11319C9.52952 2.25467 10.0676 2.52282 10.5278 2.89818C10.9881 3.27353 11.359 3.74666 11.6136 4.28322C11.8682 4.81978 12.0001 5.4063 11.9998 6.00021C12.0047 6.91345 11.6912 7.79985 11.1131 8.50688Z';

// Canvas's chevron for its own expandable entries, turned up when expanded.
const CHEVRON_PATH =
  'M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z';

// Labels like "Führt <cmd>{{command}}</cmd> aus" as one pattern for the text
// Canvas renders from them, e.g. "Führt ls -la aus".
function labelPattern(labels) {
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sources = labels.map((label) =>
    label
      .split(/<(\w+)>\{\{\w+\}\}<\/\1>|\{\{\w+\}\}/)
      .filter((part, index) => index % 2 === 0)
      .map((part) => escape(part.replace(/<[^>]*>/g, '')))
      .join('[\\s\\S]+'),
  );
  return new RegExp(`^(?:${sources.join('|')})$`);
}

// Canvas's titles to fold, as a pattern, and its "Thinking", by language:
// English until Canvas's translations for the language arrive, when onLoad
// runs so they can be used.
const ENGLISH_FOLD_LABELS = {
  title: labelPattern(Object.values(FOLD_LABELS)),
  thinking: 'Thinking',
};
const foldLabelsByLanguage = new Map();

function foldLabels(language, onLoad) {
  if (!foldLabelsByLanguage.has(language)) {
    foldLabelsByLanguage.set(language, ENGLISH_FOLD_LABELS);
    if (language !== 'en') {
      canvasTranslations(language).then((translated) => {
        foldLabelsByLanguage.set(language, {
          title: labelPattern(
            Object.entries(FOLD_LABELS).map(
              ([key, label]) => translated[key] ?? label,
            ),
          ),
          thinking: translated[THINKING_KEY] ?? ENGLISH_FOLD_LABELS.thinking,
        });
        onLoad();
      });
    }
  }
  return foldLabelsByLanguage.get(language);
}

// Canvas's own "Thinking" entry, with its chevron and lightbulb, as a toggle
// for the entries it folds, with Canvas's focus ring for keyboard use.
function buildThinking(onToggle) {
  const row = document.createElement('div');
  row.className = 'my-1 w-full py-1 text-sm';
  row.setAttribute(THINKING_ATTR, '');
  row.innerHTML = `
    <button type="button" aria-expanded="false" class="w-full flex items-center gap-2 text-left cursor-pointer rounded-sm ${FOCUS_RING}">
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="h-4 w-4 fill-muted flex-shrink-0"><path d="${CHEVRON_PATH}"/></svg>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted flex-shrink-0"><path fill="currentColor" d="${LIGHTBULB_PATH}"/></svg>
      <span class="font-normal text-muted motion-reduce:animate-none"></span>
    </button>`;
  row.querySelector('button').addEventListener('click', (event) => {
    const button = event.currentTarget;
    button.setAttribute('aria-expanded', String(!expanded(row)));
    onToggle();
  });
  return row;
}

const expanded = (thinking) =>
  thinking.firstElementChild.getAttribute('aria-expanded') === 'true';

// Mark the "Running" and "Reading" entries, which a style hides, rather than
// removing nodes React owns, and fold each stretch of them into a "Thinking"
// toggle placed inside the stretch's last chat item, so the chat list's own
// children stay as React rendered them. An entry can share its item with the
// agent's message, so a whole item is only hidden once nothing in it is left
// to show. Timed out commands, the only failures Canvas marks, stay visible.
// The last stretch pulses while the open conversation is running. The body
// observer only watches child lists, so marking doesn't re-trigger it.
export function watchCollapseActivity(statusOf) {
  let active = false;
  let disposed = false;
  // Canvas's titles to fold and its "Thinking", in its current language.
  let labels = ENGLISH_FOLD_LABELS;
  // Each stretch's toggle, by the stretch's first chat item.
  let toggles = new WeakMap();
  // Whether the last stretch pulses, for the open conversation running.
  let pulsing = false;
  // The chat and activity chip, found again only once Canvas replaces them,
  // and whether each row is one to fold, by row: a row's title doesn't
  // change once Canvas renders it.
  let chat = null;
  let chip = null;
  let foldRows = new WeakMap();
  // Each chat item as last read, read again only once it changes, so a
  // streaming run doesn't rescan the whole chat on every update.
  let readItems = new WeakMap();
  // What was hidden, and whether shown, and the toggles placed, last time, so
  // only what changes is written.
  let lastHidden = new Map();
  let placedToggles = new Set();
  // Each toggle's look as last drawn.
  const toggleStates = new WeakMap();
  const find = (current, selector) =>
    current?.isConnected ? current : document.querySelector(selector);
  const running = () => {
    const id = openConversationId();
    return !!id && statusOf(id) === 'running';
  };

  function reveal() {
    for (const element of document.querySelectorAll(
      `[${FOLDED_ATTR}], [${SHOWN_ATTR}]`,
    )) {
      element.removeAttribute(FOLDED_ATTR);
      element.removeAttribute(SHOWN_ATTR);
    }
    for (const ours of document.querySelectorAll(
      `[${THINKING_ATTR}], [${CHIP_LABEL_ATTR}]`,
    )) {
      ours.remove();
    }
    removeElement(COLLAPSE_STYLE_ID);
    toggles = new WeakMap();
    foldRows = new WeakMap();
    lastHidden = new Map();
    placedToggles = new Set();
    readItems = new WeakMap();
  }

  // Each chat item's event rows, the foldable ones among them, and whether
  // they're all it shows.
  function readItem(item) {
    const rows = [];
    const foldable = [];
    for (const title of item.querySelectorAll(EVENT_TITLE)) {
      // Only a row inside the item: were Canvas to drop a wrapper, this would
      // otherwise hide the item, or the whole chat.
      const row = title.parentElement?.parentElement;
      if (!row || row === item || !item.contains(row)) continue;
      rows.push(row);
      let known = foldRows.get(row);
      if (known?.labels !== labels) {
        known = { labels, foldable: labels.title.test(title.textContent.trim()) };
        foldRows.set(row, known);
      }
      if (known.foldable && !row.querySelector('[data-testid="status-icon"]')) {
        foldable.push(row);
      }
    }
    const children = [...item.children].filter(
      (child) => !child.hasAttribute(THINKING_ATTR),
    );
    const whole =
      children.length > 0 && children.every((child) => foldable.includes(child));
    return { item, rows, foldable, whole, labels };
  }

  function itemEntry(item) {
    let entry = readItems.get(item);
    if (entry?.labels !== labels) {
      entry = readItem(item);
      readItems.set(item, entry);
    }
    return entry;
  }

  // Forget the chat items that changed, as the body observer reported them,
  // and say whether anything in the chat did.
  function forgetChanged(records) {
    if (!chat?.isConnected) return true;
    let changed = false;
    for (const { target } of records) {
      if (target !== chat && !chat.contains(target)) continue;
      changed = true;
      let node = target;
      while (node && node.parentElement !== chat) node = node.parentElement;
      if (node) readItems.delete(node);
    }
    return changed;
  }

  // Runs of items with foldable rows: a stretch starts at any item with some,
  // and carries on through items with nothing else.
  function stretches(items) {
    const found = [];
    let current = null;
    for (const entry of items) {
      if (!entry.foldable.length || !entry.whole) {
        if (current) found.push(current);
        current = entry.foldable.length ? [entry] : null;
      } else {
        (current ??= []).push(entry);
      }
    }
    if (current) found.push(current);
    return found;
  }

  // The live activity chip above the message box says "Running …" too: show
  // "Thinking" in a label of ours beside Canvas's, which React keeps updating.
  function relabelChip() {
    chip = find(chip, '[data-testid="live-activity-chip"]');
    if (!chip) return;
    let ours = chip.querySelector(`:scope > [${CHIP_LABEL_ATTR}]`);
    const label = [...chip.children].findLast((child) => child !== ours);
    const foldable = !!label && labels.title.test(label.textContent.trim());
    if (label) toggleAttr(label, FOLDED_ATTR, foldable);
    if (!foldable) {
      ours?.remove();
      return;
    }
    if (!ours) {
      ours = document.createElement('span');
      ours.className = label.className;
      ours.setAttribute(CHIP_LABEL_ATTR, '');
    }
    setProperty(ours, 'textContent', labels.thinking);
    if (label.nextElementSibling !== ours) label.after(ours);
  }

  // Changes outside the chat only touch the chip, unless the chat itself is
  // replaced; everything else reads the chat again.
  function apply(chatChanged = true) {
    if (disposed) return;
    if (!settings.collapseActivity) {
      if (active) reveal();
      active = false;
      return;
    }
    active = true;
    labels = foldLabels(canvasLanguage(), apply);
    setStyle(
      COLLAPSE_STYLE_ID,
      `[${FOLDED_ATTR}]:not([${SHOWN_ATTR}]) { display: none !important; }`,
    );
    // The chat and its activity chip are only on a conversation's page.
    if (!openConversationId()) return;
    relabelChip();
    const previous = chat;
    chat = find(chat, '[data-testid="chat-scroll-container"]');
    if (!chat || (!chatChanged && chat === previous)) return;
    const items = [...chat.children].map(itemEntry);
    pulsing = running();
    // Hide whole items, except the last of each stretch, which holds the
    // toggle and hides just its rows.
    const hidden = new Map();
    const used = new Set();
    for (const stretch of stretches(items)) {
      const last = stretch.at(-1);
      let thinking = toggles.get(stretch[0].item);
      if (!thinking) {
        thinking = buildThinking(apply);
        toggles.set(stretch[0].item, thinking);
      }
      used.add(thinking);
      const open = expanded(thinking);
      for (const entry of stretch) {
        const nodes = entry.whole && entry !== last ? [entry.item] : entry.foldable;
        for (const node of nodes) hidden.set(node, open);
      }
      // Canvas's own pulse, which the label stops for people who ask for less
      // motion.
      const pulse = pulsing && last === items.at(-1);
      const state = `${open}|${pulse}|${labels.thinking}`;
      if (toggleStates.get(thinking) !== state) {
        toggleStates.set(thinking, state);
        thinking.querySelector('svg').classList.toggle('rotate-180', open);
        const label = thinking.querySelector('span');
        setProperty(label, 'textContent', labels.thinking);
        label.classList.toggle('animate-pulse', pulse);
      }
      if (last.item.lastElementChild !== thinking) last.item.append(thinking);
    }
    for (const node of lastHidden.keys()) {
      if (hidden.has(node)) continue;
      node.removeAttribute(FOLDED_ATTR);
      node.removeAttribute(SHOWN_ATTR);
    }
    for (const [node, open] of hidden) {
      if (lastHidden.get(node) === open) continue;
      toggleAttr(node, FOLDED_ATTR, true);
      toggleAttr(node, SHOWN_ATTR, open);
    }
    lastHidden = hidden;
    for (const thinking of placedToggles) {
      if (!used.has(thinking)) thinking.remove();
    }
    placedToggles = used;
  }

  return {
    onDomChange(records) {
      apply(records ? forgetChanged(records) : true);
    },
    refresh: () => apply(),
    // Statuses are checked every few seconds; only the open conversation
    // starting or stopping changes anything here.
    onStatus() {
      if (active && running() !== pulsing) apply();
    },
    dispose() {
      disposed = true;
      reveal();
      active = false;
    },
  };
}
