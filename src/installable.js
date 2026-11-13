// Installable app.

import {
  headElement,
  removeElement,
  setAttribute,
  setProperty,
  setStyle,
} from './dom.js';
import {
  canvasBackground,
  canvasBase,
  canvasManifest,
  MANIFEST_ID,
  themeRoot,
} from './canvas.js';
import { settings } from './settings.js';

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

export function installableApp(host) {
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
  let disposed = false;
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
      // Turned off, or disposed, while the icon loaded.
      if (pngsFor !== svgUrl || !settings.installableApp || disposed) return;
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

  // Icons are drawn again when it's next on, as a load it was turned off
  // during is dropped.
  function remove() {
    built = null;
    pngsFor = null;
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
    if (root) {
      rootObserver.observe(root, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-color-theme'],
      });
    }
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
      disposed = true;
      rootObserver.disconnect();
      scheme?.removeEventListener?.('change', apply);
      remove();
      if (launches) window.launchQueue.setConsumer(() => {});
    },
  };
}
