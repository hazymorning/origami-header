// Minimal stand-ins for the Home Assistant elements the module relies on.
// They follow the behavior of hui-root.ts and hui-card.ts in the frontend repository.

const events = (window.events = []);
for (const type of ["hass-action", "hass-toggle-menu"]) {
  addEventListener(type, (ev) => events.push({ type, detail: ev.detail, target: ev.composedPath()[0].localName }));
}

// Like home-assistant, which runs hass-action and sends fire-dom-event from itself, outside the dashboard.
addEventListener("hass-action", (ev) => {
  const action = ev.detail.config[`${ev.detail.action}_action`];
  if (action?.action !== "fire-dom-event") return;
  const custom = new Event("ll-custom", { bubbles: true, composed: true });
  custom.detail = action;
  document.body.dispatchEvent(custom);
});

// Like hui-root, the header gets its height from the toolbar and may carry a backdrop-filter from the theme.
const ROOT_STYLE = `
  :host { display: block; --header-height: 56px; }
  .header { position: fixed; inset: 0 0 auto; z-index: 4; background: var(--app-header-background-color); backdrop-filter: blur(4px); }
  .toolbar { height: var(--header-height); }
  #view { padding-top: var(--header-height); }
`;

// Renders in a microtask and calls updated() right after, like a LitElement.
class HuiRoot extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  get hass() {
    return this._hass;
  }

  set hass(value) {
    this._hass = value;
    this.requestUpdate();
  }

  get lovelace() {
    return this._lovelace;
  }

  set lovelace(value) {
    this._lovelace = value;
    this.requestUpdate();
  }

  connectedCallback() {
    this.requestUpdate();
  }

  requestUpdate() {
    if (this._pending) return;
    this._pending = true;
    queueMicrotask(() => {
      this._pending = false;
      this.render();
      this.updated(new Map());
    });
  }

  render() {
    const edit = !!this._lovelace?.editMode;
    if (this._rendered === edit) return;
    this._rendered = edit;
    const native = `<div class="toolbar">Default header</div>`;
    const toolbar = edit ? `<div class="toolbar edit">Edit mode</div>` : window.noslot ? native : `<slot name="toolbar">${native}</slot>`;
    this.shadowRoot.innerHTML = `<style>${ROOT_STYLE}</style><div class="header">${toolbar}</div><div id="view">View</div>`;
  }

  updated() {}

  _enableEditMode() {
    events.push({ type: "enable-edit-mode" });
    this.lovelace.setEditMode(true);
  }
}

// Hides itself and detaches the element when the element is hidden, like hui-card.
class HuiCard extends HTMLElement {
  get hass() {
    return this._hass;
  }

  set hass(value) {
    this._hass = value;
    if (this._el) this._el.hass = value;
  }

  get preview() {
    return !!this._preview;
  }

  set preview(value) {
    this._preview = !!value;
    if (this._el) this._el.preview = this._preview;
    this._updateVisibility();
  }

  load() {
    const type = this.config?.type || "";
    if (!type.startsWith("custom:")) {
      this.textContent = `card:${type}`;
      return;
    }
    customElements.whenDefined(type.slice(7)).then(() => {
      const el = document.createElement(type.slice(7));
      el.setConfig(this.config);
      el.hass = this._hass;
      el.preview = this.preview;
      el.addEventListener("card-visibility-changed", (ev) => {
        ev.stopPropagation();
        this._updateVisibility();
      });
      this._el = el;
      this.replaceChildren(el);
      this._updateVisibility();
    });
  }

  _updateVisibility() {
    if (!this._el) return;
    const visible = !this._el.hidden;
    this.style.display = visible ? "" : "none";
    this.toggleAttribute("hidden", !visible);
    if (!visible && this._el.parentElement) this._el.remove();
    else if (visible && !this._el.parentElement) this.append(this._el);
  }
}

// Like the action handler of the cards, it keeps the options on the element and reports a click as a tap.
// Hold and double tap depend on timing, so tests send those action events themselves.
class ActionHandler extends HTMLElement {
  bind(element, options = {}) {
    element.actionHandler = { options };
    element.addEventListener("click", () => {
      element.dispatchEvent(new CustomEvent("action", { detail: { action: "tap" }, bubbles: true, composed: true }));
    });
  }
}

customElements.define("hui-root", HuiRoot);
customElements.define("hui-card", HuiCard);
if (!window.noActionHandler) customElements.define("action-handler", ActionHandler);
customElements.define("ha-ripple", class extends HTMLElement {});
customElements.define("ha-icon", class extends HTMLElement {
  set icon(value) {
    this.setAttribute("icon", value);
  }
});

const snapshot = (root) => {
  const sr = root.shadowRoot;
  const header = sr.querySelector(".header");
  const drawer = root.querySelector("origami-header");
  const sheet = drawer?.shadowRoot.querySelector(".sheet");
  return {
    assigned: sr.querySelector('slot[name="toolbar"]')?.assignedElements().map((e) => e.localName) ?? [],
    headerDisplay: getComputedStyle(header).display,
    headerBackground: getComputedStyle(header).backgroundColor,
    viewPadding: getComputedStyle(sr.querySelector("#view")).paddingTop,
    sheetOutline: sheet ? getComputedStyle(sheet).outlineWidth : null,
  };
};

window.snapshot = () => snapshot(window.root);

window.boot = ({ config, admin = true }) => {
  const root = document.createElement("hui-root");
  const lovelace = (cfg, editMode) => ({
    config: cfg,
    editMode,
    setEditMode: (value) => {
      root.lovelace = lovelace(root.lovelace.config, value);
    },
  });
  root.hass = { user: { name: "Test", is_admin: admin }, states: {} };
  root.lovelace = lovelace(config, false);
  window.root = root;
  window.save = (cfg) => {
    root.lovelace = lovelace(cfg, root.lovelace.editMode);
  };
  document.body.append(root);
  requestAnimationFrame(() => {
    window.firstFrame = snapshot(root);
  });
};
