// What this app reads from Canvas's page: its conversations, language,
// theme and base path.

export const MANIFEST_ID = 'openhands-extras-manifest';
const CONVERSATION_PATH = /\/conversations\/([0-9a-f-]{32,36})(?:\/|$)/i;

// The Agent Server's ids drop the dashes Canvas's links may have, so ids are
// kept that way, one per conversation.
export const conversationKey = (id) => id.replaceAll('-', '').toLowerCase();
export const openConversationId = () => {
  const id = location.pathname.match(CONVERSATION_PATH)?.[1];
  return id ? conversationKey(id) : null;
};

// A browser window behind another app often still counts as visible.
export const away = () => document.hidden || !document.hasFocus();

// Canvas keeps its UI language on <html lang>, and its translations at
// /locales, which are fetched once per language. A failed fetch gives none,
// leaving the English.
export const canvasLanguage = () => document.documentElement.lang || 'en';
const translations = new Map();

export function canvasTranslations(language) {
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
export const themeRoot = () =>
  document.querySelector('[data-agent-server-ui][data-color-theme]') ??
  document.querySelector('[data-agent-server-ui]');

// The first opaque background from Canvas's themed root outwards.
export function canvasBackground() {
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

export const canvasManifest = () =>
  document.head.querySelector(`link[rel~="manifest"]:not(#${MANIFEST_ID})`);

export function installProblem() {
  return canvasManifest() ? 'Canvas is already installable.' : null;
}

// Canvas's mount point, as React Router has it, e.g. "/" or "/canvas/".
export function canvasBase() {
  const basename = window.__reactRouterContext?.basename ?? '/';
  return new URL(basename.endsWith('/') ? basename : `${basename}/`, location.origin)
    .href;
}

// Edit the <title>'s text node in place: replacing it (document.title = …)
// would detach the node React updates and freeze Canvas's own titles.
export function setTitle(text) {
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

export function sidebarConversations() {
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
