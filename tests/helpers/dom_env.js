// tests/helpers/dom_env.js
// Simulated DOM, Window, and LocalStorage Environment for Node.js E2E Testing

const fs = require('fs');
const path = require('path');

class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(i) {
    return Object.keys(this.store)[i] || null;
  }
}

class MockClassList {
  constructor(element) {
    this.element = element;
    this.classes = new Set();
  }
  add(...cls) {
    cls.forEach(c => c && this.classes.add(c));
  }
  remove(...cls) {
    cls.forEach(c => this.classes.delete(c));
  }
  contains(cls) {
    return this.classes.has(cls);
  }
  toggle(cls, force) {
    if (force !== undefined) {
      if (force) this.classes.add(cls);
      else this.classes.delete(cls);
      return force;
    }
    if (this.classes.has(cls)) {
      this.classes.delete(cls);
      return false;
    } else {
      this.classes.add(cls);
      return true;
    }
  }
  toString() {
    return Array.from(this.classes).join(' ');
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.name = '';
    this.type = 'text';
    this._value = '';
    this.checked = false;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {};
    this.classList = new MockClassList(this);
    this.eventListeners = {};
    this.placeholder = '';
    this.innerText = '';
    this.innerHTML = '';
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = (v === null || v === undefined) ? '' : String(v);
  }

  getAttribute(attr) {
    return this.attributes[attr] !== undefined ? this.attributes[attr] : null;
  }

  setAttribute(attr, val) {
    this.attributes[attr] = String(val);
    if (attr === 'id') this.id = String(val);
    if (attr === 'name') this.name = String(val);
    if (attr === 'type') this.type = String(val);
    if (attr === 'value') this.value = String(val);
    if (attr === 'placeholder') this.placeholder = String(val);
    if (attr === 'class') {
      this.classList.classes.clear();
      val.split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
    }
  }

  hasAttribute(attr) {
    return Object.prototype.hasOwnProperty.call(this.attributes, attr);
  }

  removeAttribute(attr) {
    delete this.attributes[attr];
  }

  appendChild(child) {
    if (child && child.nodeType === 11) { // DocumentFragment
      const children = [...child.children];
      children.forEach(c => this.appendChild(c));
      child.children = [];
      return child;
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  addEventListener(type, listener) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(listener);
  }

  removeEventListener(type, listener) {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter(l => l !== listener);
  }

  dispatchEvent(event) {
    event.target = this;
    if (this.eventListeners[event.type]) {
      this.eventListeners[event.type].forEach(fn => fn.call(this, event));
    }
    if (event.bubbles && this.parentNode && typeof this.parentNode.dispatchEvent === 'function') {
      this.parentNode.dispatchEvent(event);
    }
    return true;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches && curr.matches(selector)) return curr;
      curr = curr.parentNode;
    }
    return null;
  }

  matches(selector) {
    if (!selector) return false;
    selector = selector.trim();
    if (selector.startsWith('#')) {
      return this.id === selector.slice(1);
    }
    if (selector.startsWith('.')) {
      return this.classList.contains(selector.slice(1));
    }
    if (selector.startsWith('[') && selector.endsWith(']')) {
      const match = selector.slice(1, -1).match(/([a-zA-Z0-9_-]+)(?:="([^"]*)")?/);
      if (match) {
        const [, attr, val] = match;
        if (val !== undefined) return this.getAttribute(attr) === val;
        return this.hasAttribute(attr);
      }
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  querySelector(selector) {
    const results = this.querySelectorAll(selector);
    return results.length > 0 ? results[0] : null;
  }

  querySelectorAll(selector) {
    const results = [];
    function traverse(node) {
      for (const child of node.children) {
        if (child.matches && child.matches(selector)) {
          results.push(child);
        }
        traverse(child);
      }
    }
    traverse(this);
    return results;
  }

  reset() {
    this.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = el.hasAttribute('checked');
      } else {
        el.value = el.getAttribute('value') || '';
      }
    });
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement('body');
    this.elementsById = new Map();
  }

  createElement(tagName) {
    return new MockElement(tagName);
  }

  createDocumentFragment() {
    const frag = new MockElement('fragment');
    frag.nodeType = 11;
    return frag;
  }

  getElementById(id) {
    return this.elementsById.get(id) || this.body.querySelector('#' + id);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  registerElement(el) {
    if (el.id) {
      this.elementsById.set(el.id, el);
    }
    for (const child of el.children) {
      this.registerElement(child);
    }
  }
}

/**
 * Parses index.html and populates the MockDocument DOM tree with all forms and inputs
 */
function createSimulatedEnvironment(htmlPath = path.resolve(__dirname, '../../index.html')) {
  const doc = new MockDocument();
  const localStorage = new MockLocalStorage();
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Extract elements from index.html
  // Regex to match tags with id, class, name, type
  const tagRegex = /<(input|select|textarea|div|form|button|table|tbody|tr|td|span|h[1-6]|p)\b([^>]*)>/gi;
  let match;

  // Key containers
  const containerEpi = new MockElement('div');
  containerEpi.setAttribute('id', 'contenedorEpiTb');
  doc.body.appendChild(containerEpi);

  const containerSppat = new MockElement('div');
  containerSppat.setAttribute('id', 'contenedorSppat');
  doc.body.appendChild(containerSppat);

  const containerEpicrisis = new MockElement('div');
  containerEpicrisis.setAttribute('id', 'contenedorEpicrisis');
  doc.body.appendChild(containerEpicrisis);

  // Form
  const form = new MockElement('form');
  form.setAttribute('id', 'epiForm');
  doc.body.appendChild(form);

  while ((match = tagRegex.exec(htmlContent)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrsStr = match[2];

    const idMatch = attrsStr.match(/\bid=["']([^"']+)["']/i);
    const classMatch = attrsStr.match(/\bclass=["']([^"']+)["']/i);
    const nameMatch = attrsStr.match(/\bname=["']([^"']+)["']/i);
    const typeMatch = attrsStr.match(/\btype=["']([^"']+)["']/i);
    const valueMatch = attrsStr.match(/\bvalue=["']([^"']*)["']/i);
    const placeholderMatch = attrsStr.match(/\bplaceholder=["']([^"']*)["']/i);
    const checkedMatch = /\bchecked\b/i.test(attrsStr);

    if (idMatch || classMatch || nameMatch) {
      const el = new MockElement(tagName);
      if (idMatch) el.setAttribute('id', idMatch[1]);
      if (classMatch) el.setAttribute('class', classMatch[1]);
      if (nameMatch) el.setAttribute('name', nameMatch[1]);
      if (typeMatch) el.setAttribute('type', typeMatch[1]);
      if (valueMatch) el.setAttribute('value', valueMatch[1]);
      if (placeholderMatch) el.setAttribute('placeholder', placeholderMatch[1]);
      if (checkedMatch) el.checked = true;

      // Assign to proper container or form
      if (idMatch && idMatch[1].startsWith('sppat_')) {
        containerSppat.appendChild(el);
      } else if (idMatch && idMatch[1].startsWith('epicrisis_')) {
        containerEpicrisis.appendChild(el);
      } else {
        form.appendChild(el);
      }

      if (el.id) doc.elementsById.set(el.id, el);
    }
  }

  // Window mock
  const win = {
    document: doc,
    localStorage: localStorage,
    modoAppActual: 'epi',
    Event: class {
      constructor(type, opts = {}) {
        this.type = type;
        this.bubbles = !!opts.bubbles;
      }
    },
    CustomEvent: class {
      constructor(type, opts = {}) {
        this.type = type;
        this.detail = opts.detail || null;
        this.bubbles = !!opts.bubbles;
      }
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Swal: {
      fire: () => Promise.resolve({ isConfirmed: true })
    }
  };

  return { doc, localStorage, win };
}

module.exports = {
  MockLocalStorage,
  MockElement,
  MockDocument,
  createSimulatedEnvironment
};
