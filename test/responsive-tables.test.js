import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateExtension, fakeHost, flush, setupPage } from './helpers.js';

// A Markdown table as Canvas renders it, in its scroller, `width` pixels wide.
// jsdom has no layout, so the table's width is given, and the scroller's is
// its style's.
const markdownTable = (id) => `
  <div class="relative max-w-full">
    <div data-testid="markdown-table-scroll" style="width: 300px; border: 0; padding: 0">
      <table id="${id}" class="my-4 w-max min-w-full">
        <thead><tr><th>Name</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Wide canvas</td><td><strong>On</strong></td></tr>
          <tr><td>Tab status</td><td>Off</td></tr>
        </tbody>
      </table>
    </div>
  </div>`;

// A Canvas page with ResizeObservers to drive by hand, whose callbacks run on
// the next "frame", and tables of the given widths.
function openChat(t, widths, settings = { responsiveTables: true }) {
  const page = setupPage(t, {
    url: 'https://canvas.test/conversations/x',
    body: `<div id="chat">${Object.keys(widths).map(markdownTable).join('')}</div>`,
    settings,
  });
  const { window } = page;
  page.observers = [];
  window.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Set();
      page.observers.push(this);
    }
    observe(target) {
      this.targets.add(target);
    }
    unobserve(target) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
    }
  };
  window.requestAnimationFrame = (callback) => setImmediate(callback);
  window.cancelAnimationFrame = (handle) => clearImmediate(handle);
  page.table = (id) => page.document.getElementById(id);
  page.setWidth = (id, width) =>
    Object.defineProperty(page.table(id), 'offsetWidth', {
      configurable: true,
      value: width,
    });
  for (const [id, width] of Object.entries(widths)) page.setWidth(id, width);
  // Canvas's chat or a table changed size.
  page.resize = async (id) => {
    for (const observer of page.observers) {
      const entries = [...observer.targets]
        .filter((target) => target === page.table(id) || target.contains(page.table(id)))
        .map((target) => ({ target }));
      if (entries.length) observer.callback(entries, observer);
    }
    await flush();
  };
  return page;
}

const stacked = (page, id) => page.table(id).classList.contains('bt');
const labels = (page, id) =>
  [...page.table(id).querySelectorAll('tbody td')].map((td) => td.getAttribute('data-th'));
const style = (page) => page.document.getElementById('openhands-extras-responsive-tables');

test('Responsive tables is off by default', async (t) => {
  const page = openChat(t, { wide: 500 }, {});
  await activateExtension(page, fakeHost());

  assert.equal(stacked(page, 'wide'), false);
  assert.deepEqual(labels(page, 'wide'), [null, null, null, null]);
  assert.equal(style(page), null);
});

test('stacks a table too wide for the chat, under its headings', async (t) => {
  const page = openChat(t, { wide: 500, narrow: 200 });
  await activateExtension(page, fakeHost());

  assert.equal(stacked(page, 'wide'), true);
  assert.deepEqual(labels(page, 'wide'), ['Name', 'Status', 'Name', 'Status']);
  assert.equal(stacked(page, 'narrow'), false);
  assert.ok(style(page));
  // The cells' content stays as React rendered it.
  assert.equal(page.table('wide').querySelector('tbody td strong').textContent, 'On');
  assert.equal(page.document.querySelector('.bt-content'), null);
});

test('puts a table back once it fits, and stacks it again when it does not', async (t) => {
  const page = openChat(t, { wide: 500 });
  await activateExtension(page, fakeHost());
  assert.equal(stacked(page, 'wide'), true);

  page.table('wide').parentElement.style.width = '600px';
  await page.resize('wide');
  assert.equal(stacked(page, 'wide'), false);

  page.setWidth('wide', 700);
  await page.resize('wide');
  assert.equal(stacked(page, 'wide'), true);
});

test('labels rows and tables Canvas adds later', async (t) => {
  const page = openChat(t, {});
  await activateExtension(page, fakeHost());

  page.document.getElementById('chat').innerHTML = markdownTable('later');
  page.setWidth('later', 500);
  await flush();
  assert.equal(stacked(page, 'later'), true);

  const row = page.document.createElement('tr');
  row.innerHTML = '<td>Unread markers</td><td>On</td>';
  page.table('later').tBodies[0].append(row);
  await page.resize('later');
  assert.deepEqual(labels(page, 'later').slice(-2), ['Name', 'Status']);
});

test('leaves tables outside Markdown alone', async (t) => {
  const page = openChat(t, {});
  page.document.body.insertAdjacentHTML(
    'beforeend',
    '<div style="width: 100px; border: 0"><table id="other"><tr><th>A</th></tr><tr><td>1</td></tr></table></div>',
  );
  page.setWidth('other', 500);
  await activateExtension(page, fakeHost());

  assert.equal(stacked(page, 'other'), false);
  assert.equal(page.table('other').hasAttribute('data-extras-table'), false);
});

test('puts every table back when switched off or disabled', async (t) => {
  const page = openChat(t, { wide: 500 });
  const dispose = await activateExtension(page, fakeHost());
  const clean = () => {
    assert.equal(stacked(page, 'wide'), false);
    assert.deepEqual(labels(page, 'wide'), [null, null, null, null]);
    assert.equal(page.table('wide').hasAttribute('data-extras-table'), false);
    assert.equal(style(page), null);
    assert.ok(page.observers.every((observer) => observer.targets.size === 0));
  };

  await page.changeSettings({ responsiveTables: false });
  clean();

  await page.changeSettings({ responsiveTables: true });
  assert.equal(stacked(page, 'wide'), true);

  dispose();
  clean();
});
