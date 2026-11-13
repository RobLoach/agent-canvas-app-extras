// Helpers for the elements this app adds to Canvas's page, and the classes
// it borrows from Canvas's own components.

export const THINKING_ATTR = 'data-extras-thinking';
export const CHIP_LABEL_ATTR = 'data-extras-chip-label';
export const UNREAD_ATTR = 'data-extras-unread';

// Marks other elements this app adds to the page body.
export const OWN_ATTR = 'data-extras-own';

// One of our own elements in <head>, by id, created on first use with these
// attributes: Chromium only picks up a manifest link that has its rel when
// it's added.
export function headElement(id, tag, { first = false, attributes = {} } = {}) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement(tag);
    element.id = id;
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }
    document.head[first ? 'prepend' : 'append'](element);
  }
  return element;
}

export const removeElement = (id) => document.getElementById(id)?.remove();

export function setStyle(id, css) {
  setProperty(headElement(id, 'style'), 'textContent', css);
}

// An element with these classes, holding text or other nodes.
export function el(tag, className, ...children) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children);
  return element;
}

// Class strings from Canvas's own components, so they're compiled.
export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
export const HAS_FOCUS_RING =
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus';

export function textButton(testid, text, onClick, look = 'underline') {
  const button = el('button', `w-fit cursor-pointer rounded-sm text-sm ${look} ${FOCUS_RING}`, text);
  button.type = 'button';
  button.dataset.testid = testid;
  button.addEventListener('click', onClick);
  return button;
}

// The parts of this app's pages, as Canvas lays out its settings pages.
export const pageHeader = (title, description) =>
  el(
    'div',
    'min-w-0 space-y-1',
    el('h2', 'text-xl font-semibold leading-6 text-foreground', title),
    el('p', 'max-w-2xl text-sm text-tertiary-light', description),
  );
export const pageSection = (title, ...children) =>
  el('section', 'flex min-w-0 flex-col gap-3', el('h3', 'text-base font-semibold text-foreground', title), ...children);

// The elements this app adds to Canvas's page body.
const OWN_SELECTOR = `[${OWN_ATTR}], [${THINKING_ATTR}], [${CHIP_LABEL_ATTR}], [${UNREAD_ATTR}]`;
const ownNode = (node) => node.nodeType === Node.ELEMENT_NODE && node.matches(OWN_SELECTOR);
export const ownChange = (record) =>
  !!record.target.closest?.(OWN_SELECTOR) ||
  [...record.addedNodes, ...record.removedNodes].every(ownNode);

// Every write to the page wakes the observers watching it, so these only
// write what changed.
export const setProperty = (element, name, value) => {
  if (element[name] !== value) element[name] = value;
};
export const setAttribute = (element, name, value) => {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
};
export const toggleAttr = (element, name, on) => {
  if (element.hasAttribute(name) !== on) element.toggleAttribute(name, on);
};
