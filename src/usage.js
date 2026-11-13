// The usage page.

import {
  el,
  note,
  OWN_ATTR,
  pageHeader,
  pageSection,
  pillClass,
  textButton,
} from './dom.js';
import { canvasLanguage, conversationKey } from './canvas.js';
import { settings } from './settings.js';
import { canvasLink, pageHref, SETTINGS_PAGE } from './pages.js';

// The usage page: what the Agent Server's conversations cost, from the cost
// of each of their LLM calls, over a period, by model and by conversation.
// Tokens are each conversation's whole total, as the server doesn't date
// them. It reads up to USAGE_PAGES pages of the latest conversations, once
// per visit and on Refresh.
const USAGE_PAGES = 5;
const USAGE_ROWS = 50;
const USAGE_PERIODS = [
  ['today', 'Today'],
  ['7', '7 days'],
  ['30', '30 days'],
  ['all', 'All time'],
];

// ACP agents report this in place of the model they run.
const ACP_MODEL = 'acp-managed';

function periodStart(period) {
  if (period === 'all') return -Infinity;
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  if (period !== 'today') day.setDate(day.getDate() - (Number(period) - 1));
  return day.getTime();
}

const sumTokens = (usage) =>
  ['prompt_tokens', 'completion_tokens', 'cache_read_tokens', 'cache_write_tokens']
    .map((key) => Number(usage?.[key]) || 0)
    .reduce((sum, count) => sum + count, 0);

// A conversation's costs, by model, each with its time, or null where the
// server has only a total, and its tokens.
function conversationUsage(info) {
  const acp = info.agent?.kind === 'ACPAgent';
  const runModel = acp
    ? info.current_model_name || info.current_model_id || info.agent?.acp_model || 'ACP agent'
    : info.agent?.llm?.model || 'Unknown model';
  const costs = [];
  let tokens = 0;
  for (const metrics of Object.values(info.stats?.usage_to_metrics ?? {})) {
    const model =
      metrics?.model_name && metrics.model_name !== ACP_MODEL ? metrics.model_name : runModel;
    tokens += sumTokens(metrics?.accumulated_token_usage);
    const dated = Array.isArray(metrics?.costs) ? metrics.costs : [];
    for (const { cost, timestamp } of dated) {
      const at = Number(timestamp) * 1000;
      costs.push({ model, cost: Number(cost) || 0, at: Number.isFinite(at) ? at : null });
    }
    if (!dated.length && metrics?.accumulated_cost) {
      costs.push({ model, cost: Number(metrics.accumulated_cost) || 0, at: null });
    }
  }
  return { id: info.id, title: info.title || 'Untitled', acp, tokens, costs };
}

async function loadUsage(host) {
  const conversations = [];
  let pageId = null;
  for (let page = 0; page < USAGE_PAGES; page++) {
    const query = new URLSearchParams({ limit: '100', sort_order: 'UPDATED_AT_DESC' });
    if (pageId) query.set('page_id', pageId);
    const result = await host.agentServer.request({
      path: `/api/conversations/search?${query}`,
    });
    if (!Array.isArray(result?.items)) throw new Error('Unexpected conversations');
    conversations.push(...result.items.filter(Boolean).map(conversationUsage));
    pageId = result.next_page_id;
    if (!pageId) break;
  }
  return { conversations, more: !!pageId };
}

// Undated costs only count for all time, and are totalled apart otherwise.
function summarizeUsage(conversations, since) {
  const models = new Map();
  const rows = [];
  let total = 0;
  let undated = 0;
  for (const conversation of conversations) {
    let cost = 0;
    for (const entry of conversation.costs) {
      if (since !== -Infinity && entry.at === null) undated += entry.cost;
      if (since !== -Infinity && !(entry.at >= since)) continue;
      cost += entry.cost;
      models.set(entry.model, (models.get(entry.model) ?? 0) + entry.cost);
    }
    if (cost > 0) rows.push({ ...conversation, cost });
    total += cost;
  }
  rows.sort((a, b) => b.cost - a.cost);
  return { total, undated, rows, models: [...models].sort((a, b) => b[1] - a[1]) };
}

export function usagePage(host) {
  let period = '30';

  function mount({ container }) {
    let disposed = false;
    let data = null;
    let error = null;
    // Only the latest load, e.g. after Refresh, is shown.
    let loads = 0;
    let loadedAt = null;
    const language = canvasLanguage();
    const money = new Intl.NumberFormat(language, { style: 'currency', currency: 'USD' });
    const count = new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 });
    const cost = (value) => (value > 0 && value < 0.01 ? `< ${money.format(0.01)}` : money.format(value));

    const refresh = textButton('extras-usage-refresh', 'Refresh', () => load(), 'shrink-0 rounded-md border border-border px-3 py-1.5 text-contrast hover:bg-surface-raised');
    // The period buttons stay, so focus stays on the one chosen.
    const periods = el(
      'div',
      'flex flex-wrap gap-2',
      ...USAGE_PERIODS.map(([value, label]) => {
        const button = el('button', '', label);
        button.type = 'button';
        button.dataset.period = value;
        button.addEventListener('click', () => {
          period = value;
          render();
        });
        return button;
      }),
    );
    periods.setAttribute('role', 'group');
    periods.setAttribute('aria-label', 'Period');
    const status = el('p', 'sr-only');
    status.setAttribute('role', 'status');
    const body = el('div', 'flex min-w-0 flex-col gap-6');
    const root = el(
      'div',
      'px-4 pt-8 pb-12',
      el(
        'div',
        'mx-auto flex w-full min-w-0 max-w-200 flex-col gap-6',
        el(
          'div',
          'flex min-w-0 items-start justify-between gap-4',
          pageHeader('Usage', 'What your conversations on this Agent Server cost, from its own records of each LLM call.'),
          refresh,
        ),
        periods,
        status,
        body,
      ),
    );
    root.setAttribute(OWN_ATTR, '');
    const periodLabel = () => USAGE_PERIODS.find(([value]) => value === period)[1];

    function table(headings, rows) {
      const head = headings.map((heading, index) =>
        el('th', `py-2 font-normal text-tertiary-light ${index ? 'text-right' : 'text-left'}`, heading),
      );
      const body = rows.map((cells) =>
        el('tr', '', ...cells.map((cell, index) =>
          el('td', `border-t border-border py-2 ${index ? 'text-right tabular-nums whitespace-nowrap pl-4' : 'min-w-0 break-words'}`, cell),
        )),
      );
      return el('table', 'w-full text-sm', el('thead', '', el('tr', '', ...head)), el('tbody', '', ...body));
    }

    function render() {
      for (const button of periods.children) {
        const on = button.dataset.period === period;
        button.setAttribute('aria-pressed', String(on));
        button.className = pillClass(on);
      }
      const loading = settings.usagePage && !data && !error;
      refresh.disabled = loading;
      body.setAttribute('aria-busy', String(loading));
      if (!settings.usagePage) {
        const link = canvasLink(
          host,
          pageHref(host.extension.name, SETTINGS_PAGE),
          'text-link hover:underline',
          'Extras settings',
        );
        const off = note('The usage page is off. Turn it on in ');
        off.append(link, '.');
        body.replaceChildren(off);
        return;
      }
      if (error) {
        const message = `Couldn't load your conversations: ${error}`;
        status.textContent = message;
        body.replaceChildren(note(message));
        return;
      }
      if (!data) {
        status.textContent = 'Loading…';
        body.replaceChildren(note('Loading…'));
        return;
      }
      const { total, undated, rows, models } = summarizeUsage(
        data.conversations,
        periodStart(period),
      );
      status.textContent = `${cost(total)} in ${periodLabel().toLowerCase()}`;
      const stats = el(
        'dl',
        'grid gap-3',
        ...[
          ['Cost', cost(total)],
          ['Conversations', String(rows.length)],
          ['Average per conversation', rows.length ? cost(total / rows.length) : '–'],
        ].map(([label, value]) =>
          el(
            'div',
            'rounded-xl border border-border bg-base-secondary p-4',
            el('dt', 'text-sm text-tertiary-light', label),
            el('dd', 'mt-1 text-xl font-semibold text-contrast tabular-nums', value),
          ),
        ),
      );
      stats.style.gridTemplateColumns = 'repeat(auto-fit, minmax(10rem, 1fr))';
      if (!rows.length) {
        body.replaceChildren(stats, note(undated > 0 ? `No dated costs in this period; ${cost(undated)} more has no date, so only All time counts it.` : 'No costs in this period.'));
        return;
      }
      const titleLink = (row) => {
        return canvasLink(host, `/conversations/${conversationKey(row.id)}`, 'text-contrast hover:underline', row.title);
      };
      const notes = [];
      if (undated > 0) {
        notes.push(note(`${cost(undated)} more has no date, so only All time counts it.`));
      }
      if (rows.some((row) => row.acp)) {
        notes.push(note("ACP agents' costs are what the same calls would cost through the API; their subscription may bill differently."));
      }
      if (data.more) {
        notes.push(note(`Only your latest ${USAGE_PAGES * 100} conversations are counted.`));
      }
      notes.push(
        note(`Loaded at ${loadedAt.toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit' })}.`),
      );
      body.replaceChildren(
        stats,
        pageSection('By model', table(['Model', 'Cost'], models.map(([model, value]) => [model, cost(value)]))),
        pageSection(
          'Conversations',
          table(
            ['Conversation', 'Tokens, all time', 'Cost'],
            rows.slice(0, USAGE_ROWS).map((row) => [titleLink(row), count.format(row.tokens), cost(row.cost)]),
          ),
        ),
        ...notes,
      );
    }

    async function load() {
      if (!settings.usagePage) {
        render();
        return;
      }
      const current = (loads += 1);
      data = null;
      error = null;
      render();
      let next = null;
      let failed = null;
      try {
        next = await loadUsage(host);
      } catch (failure) {
        failed = failure?.message || 'the Agent Server did not answer.';
      }
      if (disposed || current !== loads) return;
      data = next;
      error = failed;
      loadedAt = new Date();
      render();
    }

    container.append(root);
    load();
    return () => {
      disposed = true;
      root.remove();
    };
  }

  return { mount };
}
