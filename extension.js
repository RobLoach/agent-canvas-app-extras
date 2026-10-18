const STORAGE_KEY = 'openhands-extras:settings';
const STYLE_ID = 'openhands-extras-wide-canvas';
const SECTION_ID = 'openhands-extras-settings';

// The chat thread is the only max-w-200 element that is also h-full, so the
// Customize, Settings and home launcher columns keep their width. Unlayered
// CSS beats Tailwind's @layer utilities regardless of specificity.
const WIDE_CANVAS_CSS =
  '[data-agent-server-ui] .max-w-200.h-full.min-h-0 { max-width: none; }';

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

function readSettings() {
  try {
    return {
      wideCanvas: false,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'),
    };
  } catch {
    return { wideCanvas: false };
  }
}

function applySettings({ wideCanvas }) {
  let style = document.getElementById(STYLE_ID);
  if (wideCanvas && !style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = WIDE_CANVAS_CSS;
    document.head.append(style);
  } else if (!wideCanvas && style) {
    style.remove();
  }
}

function writeSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  applySettings(settings);
}

function buildSection() {
  const section = document.createElement("section");
  section.id = SECTION_ID;
  section.className = 'flex min-w-0 flex-col gap-2 border-t border-border pt-3';
  section.innerHTML = `
    <label class="flex items-center gap-2 rounded-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus w-fit cursor-pointer">
      <input class="sr-only" type="checkbox" data-testid="extras-wide-canvas-switch" />
      <span aria-hidden="true"><span></span></span>
      <div class="flex items-center gap-1">
        <span class="text-sm">Wide Canvas</span>
      </div>
    </label>
    <p class="text-xs leading-relaxed text-tertiary-light">
      Let the chat window use the full width of the canvas.
    </p>`;

  const input = section.querySelector('input');
  const track = input.nextElementSibling;
  const render = () => {
    track.className = `${TRACK_CLASS} ${input.checked ? TRACK_ON_CLASS : TRACK_OFF_CLASS}`;
    track.firstElementChild.className = `${THUMB_CLASS} ${input.checked ? THUMB_ON_CLASS : THUMB_OFF_CLASS}`;
  };
  input.checked = readSettings().wideCanvas;
  render();
  input.addEventListener("change", () => {
    writeSettings({ ...readSettings(), wideCanvas: input.checked });
    render();
  });
  return section;
}

// App cards on Customize > Apps have no host API for settings, so add a
// section above this app's card footer. React may insert its own nodes
// before the footer later, so re-place the section whenever it's displaced.
function placeSection(cardSelector) {
  // Skip the DOM search everywhere but Customize > Apps (e.g. while chatting).
  if (!/\/apps\/?$/.test(location.pathname)) return;
  const footer = document.querySelector(`${cardSelector} > footer`);
  if (!footer || footer.previousElementSibling?.id === SECTION_ID) return;
  document.getElementById(SECTION_ID)?.remove();
  footer.before(buildSection());
}

function watchAppCard(name) {
  const cardSelector = `article[data-testid="canvas-extension-card-${name}"]`;
  let frame = 0;
  const observer = new MutationObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      placeSection(cardSelector);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  placeSection(cardSelector);
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    document.getElementById(SECTION_ID)?.remove();
  };
}

export function activate(host) {
  if (host.apiVersion !== "1") {
    throw new Error(`Extras requires host API 1, got ${host.apiVersion}.`);
  }
  applySettings(readSettings());
  const unwatch = watchAppCard(host.extension.name);
  return () => {
    unwatch();
    applySettings({ wideCanvas: false });
  };
}
