// Built from src/ by `npm run build`; edit those files instead.
// Helpers for the elements this app adds to Canvas's page, and the classes
// it borrows from Canvas's own components.

const THINKING_ATTR = 'data-extras-thinking';
const CHIP_LABEL_ATTR = 'data-extras-chip-label';
const UNREAD_ATTR = 'data-extras-unread';

// Marks other elements this app adds to the page body.
const OWN_ATTR = 'data-extras-own';

// One of our own elements in <head>, by id, created on first use with these
// attributes: Chromium only picks up a manifest link that has its rel when
// it's added.
function headElement(id, tag, { first = false, attributes = {} } = {}) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement(tag);
    element.id = id;
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }
    document.head[first ? 'prepend' : 'append'](element);
  }
  return element;
}

const removeElement = (id) => document.getElementById(id)?.remove();

function setStyle(id, css) {
  setProperty(headElement(id, 'style'), 'textContent', css);
}

// An element with these classes, holding text or other nodes.
function el(tag, className, ...children) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children);
  return element;
}

// Class strings from Canvas's own components, so they're compiled.
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const HAS_FOCUS_RING =
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus';

function textButton(testid, text, onClick, look = 'underline') {
  const button = el('button', `w-fit cursor-pointer rounded-sm text-sm ${look} ${FOCUS_RING}`, text);
  button.type = 'button';
  button.dataset.testid = testid;
  button.addEventListener('click', onClick);
  return button;
}

// The parts of this app's pages, as Canvas lays out its settings pages.
const pageHeader = (title, description) =>
  el(
    'div',
    'min-w-0 space-y-1',
    el('h2', 'text-xl font-semibold leading-6 text-foreground', title),
    el('p', 'max-w-2xl text-sm text-tertiary-light', description),
  );
const pageSection = (title, ...children) =>
  el('section', 'flex min-w-0 flex-col gap-3', el('h3', 'text-base font-semibold text-foreground', title), ...children);

// The elements this app adds to Canvas's page body.
const OWN_SELECTOR = `[${OWN_ATTR}], [${THINKING_ATTR}], [${CHIP_LABEL_ATTR}], [${UNREAD_ATTR}]`;
const ownNode = (node) => node.nodeType === Node.ELEMENT_NODE && node.matches(OWN_SELECTOR);
const ownChange = (record) =>
  !!record.target.closest?.(OWN_SELECTOR) ||
  [...record.addedNodes, ...record.removedNodes].every(ownNode);

// Every write to the page wakes the observers watching it, so these only
// write what changed.
const setProperty = (element, name, value) => {
  if (element[name] !== value) element[name] = value;
};
const setAttribute = (element, name, value) => {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
};
const toggleAttr = (element, name, on) => {
  if (element.hasAttribute(name) !== on) element.toggleAttribute(name, on);
};

// What this app keeps in the browser's localStorage.

const STORAGE_KEY = 'openhands-extras:settings';
const UNSEEN_KEY = 'openhands-extras:unseen';
const READ_KEY = 'openhands-extras:read';
const VIEWING_KEY = 'openhands-extras:viewing';

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

// Stores a value as JSON, or removes it for null. Storage that's full or
// blocked just doesn't remember it.
function writeJson(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to keep then.
  }
}

// What this app reads from Canvas's page: its conversations, language,
// theme and base path.

const MANIFEST_ID = 'openhands-extras-manifest';
const CONVERSATION_PATH = /\/conversations\/([0-9a-f-]{32,36})(?:\/|$)/i;

// The Agent Server's ids drop the dashes Canvas's links may have, so ids are
// kept that way, one per conversation.
const conversationKey = (id) => id.replaceAll('-', '').toLowerCase();
const openConversationId = () => {
  const id = location.pathname.match(CONVERSATION_PATH)?.[1];
  return id ? conversationKey(id) : null;
};

// A browser window behind another app often still counts as visible.
const away = () => document.hidden || !document.hasFocus();

// Canvas keeps its UI language on <html lang>, and its translations at
// /locales, which are fetched once per language. A failed fetch gives none,
// leaving the English.
const canvasLanguage = () => document.documentElement.lang || 'en';
const translations = new Map();

function canvasTranslations(language) {
  if (!translations.has(language)) {
    translations.set(
      language,
      fetch(`/locales/${encodeURIComponent(language)}/openhands.json`)
        .then((response) => (response.ok ? response.json() : {}))
        .catch(() => ({})),
    );
  }
  return translations.get(language);
}

// Canvas marks <body> as well as its themed root, which carries the theme.
const themeRoot = () =>
  document.querySelector('[data-agent-server-ui][data-color-theme]') ??
  document.querySelector('[data-agent-server-ui]');

// The first opaque background from Canvas's themed root outwards.
function canvasBackground() {
  const root = themeRoot();
  for (const element of [
    root,
    root?.firstElementChild,
    document.body,
    document.documentElement,
  ]) {
    if (!element) continue;
    const color = window.getComputedStyle(element).backgroundColor;
    if (color && color !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(color)) {
      return color;
    }
  }
  return null;
}

const canvasManifest = () =>
  document.head.querySelector(`link[rel~="manifest"]:not(#${MANIFEST_ID})`);

function installProblem() {
  return canvasManifest() ? 'Canvas is already installable.' : null;
}

// Canvas's mount point, as React Router has it, e.g. "/" or "/canvas/".
function canvasBase() {
  const basename = window.__reactRouterContext?.basename ?? '/';
  return new URL(basename.endsWith('/') ? basename : `${basename}/`, location.origin)
    .href;
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

// The sidebar's conversations, in order: each card, its link, whose query
// carries Canvas's backend, as in ?backend=…, and the conversation's key.
// A card's link is read again only once it changes.
const cardLinks = new WeakMap();

function sidebarConversations() {
  return [...document.querySelectorAll('[data-testid="conversation-card"]')].flatMap((card) => {
    const href = card.closest('a[href]')?.getAttribute('href');
    let known = cardLinks.get(card);
    if (known?.href !== href) {
      const url = href ? new URL(href, location.href) : null;
      const id = url?.pathname.match(CONVERSATION_PATH)?.[1];
      known = { href, url, key: id ? conversationKey(id) : null };
      cardLinks.set(card, known);
    }
    return known.key ? [{ card, url: known.url, key: known.key }] : [];
  });
}

// The chime Notification sounds plays.

// Browsers only let audio start after a click or key press on the page, so
// the context is created when the switch is turned on, and activate() unlocks
// it on each later one, e.g. after a reload.
let audio = null;

function unlockAudio() {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) return 'Your browser does not support playing sounds.';
  audio ??= new Context();
  audio.resume?.();
  return null;
}

function closeAudio() {
  if (!audio) return;
  Promise.resolve(audio.close?.()).catch(() => {});
  audio = null;
}

// Two short falling tones, made on the fly so the app needs no sound file.
function playChime() {
  if (unlockAudio()) return;
  const start = audio.currentTime;
  [880, 660].forEach((frequency, index) => {
    const at = start + index * 0.18;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.15, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.16);
  });
}

// Conversation statuses, and how Tab status and notifications show them.

// Canvas starts the open conversation's title with its own status emoji,
// which Tab status replaces rather than adding a second.
const CANVAS_TITLE_STATUS = /^(?:🟢|✅|⚪|🔴) /u;

// Each label is English, and the key Canvas's translation of it, for its
// other languages.
const STATUS_BADGES = {
  running: { emoji: '⏳', color: '#3b82f6', label: 'Running', key: 'COMMON$RUNNING' },
  waiting_for_confirmation: {
    emoji: '✋',
    color: '#f59e0b',
    label: 'Needs your confirmation',
    key: 'CHAT_INTERFACE$AGENT_AWAITING_USER_CONFIRMATION_MESSAGE',
  },
  paused: { emoji: '⏸️', color: '#9ca3af', label: 'Paused', key: 'COMMON$PAUSED' },
  finished: { emoji: '✅', color: '#22c55e', label: 'Finished', key: 'COMMON$FINISHED' },
  error: {
    emoji: '❌',
    color: '#ef4444',
    label: 'Stopped with an error',
    key: 'COMMON$ERROR',
  },
  stuck: {
    emoji: '❌',
    color: '#ef4444',
    label: 'Got stuck',
    key: 'AGENT_STATUS$AGENT_STOPPED',
  },
};

// Active badges show whenever the status holds; the rest only after this tab
// saw the run, until you come back to the tab.
const ACTIVE_STATUSES = new Set(['running', 'waiting_for_confirmation']);
const ENDED_STATUSES = new Set(['finished', 'error', 'stuck']);
const NOTIFY_STATUSES = new Set(['waiting_for_confirmation', ...ENDED_STATUSES]);

// Desktop notifications.


const PERMISSION_PROBLEMS = {
  denied: 'Notifications are blocked for this site in your browser settings.',
  default: "Your browser hasn't allowed notifications yet.",
};

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

// Final responses are Markdown, which notifications show as raw text. Strip
// the syntax and cut on a word boundary without splitting an emoji.
function plainText(markdown, max = 200) {
  const text = markdown
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, ' ')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\*+|~~|`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > cut.length / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// Notify about a run's new status, in Canvas's language, with the agent's
// final reply when it finished. Clicking opens the run, which may not be the
// one on screen.
async function notify(host, { id, title, status, icon, isOpen, isDisposed }) {
  if (window.Notification?.permission !== 'granted') return;
  const { label, key } = STATUS_BADGES[status];
  const language = canvasLanguage();
  let body =
    language === 'en' ? label : ((await canvasTranslations(language))[key] ?? label);
  if (status === 'finished') {
    const result = await host.agentServer
      .request({ path: `/api/conversations/${id}/agent_final_response` })
      .catch(() => null);
    if (result?.response) body = plainText(result.response) || body;
  }
  if (isDisposed()) return;
  const notification = new Notification(title || 'OpenHands', {
    body,
    tag: `openhands-extras-${id}`,
    icon,
  });
  notification.onclick = () => {
    window.focus();
    if (!isOpen()) host.navigate(`/conversations/${id}`);
    notification.close();
  };
}

// The settings: each feature's switch, kept in localStorage.


// A switch with options is a choice between them instead, starting at its
// default. check() says why a switch can't work, e.g. after a permission was
// revoked; enable(), which defaults to check(), may also ask the browser for
// what it needs.
// status is 'follow' for a feature that needs conversation statuses, and
// 'count' for one that also needs how many conversations need your input.
// The settings page lists them under their group, in this order.
const SWITCH_GROUPS = ['Chat', 'Notifications', 'Accessibility', 'Phone and app'];
const SWITCHES = [
  {
    key: 'wideChat',
    group: 'Chat',
    label: 'Wide chat',
    description: 'Let the chat use the full width of the page.',
  },
  {
    key: 'focusedNewChat',
    group: 'Chat',
    label: 'Focused new chat',
    description: "Hide the new chat page's heading, and put the message box at the top.",
  },
  {
    key: 'collapseActivity',
    group: 'Chat',
    status: 'follow',
    label: 'Collapse agent activity',
    description: 'Fold the agent\'s "Running" and "Reading" entries into an expandable "Thinking".',
  },
  {
    key: 'responsiveTables',
    group: 'Chat',
    label: 'Responsive tables',
    description: "Stack a table's cells under their headings when it's too wide for the chat.",
  },
  {
    key: 'keyboardShortcuts',
    group: 'Chat',
    label: 'Keyboard shortcuts',
    description: 'Switch conversations and start chats from the keyboard. Press ? to list them.',
  },
  {
    key: 'tabStatus',
    group: 'Notifications',
    status: 'count',
    label: 'Tab status',
    description: "Show the agent's status in the tab, and what needs you on the app's icon.",
  },
  {
    key: 'notifications',
    group: 'Notifications',
    status: 'follow',
    label: 'Desktop notifications',
    description: "Notify you when the agent finishes or needs you while you're away.",
    check: notificationProblem,
    enable: requestNotificationPermission,
  },
  {
    key: 'notificationSounds',
    group: 'Notifications',
    status: 'follow',
    label: 'Notification sounds',
    description: "Chime when the agent needs your confirmation while you're away.",
    enable: unlockAudio,
  },
  {
    key: 'unreadMarkers',
    group: 'Notifications',
    label: 'Unread markers',
    description: 'Mark the conversations in the sidebar that changed since you last opened them.',
  },
  {
    key: 'checkInterval',
    group: 'Notifications',
    label: 'Check for changes every',
    description:
      'How often to ask the Agent Server about runs and unread conversations, while a setting above needs it.',
    // Choices as [value, label, the time between checks in ms].
    options: [
      ['5s', '5 seconds', 5000],
      ['10s', '10 seconds', 10000],
      ['20s', '20 seconds', 20000],
      ['30s', '30 seconds', 30000],
      ['1m', '1 minute', 60000],
      ['2m', '2 minutes', 120000],
      ['3m', '3 minutes', 180000],
      ['5m', '5 minutes', 300000],
    ],
    default: '10s',
  },
  {
    key: 'fontSize',
    group: 'Accessibility',
    label: 'Font size',
    description: "Make Canvas's text, and the space around it, smaller or larger.",
    // Choices as [value, label, the page's root font size].
    options: [
      ['smallest', 'Smallest', '75%'],
      ['smaller', 'Smaller', '87.5%'],
      ['small', 'Small', '93.75%'],
      ['default', 'Default', null],
      ['large', 'Large', '112.5%'],
      ['larger', 'Larger', '125%'],
      ['largest', 'Largest', '150%'],
    ],
    default: 'default',
  },
  {
    key: 'reduceMotion',
    group: 'Accessibility',
    label: 'Reduce motion',
    description: "Stop Canvas's spinners, pulses, fades and slides.",
  },
  {
    key: 'clearFocus',
    group: 'Accessibility',
    label: 'Clear links and focus',
    description: 'Underline every link, and ring what has keyboard focus.',
  },
  {
    key: 'biggerTapTargets',
    group: 'Accessibility',
    label: 'Bigger tap targets',
    description: 'Make buttons and sidebar rows at least 44 pixels tall on touch screens.',
  },
  {
    key: 'installableApp',
    group: 'Phone and app',
    label: 'Installable app',
    description: "Let your browser install Canvas as an app, with shortcuts and a title bar in its colours.",
    check: installProblem,
  },
  {
    key: 'mobileFixes',
    group: 'Phone and app',
    label: 'Mobile fixes',
    description: "Fit Canvas's sidebar, dialogs, buttons and message box to phones and tablets.",
  },
];
const DEFAULT_SETTINGS = Object.fromEntries(
  SWITCHES.map((item) => [item.key, item.options ? item.default : false]),
);

let settings = DEFAULT_SETTINGS;

// Each switch's stored value, or its default where there's none, or it's
// not one of its choices.
function loadSettings() {
  const stored = readJson(STORAGE_KEY, {});
  settings = Object.fromEntries(
    SWITCHES.map((item) => {
      const value = stored?.[item.key];
      const valid = item.options
        ? item.options.some(([option]) => option === value)
        : typeof value === 'boolean';
      return [item.key, valid ? value : DEFAULT_SETTINGS[item.key]];
    }),
  );
}

// Saves the settings, or with none, removes them, turning every feature off.
function saveSettings(next) {
  settings = next ?? DEFAULT_SETTINGS;
  writeJson(STORAGE_KEY, next ?? null);
}

// Checks of conversations on the Agent Server, shared by the features that
// need them.


// Status and unread checks run together, sharing one request, at most once
// per Check for changes every, and poll that often while a run is going,
// while counting the conversations waiting for confirmation, and for the
// sidebar's changes.
const CHECK_INTERVALS = SWITCHES.find(({ key }) => key === 'checkInterval').options;
const checkMs = () =>
  CHECK_INTERVALS.find(([value]) => value === settings.checkInterval)?.[2] ?? 10000;

// Conversations from the Agent Server, by id, with every load asked for at
// the same moment, e.g. by the agent status and unread markers on the same
// page change, sharing one request. Missing conversations are null.
function conversationLoader(host) {
  let batch = null;
  return function load(ids) {
    if (!batch) {
      const next = { keys: new Set() };
      next.result = Promise.resolve().then(async () => {
        batch = null;
        const keys = [...next.keys];
        const query = keys.map((key) => `ids=${key}`).join('&');
        const infos = await host.agentServer.request({
          path: `/api/conversations?${query}`,
        });
        // Anything but a list would read as every run gone.
        if (!Array.isArray(infos)) throw new Error('Unexpected conversations');
        return new Map(keys.map((key, index) => [key, infos[index] ?? null]));
      });
      batch = next;
    }
    const { keys, result } = batch;
    for (const id of ids) keys.add(conversationKey(id));
    return result.then((byKey) => ids.map((id) => byKey.get(conversationKey(id))));
  };
}

// Run task at most once per gap(), folding the calls in between into one run at
// the end of it, and never two at once: a call during a run queues another,
// which now() runs as soon as the first is done.
function throttle(task, gap) {
  let last = 0;
  let trailing = 0;
  let running = false;
  // false, true, or 'now' to skip the gap.
  let again = false;
  let soon = false;

  async function run() {
    last = Date.now();
    if (running) {
      again ||= true;
      return;
    }
    running = true;
    try {
      await task();
    } catch {
      // The next run tries again.
    } finally {
      running = false;
    }
    if (again) {
      if (again === 'now') last = 0;
      again = false;
      request();
    }
  }

  function request() {
    const wait = last + gap() - Date.now();
    if (wait <= 0) {
      run();
    } else if (!trailing) {
      trailing = setTimeout(() => {
        trailing = 0;
        run();
      }, wait);
    }
  }

  return {
    request,
    // Run without waiting out the gap, e.g. as settings change, instead of
    // the run that was waiting for it. Calls at the same moment, e.g. from
    // every feature, make one run.
    now() {
      clearTimeout(trailing);
      trailing = 0;
      last = 0;
      if (soon) return;
      soon = true;
      queueMicrotask(() => {
        soon = false;
        if (running) again = 'now';
        else request();
      });
    },
    cancel() {
      clearTimeout(trailing);
      trailing = 0;
    },
  };
}

// Tab status: the agent's status in the tab's title and icon and the app's
// badge, and the runs that notifications follow.


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
function watchAgentStatus(host, loadConversations, checks, onRender) {
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
    if (settings.notificationSounds && next === WAITING) {
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
        const countDue = counting() && Date.now() - countedAt >= checkMs();
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

  // Coming back to the tab or window clears the badges of ended or paused runs.
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
      // A new interval checks at once too, so the next poll follows it.
      const next = [
        ...SWITCHES.filter((item) => item.status).map((item) => settings[item.key]),
        settings.checkInterval,
      ].join();
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

// Unread markers.


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

function watchUnread(loadConversations, checks) {
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

// Collapse agent activity.


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
function watchCollapseActivity(statusOf) {
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

// Responsive tables.


const TABLES_STYLE_ID = 'openhands-extras-responsive-tables';
const TABLE_ATTR = 'data-extras-table';

// Canvas's Markdown tables, each in a scroller that lets it run wider than
// the chat. A stacked table is marked with TABLE_STACKED, and each cell
// carries its column's heading in data-th, floated into the cell's padding
// so the cell's own text, bold, code and links flow as one paragraph beside
// it. These undo Canvas's widths, borders and nowrap, and rule a line between
// rows.
const MARKDOWN_TABLE = '[data-testid="markdown-table-scroll"] > table';
const TABLE_STACKED = 'extras-stacked';
const STACKED = `[${TABLE_ATTR}].${TABLE_STACKED}`;
const RESPONSIVE_TABLES_CSS = `
${STACKED}, ${STACKED} tbody, ${STACKED} tr { display: block; }
${STACKED} { width: 100%; min-width: 0; }
${STACKED} thead, ${STACKED} tbody th { display: none; }
${STACKED} tbody td {
  display: flow-root; max-width: none; white-space: normal; border: none;
  padding-left: calc(8em + 1.5rem);
}
${STACKED} tbody td::before {
  content: attr(data-th); float: left; width: 8em; margin-left: calc(-8em - 0.75rem);
  font-weight: 600; overflow-wrap: anywhere;
}
${STACKED} tbody tr + tr td:first-child {
  border-top: 1px solid color-mix(in srgb, currentColor 20%, transparent);
}`;

// An element's content width, as Canvas sizes boxes by their border box.
function contentWidth(element) {
  const style = window.getComputedStyle(element);
  const edges = ['Left', 'Right'].reduce(
    (sum, side) =>
      sum + (parseFloat(style[`border${side}Width`]) || 0) + (parseFloat(style[`padding${side}`]) || 0),
    0,
  );
  return parseFloat(style.width) - edges;
}

function labelCells(table) {
  const headings = [...(table.tHead?.rows[0]?.cells ?? [])].map((cell) => cell.textContent.trim());
  for (const body of table.tBodies) {
    for (const row of body.rows) {
      [...row.cells].forEach((cell, index) => {
        if (index < headings.length) setAttribute(cell, 'data-th', headings[index]);
      });
    }
  }
}

// Fit tables together: label them and put them all back, then measure them
// all, then stack the ones too wide, so the browser lays the page out once
// rather than once per table.
function fitTables(tables) {
  for (const table of tables) {
    labelCells(table);
    table.classList.remove(TABLE_STACKED);
  }
  const wide = tables.filter((table) => table.offsetWidth > contentWidth(table.parentElement));
  for (const table of wide) table.classList.add(TABLE_STACKED);
}

// Stack a Markdown table while it's wider than its scroller, and put it back
// once it fits, checked as the chat's width or the table changes, e.g. as
// rows stream in, which also labels the new cells. Only attributes and a
// class are added, leaving the nodes React owns where they are.
function watchResponsiveTables() {
  // Each table's scroller, which it's measured against.
  const tables = new Map();
  // Tables to check again on the next frame: ResizeObserver reports an error
  // when its callback resizes what it watches.
  const pending = new Set();
  let observer = null;
  let frame = 0;

  function track(table) {
    table.setAttribute(TABLE_ATTR, '');
    const scroller = table.parentElement;
    tables.set(table, scroller);
    observer?.observe(table);
    observer?.observe(scroller);
  }

  function untrack(table) {
    const scroller = tables.get(table);
    tables.delete(table);
    table.classList.remove(TABLE_STACKED);
    table.removeAttribute(TABLE_ATTR);
    for (const cell of table.querySelectorAll('[data-th]')) cell.removeAttribute('data-th');
    observer?.unobserve(table);
    observer?.unobserve(scroller);
  }

  function recheck() {
    frame = 0;
    fitTables([...pending].filter((table) => tables.has(table)));
    pending.clear();
  }

  function onResize(entries) {
    for (const { target } of entries) {
      const table = tables.has(target)
        ? target
        : [...target.children].find((child) => tables.has(child));
      if (table) pending.add(table);
    }
    if (pending.size && !frame) frame = window.requestAnimationFrame(recheck);
  }

  function stop() {
    for (const table of [...tables.keys()]) untrack(table);
    observer?.disconnect();
    observer = null;
    window.cancelAnimationFrame?.(frame);
    frame = 0;
    pending.clear();
    removeElement(TABLES_STYLE_ID);
  }

  function apply() {
    if (!settings.responsiveTables) {
      if (tables.size || observer) stop();
      return;
    }
    setStyle(TABLES_STYLE_ID, RESPONSIVE_TABLES_CSS);
    if (!observer && window.ResizeObserver) {
      observer = new window.ResizeObserver(onResize);
    }
    for (const table of [...tables.keys()]) {
      if (!table.isConnected) untrack(table);
    }
    const added = [...document.querySelectorAll(`${MARKDOWN_TABLE}:not([${TABLE_ATTR}])`)];
    added.forEach(track);
    if (added.length) fitTables(added);
  }

  return { refresh: apply, onDomChange: apply, dispose: stop };
}

// Installable app.


const THEME_META_ID = 'openhands-extras-theme-color';
const TOUCH_ICON_ID = 'openhands-extras-touch-icon';
const SAFE_AREA_STYLE_ID = 'openhands-extras-safe-area';

// Canvas links no web app manifest, so browsers won't offer to install it.
// This links one of its own, as a data: URL, with absolute URLs under
// Canvas's base path, as relative ones would resolve against the data: URL.
// Its icons are Canvas's own favicon.svg, also drawn as PNGs where the
// browser can, for launchers that want them. It stands down should Canvas
// link a manifest itself.
const APP_NAME = 'OpenHands';
const IOS_META = {
  'apple-mobile-web-app-capable': 'yes',
  'apple-mobile-web-app-status-bar-style': 'black-translucent',
  'apple-mobile-web-app-title': APP_NAME,
  'mobile-web-app-capable': 'yes',
};
const iosMetaId = (name) => `openhands-extras-${name}`;

// An installed window paints under the notch and home indicator with
// viewport-fit=cover, so Canvas's shell pads its content back out of them.
// The insets are 0 everywhere else. Canvas's desktop app has a title bar band
// of its own, padded with pt-7.
const SAFE_AREA_CSS = `[data-testid="root-layout"]:not(.pt-7) {
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
    env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
}`;

// Icons as [size, purpose]: maskable ones keep the tile in the middle 80%,
// which launchers may crop to a circle.
const PNG_ICONS = [
  [192, 'any'],
  [512, 'any'],
  [512, 'maskable'],
];

// Shortcuts on the installed app's icon, by path under Canvas's base path.
// /conversations is Canvas's own home, which / may redirect from.
const SHORTCUTS = [
  ['New chat', 'conversations'],
  ['Settings', 'settings'],
];

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

// The image as a square PNG data URL, or null where the browser can't draw.
function pngIcon(image, size, purpose) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;
  let inset = 0;
  if (purpose === 'maskable') {
    context.fillStyle = '#000';
    context.fillRect(0, 0, size, size);
    inset = size * 0.1;
  }
  context.drawImage(image, inset, inset, size - 2 * inset, size - 2 * inset);
  return canvas.toDataURL('image/png');
}

function installableApp(host) {
  let launches = false;
  let pngs = null;
  let touchIcon = null;
  let pngsFor = null;
  let viewport = null;
  let viewportContent = null;
  // What the linked manifest was built from, as it's only built again when
  // that changes, and the theme root followed for its colour.
  let built = null;
  let root = null;
  const rootObserver = new MutationObserver(() => apply());
  const scheme = window.matchMedia?.('(prefers-color-scheme: dark)');

  // Canvas's favicon as PNG icons, once per URL: null until they're drawn,
  // and none where the browser can't draw them.
  function drawIcons(svgUrl) {
    if (pngsFor === svgUrl) return;
    pngsFor = svgUrl;
    pngs = null;
    touchIcon = null;
    loadImage(svgUrl).then((image) => {
      if (pngsFor !== svgUrl) return;
      const drawn = PNG_ICONS.map(([size, purpose]) => ({
        src: image && pngIcon(image, size, purpose),
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose,
      }));
      const ok = drawn.every(({ src }) => src);
      pngs = ok ? drawn : [];
      if (ok) touchIcon = pngIcon(image, 180, 'any');
      apply();
    });
  }

  function setViewport(on) {
    if (on && !viewport) {
      viewport = document.head.querySelector('meta[name="viewport"]');
      viewportContent = viewport?.getAttribute('content') ?? null;
      if (viewportContent?.includes('viewport-fit')) viewport = null;
      viewport?.setAttribute('content', `${viewportContent}, viewport-fit=cover`);
    } else if (!on && viewport) {
      viewport.setAttribute('content', viewportContent);
      viewport = null;
    }
  }

  function remove() {
    built = null;
    removeElement(MANIFEST_ID);
    removeElement(THEME_META_ID);
    removeElement(TOUCH_ICON_ID);
    removeElement(SAFE_AREA_STYLE_ID);
    for (const name of Object.keys(IOS_META)) removeElement(iosMetaId(name));
    setViewport(false);
  }

  function apply() {
    if (!settings.installableApp || canvasManifest()) {
      remove();
      return;
    }
    const base = canvasBase();
    const svgUrl = new URL('favicon.svg', base).href;
    drawIcons(svgUrl);
    // Installed apps colour their title bar from the theme-color meta, which
    // Canvas doesn't set.
    const background = canvasBackground();
    if (background) {
      const meta = headElement(THEME_META_ID, 'meta', { first: true });
      meta.name = 'theme-color';
      setProperty(meta, 'content', background);
    } else {
      removeElement(THEME_META_ID);
    }
    // Browsers may only read the first manifest linked, so it waits for the
    // PNG icons that Android needs to install the app.
    const color = background ?? '#000';
    const key = `${base}|${color}|${svgUrl}`;
    if (pngs && (key !== built || !document.getElementById(MANIFEST_ID))) {
      built = key;
      linkManifest(base, color, svgUrl);
    }
    const touch = headElement(TOUCH_ICON_ID, 'link', {
      attributes: { rel: 'apple-touch-icon' },
    });
    setAttribute(touch, 'href', touchIcon ?? svgUrl);
    for (const [name, content] of Object.entries(IOS_META)) {
      headElement(iosMetaId(name), 'meta', { attributes: { name, content } });
    }
    setStyle(SAFE_AREA_STYLE_ID, SAFE_AREA_CSS);
    setViewport(true);
    handleLaunches(base);
  }

  function linkManifest(base, color, svgUrl) {
    const manifest = {
      id: base,
      name: APP_NAME,
      short_name: APP_NAME,
      description:
        'The self-hosted developer control center for coding agents and automations.',
      start_url: base,
      scope: base,
      display: 'standalone',
      theme_color: color,
      background_color: color,
      categories: ['developer', 'productivity', 'utilities'],
      shortcuts: SHORTCUTS.map(([name, path]) => ({
        name,
        url: new URL(path, base).href,
      })),
      // Launches, e.g. from a shortcut, reuse the open window, which goes
      // where they point without reloading Canvas.
      launch_handler: { client_mode: ['focus-existing', 'auto'] },
      icons: [
        ...(pngs ?? []),
        { src: svgUrl, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
    };
    const href = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;
    const link = headElement(MANIFEST_ID, 'link', {
      attributes: { rel: 'manifest', href },
    });
    setAttribute(link, 'href', href);
  }

  // The colours follow the theme root's attributes, and the system scheme
  // for Canvas's "system" theme; Canvas may re-mount the root.
  function track() {
    const next = settings.installableApp ? themeRoot() : null;
    if (next === root) return;
    root = next;
    rootObserver.disconnect();
    if (root) rootObserver.observe(root, { attributes: true });
    apply();
  }

  // Launches go to their URL inside Canvas, as host.navigate() does, from
  // Canvas's base path, in the window they reuse.
  function handleLaunches(base) {
    if (launches || !window.launchQueue) return;
    launches = true;
    window.launchQueue.setConsumer(({ targetURL }) => {
      if (!targetURL || !settings.installableApp || targetURL === location.href) return;
      host.navigate(`/${targetURL.slice(base.length)}`);
    });
  }

  scheme?.addEventListener?.('change', apply);
  return {
    refresh() {
      track();
      apply();
    },
    onDomChange: track,
    dispose() {
      rootObserver.disconnect();
      scheme?.removeEventListener?.('change', apply);
      remove();
      if (launches) window.launchQueue.setConsumer(() => {});
    },
  };
}

// Features that are only a style: Wide canvas, Mobile fixes and the
// accessibility settings.


// The chat thread is the only max-w-200 element that is also h-full, so the
// Customize, Settings and home launcher columns keep their width. Unlayered
// CSS beats Tailwind's @layer utilities regardless of specificity.
const WIDE_CHAT_CSS =
  '[data-agent-server-ui] .max-w-200.h-full.min-h-0 { max-width: none; }';

// The new chat page (HomeChatLauncher) puts its heading and tagline
// (HomeHeaderTitle) above the message box, and starts 28% of the way down
// the page, or further while a new chat starts.
const FOCUSED_NEW_CHAT_CSS = `
[data-testid="home-chat-launcher"] div:has(> div > [data-testid="home-header-subtitle"]) { display: none; }
[data-testid="home-chat-launcher"]:not(.h-full) { padding-top: 2rem; }`;

// Canvas's dialogs (ModalBackdrop: a fixed backdrop, then the content)
// centre fixed-width content with no height limit, so on a phone a tall or
// wide one runs off the screen, out of reach. The Automate pages' tab strip
// (ManifestSubpageLayout) gives its links equal widths that cut their names
// off, though it can scroll. The sidebar's drawer takes the screen's full
// width, closing with its own close button, with its right edge padded like
// its left, and a conversation's hover preview, which opens beside it with
// no room, is hidden.
//
// Canvas's shell is 100vh tall, which on phones includes the space behind
// the browser's toolbars, hiding the message box under them; 100dvh is the
// space you see. Touch screens can't hover, so controls Canvas only shows on
// hover show all the time there.
const MODAL_FRAME = '[role="dialog"][aria-modal="true"].fixed.inset-0 > .fixed.inset-0 + .relative';
const HOVER_PREVIEW = '[data-testid="conversation-card-preview"]';
const MOBILE_FIXES_CSS = `
[data-testid="root-layout"].h-screen { height: 100dvh; }
@media (hover: none) {
  [class*="hover:opacity-100"] { opacity: 1; }
  [class*="group-hover"][class*=":visible"] { visibility: visible; }
}
@media (max-width: 767px) {
  ${MODAL_FRAME} {
    box-sizing: border-box; max-width: 100vw; max-height: 100dvh;
    overflow-y: auto; padding: 0.75rem;
  }
  ${MODAL_FRAME} > * { max-width: 100%; }
  [data-testid$="-navbar-mobile"] > a { flex: none; width: auto; }
  [data-testid="sidebar-mobile-drawer"] {
    width: 100%; border-right: none; padding-right: 0.625rem;
  }
  [role="tooltip"]:has(${HOVER_PREVIEW}), .shadow-xl:has(> ${HOVER_PREVIEW}) { display: none; }
}`;

// The page's root font size, which Canvas's rem-based sizes follow, from the
// browser's own, so a size set there still counts.
const FONT_STYLE_ID = 'openhands-extras-font-size';

function fontSize() {
  const item = SWITCHES.find(({ key }) => key === 'fontSize');
  return {
    refresh() {
      const size = item.options.find(([value]) => value === settings.fontSize)?.[2];
      if (size) setStyle(FONT_STYLE_ID, `html { font-size: ${size}; }`);
      else removeElement(FONT_STYLE_ID);
    },
    dispose: () => removeElement(FONT_STYLE_ID),
  };
}

// Animations end at once rather than not at all, as some of Canvas's wait
// for theirs to end, e.g. before closing a panel.
const REDUCE_MOTION_CSS = `
*, *::before, *::after {
  animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
  animation-delay: 0s !important; transition-duration: 0.01ms !important;
  transition-delay: 0s !important; scroll-behavior: auto !important;
}`;

// Canvas underlines some links only on hover, and takes the outline off many
// controls, or draws a faint 1px ring.
const CLEAR_FOCUS_CSS = `
a[href].hover\\:underline { text-decoration-line: underline; text-underline-offset: 2px; }
:focus-visible {
  outline: 3px solid var(--color-focus, Highlight) !important; outline-offset: 2px !important;
}`;

// 44px, as WCAG 2.5.5 asks, for controls; inline links in text are left as
// they are, as min-height doesn't apply to them.
const BIGGER_TAP_TARGETS_CSS = `
@media (pointer: coarse) {
  button, [role="button"], a[href], select, summary { min-height: 2.75rem; }
  button[aria-label], [role="button"][aria-label] { min-width: 2.75rem; }
}`;

// A switch that's only a style, added while it's on, as
// openhands-extras-<key in kebab case>.
function styleSwitch(key, css) {
  const id = `openhands-extras-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  return {
    refresh: () => (settings[key] ? setStyle(id, css) : removeElement(id)),
    dispose: () => removeElement(id),
  };
}

// Keyboard shortcuts.


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
let showShortcuts = null;

function shortcutList() {
  const mod = isApple() ? '⌘' : 'Ctrl';
  const alt = isApple() ? '⌥' : 'Alt';
  return [
    ['?', 'Show these shortcuts'],
    ['/', 'Focus the message box'],
    [`${alt} ↑`, 'Open the previous conversation in the sidebar'],
    [`${alt} ↓`, 'Open the next conversation in the sidebar'],
    [`${alt} ⇧ ↓`, 'Open the next conversation that needs you or is unread'],
    [`${alt} N`, 'Start a new chat'],
    [`${mod} K`, "Open Canvas's command menu, e.g. to toggle the sidebar"],
    [`${mod} Enter`, "Approve the agent's pending action, in Canvas"],
    [`${mod} ⇧ ${isApple() ? '⌫' : 'Backspace'}`, "Reject the agent's pending action, in Canvas"],
    ['Esc', 'Close this list'],
  ];
}

function keyboardShortcuts(host, loadConversations) {
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
  function open(url) {
    const basePath = new URL(canvasBase()).pathname;
    host.navigate(`/${(url.pathname + url.search).slice(basePath.length)}`);
  }

  function openNeighbour(step) {
    const conversations = sidebarConversations();
    if (!conversations.length) return;
    const index = conversations.findIndex(({ key }) => key === openConversationId());
    const next =
      conversations[index === -1 ? (step > 0 ? 0 : conversations.length - 1) : index + step];
    if (next) open(next.url);
  }

  // The next sidebar conversation after the open one, round to the top, that
  // waits for your confirmation, from the Agent Server, or else one Unread
  // markers marks.
  async function openNeedingYou() {
    const conversations = sidebarConversations();
    const index = conversations.findIndex(({ key }) => key === openConversationId());
    const after = [...conversations.slice(index + 1), ...conversations.slice(0, index + 1)].filter(
      ({ key }) => key !== openConversationId(),
    );
    if (!after.length) return;
    const infos = await loadConversations(after.map(({ key }) => key)).catch(() => []);
    const next =
      after.find((_, at) => infos[at]?.execution_status === 'waiting_for_confirmation') ??
      after.find(({ card }) => card.querySelector(`[${UNREAD_ATTR}]`));
    if (next) open(next.url);
  }

  // Alt+↑, Alt+↓ and Alt+Shift+↓ work in the message box too, so you can move
  // on from a conversation as you write; the others type text there.
  function actionFor(event, inField) {
    if (event.ctrlKey || event.metaKey) return null;
    if (event.altKey) {
      if (event.shiftKey) return event.key === 'ArrowDown' ? openNeedingYou : null;
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

// The settings page, its place in Customize's menu, and the switches it
// shows.


// Class strings mirror Canvas's ToggleSwitchVisual (src/ui/toggle-switch.tsx)
// so the switch picks up the same compiled Tailwind styles. The checkbox it
// stands for says it's a switch, as Canvas's own do, and its hint is read out
// when it changes, e.g. to say why a switch turned itself back off.
const TRACK_CLASS =
  'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out motion-reduce:transition-none h-5.5 w-10 border';
const TRACK_ON_CLASS = 'border-contrast bg-contrast';
const TRACK_OFF_CLASS = 'border-border bg-surface-raised';
const THUMB_CLASS =
  'inline-block rounded-full transition-transform duration-200 ease-in-out motion-reduce:transition-none size-4';
const THUMB_ON_CLASS = 'translate-x-5.25 rtl:-translate-x-5.25 bg-base-secondary';
const THUMB_OFF_CLASS = 'translate-x-0.5 rtl:-translate-x-0.5 bg-muted';

// Canvas's formControlFieldClassName (form-control-classes.ts), as its
// settings fields look.
const SELECT_CLASS =
  'h-9 min-h-9 rounded-lg border border-control bg-base-secondary transition-control-shell duration-75 motion-reduce:transition-none focus:border-contrast/40 dark:focus:border-contrast/40 focus:ring-1 focus:ring-contrast/20 focus:outline-none w-full max-w-xs min-w-0 px-3 text-sm text-contrast cursor-pointer';

// A choice as a dropdown under its label.
function buildChoice(item, onChange) {
  const id = `extras-${item.key}`;
  const select = el(
    'select',
    SELECT_CLASS,
    ...item.options.map(([value, text]) => {
      const option = el('option', '', text);
      option.value = value;
      return option;
    }),
  );
  select.id = id;
  select.dataset.testid = `${id}-select`;
  select.value = settings[item.key];
  select.setAttribute('aria-describedby', `${id}-hint`);
  select.addEventListener('change', () => onChange({ ...settings, [item.key]: select.value }));
  const label = el('label', 'w-fit text-sm', item.label);
  label.htmlFor = id;
  const hint = el('p', 'text-xs leading-relaxed text-tertiary-light', item.description);
  hint.id = `${id}-hint`;
  return el('div', 'flex min-w-0 flex-col gap-2', label, select, hint);
}

function buildSwitch(item, onChange) {
  const block = document.createElement('div');
  block.className = 'flex min-w-0 flex-col gap-1';
  block.innerHTML = `
    <label class="relative flex items-center gap-2 rounded-sm ${HAS_FOCUS_RING} w-fit cursor-pointer">
      <input class="sr-only" type="checkbox" role="switch" data-testid="extras-${item.key}-switch" aria-describedby="extras-${item.key}-hint" />
      <span aria-hidden="true"><span></span></span>
      <span class="flex items-center gap-1">
        <span class="text-sm"></span>
      </span>
    </label>
    <p id="extras-${item.key}-hint" class="text-xs leading-relaxed text-tertiary-light" aria-live="polite"></p>`;

  const input = block.querySelector('input');
  const track = input.nextElementSibling;
  const hint = block.querySelector('p');
  const enable = item.enable ?? item.check;
  block.querySelector('.text-sm').textContent = item.label;
  const render = () => {
    track.className = `${TRACK_CLASS} ${input.checked ? TRACK_ON_CLASS : TRACK_OFF_CLASS}`;
    track.firstElementChild.className = `${THUMB_CLASS} ${input.checked ? THUMB_ON_CLASS : THUMB_OFF_CLASS}`;
  };
  input.checked = settings[item.key];
  hint.textContent = (input.checked && item.check?.()) || item.description;
  render();
  input.addEventListener('change', async () => {
    const problem = input.checked && enable ? await enable() : null;
    // Reset, or another tab, rebuilt the switches while the browser asked.
    if (!block.isConnected) return;
    if (problem) input.checked = false;
    hint.textContent = problem ?? item.description;
    render();
    onChange({ ...settings, [item.key]: input.checked });
  });
  return block;
}

// The app's settings page, as declared in canvas-extension.json, which Canvas
// serves under /extensions/<app name>/ and links from its sidebar. The link
// is hidden there and goes under Apps in Customize's menu instead.
const SETTINGS_PAGE = 'settings';
const pageHref = (name, page) => `/extensions/${name}/${page}`;
const SIDEBAR_STYLE_ID = 'openhands-extras-sidebar';

// Customize's pages, whose menu gets the settings page's link.
const CUSTOMIZE_PAGE = /\/(?:customize|mcp|skills|plugins|apps)\/?$/;

// Class strings mirror Canvas's sidebarNavRowClassName() and
// SIDEBAR_ROW_INTERACTIVE_CLASS (sidebar-layout.ts), and its Customize menu
// (extensions-navigation.tsx), whose items and icons the settings page
// repeats.
const NAV_ROW_CLASS =
  'flex h-9 min-h-9 min-w-0 items-center rounded-md transition-none motion-reduce:transition-none text-sm leading-5 w-full gap-2 px-2.5 overflow-hidden truncate';
const NAV_ACTIVE_CLASS = 'bg-tertiary text-contrast font-normal';
const NAV_IDLE_CLASS = 'text-muted hover:text-contrast hover:bg-surface-raised';
const svgIcon = (viewBox, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="16" height="16" aria-hidden="true" ${extra}>${body}</svg>`;
const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const NAV_ICONS = {
  mcp: svgIcon(
    '0 0 24 24',
    '<path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M2.25 3H21.75L22.5 3.75V13.5H21V9H3V19.5H13.5V21H2.25L1.5 20.25V3.75L2.25 3ZM3 7.5H21V4.5H3V7.5ZM10.5 18V16.359C10.2451 16.2664 10.0074 16.132 9.7965 15.9615L8.379 16.77L7.629 15.48L9.0345 14.6595C8.98649 14.3881 8.98649 14.1104 9.0345 13.839L7.629 13.02L8.379 11.73L9.7965 12.54C10.023 12.36 10.2585 12.2265 10.5 12.141V10.5H12V12.141C12.2568 12.2293 12.4953 12.3641 12.7035 12.5385L14.121 11.73L14.871 13.02L13.4655 13.8405C13.5133 14.1114 13.5133 14.3886 13.4655 14.6595L14.871 15.48L14.121 16.77L12.7035 15.96C12.4903 16.1274 12.2531 16.2619 12 16.359V18H10.5ZM10.125 14.25C10.125 14.562 10.2345 14.8275 10.4535 15.0465C10.5568 15.1528 10.6807 15.2367 10.8177 15.2932C10.9547 15.3497 11.1018 15.3776 11.25 15.375C11.3982 15.3776 11.5453 15.3497 11.6823 15.2932C11.8193 15.2367 11.9432 15.1528 12.0465 15.0465C12.1528 14.9432 12.2367 14.8193 12.2932 14.6823C12.3497 14.5453 12.3776 14.3982 12.375 14.25C12.3776 14.1018 12.3497 13.9547 12.2932 13.8177C12.2367 13.6807 12.1528 13.5568 12.0465 13.4535C11.9432 13.3472 11.8193 13.2633 11.6823 13.2068C11.5453 13.1503 11.3982 13.1224 11.25 13.125C11.1018 13.1224 10.9547 13.1503 10.8177 13.2068C10.6807 13.2633 10.5568 13.3472 10.4535 13.4535C10.3472 13.5568 10.2633 13.6807 10.2068 13.8177C10.1503 13.9547 10.1224 14.1018 10.125 14.25ZM18.126 22.5V20.859C17.8711 20.7663 17.6334 20.632 17.4225 20.4615L16.005 21.27L15.255 19.98L16.662 19.1595C16.614 18.8881 16.614 18.6104 16.662 18.339L15.255 17.52L16.005 16.23L17.4225 17.04C17.649 16.86 17.8845 16.7265 18.1275 16.641V15H19.6275V16.641C19.8837 16.7297 20.1216 16.8644 20.3295 17.0385L21.747 16.23L22.497 17.52L21.0915 18.3405C21.1396 18.6114 21.1396 18.8886 21.0915 19.1595L22.497 19.98L21.747 21.27L20.3295 20.46C20.1163 20.6275 19.8791 20.762 19.626 20.859V22.5H18.126ZM17.751 18.75C17.751 19.062 17.8605 19.3275 18.0795 19.5465C18.1828 19.6528 18.3067 19.7367 18.4437 19.7932C18.5807 19.8497 18.7278 19.8776 18.876 19.875C19.0242 19.8776 19.1713 19.8497 19.3083 19.7932C19.4453 19.7367 19.5692 19.6528 19.6725 19.5465C19.779 19.4434 19.8633 19.3195 19.9201 19.1825C19.9768 19.0455 20.0049 18.8983 20.0025 18.75C20.0049 18.6017 19.9768 18.4545 19.9201 18.3175C19.8633 18.1805 19.779 18.0566 19.6725 17.9535C19.5694 17.8474 19.4457 17.7636 19.309 17.7071C19.1722 17.6506 19.0254 17.6226 18.8775 17.625C18.7291 17.6222 18.5817 17.65 18.4444 17.7065C18.3072 17.763 18.183 17.847 18.0795 17.9535C17.9732 18.0568 17.8893 18.1807 17.8328 18.3177C17.7763 18.4547 17.7484 18.6018 17.751 18.75Z"/>',
  ),
  skills: svgIcon(
    '0 0 19.13 24.62',
    '<path d="M.86,7.26l5.74,3.3,11.68-6.6"/><path d="M6.6,17.15v-6.6"/><path d="M1.32,14.34l4.62,2.64c.41.24.91.24,1.32,0l10.56-5.94"/><path d="M.66,20c0,.47.25.91.66,1.14l4.62,2.64c.41.24.91.24,1.32,0l10.56-5.94c.41-.24.66-.67.66-1.14V4.62c0-.47-.25-.91-.66-1.14L13.2.84c-.41-.24-.91-.24-1.32,0L1.32,6.78c-.41.24-.66.67-.66,1.14v12.08Z"/><path d="M.86,14.06l5.74,3.3,11.68-6.6"/><path d="M6.6,23.96v-6.6"/>',
    'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"',
  ),
  plugins: svgIcon(
    '0 0 24 24',
    '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    STROKE,
  ),
  apps: svgIcon(
    '0 0 24 24',
    '<rect width="7" height="7" x="14" y="3" rx="1"/><path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"/>',
    STROKE,
  ),
  extras: svgIcon(
    '0 0 24 24',
    '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
    STROKE,
  ),
};
const CUSTOMIZE_ITEMS = [
  ['/mcp', 'MCP Servers', NAV_ICONS.mcp],
  ['/skills', 'Skills', NAV_ICONS.skills],
  ['/plugins', 'Plugins', NAV_ICONS.plugins],
  ['/apps', 'Apps', NAV_ICONS.apps],
];

// A link to a Canvas path, which Canvas's router follows on a plain click.
function canvasLink(host, path, className, text = '') {
  const link = el('a', className, text);
  link.href = new URL(path.slice(1), canvasBase()).href;
  link.addEventListener('click', (event) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    host.navigate(path);
  });
  return link;
}

function navLink(host, path, label, icon, active) {
  const link = canvasLink(
    host,
    path,
    `${NAV_ROW_CLASS} ${active ? NAV_ACTIVE_CLASS : NAV_IDLE_CLASS}`,
  );
  link.setAttribute(OWN_ATTR, '');
  if (active) link.setAttribute('aria-current', 'page');
  link.innerHTML = `<span class="shrink-0 flex items-center justify-center">${icon}</span><span class="truncate"></span>`;
  link.lastElementChild.textContent = label;
  return link;
}

// Hide the settings page's sidebar link.
function sidebarLinks(name) {
  const css = `[data-testid="sidebar-canvas-extension-${name}-${SETTINGS_PAGE}"] { display: none !important; }`;
  return {
    refresh: () => setStyle(SIDEBAR_STYLE_ID, css),
    dispose: () => removeElement(SIDEBAR_STYLE_ID),
  };
}

// Add the settings page under Apps in Customize's menu, in its desktop
// sidebar and its compact menu alike.
function watchCustomizeMenu(host) {
  const path = pageHref(host.extension.name, SETTINGS_PAGE);
  const ours = () => document.querySelectorAll('[data-testid="sidebar-extensions-extras"]');
  function place() {
    if (!CUSTOMIZE_PAGE.test(location.pathname)) return;
    for (const apps of document.querySelectorAll('[data-testid="sidebar-extensions-/apps"]')) {
      if (apps.nextElementSibling?.dataset.testid === 'sidebar-extensions-extras') continue;
      const link = navLink(host, path, 'Extras', NAV_ICONS.extras, false);
      link.dataset.testid = 'sidebar-extensions-extras';
      apps.after(link);
    }
  }
  return {
    refresh: place,
    onDomChange: place,
    dispose: () => ours().forEach((link) => link.remove()),
  };
}

// The settings page: Customize's menu, as Canvas draws it on its own pages,
// beside the switches under their groups. Its reset button passes no
// settings, putting every switch back, and offers to undo that. Settings
// changed in another tab redraw the switches.
function settingsPage(host, onChange) {
  let list = null;
  let showShortcutsButton = null;
  // The settings before Reset, until you undo it or change one.
  let beforeReset = null;
  const change = (next) => {
    beforeReset = null;
    onChange(next);
  };

  function render() {
    if (!list) return;
    showShortcutsButton = textButton('extras-show-shortcuts', 'Show keyboard shortcuts', () =>
      showShortcuts?.(),
    );
    showShortcutsButton.hidden = !settings.keyboardShortcuts;
    const groups = SWITCH_GROUPS.map((group) =>
      pageSection(
        group,
        ...SWITCHES.filter((item) => item.group === group).map((item) =>
          (item.options ? buildChoice : buildSwitch)(item, change),
        ),
        ...(group === 'Chat' ? [showShortcutsButton] : []),
      ),
    );
    const reset = el(
      'div',
      'flex flex-wrap items-center gap-3',
      textButton('extras-reset-settings', 'Reset settings', () => {
        const before = settings;
        change(null);
        beforeReset = before;
        render();
      }),
    );
    if (beforeReset) {
      const status = el('span', 'text-sm text-tertiary-light', 'Every setting is back to its default.');
      status.setAttribute('role', 'status');
      reset.append(
        status,
        textButton('extras-undo-reset', 'Undo', () => {
          change(beforeReset);
          render();
        }),
      );
    }
    list.replaceChildren(...groups, reset);
  }

  function mount({ container }) {
    const name = host.extension.name;
    const own = el('div', 'flex min-w-0 flex-col gap-8');
    const header = pageHeader(
      'Extras',
      'Agent status in your tab and app icon, notifications, unread markers, a quieter chat and more. Settings are kept in this browser.',
    );
    // Customize's menu only shows on wide screens, as in Canvas.
    header.prepend(canvasLink(host, '/apps', 'lg:hidden text-sm text-link hover:underline', '← Customize'));
    const root = el(
      'div',
      'flex min-h-full gap-4 md:gap-6 md:pl-8 lg:gap-10 lg:pl-10',
      el(
        'aside',
        'hidden lg:flex lg:w-65 lg:shrink-0 lg:flex-col lg:gap-2 lg:sticky lg:top-8 lg:self-start',
        el('span', 'px-2 text-sm font-normal text-contrast', 'Customize'),
        el(
          'div',
          'flex flex-col gap-0.5 pt-0.5',
          ...CUSTOMIZE_ITEMS.map(([path, label, icon]) => navLink(host, path, label, icon, false)),
          navLink(host, pageHref(name, SETTINGS_PAGE), 'Extras', NAV_ICONS.extras, true),
        ),
      ),
      el(
        'div',
        'flex min-w-0 flex-1 flex-col px-4 pt-8 pb-12 lg:px-0 lg:pr-3.5',
        el('div', 'mx-auto flex w-full min-w-0 max-w-200 flex-col gap-6', header, own),
      ),
    );
    root.setAttribute(OWN_ATTR, '');
    list = own;
    render();
    container.append(root);
    // Canvas may clean up a mount after the next one has started.
    return () => {
      if (list === own) list = null;
      root.remove();
    };
  }

  return {
    mount,
    // Show keyboard shortcuts only shows while they're on.
    refresh() {
      if (showShortcutsButton) showShortcutsButton.hidden = !settings.keyboardShortcuts;
    },
    onStorage(key) {
      if (key === STORAGE_KEY) render();
    },
  };
}

// Extras: Agent Canvas tweaks, each a setting in settings.js, turned on from
// this app's settings page under Customize and saved in the browser's
// localStorage. The README says what each does. Canvas loads an app from one
// file, so these modules are built into extension.js.
//
// Each feature is an object with any of refresh() (settings changed),
// onDomChange(records), onStorage(key), check() and polling() (the shared
// Agent Server checks) and dispose(), which activate() calls. Hiding
// "Running" and "Reading" also reads the agent status's statusOf(), and hears
// of status changes through its onStatus().

// The running copy's dispose, on the page's window. Canvas disposes an app
// before activating it again; should a copy still be running anyway, the new
// one stops it first, as two copies folding the same chat would undo each
// other's work forever.
const INSTANCE = Symbol.for('openhands-extras');

function activate(host) {
  if (host.apiVersion !== '1') {
    throw new Error(`Extras requires host API 1, got ${host.apiVersion}.`);
  }
  window[INSTANCE]?.();
  loadSettings();
  let disposed = false;
  // A switch can finish changing after the app is disposed, e.g. once you
  // answer a permission prompt.
  const settingsView = settingsPage(host, (next) => {
    if (disposed) return;
    saveSettings(next);
    each('refresh');
  });
  // Before anything starts, as Canvas throws for a page its copy of the
  // manifest doesn't declare.
  const unregisterSettings = host.registerPage(SETTINGS_PAGE, settingsView.mount);
  // Hiding "Running" and "Reading" pulses on the open conversation's status.
  // The status and unread checks run together, so their loads share one
  // request.
  const loadConversations = conversationLoader(host);
  // Checks poll while any feature wants them to.
  let poll = 0;
  const checks = throttle(async () => {
    await Promise.allSettled(features.map((feature) => feature.check?.()));
    clearTimeout(poll);
    poll = !disposed && features.some((feature) => feature.polling?.())
      ? setTimeout(checks.request, checkMs())
      : 0;
  }, checkMs);
  const collapseActivity = watchCollapseActivity((id) => agentStatus.statusOf(id));
  const agentStatus = watchAgentStatus(host, loadConversations, checks, () =>
    collapseActivity.onStatus(),
  );
  const features = [
    watchCustomizeMenu(host),
    sidebarLinks(host.extension.name),
    settingsView,
    styleSwitch('wideChat', WIDE_CHAT_CSS),
    styleSwitch('focusedNewChat', FOCUSED_NEW_CHAT_CSS),
    styleSwitch('mobileFixes', MOBILE_FIXES_CSS),
    fontSize(),
    styleSwitch('reduceMotion', REDUCE_MOTION_CSS),
    styleSwitch('clearFocus', CLEAR_FOCUS_CSS),
    styleSwitch('biggerTapTargets', BIGGER_TAP_TARGETS_CSS),
    watchResponsiveTables(),
    agentStatus,
    watchUnread(loadConversations, checks),
    installableApp(host),
    collapseActivity,
    keyboardShortcuts(host, loadConversations),
  ];
  function each(method, ...args) {
    for (const feature of features) feature[method]?.(...args);
  }
  // Settings changed in another tab apply here too.
  const onStorage = ({ key }) => {
    if (key === STORAGE_KEY) loadSettings();
    each('onStorage', key);
    if (key === STORAGE_KEY) each('refresh');
  };
  window.addEventListener('storage', onStorage);
  const onInput = () => {
    if (settings.notificationSounds) unlockAudio();
  };
  for (const type of ['pointerdown', 'keydown']) {
    window.addEventListener(type, onInput, true);
  }
  each('refresh');
  // One body observer for all: Canvas renders Customize's menu, re-renders
  // the chat as a run's events stream in, and may re-mount its themed root. Changes to only our own elements are the features'
  // doing, and would just run them again for nothing.
  //
  // Canvas keeps rendering in a hidden tab, where nobody sees the page: only
  // the agent status hears of changes there, to check runs it follows, and
  // the rest catch up once the tab shows again.
  let missed = false;
  const observer = new MutationObserver((records) => {
    if (records.every(ownChange)) return;
    if (document.hidden) {
      missed = true;
      agentStatus.onDomChange();
    } else {
      each('onDomChange', records);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const onVisibility = () => {
    if (document.hidden || !missed) return;
    missed = false;
    each('onDomChange');
  };
  document.addEventListener('visibilitychange', onVisibility);
  // Each feature cleans up even if one before it fails, whose error is then
  // passed on for Canvas to report.
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (window[INSTANCE] === dispose) delete window[INSTANCE];
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    checks.cancel();
    clearTimeout(poll);
    unregisterSettings?.();
    window.removeEventListener('storage', onStorage);
    for (const type of ['pointerdown', 'keydown']) {
      window.removeEventListener(type, onInput, true);
    }
    let failure = null;
    for (const feature of features) {
      try {
        feature.dispose?.();
      } catch (error) {
        failure ??= error;
      }
    }
    closeAudio();
    if (failure) throw failure;
  };
  window[INSTANCE] = dispose;
  return dispose;
}

export { activate };
