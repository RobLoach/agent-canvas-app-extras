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
export const SWITCH_GROUPS = ['Chat', 'Notifications', 'Accessibility', 'Phone and app', 'Pages'];
export const SWITCHES = [
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
  {
    key: 'usagePage',
    group: 'Pages',
    label: 'Usage page',
    description: 'Add a Usage page to the sidebar, with what your conversations cost.',
  },
];
const DEFAULT_SETTINGS = Object.fromEntries(
  SWITCHES.map((item) => [item.key, item.options ? item.default : false]),
);

export let settings = DEFAULT_SETTINGS;

// Each switch's stored value, or its default where there's none, or it's
// not one of its choices.
export function loadSettings() {
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
export function saveSettings(next) {
  settings = next ?? DEFAULT_SETTINGS;
  writeJson(STORAGE_KEY, next ?? null);
}
