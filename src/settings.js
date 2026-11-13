// The settings: each feature's switch, kept in localStorage.

import { installProblem } from './canvas.js';
import { readJson, STORAGE_KEY, writeJson } from './storage.js';
import { unlockAudio } from './audio.js';
import {
  notificationProblem,
  requestNotificationPermission,
} from './notifications.js';

// A switch with options is a choice between them instead, starting at its
// default. check() says why a switch can't work, e.g. after a permission was
// revoked; enable(), which defaults to check(), may also ask the browser for
// what it needs.
// status is 'follow' for a feature that needs conversation statuses, and
// 'count' for one that also needs how many conversations need your input.
// The settings page lists them under their group, in this order.
export const SWITCH_GROUPS = ['Chat', 'Status and notifications', 'Accessibility', 'App'];
export const SWITCHES = [
  {
    key: 'wideCanvas',
    group: 'Chat',
    label: 'Wide canvas',
    description: 'Let the chat window use the full width of the canvas.',
  },
  {
    key: 'responsiveTables',
    group: 'Chat',
    label: 'Responsive tables',
    description:
      "Stack a table's cells under their headings while it's too wide for the chat.",
  },
  {
    key: 'quietActivity',
    group: 'Chat',
    status: 'follow',
    label: 'Collapse agent activity',
    description:
      'Fold the agent\'s "Running" and "Reading" entries in the chat into "Thinking", which expands to show them.',
  },
  {
    key: 'keyboardShortcuts',
    group: 'Chat',
    label: 'Keyboard shortcuts',
    description:
      'Press ? to list them: / focuses the message box, Alt+↑ and Alt+↓ open the previous or next conversation, even from the message box, and Alt+N starts a new chat.',
  },
  {
    key: 'tabStatus',
    group: 'Status and notifications',
    status: 'count',
    label: 'Tab status',
    description:
      "Show the agent's status in the browser tab's title and icon, and how many conversations need your input on the installed app's icon.",
  },
  {
    key: 'notifications',
    group: 'Status and notifications',
    status: 'follow',
    label: 'Desktop notifications',
    description:
      'Notify you when the agent finishes or needs you while this tab is in the background.',
    check: notificationProblem,
    enable: requestNotificationPermission,
  },
  {
    key: 'confirmationSound',
    group: 'Status and notifications',
    status: 'follow',
    label: 'Notification sounds',
    description:
      'Play a chime when the agent needs your confirmation while this tab is in the background.',
    enable: unlockAudio,
  },
  {
    key: 'unreadMarkers',
    group: 'Status and notifications',
    label: 'Unread markers',
    description:
      'Mark the conversations in the sidebar that changed since you last had them open.',
  },
  {
    key: 'fontSize',
    group: 'Accessibility',
    label: 'Font size',
    description:
      "Make Canvas's text, and the space around it, smaller or larger in this browser.",
    // Choices as [value, label, the page's root font size].
    options: [
      ['small', 'Smaller', '90%'],
      ['default', 'Default', null],
      ['large', 'Larger', '112.5%'],
      ['larger', 'Even larger', '125%'],
      ['largest', 'Largest', '150%'],
    ],
    default: 'default',
  },
  {
    key: 'reduceMotion',
    group: 'Accessibility',
    label: 'Reduce motion',
    description:
      "Stop Canvas's spinners, pulses, fades and slides, whatever your system's motion setting.",
  },
  {
    key: 'clearFocus',
    group: 'Accessibility',
    label: 'Clear links and focus',
    description:
      'Underline every link, not only on hover, and outline what has keyboard focus in a thick ring.',
  },
  {
    key: 'largerTargets',
    group: 'Accessibility',
    label: 'Bigger tap targets',
    description:
      'Make buttons and sidebar rows at least 44 pixels tall on touch screens, so they are easier to tap.',
  },
  {
    key: 'installableApp',
    group: 'App',
    label: 'Installable app',
    description:
      "Let your browser install Canvas as an app, with New chat and Settings shortcuts and a title bar in Canvas's colours, clear of notches and home indicators.",
    check: installProblem,
  },
  {
    key: 'mobileFixes',
    group: 'App',
    label: 'Mobile fixes',
    description:
      "On phones and tablets: keep the message box above the browser's toolbar, open the sidebar across the whole screen, show buttons that otherwise only appear on hover, keep dialogs on screen, and stop the Automate tabs cutting off their names.",
  },
  {
    key: 'usagePage',
    group: 'App',
    label: 'Usage page',
    description:
      'Add a Usage page to the sidebar, with what your conversations cost over a period, by model and by conversation.',
  },
];
const DEFAULT_SETTINGS = Object.fromEntries(
  SWITCHES.map((item) => [item.key, item.options ? item.default : false]),
);

export let settings = DEFAULT_SETTINGS;

// Switches since merged into others turn those on.
const MERGED_SWITCHES = { appBadge: 'tabStatus', themeColor: 'installableApp' };

export function loadSettings() {
  const stored = { ...readJson(STORAGE_KEY, {}) };
  for (const [old, key] of Object.entries(MERGED_SWITCHES)) {
    if (stored[old]) stored[key] = true;
    delete stored[old];
  }
  settings = { ...DEFAULT_SETTINGS, ...stored };
  for (const item of SWITCHES) {
    const value = settings[item.key];
    if (item.options && !item.options.some(([option]) => option === value)) {
      settings[item.key] = item.default;
    }
  }
}

// Saves the settings, or with none, removes them, turning every feature off.
export function saveSettings(next) {
  settings = next ?? DEFAULT_SETTINGS;
  writeJson(STORAGE_KEY, next ?? null);
}
