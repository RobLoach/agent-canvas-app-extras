// Checks of conversations on the Agent Server, shared by the features that
// need them.

import { conversationKey } from './canvas.js';
import { settings, SWITCHES } from './settings.js';

// Status and unread checks run together, sharing one request, at most once
// per Check for changes every, and poll that often while a run is going,
// while counting the conversations waiting for confirmation, and for the
// sidebar's changes.
const CHECK_INTERVALS = SWITCHES.find(({ key }) => key === 'checkInterval').options;
export const checkMs = () =>
  CHECK_INTERVALS.find(([value]) => value === settings.checkInterval)?.[2] ?? 10000;

// Conversations from the Agent Server, by id, with every load asked for at
// the same moment, e.g. by the agent status and unread markers on the same
// page change, sharing one request. Missing conversations are null.
export function conversationLoader(host) {
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
export function throttle(task, gap) {
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
