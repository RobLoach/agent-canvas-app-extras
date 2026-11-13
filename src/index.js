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
import { ownChange } from './dom.js';
import { STORAGE_KEY } from './storage.js';
import { loadSettings, saveSettings, settings } from './settings.js';
import { closeAudio, unlockAudio } from './audio.js';
import { CHECK_MS, conversationLoader, throttle } from './checks.js';
import { watchAgentStatus } from './status.js';
import { watchUnread } from './unread.js';
import { watchQuietActivity } from './quiet-activity.js';
import { watchResponsiveTables } from './tables.js';
import { installableApp } from './installable.js';
import {
  CLEAR_FOCUS_CSS,
  fontSize,
  LARGER_TARGETS_CSS,
  MOBILE_FIXES_CSS,
  REDUCE_MOTION_CSS,
  styleSwitch,
  WIDE_CANVAS_CSS,
} from './styles.js';
import {
  SETTINGS_PAGE,
  settingsPage,
  sidebarLinks,
  USAGE_PAGE,
  watchCustomizeMenu,
} from './pages.js';
import { keyboardShortcuts } from './shortcuts.js';
import { usagePage } from './usage.js';

// The running copy's dispose, on the page's window. Canvas disposes an app
// before activating it again; should a copy still be running anyway, the new
// one stops it first, as two copies folding the same chat would undo each
// other's work forever.
const INSTANCE = Symbol.for('openhands-extras');

export function activate(host) {
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
  const unregisterPages = [
    host.registerPage(SETTINGS_PAGE, settingsView.mount),
    host.registerPage(USAGE_PAGE, usagePage(host).mount),
  ];
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
      ? setTimeout(checks.request, CHECK_MS)
      : 0;
  }, CHECK_MS);
  const quietActivity = watchQuietActivity((id) => agentStatus.statusOf(id));
  const agentStatus = watchAgentStatus(host, loadConversations, checks, () =>
    quietActivity.onStatus(),
  );
  const features = [
    watchCustomizeMenu(host),
    sidebarLinks(host.extension.name),
    settingsView,
    styleSwitch('wideCanvas', WIDE_CANVAS_CSS),
    styleSwitch('mobileFixes', MOBILE_FIXES_CSS),
    fontSize(),
    styleSwitch('reduceMotion', REDUCE_MOTION_CSS),
    styleSwitch('clearFocus', CLEAR_FOCUS_CSS),
    styleSwitch('largerTargets', LARGER_TARGETS_CSS),
    watchResponsiveTables(),
    agentStatus,
    watchUnread(loadConversations, checks),
    installableApp(host),
    quietActivity,
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
    if (settings.confirmationSound) unlockAudio();
  };
  for (const type of ['pointerdown', 'keydown']) {
    window.addEventListener(type, onInput, true);
  }
  each('refresh');
  // One body observer for all: Canvas renders the app card on Customize >
  // Apps, re-renders the chat as a run's events stream in, and may re-mount
  // its themed root. Changes to only our own elements are the features'
  // doing, and would just run them again for nothing.
  const observer = new MutationObserver((records) => {
    if (!records.every(ownChange)) each('onDomChange', records);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  // Each feature cleans up even if one before it fails, whose error is then
  // passed on for Canvas to report.
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (window[INSTANCE] === dispose) delete window[INSTANCE];
    observer.disconnect();
    checks.cancel();
    clearTimeout(poll);
    for (const unregister of unregisterPages) unregister?.();
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
