import { JSDOM } from 'jsdom';

let loads = 0;

// A Canvas-like page in jsdom, installed as the globals extension.js uses,
// with controls for the browser state jsdom can't produce on its own. It's
// torn down after the test `t`: the app is disabled before the window closes,
// as closing it empties the page under the app's observers.
export function setupPage(
  t,
  { url = 'https://canvas.test/apps', head = '', body = '' } = {},
) {
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
    navigate(path) {
      window.history.pushState({}, '', path);
    },
    // Any DOM change, like Canvas rendering a chat event.
    mutate() {
      window.document.body.append(window.document.createElement('div'));
    },
    // Re-check the agent status now instead of waiting out the 3 second gap
    // between checks: a settings change from another tab triggers one.
    checkNow() {
      window.dispatchEvent(
        new window.StorageEvent('storage', { key: 'openhands-extras:settings' }),
      );
    },
    returnToTab() {
      page.hidden = false;
      page.focused = true;
      window.document.dispatchEvent(new window.Event('visibilitychange'));
      window.dispatchEvent(new window.Event('focus'));
    },
    dispose: () => {},
  });
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

// A fresh copy of extension.js per test, since it keeps module-level state.
// Returns the app's disposer, which is safe to call before the teardown.
export async function activateExtension(page, host) {
  loads += 1;
  const { activate } = await import(`../extension.js?load=${loads}`);
  const dispose = activate(host);
  let disposed = false;
  page.dispose = () => {
    if (!disposed) dispose();
    disposed = true;
  };
  return page.dispose;
}

export const settle = (ms = 20) =>
  new Promise((resolve) => setTimeout(resolve, ms));
