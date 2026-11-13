// Unread markers.

import { UNREAD_ATTR } from './dom.js';
import { away, openConversationId, sidebarConversations } from './canvas.js';
import { READ_KEY, readJson, writeJson } from './storage.js';
import { settings } from './settings.js';
import { checkMs } from './checks.js';

// How many conversations' read times are kept.
const READ_LIMIT = 500;

// Which conversations you've read, kept in localStorage so every Canvas
// window shares it: since, the newest update when the markers were switched
// on, by the server's clock, and seen, each conversation's update time when
// you last had it open. Anything updated after both is unread.
const readState = {
  load() {
    const state = readJson(READ_KEY, null);
    return typeof state?.since === 'number' && state.seen ? state : null;
  },
  // Only the conversations you opened most recently are kept.
  save(state) {
    const seen = Object.entries(state.seen);
    if (seen.length > READ_LIMIT) {
      state.seen = Object.fromEntries(
        seen.sort(([, a], [, b]) => b - a).slice(0, READ_LIMIT),
      );
    }
    writeJson(READ_KEY, state);
  },
  clear: () => writeJson(READ_KEY, null),
};

// Mark the conversations in the sidebar that changed since you last had them
// open, with a dot after their title. Their update times come from the Agent
// Server, checked as the page changes and at each check, except while
// the tab is hidden, when nobody sees the sidebar: it's checked on return.
// Each conversation's record from the Agent Server holds every LLM call's
// cost and tokens, so all of the sidebar's are asked for at most this often,
// and in between only the ones not known yet.
const UNREAD_ALL_MS = 60000;
const CARD = '[data-testid="conversation-card"]';
// Whether a change the body observer reported was to the sidebar's cards.
const touchesCards = (records) =>
  records.some(
    ({ target, addedNodes }) =>
      !!target.closest?.(CARD) ||
      [...addedNodes].some(
        (node) => node.nodeType === Node.ELEMENT_NODE && (node.matches(CARD) || node.querySelector(CARD)),
      ),
  );

export function watchUnread(loadConversations, checks) {
  // Each sidebar conversation's last update, by key, in ms, and when they
  // were all last asked for.
  const updated = new Map();
  let allAt = -Infinity;
  // The conversation open when the markers were last drawn.
  let drawnOpen;
  // What you've read, as stored, loaded again when another window changes it.
  let state = null;
  let active = false;
  let disposed = false;

  // The open conversation is read while you're looking at it.
  const openKey = () => (away() ? null : openConversationId());

  function render() {
    const open = openKey();
    drawnOpen = open;
    if (state && open && updated.has(open) && !(state.seen[open] >= updated.get(open))) {
      state.seen[open] = updated.get(open);
      readState.save(state);
    }
    for (const { card, key } of sidebarConversations()) {
      const at = updated.get(key);
      const unread =
        !!state &&
        key !== open &&
        at > Math.max(state.since, state.seen[key] ?? 0);
      let dot = card.querySelector(`[${UNREAD_ATTR}]`);
      if (!unread) {
        dot?.remove();
        continue;
      }
      const title = card.querySelector('[data-testid="conversation-card-title"]');
      if (!title) continue;
      if (!dot) {
        dot = document.createElement('span');
        dot.setAttribute(UNREAD_ATTR, '');
        dot.className = 'mr-1 size-1.5 shrink-0 rounded-full bg-contrast';
        dot.innerHTML = '<span class="sr-only">Unread</span>';
      }
      if (title.nextElementSibling !== dot) title.after(dot);
    }
  }

  async function check() {
    if (!active || document.hidden) return;
    let keys = [...new Set(sidebarConversations().map(({ key }) => key))];
    if (Date.now() - allAt >= Math.max(UNREAD_ALL_MS, checkMs())) {
      allAt = Date.now();
    } else {
      keys = keys.filter((key) => !updated.has(key));
    }
    if (keys.length) {
      try {
        const infos = await loadConversations(keys);
        infos.forEach((info, index) => {
          const at = Date.parse(info?.updated_at);
          if (!Number.isNaN(at)) updated.set(keys[index], at);
        });
      } catch {
        // Keep the last known times; the next check retries.
      }
      if (!active) return;
      // The first check after switching on counts everything so far as read.
      state ??= readState.load();
      if (!state && updated.size) {
        state = { since: Math.max(...updated.values()), seen: {} };
        readState.save(state);
      }
      render();
    }
  }

  // Coming back to the tab asks for every conversation again.
  function onVisibility() {
    render();
    if (!active || document.hidden) return;
    allAt = -Infinity;
    checks.now();
  }

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', render);

  return {
    check,
    polling: () => active && !document.hidden,
    refresh() {
      const on = settings.unreadMarkers && !disposed;
      if (on === active) return;
      active = on;
      if (on) {
        state = readState.load();
        allAt = -Infinity;
        checks.now();
        return;
      }
      readState.clear();
      state = null;
      render();
    },
    // Streaming in the chat doesn't change the sidebar, so only changes to
    // its cards, or opening another conversation, redraw the markers.
    onDomChange(records) {
      if (!active) return;
      if (records && !touchesCards(records) && openKey() === drawnOpen) return;
      render();
      checks.request();
    },
    // Another window opened a conversation.
    onStorage(key) {
      if (key !== READ_KEY || !active) return;
      state = readState.load();
      render();
    },
    dispose() {
      disposed = true;
      active = false;
      state = null;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', render);
      render();
    },
  };
}
