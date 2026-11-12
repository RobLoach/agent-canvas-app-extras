import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, flush, setupPage } from './helpers.js';

const URL = 'https://canvas.test/extensions/agent-canvas-app-extras/usage';
const NOW = Date.now() / 1000;
const DAY = 24 * 60 * 60;

// A conversation as the Agent Server's search lists it, with its LLM calls'
// costs, each `days` ago.
const conversation = (id, title, calls, extra = {}) => ({
  id,
  title,
  updated_at: new Date().toISOString(),
  stats: {
    usage_to_metrics: {
      agent: {
        model_name: extra.model ?? 'claude-opus',
        accumulated_cost: calls.reduce((sum, [cost]) => sum + cost, 0),
        accumulated_token_usage: { prompt_tokens: 1000, completion_tokens: 500, cache_read_tokens: 1500 },
        costs: calls.map(([cost, days]) => ({ cost, timestamp: NOW - days * DAY })),
      },
    },
  },
  ...extra.info,
});

// The usage page, mounted as Canvas does, over these search pages.
async function openUsage(t, pages, settings = { usagePage: true }) {
  const page = setupPage(t, { url: URL, settings });
  const host = fakeHost();
  host.agentServer.request = async ({ path }) => {
    host.requests.push(path);
    const pageId = new globalThis.URL(path, 'https://agent.test').searchParams.get('page_id');
    const index = pageId ? Number(pageId) : 0;
    if (pages[index] instanceof Error) throw pages[index];
    return { items: pages[index], next_page_id: index + 1 < pages.length ? String(index + 1) : null };
  };
  await activateExtension(page, host);
  const container = page.document.createElement('div');
  page.document.body.append(container);
  const unmount = host.pages.get('usage')({ container, path: '', navigate: host.navigate });
  await flush();
  return { page, host, container, unmount };
}

const tiles = (container) =>
  [...container.querySelectorAll('dd')].map((dd) => dd.textContent);
const rows = (container, section) =>
  [...container.querySelectorAll('section')]
    .find((element) => element.querySelector('h3').textContent === section)
    .querySelectorAll('tbody tr');
const choose = async (container, period) => {
  container.querySelector(`[data-period="${period}"]`).click();
  await flush();
};

test('totals the costs in the last 30 days, by model and by conversation', async (t) => {
  const { container, host } = await openUsage(t, [
    [
      conversation('a', 'Alpha', [[1.5, 0], [0.5, 40]]),
      conversation('b', 'Beta', [[3, 2]], { model: 'gpt-5' }),
      conversation('c', 'Old', [[9, 60]]),
    ],
  ]);

  assert.deepEqual(host.requests, ['/api/conversations/search?limit=100&sort_order=UPDATED_AT_DESC']);
  assert.deepEqual(tiles(container), ['$4.50', '2', '$2.25']);
  assert.deepEqual(
    [...rows(container, 'By model')].map((row) => row.textContent),
    ['gpt-5$3.00', 'claude-opus$1.50'],
  );
  const [first] = rows(container, 'Conversations');
  assert.equal(first.cells[0].textContent, 'Beta');
  assert.equal(first.cells[1].textContent, '3K');

  await choose(container, 'all');
  assert.deepEqual(tiles(container), ['$14.00', '3', '$4.67']);
  await choose(container, 'today');
  assert.deepEqual(tiles(container), ['$1.50', '1', '$1.50']);
});

test('reads every page of conversations, up to 500', async (t) => {
  const pages = Array.from({ length: 6 }, (_, index) => [
    conversation(`c${index}`, `Chat ${index}`, [[1, 0]]),
  ]);
  const { container, host } = await openUsage(t, pages);

  assert.equal(host.requests.length, 5);
  assert.equal(tiles(container)[1], '5');
  assert.match(container.textContent, /Only your latest 500 conversations are counted/);
});

test("names an ACP agent's model, and says its costs are estimates", async (t) => {
  const { container } = await openUsage(t, [
    [
      conversation('a', 'Alpha', [[1, 0]], {
        model: 'acp-managed',
        info: { current_model_id: 'opus', agent: { kind: 'ACPAgent' } },
      }),
    ],
  ]);

  assert.equal(rows(container, 'By model')[0].cells[0].textContent, 'opus');
  assert.match(container.textContent, /subscription may bill differently/);
});

test('opens a conversation from its row', async (t) => {
  const { container, host } = await openUsage(t, [
    [conversation('AB-CD', 'Alpha', [[1, 0]])],
  ]);
  rows(container, 'Conversations')[0].querySelector('a').click();

  assert.deepEqual(host.navigations, ['/conversations/abcd']);
});

test('says when the server fails, and loads again on Refresh', async (t) => {
  const pages = [new Error('Offline')];
  const { container, host } = await openUsage(t, pages);
  assert.match(container.textContent, /Couldn't load your conversations: Offline/);

  pages[0] = [];
  container.querySelector('[data-testid="extras-usage-refresh"]').click();
  await flush();
  assert.equal(host.requests.length, 2);
  assert.match(container.textContent, /No costs in this period/);
});

test('asks for nothing while the usage page is off', async (t) => {
  const { container, host } = await openUsage(t, [[]], {});

  assert.deepEqual(host.requests, []);
  assert.match(container.textContent, /The usage page is off/);
});

test('ignores an answer that arrives after the page closes', async (t) => {
  let answer;
  const page = setupPage(t, { url: URL, settings: { usagePage: true } });
  const host = fakeHost();
  host.agentServer.request = () => new Promise((resolve) => (answer = resolve));
  await activateExtension(page, host);
  const container = page.document.createElement('div');
  page.document.body.append(container);
  const unmount = host.pages.get('usage')({ container, path: '', navigate: host.navigate });
  unmount();
  answer({ items: [conversation('a', 'Alpha', [[1, 0]])] });
  await flush();

  assert.equal(container.textContent, '');
});
