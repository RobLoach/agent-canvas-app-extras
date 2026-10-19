import { JSDOM } from 'jsdom';

// Conversations, and the request for how many wait for confirmation.
export const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
export const COUNT_PATH =
  '/api/conversations/count?status=waiting_for_confirmation';
// The app checks statuses at most this often, as its STATUS_MIN_GAP_MS.
const CHECK_GAP_MS = 3000;

let loads = 0;

// Lets pending promises, observer callbacks and jsdom's own events run,
// without moving the mocked clock.
export async function flush() {
  for (let turn = 0; turn < 5; turn++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

// A Canvas-like page in jsdom, installed as the globals extension.js uses,
// with controls for the browser state jsdom can't produce on its own, and a
// mocked clock. It's torn down after the test `t`: the app is disabled before
// the window closes, as closing it empties the page under the app's
// observers.
export function setupPage(
  t,
  { url = 'https://canvas.test/apps', head = '', body = '', settings } = {},
) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
  const dom = new JSDOM(
    `<!doctype html><html><head>${head}</head><body>${body}</body></html>`,
    { url },
  );
  const { window } = dom;
  const page = {
    window,
    document: window.document,
    hidden: false,
    focused: true,
    permission: 'granted',
    permissionAnswer: 'granted',
    notifications: [],
    fetched: [],
    tones: [],
    badge: undefined,
    audioClosed: false,
  };

  Object.defineProperty(window.document, 'hidden', { get: () => page.hidden });
  window.document.hasFocus = () => page.focused;
  window.focus = () => {};
  Object.defineProperty(window, 'isSecureContext', { value: true });
  window.Notification = class {
    static get permission() {
      return page.permission;
    }
    static async requestPermission() {
      page.permission = page.permissionAnswer;
      return page.permission;
    }
    constructor(title, options) {
      this.title = title;
      this.options = options;
      page.notifications.push(this);
    }
    close() {
      this.closed = true;
    }
  };

  window.navigator.setAppBadge = async (count) => {
    page.badge = count;
  };
  window.navigator.clearAppBadge = async () => {
    page.badge = 0;
  };

  // Records the tones the app plays; jsdom has no Web Audio.
  window.AudioContext = class {
    currentTime = 0;
    destination = {};
    resume() {}
    close() {
      page.audioClosed = true;
      return Promise.resolve();
    }
    createGain() {
      const ramp = () => {};
      return { gain: { setValueAtTime: ramp, exponentialRampToValueAtTime: ramp }, connect: (node) => node };
    }
    createOscillator() {
      const oscillator = {
        frequency: {},
        connect: (node) => node,
        start: () => page.tones.push(oscillator.frequency.value),
        stop() {},
      };
      return oscillator;
    }
  };

  Object.assign(globalThis, {
    window,
    document: window.document,
    localStorage: window.localStorage,
    MutationObserver: window.MutationObserver,
    Node: window.Node,
    FileReader: window.FileReader,
    Notification: window.Notification,
    fetch: async (fetchUrl) => {
      page.fetched.push(fetchUrl);
      return {
        ok: true,
        blob: async () =>
          new window.Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], {
            type: 'image/svg+xml',
          }),
      };
    },
  });
  Object.defineProperty(globalThis, 'location', {
    get: () => window.location,
    configurable: true,
  });

  Object.assign(page, {
    settings(values) {
      window.localStorage.setItem(
        'openhands-extras:settings',
        JSON.stringify(values),
      );
    },
    // Settings changed in another tab, which applies them here too.
    async changeSettings(values) {
      page.settings(values);
      window.dispatchEvent(
        new window.StorageEvent('storage', { key: 'openhands-extras:settings' }),
      );
      await flush();
    },
    navigate(path) {
      window.history.pushState({}, '', path);
    },
    // Any DOM change, like Canvas rendering a chat event.
    mutate() {
      window.document.body.append(window.document.createElement('div'));
    },
    // Time passes.
    async wait(ms) {
      t.mock.timers.tick(ms);
      await flush();
    },
    // Canvas updates the page after the gap between status checks, so the
    // app checks again.
    async check() {
      t.mock.timers.tick(CHECK_GAP_MS);
      page.mutate();
      await flush();
    },
    returnToTab() {
      page.hidden = false;
      page.focused = true;
      window.document.dispatchEvent(new window.Event('visibilitychange'));
      window.dispatchEvent(new window.Event('focus'));
    },
    dispose: () => {},
  });
  if (settings) page.settings(settings);
  t.after(() => {
    page.dispose();
    window.close();
  });
  return page;
}

// A host as Canvas passes to activate(), backed by fake conversations.
export function fakeHost({ statuses = {}, titles = {}, finalResponse = '' } = {}) {
  const host = {
    apiVersion: '1',
    extension: { name: 'agent-canvas-app-extras', version: '0.0.0', resolvedRef: null },
    backend: { id: 'test', kind: 'local', orgId: null },
    statuses,
    titles,
    requests: [],
    navigations: [],
    navigate: (path) => host.navigations.push(path),
    agentServer: {
      async request({ path }) {
        host.requests.push(path);
        const url = new URL(path, 'https://agent.test');
        if (url.pathname.endsWith('/agent_final_response')) {
          return { response: finalResponse };
        }
        // GET /api/conversations/count?status=…, over every conversation.
        if (url.pathname.endsWith('/count')) {
          const status = url.searchParams.get('status');
          return Object.values(host.statuses).filter((s) => s === status).length;
        }
        // GET /api/conversations?ids=…, as the Agent Server's batch endpoint.
        return url.searchParams.getAll('ids').map((id) => ({
          execution_status: host.statuses[id] ?? 'idle',
          title: host.titles[id] ?? null,
        }));
      },
    },
  };
  return host;
}

// A fresh copy of extension.js per test, as Canvas imports one per
// activation, so the translations it caches don't carry over. Returns the
// app's disposer, which is safe to call before the teardown.
export async function activateExtension(page, host) {
  loads += 1;
  const { activate } = await import(`../extension.js?load=${loads}`);
  const dispose = activate(host);
  let disposed = false;
  page.dispose = () => {
    if (!disposed) dispose();
    disposed = true;
  };
  await flush();
  return page.dispose;
}

// The app running on a Canvas page at `path`, with a host backed by fake
// conversations. before(page) sets the page up first, e.g. its storage.
export async function start(
  t,
  { path = '/apps', statuses, titles, finalResponse, before, ...pageOptions } = {},
) {
  const page = setupPage(t, { url: `https://canvas.test${path}`, ...pageOptions });
  const host = fakeHost({ statuses, titles, finalResponse });
  before?.(page);
  await activateExtension(page, host);
  return { page, host };
}
