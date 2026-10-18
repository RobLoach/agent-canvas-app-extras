// Extras: Agent Canvas tweaks, each switched on from this app's card on
// Customize > Apps and saved in the browser's localStorage.
// - Wide Canvas: removes the chat window's maximum width.
// - Tab status: badges the tab's title and icon with the agent's status.
// - Desktop notifications: tells you when a run ends or needs you while
//   you're away from it.

const STORAGE_KEY = 'openhands-extras:settings';
const STYLE_ID = 'openhands-extras-wide-canvas';
const SECTION_ID = 'openhands-extras-settings';
const DEFAULT_SETTINGS = {
  wideCanvas: false,
  tabStatus: false,
  notifications: false,
};

// The chat thread is the only max-w-200 element that is also h-full, so the
// Customize, Settings and home launcher columns keep their width. Unlayered
// CSS beats Tailwind's @layer utilities regardless of specificity.
const WIDE_CANVAS_CSS =
  '[data-agent-server-ui] .max-w-200.h-full.min-h-0 { max-width: none; }';

// Status checks run at most this often, plus a slow poll while a run is going.
const STATUS_MIN_GAP_MS = 3000;
const STATUS_POLL_MS = 15000;
const CONVERSATION_PATH = /\/conversations\/([0-9a-f-]{32,36})(?:\/|$)/i;
const STATUS_BADGES = {
  running: { emoji: '⏳', color: '#3b82f6', label: 'Running' },
  waiting_for_confirmation: {
    emoji: '✋',
    color: '#f59e0b',
    label: 'Needs your confirmation',
  },
  paused: { emoji: '⏸', color: '#9ca3af', label: 'Paused' },
  finished: { emoji: '✅', color: '#22c55e', label: 'Finished' },
  error: { emoji: '❌', color: '#ef4444', label: 'Stopped with an error' },
  stuck: { emoji: '❌', color: '#ef4444', label: 'Got stuck' },
};
// Active badges show whenever the status holds; the rest only after this tab
// saw the run, until you come back to the tab.
const ACTIVE_STATUSES = new Set(['running', 'waiting_for_confirmation']);
const NOTIFY_STATUSES = new Set([
  'waiting_for_confirmation',
  'finished',
  'error',
  'stuck',
]);

const SWITCHES = [
  {
    key: 'wideCanvas',
    label: 'Wide Canvas',
    description: 'Let the chat window use the full width of the canvas.',
  },
  {
    key: 'tabStatus',
    label: 'Tab status',
    description: "Show the agent's status in the browser tab's title and icon.",
  },
  {
    key: 'notifications',
    label: 'Desktop notifications',
    description:
      'Notify you when the agent finishes or needs you while this tab is in the background.',
    enable: requestNotificationPermission,
    problem: notificationProblem,
  },
];

// Class strings mirror Canvas's ToggleSwitchVisual (src/ui/toggle-switch.tsx)
// so the switch picks up the same compiled Tailwind styles.
const TRACK_CLASS =
  'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out motion-reduce:transition-none h-5.5 w-10 border';
const TRACK_ON_CLASS = 'border-contrast bg-contrast';
const TRACK_OFF_CLASS = 'border-border bg-surface-raised';
const THUMB_CLASS =
  'inline-block rounded-full transition-transform duration-200 ease-in-out motion-reduce:transition-none size-4';
const THUMB_ON_CLASS = 'translate-x-5.25 rtl:-translate-x-5.25 bg-base-secondary';
const THUMB_OFF_CLASS = 'translate-x-0.5 rtl:-translate-x-0.5 bg-muted';

let settings = DEFAULT_SETTINGS;

function loadSettings() {
  try {
    settings = {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'),
    };
  } catch {
    settings = DEFAULT_SETTINGS;
  }
}

function saveSettings(next) {
  settings = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function applyWideCanvas(enabled) {
  let style = document.getElementById(STYLE_ID);
  if (enabled && !style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = WIDE_CANVAS_CSS;
    document.head.append(style);
  } else if (!enabled && style) {
    style.remove();
  }
}

const PERMISSION_PROBLEMS = {
  denied: 'Notifications are blocked for this site in your browser settings.',
  default: "Your browser hasn't allowed notifications yet.",
};

// Why notifications can't show even though the switch is on, e.g. after the
// permission was revoked in the browser's site settings.
function notificationProblem() {
  if (!window.Notification || !window.isSecureContext) {
    return 'Your browser only allows notifications over HTTPS or on localhost.';
  }
  return PERMISSION_PROBLEMS[Notification.permission] ?? null;
}

async function requestNotificationPermission() {
  await window.Notification?.requestPermission();
  return notificationProblem();
}

function buildSwitch(item, onChange) {
  const block = document.createElement('div');
  block.className = 'flex min-w-0 flex-col gap-1';
  block.innerHTML = `
    <label class="flex items-center gap-2 rounded-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus w-fit cursor-pointer">
      <input class="sr-only" type="checkbox" data-testid="extras-${item.key}-switch" aria-describedby="extras-${item.key}-hint" />
      <span aria-hidden="true"><span></span></span>
      <div class="flex items-center gap-1">
        <span class="text-sm"></span>
      </div>
    </label>
    <p id="extras-${item.key}-hint" class="text-xs leading-relaxed text-tertiary-light"></p>`;

  const input = block.querySelector('input');
  const track = input.nextElementSibling;
  const hint = block.querySelector('p');
  block.querySelector('.text-sm').textContent = item.label;
  const render = () => {
    track.className = `${TRACK_CLASS} ${input.checked ? TRACK_ON_CLASS : TRACK_OFF_CLASS}`;
    track.firstElementChild.className = `${THUMB_CLASS} ${input.checked ? THUMB_ON_CLASS : THUMB_OFF_CLASS}`;
  };
  input.checked = settings[item.key];
  hint.textContent = (input.checked && item.problem?.()) || item.description;
  render();
  input.addEventListener('change', async () => {
    const problem = input.checked && item.enable ? await item.enable() : null;
    if (problem) input.checked = false;
    hint.textContent = problem ?? item.description;
    render();
    onChange({ ...settings, [item.key]: input.checked });
  });
  return block;
}

function buildSection(onChange) {
  const section = document.createElement('section');
  section.id = SECTION_ID;
  section.className = 'flex min-w-0 flex-col gap-4 border-t border-border pt-3';
  section.append(...SWITCHES.map((item) => buildSwitch(item, onChange)));
  return section;
}

// App cards on Customize > Apps have no host API for settings, so add a
// section above this app's card footer. React may insert its own nodes
// before the footer later, so re-place the section whenever it's displaced.
function placeSection(cardSelector, onChange) {
  // Skip the DOM search everywhere but Customize > Apps (e.g. while chatting).
  if (!/\/apps\/?$/.test(location.pathname)) return;
  const footer = document.querySelector(`${cardSelector} > footer`);
  if (!footer || footer.previousElementSibling?.id === SECTION_ID) return;
  document.getElementById(SECTION_ID)?.remove();
  footer.before(buildSection(onChange));
}

function watchAppCard(name, onChange) {
  const cardSelector = `article[data-testid="canvas-extension-card-${name}"]`;
  const place = () => placeSection(cardSelector, onChange);
  place();
  return {
    onDomChange: place,
    dispose: () => document.getElementById(SECTION_ID)?.remove(),
  };
}

// Edit the <title>'s text node in place: replacing it (document.title = …)
// would detach the node React updates and freeze Canvas's own titles.
function setTitle(text) {
  const element = document.head.querySelector('title');
  const node = element?.firstChild;
  if (node && node === element.lastChild && node.nodeType === Node.TEXT_NODE) {
    node.nodeValue = text;
  }
}

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

// Badge the tab's title and favicon with the open conversation's status, and
// notify when a run ends while you're away from it. Canvas re-renders the
// chat as events stream in, background tabs included, so DOM changes trigger
// checks.
function watchAgentStatus(host) {
  // The open conversation, plus runs this tab saw that you've since navigated
  // away from, which are followed until they end so they can still notify.
  const conversations = new Map();
  let openId = null;
  let appliedPrefix = '';
  let lastCheck = 0;
  let trailing = 0;
  let poll = 0;
  let inFlight = false;
  let again = false;
  let disposed = false;

  // The badge swaps the href of Canvas's own icon links: browsers don't
  // reliably switch to an extra icon link, and React owns these elements, so
  // they must not be removed. Their original hrefs come back when it clears.
  const originalHrefs = new WeakMap();
  const badgedHrefs = new Set();
  let iconHref = null;
  let iconColor = null;
  let iconSource;
  const iconLinks = () => document.head.querySelectorAll('link[rel~="icon"]');
  const originalIconUrl = () => {
    const link = iconLinks()[0];
    const href = link && (originalHrefs.get(link) ?? link.getAttribute('href'));
    return href ? new URL(href, document.baseURI).href : undefined;
  };

  // A browser window behind another app often still counts as visible.
  const away = () => document.hidden || !document.hasFocus();
  const watching = () => settings.tabStatus || settings.notifications;

  function badge() {
    const open = settings.tabStatus && conversations.get(openId);
    const current = open && STATUS_BADGES[open.status];
    return current && (ACTIVE_STATUSES.has(open.status) || open.sawActive)
      ? current
      : null;
  }

  // Only strip the prefix we added, so a title of Canvas's own that starts
  // with one of the badge emoji stays intact. Skip the prefix when the title
  // already starts with the same emoji.
  function renderTitle() {
    const current = document.title;
    const base =
      appliedPrefix && current.startsWith(appliedPrefix)
        ? current.slice(appliedPrefix.length)
        : current;
    const emoji = badge()?.emoji;
    appliedPrefix = emoji && !base.startsWith(emoji) ? `${emoji} ` : '';
    if (current !== appliedPrefix + base) setTitle(appliedPrefix + base);
  }

  // Also re-run when Canvas adds an icon link or React rewrites its href.
  function applyIcon() {
    for (const link of iconLinks()) {
      const current = link.getAttribute('href');
      if (!badgedHrefs.has(current)) originalHrefs.set(link, current);
      const next = iconHref ?? originalHrefs.get(link);
      if (next && current !== next) link.setAttribute('href', next);
    }
  }

  async function renderIcon() {
    const color = badge()?.color ?? null;
    if (color === iconColor) return;
    iconColor = color;
    if (!color) {
      iconHref = null;
      applyIcon();
      return;
    }
    iconSource ??= loadDataUrl(originalIconUrl());
    const source = await iconSource;
    if (iconColor !== color) return;
    const image = source
      ? `<image href="${source}" width="32" height="32"/>`
      : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${image}<circle cx="24" cy="24" r="7" fill="${color}" stroke="#fff" stroke-width="2"/></svg>`;
    iconHref = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    badgedHrefs.add(iconHref);
    applyIcon();
  }

  function render() {
    renderTitle();
    renderIcon();
  }

  async function notify(id, title, next) {
    if (window.Notification?.permission !== 'granted') return;
    let body = STATUS_BADGES[next].label;
    if (next === 'finished') {
      const result = await host.agentServer
        .request({ path: `/api/conversations/${id}/agent_final_response` })
        .catch(() => null);
      if (result?.response) body = result.response.slice(0, 200);
    }
    if (disposed) return;
    const notification = new Notification(title || 'OpenHands', {
      body,
      tag: `openhands-extras-${id}`,
      icon: originalIconUrl(),
    });
    // Open the run it's about, which may not be the conversation on screen.
    notification.onclick = () => {
      window.focus();
      if (id !== openId) host.navigate(`/conversations/${id}`);
      notification.close();
    };
  }

  function update(id, info) {
    const entry = conversations.get(id);
    if (!entry) return;
    const previous = entry.status;
    const next = info.execution_status;
    entry.status = next;
    entry.title = info.title || entry.title;
    if (ACTIVE_STATUSES.has(next)) entry.sawActive = true;
    if (
      previous &&
      previous !== next &&
      entry.sawActive &&
      NOTIFY_STATUSES.has(next) &&
      settings.notifications &&
      (id !== openId || away())
    ) {
      notify(id, entry.title, next);
    }
  }

  async function check() {
    lastCheck = Date.now();
    if (inFlight) {
      again = true;
      return;
    }
    const nextOpenId = watching()
      ? (location.pathname.match(CONVERSATION_PATH)?.[1] ?? null)
      : null;
    if (nextOpenId !== openId) {
      openId = nextOpenId;
      if (openId && !conversations.has(openId)) {
        conversations.set(openId, { status: null, title: '', sawActive: false });
      }
      render();
    }
    for (const [id, entry] of conversations) {
      const followRun =
        settings.notifications && ACTIVE_STATUSES.has(entry.status);
      if (id !== openId && !followRun) conversations.delete(id);
    }
    const ids = [...conversations.keys()];
    if (ids.length) {
      inFlight = true;
      try {
        // One request for every conversation followed; missing ones are null.
        const query = ids.map((id) => `ids=${id}`).join('&');
        const infos = await host.agentServer.request({
          path: `/api/conversations?${query}`,
        });
        if (!disposed) {
          ids.forEach((id, index) => infos[index] && update(id, infos[index]));
        }
      } catch {
        // Keep the last known statuses; the next check retries.
      } finally {
        inFlight = false;
      }
      if (disposed) return;
      render();
    }
    schedulePoll();
    if (again) {
      again = false;
      requestCheck();
    }
  }

  // Poll only while a run is going: runs you navigated away from don't
  // re-render this page, and a run's last event can land between checks.
  // Otherwise, page changes and coming back to the tab trigger checks.
  function schedulePoll() {
    clearTimeout(poll);
    const running = [...conversations.values()].some((entry) =>
      ACTIVE_STATUSES.has(entry.status),
    );
    poll = running ? setTimeout(requestCheck, STATUS_POLL_MS) : 0;
  }

  function requestCheck() {
    const wait = lastCheck + STATUS_MIN_GAP_MS - Date.now();
    if (wait <= 0) {
      check();
    } else if (!trailing) {
      trailing = setTimeout(() => {
        trailing = 0;
        check();
      }, wait);
    }
  }

  // Coming back to the tab or window clears the finished/error/paused badges.
  function onReturn() {
    if (away() || !watching()) return;
    const open = conversations.get(openId);
    if (open && !ACTIVE_STATUSES.has(open.status)) open.sawActive = false;
    render();
    requestCheck();
  }

  // Canvas rewrites the title on navigation, and may add icon links or reset
  // their href; re-apply the badge to both.
  const headObserver = new MutationObserver(() => {
    applyIcon();
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

  return {
    onDomChange() {
      if (watching()) requestCheck();
    },
    // Also runs the first check, as activate() applies the initial settings.
    refresh() {
      render();
      lastCheck = 0;
      requestCheck();
    },
    dispose() {
      disposed = true;
      headObserver.disconnect();
      clearTimeout(trailing);
      clearTimeout(poll);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      openId = null;
      conversations.clear();
      render();
    },
  };
}

export function activate(host) {
  if (host.apiVersion !== '1') {
    throw new Error(`Extras requires host API 1, got ${host.apiVersion}.`);
  }
  loadSettings();
  const agentStatus = watchAgentStatus(host);
  const applyAll = () => {
    applyWideCanvas(settings.wideCanvas);
    agentStatus.refresh();
  };
  // Settings changed in another tab: apply them and rebuild the card section.
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY) return;
    loadSettings();
    applyAll();
    document.getElementById(SECTION_ID)?.remove();
  };
  window.addEventListener('storage', onStorage);
  applyAll();
  const card = watchAppCard(host.extension.name, (next) => {
    saveSettings(next);
    applyAll();
  });
  // One body observer for both: Canvas renders the app card on Customize >
  // Apps, and re-renders the chat as a run's events stream in.
  const observer = new MutationObserver(() => {
    card.onDomChange();
    agentStatus.onDomChange();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    window.removeEventListener('storage', onStorage);
    card.dispose();
    agentStatus.dispose();
    applyWideCanvas(false);
  };
}
