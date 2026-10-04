// Origami Header: replaces the Home Assistant dashboard header with your own buttons and cards.
// Configuration and usage: README.md

const VERSION = "0.2.0";
const ROOT = "hui-root";
const TAG = "origami-header";
const CARD = "origami-header-card";
const CARD_TYPE = `custom:${CARD}`;
const EVENT = "origami_header";

const STRINGS = {
  en: {
    edit: "Edit", menu: "Menu", automations: "Automations", tools: "Tools",
    mode: "Mode", mode_menu: "Menu", mode_header: "Header", mode_hidden: "Hidden", hidden_note: "Header hidden",
    buttons: "Buttons", label: "Name", icon: "Icon", special: "Preset", special_edit: "Edit dashboard",
    special_sidebar: "Open sidebar", tap_action: "Action", cards: "Cards",
    position: "Position", top: "Top", bottom: "Bottom", layout: "Layout", list: "List", grid: "Grid", icons: "Icons only",
    all_users: "Show for all users", all_users_help: "Otherwise only for admins.",
    hide_handle: "Hide handle", css: "CSS", css_help: "Class names are in the README.",
    open: "Open menu", close: "Close menu",
  },
  de: {
    edit: "Bear\u00adbeiten", menu: "Menü", automations: "Automa\u00adtionen", tools: "Werk\u00adzeuge",
    mode: "Modus", mode_menu: "Menü", mode_header: "Header", mode_hidden: "Ausgeblendet", hidden_note: "Header ausgeblendet",
    buttons: "Buttons", label: "Name", icon: "Icon", special: "Funktion", special_edit: "Dashboard bearbeiten",
    special_sidebar: "Seitenleiste öffnen", tap_action: "Aktion", cards: "Karten",
    position: "Position", top: "Oben", bottom: "Unten", layout: "Layout", list: "Liste", grid: "Raster", icons: "Nur Icons",
    all_users: "Für alle Benutzer anzeigen", all_users_help: "Sonst nur für Admins.",
    hide_handle: "Griff ausblenden", css: "CSS", css_help: "Die Klassennamen stehen in der README.",
    open: "Menü öffnen", close: "Menü schließen",
  },
};
const t = (key) => (STRINGS[document.documentElement.lang.slice(0, 2)] || STRINGS.en)[key] ?? STRINGS.en[key];

const nav = (navigation_path) => ({ action: "navigate", navigation_path });
const defaultButtons = () => [
  { label: t("edit"), icon: "mdi:pencil-outline", special: "edit" },
  { label: t("automations"), icon: "mdi:robot-outline", tap_action: nav("/config/automation/dashboard") },
  { label: t("tools"), icon: "mdi:hammer-wrench", tap_action: nav("/config/tools") },
  { label: t("menu"), icon: "mdi:menu", special: "sidebar" },
];

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const fire = (node, type, detail) => node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
const sheet = (css) => {
  const s = new CSSStyleSheet();
  s.replaceSync(css);
  return s;
};
const idle = (cb) => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 500 }) : setTimeout(cb, 200));
const modeOf = (conf) => (conf.mode === "header" || conf.mode === "hidden" ? conf.mode : "menu");
const hasContent = (conf) => (Array.isArray(conf.cards) && conf.cards.length > 0) || !Array.isArray(conf.buttons) || conf.buttons.length > 0;
const deepActive = () => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
};

// Focus moves into the drawer only when it was opened with the keyboard.
let keyboard = false;

// A tap runs the action, and so does pulling the element far enough in the given direction.
const pull = (el, direction, action) => {
  let pulled = false;
  el.addEventListener("pointerdown", (down) => {
    const dir = direction();
    pulled = false;
    el.setPointerCapture(down.pointerId);
    const move = (ev) => {
      if ((ev.clientY - down.clientY) * dir < 24) return;
      pulled = true;
      stop();
      action();
    };
    const stop = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", stop);
      el.removeEventListener("pointercancel", stop);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
  });
  el.addEventListener("click", () => {
    if (pulled) pulled = false;
    else action();
  });
};

const PAD = "var(--ha-space-6, 24px)";
const RADIUS = "var(--ha-dialog-border-radius, var(--ha-border-radius-3xl, 24px))";
// Home Assistant sets this to 1ms when reduced motion is enabled.
const TIME = "var(--ha-animation-duration-normal, 250ms)";
// Page colors instead of black, so the backdrop has no edge at the system bars.
const FADE = (color) => `color-mix(in srgb, var(${color}) 85%, transparent)`;

const STYLE = sheet(`
:host { position: relative; display: block; height: 0; pointer-events: none; font-family: var(--ha-font-family-body); -webkit-tap-highlight-color: transparent; }
:host([mode="header"]) { height: auto; }
.bar { position: relative; }
:host([mode="header"]) .bar { display: flex; flex-direction: column; gap: var(--ha-space-2, 8px); box-sizing: border-box; padding: var(--ha-space-2, 8px) var(--ha-space-4, 16px);
  backdrop-filter: var(--app-header-backdrop-filter, none); -webkit-backdrop-filter: var(--app-header-backdrop-filter, none); pointer-events: auto; }
.note { display: none; }
.handle, .grip { display: none; align-items: center; justify-content: center; flex: none; box-sizing: border-box; width: 96px; height: 24px; margin: 0; padding: 0;
  border: 0; border-radius: 12px; background: none; cursor: grab; touch-action: none; }
.handle { pointer-events: auto; }
.handle::before, .grip::before { content: ""; width: 36px; height: 4px; border-radius: 2px; background: var(--divider-color, rgba(127, 127, 127, 0.3)); }
.handle:hover::before, .grip:hover::before { background: var(--secondary-text-color); }
.handle:focus-visible, .grip:focus-visible { outline: 2px solid var(--ha-color-focus, var(--primary-color)); outline-offset: -2px; }
:host([drawer]:not([no-handle])) .handle { display: flex; }
:host([mode="menu"]) .handle { position: fixed; top: calc(var(--safe-area-inset-top, 0px) + 4px); left: 50%; transform: translateX(-50%); }
:host([mode="menu"][bottom]) .handle { top: auto; bottom: calc(var(--safe-area-inset-bottom, 0px) + 4px); }
.grip { display: flex; align-self: center; margin: calc(-1 * var(--ha-space-2, 8px)) 0 calc(-1 * var(--ha-space-4, 16px)); }
:host([bottom]) .grip { order: -1; margin: calc(-1 * var(--ha-space-4, 16px)) 0 calc(-1 * var(--ha-space-2, 8px)); }
.scrim { position: fixed; inset: 0; opacity: 0; visibility: hidden; pointer-events: none; touch-action: none;
  background: linear-gradient(${FADE("--app-header-background-color, var(--primary-background-color)")}, ${FADE("--primary-background-color")});
  transition: opacity ${TIME} ease, visibility 0s ${TIME}; }
.sheet { position: fixed; inset: 0 0 auto; display: flex; flex-direction: column; gap: var(--ha-space-4, 16px); box-sizing: border-box;
  width: min(100%, 560px); max-height: 85vh; margin-inline: auto; overflow: auto; overscroll-behavior: contain; will-change: transform;
  pointer-events: none; visibility: hidden; padding: calc(${PAD} + var(--safe-area-inset-top, 0px)) ${PAD} ${PAD}; border-radius: 0 0 ${RADIUS} ${RADIUS};
  background: var(--app-header-background-color, var(--primary-background-color)); color: var(--primary-text-color); outline: none;
  transform: translateY(-100%); transition: transform ${TIME} cubic-bezier(0.2, 0, 0, 1), visibility 0s ${TIME}; }
:host([bottom]) .sheet { inset: auto 0 0; padding: ${PAD} ${PAD} calc(${PAD} + var(--safe-area-inset-bottom, 0px));
  border-radius: ${RADIUS} ${RADIUS} 0 0; background: var(--primary-background-color); transform: translateY(100%); }
:host([open]) .scrim, :host([open]) .sheet { visibility: visible; transition-delay: 0s; }
:host([open]) .scrim { opacity: 1; pointer-events: auto; }
:host([open]) .sheet { transform: none; pointer-events: auto; }
.cards { display: flex; flex-direction: column; gap: var(--ha-space-2, 8px); }
.cards:empty, .grid:empty { display: none; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ha-space-2, 8px); }
.tile { position: relative; display: flex; align-items: center; gap: var(--ha-space-3, 12px); box-sizing: border-box; min-height: var(--ha-space-12, 48px);
  margin: 0; padding: var(--ha-space-2, 8px) var(--ha-space-4, 16px); border: 0; border-radius: var(--ha-border-radius-xl, 16px);
  background: var(--ha-color-form-background, var(--secondary-background-color)); color: var(--primary-text-color); font: inherit;
  font-size: var(--ha-font-size-m, 14px); font-weight: var(--ha-font-weight-action, 500); line-height: var(--ha-line-height-condensed, 1.2);
  text-align: start; cursor: pointer; }
.tile:focus-visible { outline: 2px solid var(--ha-color-focus, var(--primary-color)); outline-offset: 2px; }
.tile ha-ripple { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
.tile ha-icon { flex: none; color: var(--secondary-text-color); --mdc-icon-size: 24px; }
.label { min-width: 0; overflow: hidden; overflow-wrap: break-word; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
:host([layout="grid"]) .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
:host([layout="grid"]) .tile { flex-direction: column; justify-content: center; gap: var(--ha-space-2, 8px); padding: var(--ha-space-3, 12px) var(--ha-space-1, 4px); text-align: center; }
:host([layout="icons"]) .grid { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
:host([layout="icons"]) .tile { justify-content: center; padding: 0; }
:host([layout="icons"]) .label { display: none; }
:host([mode="header"]) .grid { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
`);

// The card shows the same header or menu, but in place instead of fixed to the screen.
const PREVIEW = sheet(`
:host { height: auto !important; pointer-events: none !important; display: flex !important; flex-direction: column; gap: var(--ha-space-3, 12px); }
:host([hidden]) { display: none !important; }
:host(:not([drawer])) .sheet, :host(:not([mode="header"])) .bar, .scrim { display: none !important; }
.bar { background: var(--app-header-background-color, var(--primary-background-color)); border-radius: var(--ha-card-border-radius, 12px); }
:host([mode="hidden"]) .note { display: block; padding: var(--ha-space-3, 12px); color: var(--secondary-text-color); text-align: center; }
.sheet { position: relative !important; inset: auto !important; transform: none !important; visibility: visible !important; transition: none !important;
  width: auto !important; max-width: none !important; max-height: none !important; margin: 0 !important; overflow: visible !important; }
`);

class DrawerPanel extends HTMLElement {
  constructor(extra = []) {
    super();
    const root = this.attachShadow({ mode: "open" });
    this._css = new CSSStyleSheet();
    root.adoptedStyleSheets = [STYLE, this._css, ...extra];
    root.innerHTML = `
      <div class="bar"><button class="handle" type="button" aria-expanded="false"></button></div>
      <div class="note"></div>
      <div class="scrim"></div>
      <div class="sheet" role="dialog" aria-modal="true" tabindex="-1" inert>
        <div class="cards"></div><div class="grid"></div><button class="grip" type="button"></button>
      </div>`;
    this._bar = root.querySelector(".bar");
    this._handle = root.querySelector(".handle");
    this._sheet = root.querySelector(".sheet");
    this._cards = root.querySelector(".cards");
    this._grid = root.querySelector(".grid");
    root.querySelector(".scrim").addEventListener("click", () => this.close());
    this._grid.addEventListener("click", (ev) => this._tap(ev));
    const bottom = () => this.hasAttribute("bottom");
    pull(this._handle, () => (bottom() ? -1 : 1), () => this.open());
    pull(root.querySelector(".grip"), () => (bottom() ? 1 : -1), () => this.close());
  }

  get hass() {
    return this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    this._feed();
  }

  configure(conf) {
    if (conf === this._conf) return false;
    this._conf = conf;
    const mode = modeOf(conf);
    this.setAttribute("mode", mode);
    this.toggleAttribute("drawer", mode === "menu" && hasContent(conf));
    this.toggleAttribute("no-handle", conf.hide_handle === true);
    this.toggleAttribute("bottom", conf.position === "bottom");
    if (["grid", "icons"].includes(conf.layout)) this.setAttribute("layout", conf.layout);
    else this.removeAttribute("layout");
    try {
      this._css.replaceSync(typeof conf.css === "string" ? conf.css : "");
    } catch (err) {
      console.warn("origami-header: invalid css", err);
    }
    this._handle.setAttribute("aria-label", t("open"));
    this.shadowRoot.querySelector(".grip").setAttribute("aria-label", t("close"));
    this._sheet.setAttribute("aria-label", "Home Assistant");
    this.shadowRoot.querySelector(".note").textContent = t("hidden_note");
    this._buttons = Array.isArray(conf.buttons) ? conf.buttons.filter(isObj) : defaultButtons();
    this._built = false;
    // The same buttons and cards form the header in header mode and fill the menu otherwise.
    (mode === "header" ? this._bar : this._sheet).prepend(this._cards, this._grid);
    if (mode === "header") this._build();
    return true;
  }

  _card(config) {
    const card = Object.assign(document.createElement("hui-card"), { hass: this._hass, preview: false, config });
    card.load();
    return card;
  }

  _build() {
    if (this._built) return;
    this._built = true;
    this._grid.replaceChildren(...this._buttons.map((button, i) => {
      const tile = document.createElement("button");
      const label = document.createElement("span");
      const icon = document.createElement("ha-icon");
      tile.type = "button";
      tile.className = "tile";
      tile.dataset.i = i;
      tile.setAttribute("aria-label", String(button.label ?? "").replaceAll("\u00ad", ""));
      label.className = "label";
      label.textContent = button.label ?? "";
      icon.icon = button.icon || "mdi:circle-outline";
      tile.append(document.createElement("ha-ripple"), icon, label);
      return tile;
    }));
    const conf = this._conf;
    const cards = Array.isArray(conf.cards) ? conf.cards.filter(isObj) : [];
    customElements.whenDefined("hui-card").then(() => {
      if (conf === this._conf) this._cards.replaceChildren(...cards.map((config) => this._card(config)));
    });
  }

  _feed() {
    if (!this._live && this.getAttribute("mode") !== "header") return;
    for (const card of this._cards.children) if (card.hass !== this._hass) card.hass = this._hass;
  }

  open() {}

  close() {}

  _tap(ev) {
    const button = this._buttons?.[ev.target.closest(".tile")?.dataset.i];
    if (!button) return;
    this.close();
    const root = this._root;
    const action = button.tap_action || {};
    switch (button.special || action.action) {
      case "edit":
        return root?._enableEditMode ? root._enableEditMode() : root?.lovelace?.setEditMode(true);
      case "sidebar":
        return fire(this, "hass-toggle-menu");
      case undefined:
      case "none":
        return;
    }
    fire(this, "hass-action", { config: { entity: button.entity, tap_action: action }, action: "tap" });
  }
}

const setHeight = (root, value) => {
  if (value === null) root.style.removeProperty("--header-height");
  else if (root.style.getPropertyValue("--header-height") !== value) root.style.setProperty("--header-height", value);
};

const drawers = new Set();

class OrigamiHeader extends DrawerPanel {
  constructor() {
    super();
    this._onKey = (ev) => ev.key === "Escape" && this.close();
    this._onNav = () => this.close();
    // In header mode the view starts below the header, as with the default one.
    this._resize = new ResizeObserver(() => {
      if (this._root && this.getAttribute("mode") === "header") setHeight(this._root, `${Math.ceil(this._bar.getBoundingClientRect().height)}px`);
    });
  }

  connectedCallback() {
    drawers.add(this);
  }

  disconnectedCallback() {
    drawers.delete(this);
    this.release();
  }

  sync(root, conf) {
    this._root = root;
    this._hass = root.hass;
    if (this.configure(conf)) idle(() => this._build());
    if (!this.hasAttribute("drawer")) this.close();
    if (this.getAttribute("mode") === "header") this._resize.observe(this._bar);
    else this._resize.unobserve(this._bar);
    this._feed();
  }

  release() {
    this.close();
    this.removeAttribute("slot");
    this._resize.unobserve(this._bar);
  }

  open() {
    if (this._open || !this.hasAttribute("drawer")) return;
    this._build();
    this._opener = deepActive();
    this._open = this._live = true;
    this._feed();
    this._sheet.inert = false;
    this.setAttribute("open", "");
    this._handle.setAttribute("aria-expanded", "true");
    addEventListener("keydown", this._onKey);
    addEventListener("location-changed", this._onNav);
    requestAnimationFrame(() => {
      if (this._open) ((keyboard && this._grid.querySelector(".tile")) || this._sheet).focus({ preventScroll: true });
    });
  }

  close() {
    if (!this._open) return;
    this._open = this._live = false;
    if (this.shadowRoot.activeElement) this._opener?.focus?.({ preventScroll: true });
    this._sheet.inert = true;
    this.removeAttribute("open");
    this._handle.setAttribute("aria-expanded", "false");
    removeEventListener("keydown", this._onKey);
    removeEventListener("location-changed", this._onNav);
  }

  toggle() {
    if (this._open) this.close();
    else this.open();
  }
}

const select = (pairs) => ({ select: { mode: "dropdown", options: pairs.map(([value, key]) => ({ value, label: t(key) })) } });
const form = () => ({
  schema: [
    { name: "mode", selector: select([["menu", "mode_menu"], ["header", "mode_header"], ["hidden", "mode_hidden"]]) },
    {
      name: "buttons",
      selector: {
        object: {
          label_field: "label",
          multiple: true,
          fields: {
            label: { label: t("label"), required: true, selector: { text: {} } },
            icon: { label: t("icon"), selector: { icon: {} } },
            special: { label: t("special"), selector: select([["edit", "special_edit"], ["sidebar", "special_sidebar"]]) },
            tap_action: { label: t("tap_action"), selector: { ui_action: {} } },
          },
        },
      },
    },
    { name: "cards", selector: { object: {} } },
    {
      name: "",
      type: "grid",
      schema: [
        { name: "position", selector: select([["top", "top"], ["bottom", "bottom"]]) },
        { name: "layout", selector: select([["list", "list"], ["grid", "grid"], ["icons", "icons"]]) },
      ],
    },
    { name: "all_users", selector: { boolean: {} } },
    { name: "hide_handle", selector: { boolean: {} } },
    { name: "css", selector: { text: { multiline: true } } },
  ],
  computeLabel: (schema) => t(schema.name),
  computeHelper: (schema) => (["all_users", "css"].includes(schema.name) ? t(`${schema.name}_help`) : undefined),
  assertConfig: (config) => {
    for (const key of ["buttons", "cards"]) {
      if (config[key] !== undefined && !(Array.isArray(config[key]) && config[key].every(isObj))) throw new Error(`${key} must be a list`);
    }
  },
});

// Home Assistant removes cards whose element is hidden from the layout. It sets preview
// in edit mode and in the card editor, where the card shows the header or menu instead.
class OrigamiHeaderCard extends DrawerPanel {
  static getConfigForm() {
    return form();
  }

  static getStubConfig() {
    return { buttons: defaultButtons().map((button) => ({ ...button, label: button.label.replaceAll("\u00ad", "") })) };
  }

  constructor() {
    super([PREVIEW]);
  }

  setConfig(config) {
    if (!isObj(config)) throw new Error("Invalid configuration");
    this._config = config;
    this.preview = this._live;
  }

  get preview() {
    return !!this._live;
  }

  set preview(value) {
    this._live = !!value;
    if (this.hidden === this._live) {
      this.hidden = !this._live;
      this.dispatchEvent(new Event("card-visibility-changed"));
    }
    if (!this._live || !this._config) return;
    if (this.configure(this._config)) this._build();
    this._feed();
  }

  getCardSize() {
    return this._live ? 4 : 0;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 6 };
  }
}

// hui-root renders the header inside <slot name="toolbar">. Filling the slot from updated()
// replaces the header in the same render, before the browser paints it.
const HIDE = sheet(".header { display: none !important; }");
const OVERLAY = sheet(".header { background: none !important; box-shadow: none !important; backdrop-filter: none !important; pointer-events: none; }");
// A backdrop-filter would make .header the containing block of the fixed drawer. The bar applies the blur instead.
const HEADER = sheet(".header { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }");

const adopt = (root, style, on) => {
  const sr = root.shadowRoot;
  if (sr && sr.adoptedStyleSheets.includes(style) !== on) {
    sr.adoptedStyleSheets = on ? [...sr.adoptedStyleSheets, style] : sr.adoptedStyleSheets.filter((s) => s !== style);
  }
};

const findCard = (cards) => {
  for (const card of Array.isArray(cards) ? cards : []) {
    if (!isObj(card)) continue;
    if (card.type === CARD_TYPE) return card;
    const nested = findCard(card.cards) || (isObj(card.card) && findCard([card.card]));
    if (nested) return nested;
  }
  return null;
};

const findConfig = (config) => {
  for (const view of Array.isArray(config?.views) ? config.views : []) {
    if (!isObj(view)) continue;
    const sections = Array.isArray(view.sections) ? view.sections : [];
    const card = findCard(view.cards) || findCard(sections.flatMap((s) => (isObj(s) && s.cards) || []));
    if (card) return card;
  }
  return null;
};

let warned = false;

const sync = (root) => {
  const config = root.lovelace?.config;
  if (config !== root.__origamiHeaderSource) root.__origamiHeaderConf = findConfig(config);
  root.__origamiHeaderSource = config;

  const conf = root.lovelace?.editMode ? null : root.__origamiHeaderConf;
  const mode = conf ? modeOf(conf) : null;
  const wanted = !!conf && mode !== "hidden" && hasContent(conf) && (conf.all_users === true || !!root.hass?.user?.is_admin);
  const hidden = !!conf && !wanted;
  const slot = root.shadowRoot?.querySelector('slot[name="toolbar"]');
  if (wanted && !slot && !warned) {
    warned = true;
    console.warn("origami-header: unsupported Home Assistant version, keeping the default header");
  }
  const custom = wanted && !!slot;

  adopt(root, HIDE, hidden);
  adopt(root, OVERLAY, custom && mode === "menu");
  adopt(root, HEADER, custom && mode === "header");
  if (hidden || (custom && mode === "menu")) setHeight(root, "0px");
  else if (!custom) setHeight(root, null);

  let el = root.__origamiHeader;
  if (!custom) {
    el?.release();
    return;
  }
  if (!el) el = root.__origamiHeader = document.createElement(TAG);
  if (el.parentNode !== root) root.append(el);
  if (el.slot !== "toolbar") el.slot = "toolbar";
  el.sync(root, conf);
};

const patch = (cls) => {
  const proto = cls?.prototype;
  if (!proto || proto.__origamiHeaderPatched) return false;
  const updated = proto.updated;
  proto.updated = function (changed) {
    updated?.call(this, changed);
    try {
      sync(this);
    } catch (err) {
      console.error("origami-header:", err);
    }
  };
  proto.__origamiHeaderPatched = true;
  return true;
};

const findRoots = (node, found = []) => {
  if (node.localName === ROOT) found.push(node);
  if (node.shadowRoot) findRoots(node.shadowRoot, found);
  for (const child of node.children) findRoots(child, found);
  return found;
};

const define = (tag, cls) => {
  try {
    if (!customElements.get(tag)) customElements.define(tag, cls);
  } catch (err) {
    console.warn(`origami-header: could not define ${tag}`, err);
  }
};

const init = () => {
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD,
    name: "Origami Header",
    description: "A custom header or a drawer in place of the dashboard header.",
    preview: false,
  });

  addEventListener("keydown", () => (keyboard = true), true);
  addEventListener("pointerdown", () => (keyboard = false), true);

  // Home Assistant looks up cards in the registry polyfill that comes with its app bundle.
  // Once hui-root exists the polyfill is installed, and no view has rendered yet.
  customElements.whenDefined(ROOT).then(() => {
    define(TAG, OrigamiHeader);
    define(CARD, OrigamiHeaderCard);
    if (patch(customElements.get(ROOT))) findRoots(document.body).forEach((root) => root.requestUpdate());
  });

  addEventListener("ll-custom", (ev) => {
    const cmd = ev.detail?.[EVENT];
    if (!cmd) return;
    const el = [...drawers].find((d) => d.isConnected && d.slot === "toolbar");
    if (!el) return;
    if (cmd === "open") el.open();
    else if (cmd === "close") el.close();
    else el.toggle();
  });

  console.info(`origami-header ${VERSION}`);
};

if (!window.origamiHeader) {
  window.origamiHeader = VERSION;
  init();
}
