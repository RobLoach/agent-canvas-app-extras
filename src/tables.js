// Responsive tables.

import { removeElement, setAttribute, setStyle } from './dom.js';
import { settings } from './settings.js';

const TABLES_STYLE_ID = 'openhands-extras-responsive-tables';
const TABLE_ATTR = 'data-extras-table';

// Canvas's Markdown tables, each in a scroller that lets it run wider than
// the chat. A stacked table is marked .bt, and each cell carries its column's
// heading in data-th. These undo Canvas's widths, borders and nowrap, and
// rule a line between rows.
const MARKDOWN_TABLE = '[data-testid="markdown-table-scroll"] > table';
const RESPONSIVE_TABLES_CSS = `
[${TABLE_ATTR}].bt { width: 100%; min-width: 0; }
[${TABLE_ATTR}].bt thead, [${TABLE_ATTR}].bt tbody th { display: none; }
[${TABLE_ATTR}].bt tbody td {
  display: flex; gap: 0.75rem; max-width: none; white-space: normal; border: none;
}
[${TABLE_ATTR}].bt tbody td::before {
  content: attr(data-th); flex: 0 0 8em; font-weight: 600; overflow-wrap: anywhere;
}
[${TABLE_ATTR}].bt tbody tr + tr td:first-child {
  border-top: 1px solid color-mix(in srgb, currentColor 20%, transparent);
}`;

// Stack a Markdown table while it's wider than its scroller, and put it back
// once it fits, checked as the chat's width or the table changes, e.g. as
// rows stream in, which also labels the new cells. Only attributes and a
// class are added, leaving the nodes React owns where they are.
const TABLE_STACKED = 'bt';

// An element's content width, as Canvas sizes boxes by their border box.
function contentWidth(element) {
  const style = window.getComputedStyle(element);
  const edges = ['Left', 'Right'].reduce(
    (sum, side) =>
      sum + (parseFloat(style[`border${side}Width`]) || 0) + (parseFloat(style[`padding${side}`]) || 0),
    0,
  );
  return parseFloat(style.width) - edges;
}

function fitTable(table) {
  const headings = [...(table.tHead?.rows[0]?.cells ?? [])].map((cell) => cell.textContent.trim());
  for (const body of table.tBodies) {
    for (const row of body.rows) {
      [...row.cells].forEach((cell, index) => {
        if (index < headings.length) setAttribute(cell, 'data-th', headings[index]);
      });
    }
  }
  table.classList.remove(TABLE_STACKED);
  if (table.offsetWidth > contentWidth(table.parentElement)) table.classList.add(TABLE_STACKED);
}

export function watchResponsiveTables() {
  // Each table's scroller, which it's measured against.
  const tables = new Map();
  // Tables to check again on the next frame: ResizeObserver reports an error
  // when its callback resizes what it watches.
  const pending = new Set();
  let observer = null;
  let frame = 0;

  function track(table) {
    table.setAttribute(TABLE_ATTR, '');
    const scroller = table.parentElement;
    tables.set(table, scroller);
    fitTable(table);
    observer?.observe(table);
    observer?.observe(scroller);
  }

  function untrack(table) {
    const scroller = tables.get(table);
    tables.delete(table);
    table.classList.remove(TABLE_STACKED);
    table.removeAttribute(TABLE_ATTR);
    for (const cell of table.querySelectorAll('[data-th]')) cell.removeAttribute('data-th');
    observer?.unobserve(table);
    observer?.unobserve(scroller);
  }

  function recheck() {
    frame = 0;
    for (const table of pending) if (tables.has(table)) fitTable(table);
    pending.clear();
  }

  function onResize(entries) {
    for (const { target } of entries) {
      const table = tables.has(target)
        ? target
        : [...target.children].find((child) => tables.has(child));
      if (table) pending.add(table);
    }
    if (pending.size && !frame) frame = window.requestAnimationFrame(recheck);
  }

  function stop() {
    for (const table of [...tables.keys()]) untrack(table);
    observer?.disconnect();
    observer = null;
    window.cancelAnimationFrame?.(frame);
    frame = 0;
    pending.clear();
    removeElement(TABLES_STYLE_ID);
  }

  function apply() {
    if (!settings.responsiveTables) {
      if (tables.size || observer) stop();
      return;
    }
    setStyle(TABLES_STYLE_ID, RESPONSIVE_TABLES_CSS);
    if (!observer && window.ResizeObserver) {
      observer = new window.ResizeObserver(onResize);
    }
    for (const table of [...tables.keys()]) {
      if (!table.isConnected) untrack(table);
    }
    for (const table of document.querySelectorAll(
      `${MARKDOWN_TABLE}:not([${TABLE_ATTR}])`,
    )) {
      track(table);
    }
  }

  return { refresh: apply, onDomChange: apply, dispose: stop };
}
