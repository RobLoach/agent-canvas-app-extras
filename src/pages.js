// The settings page, its place in Customize's menu, and the switches it
// shows.

import {
  el,
  HAS_FOCUS_RING,
  OWN_ATTR,
  pageHeader,
  pageSection,
  pillClass,
  removeElement,
  setStyle,
  textButton,
} from './dom.js';
import { canvasBase } from './canvas.js';
import { STORAGE_KEY } from './storage.js';
import { settings, SWITCH_GROUPS, SWITCHES } from './settings.js';
import { showShortcuts } from './shortcuts.js';

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

// A choice as a row of radio buttons, drawn as pills.
function buildChoice(item, onChange) {
  const row = el('div', 'flex flex-wrap gap-2');
  const hint = el('p', 'text-xs leading-relaxed text-tertiary-light', item.description);
  hint.id = `extras-${item.key}-hint`;
  const block = el('fieldset', 'flex min-w-0 flex-col gap-2', el('legend', 'text-sm', item.label), row, hint);
  const render = () => {
    for (const label of row.children) {
      label.className = pillClass(label.firstElementChild.checked, HAS_FOCUS_RING);
    }
  };
  for (const [value, text] of item.options) {
    const label = document.createElement('label');
    label.innerHTML = `<input class="sr-only" type="radio" name="extras-${item.key}" aria-describedby="extras-${item.key}-hint" data-testid="extras-${item.key}-${value}" />`;
    const input = label.firstElementChild;
    input.value = value;
    input.checked = settings[item.key] === value;
    input.addEventListener('change', () => {
      render();
      onChange({ ...settings, [item.key]: value });
    });
    label.append(text);
    row.append(label);
  }
  render();
  return block;
}

function buildSwitch(item, onChange) {
  const block = document.createElement('div');
  block.className = 'flex min-w-0 flex-col gap-1';
  block.innerHTML = `
    <label class="flex items-center gap-2 rounded-sm ${HAS_FOCUS_RING} w-fit cursor-pointer">
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

// The app's pages, as declared in canvas-extension.json, which Canvas serves
// under /extensions/<app name>/ and links from its sidebar. The settings
// page's link is hidden there and goes under Apps in Customize's menu
// instead; the usage page's shows while its switch is on.
export const SETTINGS_PAGE = 'settings';
export const USAGE_PAGE = 'usage';
export const pageHref = (name, page) => `/extensions/${name}/${page}`;
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
export function canvasLink(host, path, className, text = '') {
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

// Hide the settings page's sidebar link always, and the usage page's while
// it's off.
export function sidebarLinks(name) {
  const link = (page) => `[data-testid="sidebar-canvas-extension-${name}-${page}"]`;
  const apply = () => {
    const hidden = [link(SETTINGS_PAGE), ...(settings.usagePage ? [] : [link(USAGE_PAGE)])];
    setStyle(SIDEBAR_STYLE_ID, `${hidden.join(', ')} { display: none !important; }`);
  };
  return { refresh: apply, dispose: () => removeElement(SIDEBAR_STYLE_ID) };
}

// Add the settings page under Apps in Customize's menu, in its desktop
// sidebar and its compact menu alike.
export function watchCustomizeMenu(host) {
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
// settings, turning every switch off. Settings changed in another tab redraw
// the switches.
export function settingsPage(host, onChange) {
  let list = null;

  function render() {
    if (!list) return;
    const groups = SWITCH_GROUPS.map((group) =>
      pageSection(
        group,
        ...SWITCHES.filter((item) => item.group === group).map((item) =>
          (item.options ? buildChoice : buildSwitch)(item, onChange),
        ),
        ...(group === 'Chat'
          ? [
              textButton(
                'extras-show-shortcuts',
                'Show keyboard shortcuts',
                () => showShortcuts?.(),
                'text-link hover:underline',
              ),
            ]
          : []),
      ),
    );
    const reset = textButton('extras-reset-settings', 'Reset settings', () => {
      onChange(null);
      render();
    });
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
    onStorage(key) {
      if (key === STORAGE_KEY) render();
    },
  };
}
