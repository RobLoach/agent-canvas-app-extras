// Tab status: the agent's status in the tab's title and icon and the app's
// badge, and the runs that notifications follow.

import { setAttribute } from './dom.js';
import {
  away,
  conversationKey,
  openConversationId,
  setTitle,
} from './canvas.js';
import { readJson, UNSEEN_KEY, VIEWING_KEY, writeJson } from './storage.js';
import { settings, SWITCHES } from './settings.js';
import { playChime } from './audio.js';
import {
  ACTIVE_STATUSES,
  CANVAS_TITLE_STATUS,
  ENDED_STATUSES,
  NOTIFY_STATUSES,
  STATUS_BADGES,
} from './statuses.js';
import { notify } from './notifications.js';
import { CHECK_MS } from './checks.js';

const WAITING_COUNT_PATH =
  '/api/conversations/count?status=waiting_for_confirmation';

async function loadDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// A coloured dot on the tab icon, holding a count when there is one. It swaps
// the href of Canvas's own icon links: browsers don't reliably switch to an
// extra icon link, and React owns these elements, so they must not be
// removed. Their original hrefs come back when it clears; the dot's own carry
// a mark to tell them apart.
const FAVICON_MARK = 'openhands-extras-badge';

function faviconBadge() {
  const originalHrefs = new WeakMap();
  let href = null;
  let shown = null;
  // Canvas's icon as a data URL, for the icon URL it was loaded from.
  let source = null;
  let sourceUrl;
  const links = () => document.head.querySelectorAll('link[rel~="icon"]');

  function originalUrl() {
    const link = links()[0];
    const original = link && (originalHrefs.get(link) ?? link.getAttribute('href'));
    return original ? new URL(original, document.baseURI).href : undefined;
  }

  // Also re-run when Canvas adds an icon link or React rewrites its href.
  function apply() {
    for (const link of links()) {
      const current = link.getAttribute('href');
      if (!current?.includes(FAVICON_MARK)) originalHrefs.set(link, current);
      const next = href ?? originalHrefs.get(link);
      if (next) setAttribute(link, 'href', next);
    }
  }

  async function show(color, count) {
    const key = color && `${color}|${count}`;
    if (key === shown) return;
    shown = key;
    if (!key) {
      href = null;
      apply();
      return;
    }
    const url = originalUrl();
    if (url !== sourceUrl) {
      sourceUrl = url;
      source = loadDataUrl(url);
    }
    const image = await source;
    // Try again next time rather than keep a failed load.
    if (!image) sourceUrl = undefined;
    if (shown !== key) return;
    const background = image
      ? `<image href="${image}" width="32" height="32"/>`
      : '';
    const dot = count
      ? `<circle cx="22" cy="22" r="10" fill="${color}" stroke="#fff" stroke-width="2"/><text x="22" y="22" fill="#fff" font-family="sans-serif" font-size="${count > 9 ? 11 : 14}" font-weight="700" text-anchor="middle" dominant-baseline="central">${count > 9 ? '9+' : count}</text>`
      : `<circle cx="24" cy="24" r="7" fill="${color}" stroke="#fff" stroke-width="2"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" id="${FAVICON_MARK}" viewBox="0 0 32 32">${background}${dot}</svg>`;
    href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    apply();
  }

  return { show, apply, originalUrl };
}

// The tab's title, with a status prefix in place of Canvas's own status
// emoji. It works from Canvas's title, which is the current one unless it's
// still the one set here, and puts that back when there's nothing to show.
function tabTitle() {
  let applied = null;
  // prefixFor(title) gives the prefix for the conversation's title, '' for
  // none, or null to keep Canvas's; without it, Canvas's title stays as is.
  return function render(prefixFor) {
    const current = document.title;
    const base = current === applied?.title ? applied.base : current;
    let next = base;
    if (prefixFor) {
      const canvasStatus = base.match(CANVAS_TITLE_STATUS)?.[0] ?? '';
      const rest = base.slice(canvasStatus.length);
      // Canvas's emoji is dropped too when the title itself starts with it.
      const prefix =
        prefixFor(rest) ??
        (rest.startsWith(canvasStatus.trim()) ? '' : canvasStatus);
      next = prefix + rest;
    }
    applied = next === base ? null : { title: next, base };
    if (current !== next) setTitle(next);
  };
}

// Runs that ended while you were away, until you open them: kept in
// localStorage, so they're shared by every Canvas window and survive reloads.
const unseenRuns = {
  load() {
    const ids = readJson(UNSEEN_KEY, []);
    return new Set(
      Array.isArray(ids) ? ids.filter((id) => typeof id === 'string').map(conversationKey) : [],
    );
  },
  mark(id, unseen) {
    const ids = unseenRuns.load();
    if (ids.has(id) === unseen) return;
    if (unseen) ids.add(id);
    else ids.delete(id);
    writeJson(UNSEEN_KEY, ids.size ? [...ids] : null);
  },
  clear: () => writeJson(UNSEEN_KEY, null),
};

// Follow the open conversation's status, and runs this tab saw that you've
// since navigated away from, to badge the tab and app icon and to notify when
// a run ends or needs you while you're away from it. Canvas re-renders the
// chat as events stream in, background tabs included, so DOM changes trigger
// checks; onRender runs after every change in what's known.
export function watchAgentStatus(host, loadConversations, checks, onRender) {
  const conversations = new Map();
  const favicon = faviconBadge();
  const title = tabTitle();
  // The installed app's badge, as last set.
  let appBadge = null;
  let openId = null;
  // Conversations waiting for confirmation anywhere, from the Agent Server,
  // and when that was last fetched.
  let waiting = 0;
  let countedAt = -Infinity;
  let disposed = false;
  // The settings that need statuses, as last applied.
  let statusSettings;

  const watching = () =>
    SWITCHES.some((item) => item.status && settings[item.key]);
  // The count of conversations that need your input feeds the app icon badge
  // and the tab icon: those waiting for confirmation, plus unseen runs.
  const counting = () =>
    SWITCHES.some((item) => item.status === 'count' && settings[item.key]);
  const needsYou = () =>
    !disposed && counting() ? waiting + unseenRuns.load().size : 0;

  function badge() {
    const open = settings.tabStatus && conversations.get(openId);
    const current = open && STATUS_BADGES[open.status];
    return current && (ACTIVE_STATUSES.has(open.status) || open.sawActive)
      ? current
      : null;
  }

  // The open conversation's badge, plus how many runs you opened in this tab
  // are still going elsewhere, running or waiting for your confirmation,
  // counting the open one with them: "⏳3", "⏳1 ✋1" or "✅ ⏳2". A lone badge
  // is skipped when the title already starts with the same emoji, and there's
  // none without either.
  function titlePrefix(rest) {
    const emoji = badge()?.emoji;
    const elsewhere = (status) =>
      [...conversations].filter(([id, entry]) => id !== openId && entry.status === status)
        .length;
    const counts = ['running', 'waiting_for_confirmation'].map((status) => {
      const own = STATUS_BADGES[status].emoji;
      return [own, elsewhere(status) + (emoji === own ? 1 : 0)];
    });
    if (counts.every(([own, count]) => count <= (emoji === own ? 1 : 0))) {
      if (!emoji) return null;
      return rest.startsWith(emoji) ? '' : `${emoji} `;
    }
    const parts = counts.filter(([, count]) => count).map(([own, count]) => `${own}${count}`);
    if (emoji && !counts.some(([own]) => own === emoji)) parts.unshift(emoji);
    return `${parts.join(' ')} `;
  }

  const renderTitle = () =>
    title(settings.tabStatus && !disposed ? titlePrefix : null);

  function render() {
    renderTitle();
    // The tab icon's dot takes the open conversation's colour, and holds the
    // number of conversations that need your input when there are any.
    const count = needsYou();
    const tabCount = settings.tabStatus ? count : 0;
    favicon.show(
      badge()?.color ??
        (tabCount ? STATUS_BADGES.waiting_for_confirmation.color : null),
      tabCount,
    );
    if (count !== appBadge) {
      appBadge = count;
      const { navigator } = window;
      const call = count ? navigator.setAppBadge?.(count) : navigator.clearAppBadge?.();
      call?.catch(() => {});
    }
    if (!disposed) onRender();
  }

  const fetchCount = () => {
    countedAt = Date.now();
    return host.agentServer
      .request({ path: WAITING_COUNT_PATH })
      .then((count) => Number(count) || 0)
      .catch(() => waiting);
  };

  // Whether the run started or stopped waiting for your confirmation.
  function update(id, info) {
    const entry = conversations.get(id);
    if (!entry) return false;
    const previous = entry.status;
    const next = info.execution_status;
    const WAITING = 'waiting_for_confirmation';
    const waitingChanged = (previous === WAITING) !== (next === WAITING);
    entry.status = next;
    entry.title = info.title || entry.title;
    if (ACTIVE_STATUSES.has(next)) entry.sawActive = true;
    if (!ENDED_STATUSES.has(next)) unseenRuns.mark(id, false);
    const changedWhileAway =
      previous &&
      previous !== next &&
      entry.sawActive &&
      (id !== openId || away()) &&
      readJson(VIEWING_KEY, null) !== id;
    if (!changedWhileAway) return waitingChanged;
    if (counting() && ENDED_STATUSES.has(next)) unseenRuns.mark(id, true);
    if (settings.notifications && NOTIFY_STATUSES.has(next)) {
      notify(host, {
        id,
        title: entry.title,
        status: next,
        icon: favicon.originalUrl(),
        isOpen: () => id === openId,
        isDisposed: () => disposed,
      }).catch(() => {});
    }
    if (settings.confirmationSound && next === WAITING) {
      chime(id).catch(() => {});
    }
    return waitingChanged;
  }

  // Canvas plays its own sound for the open conversation when its sound
  // notifications are on, so the chime is left to it there.
  async function chime(id) {
    if (id === openId) {
      const canvas = await host.agentServer.request({ path: '/api/settings' });
      const sound =
        canvas?.enable_sound_notifications ??
        canvas?.misc_settings?.app_preferences?.enable_sound_notifications;
      if (sound || disposed) return;
    }
    playChime();
  }

  async function check() {
    if (disposed) return;
    const nextOpenId = watching() ? openConversationId() : null;
    if (nextOpenId !== openId) {
      openId = nextOpenId;
      if (openId && !conversations.has(openId)) {
        conversations.set(openId, { status: null, title: '', sawActive: false });
      }
      render();
    }
    shareViewing();
    if (openId && !away()) unseenRuns.mark(openId, false);
    for (const [id, entry] of conversations) {
      const followRun = watching() && ACTIVE_STATUSES.has(entry.status);
      if (id !== openId && !followRun) conversations.delete(id);
    }
    // Unseen runs are checked too, to drop ones resumed or deleted elsewhere.
    const unseen = counting()
      ? [...unseenRuns.load()].filter((id) => !conversations.has(id))
      : [];
    const ids = [...conversations.keys(), ...unseen];
    if (ids.length || counting()) {
      try {
        const countDue = counting() && Date.now() - countedAt >= CHECK_MS;
        const [infos, count] = await Promise.all([
          ids.length ? loadConversations(ids) : [],
          countDue ? fetchCount() : counting() ? waiting : 0,
        ]);
        if (!disposed) {
          waiting = count;
          let waitingChanged = false;
          ids.forEach((id, index) => {
            const info = infos[index];
            if (conversations.has(id)) {
              if (info && update(id, info)) waitingChanged = true;
            } else if (!ENDED_STATUSES.has(info?.execution_status)) {
              unseenRuns.mark(id, false);
            }
          });
          if (waitingChanged && counting() && !countDue) {
            waiting = await fetchCount();
          }
        }
      } catch {
        // Keep the last known statuses; the next check retries.
      }
      if (disposed) return;
      render();
    }
  }

  // Poll while a run is going: runs you navigated away from don't re-render
  // this page, and a run's last event can land between checks. Poll while
  // counting too, for runs started elsewhere. Otherwise, page changes and
  // coming back to the tab trigger checks.
  const polling = () =>
    counting() || [...conversations.values()].some((entry) => ACTIVE_STATUSES.has(entry.status));

  // The conversation this window shows while it has focus, shared so other
  // windows following it don't notify you about it.
  let shared = null;
  function shareViewing() {
    const id = !disposed && watching() && !away() ? openId : null;
    if (id === shared) return;
    if (id || readJson(VIEWING_KEY, null) === shared) writeJson(VIEWING_KEY, id);
    shared = id;
  }

  // Coming back to the tab or window clears the finished/error/paused badges.
  function onReturn() {
    shareViewing();
    if (away() || !watching()) return;
    const open = conversations.get(openId);
    if (open && !ACTIVE_STATUSES.has(open.status)) open.sawActive = false;
    if (openId) unseenRuns.mark(openId, false);
    countedAt = -Infinity;
    render();
    checks.request();
  }

  // Canvas rewrites the title on navigation, and may add icon links or reset
  // their href; re-apply the badge to both.
  const headObserver = new MutationObserver(() => {
    favicon.apply();
    renderTitle();
  });
  headObserver.observe(document.head, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });
  document.addEventListener('visibilitychange', onReturn);
  window.addEventListener('focus', onReturn);
  window.addEventListener('blur', shareViewing);

  return {
    check,
    polling,
    statusOf: (id) => conversations.get(id)?.status ?? null,
    onDomChange() {
      if (watching()) checks.request();
    },
    // Another window marked or cleared a run: the open one can't be unseen
    // while you're looking at it.
    onStorage(key) {
      if (key !== UNSEEN_KEY) return;
      if (openId && !away()) unseenRuns.mark(openId, false);
      render();
    },
    // Check at once when a setting that needs statuses changes, which
    // includes activate() applying the first ones.
    refresh() {
      if (!counting()) unseenRuns.clear();
      render();
      const next = SWITCHES.filter((item) => item.status)
        .map((item) => settings[item.key])
        .join();
      if (next === statusSettings) return;
      statusSettings = next;
      countedAt = -Infinity;
      checks.now();
    },
    dispose() {
      disposed = true;
      headObserver.disconnect();
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('blur', shareViewing);
      shareViewing();
      openId = null;
      conversations.clear();
      render();
    },
  };
}
