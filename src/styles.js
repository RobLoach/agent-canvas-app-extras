// Features that are only a style: Wide canvas, Mobile fixes and the
// accessibility settings.

import { removeElement, setStyle } from './dom.js';
import { settings, SWITCHES } from './settings.js';

// The chat thread is the only max-w-200 element that is also h-full, so the
// Customize, Settings and home launcher columns keep their width. Unlayered
// CSS beats Tailwind's @layer utilities regardless of specificity.
export const WIDE_CHAT_CSS =
  '[data-agent-server-ui] .max-w-200.h-full.min-h-0 { max-width: none; }';

// The new chat page (HomeChatLauncher) puts its heading and tagline
// (HomeHeaderTitle) above the message box, and starts 28% of the way down
// the page, or further while a new chat starts.
export const FOCUSED_NEW_CHAT_CSS = `
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
export const MOBILE_FIXES_CSS = `
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

export function fontSize() {
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
export const REDUCE_MOTION_CSS = `
*, *::before, *::after {
  animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
  animation-delay: 0s !important; transition-duration: 0.01ms !important;
  transition-delay: 0s !important; scroll-behavior: auto !important;
}`;

// Canvas underlines some links only on hover, and takes the outline off many
// controls, or draws a faint 1px ring.
export const CLEAR_FOCUS_CSS = `
a[href].hover\\:underline { text-decoration-line: underline; text-underline-offset: 2px; }
:focus-visible {
  outline: 3px solid var(--color-focus, Highlight) !important; outline-offset: 2px !important;
}`;

// 44px, as WCAG 2.5.5 asks, for controls; inline links in text are left as
// they are, as min-height doesn't apply to them.
export const BIGGER_TAP_TARGETS_CSS = `
@media (pointer: coarse) {
  button, [role="button"], a[href], select, summary { min-height: 2.75rem; }
  button[aria-label], [role="button"][aria-label] { min-width: 2.75rem; }
}`;

// A switch that's only a style, added while it's on, as
// openhands-extras-<key in kebab case>.
export function styleSwitch(key, css) {
  const id = `openhands-extras-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  return {
    refresh: () => (settings[key] ? setStyle(id, css) : removeElement(id)),
    dispose: () => removeElement(id),
  };
}
