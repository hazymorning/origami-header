// Origami Header: replaces the Home Assistant dashboard header with your own buttons and cards.
// Configuration and usage: README.md

const VERSION = "0.4.3";
const ROOT = "hui-root";
const TAG = "origami-header";
const CARD = "origami-header-card";

const STRINGS = {
  en: {
    edit: "Edit", automations: "Automations", tools: "Tools", sidebar: "Sidebar",
    mode: "Header", mode_menu: "Fold-out menu", mode_header: "Custom header", mode_hidden: "No header",
    mode_menu_info: "Hides the header. Your buttons and cards fold out when another card opens the menu.",
    mode_header_info: "Your buttons and cards form the header.",
    mode_hidden_info: "Hides the header, for example on wall tablets.",
    buttons: "Buttons", name: "Name", icon: "Icon", color: "Color",
    special: "Function", special_info: "Replaces the tap behavior.", special_edit: "Edit dashboard", special_sidebar: "Toggle sidebar",
    tap_action: "Tap behavior", hold_action: "Hold behavior", double_tap_action: "Double tap behavior",
    cards: "Cards", position: "Position", top: "Top", bottom: "Bottom", layout: "Layout", list: "List", grid: "Grid",
    all_users: "Show for all users", all_users_help: "Otherwise only admins see it, and other users get no header.",
    css: "CSS", css_help: "Classes: .bar for the header, .sheet for the menu and .scrim for its backdrop, .button and .name for buttons. The help icon at the top opens the README with all classes.",
  },
  de: {
    edit: "Bear\u00adbeiten", automations: "Automa\u00adtionen", tools: "Werk\u00adzeuge", sidebar: "Seiten\u00adleiste",
    mode: "Kopfzeile", mode_menu: "Ausklappmenü", mode_header: "Eigene Kopfzeile", mode_hidden: "Keine Kopfzeile",
    mode_menu_info: "Blendet die Kopfzeile aus. Deine Knöpfe und Karten klappen auf, wenn eine andere Karte das Menü öffnet.",
    mode_header_info: "Deine Knöpfe und Karten bilden die Kopfzeile.",
    mode_hidden_info: "Blendet die Kopfzeile aus, zum Beispiel für Wandtablets.",
    buttons: "Knöpfe", name: "Name", icon: "Symbol", color: "Farbe",
    special: "Funktion", special_info: "Ersetzt das Verhalten bei Antippen.", special_edit: "Dashboard bearbeiten",
    special_sidebar: "Seitenleiste umschalten",
    tap_action: "Verhalten bei Antippen", hold_action: "Verhalten bei Festhalten", double_tap_action: "Verhalten bei Doppeltippen",
    cards: "Karten", position: "Position", top: "Oben", bottom: "Unten", layout: "Anordnung", list: "Liste", grid: "Raster",
    all_users: "Für alle Benutzer anzeigen", all_users_help: "Sonst nur für Admins. Andere Benutzer sehen dann keine Kopfzeile.",
    css: "CSS", css_help: "Klassen: .bar für die Kopfzeile, .sheet für das Menü und .scrim für den Hintergrund dahinter, .button und .name für Knöpfe. Das Hilfe-Symbol oben öffnet die README mit allen Klassen.",
  },
};
const t = (key) => (STRINGS[document.documentElement.lang.slice(0, 2)] || STRINGS.en)[key] ?? STRINGS.en[key];

const nav = (navigation_path) => ({ action: "navigate", navigation_path });
const defaultButtons = () => [
  { name: t("edit"), icon: "mdi:pencil-outline", special: "edit" },
  { name: t("automations"), icon: "mdi:robot-outline", tap_action: nav("/config/automation/dashboard") },
  { name: t("tools"), icon: "mdi:hammer-wrench", tap_action: nav("/config/tools") },
  { name: t("sidebar"), icon: "mdi:menu", special: "sidebar" },
];

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const fire = (node, type, detail) => node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
const sheet = (css) => {
  const s = new CSSStyleSheet();
  s.replaceSync(css);
  return s;
};
const idle = (cb) => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 500 }) : setTimeout(cb, 200));
const modeOf = (conf) => (conf.mode === "menu" || conf.mode === "hidden" ? conf.mode : "header");
// A card copied in the Home Assistant editor has no leading "-", and clearing the cards field leaves {}.
const cardsOf = (conf) => [conf.cards].flat().filter((card) => isObj(card) && card.type);
const hasContent = (conf) => cardsOf(conf).length > 0 || !Array.isArray(conf.buttons) || conf.buttons.length > 0;
const active = (action) => isObj(action) && action.action !== "none";
// Theme colors such as "amber" become var(--amber-color), as in tiles and badges.
const cssColor = (color) => (/^[a-z-]+$/.test(color) ? `var(--${color}-color, ${color})` : color);
const deepActive = () => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
};

// Cards that hand their actions to hass-action send fire-dom-event from home-assistant, outside the dashboard.
// Their commands go to the dashboard that rendered last, which is the one on screen.
let lastRoot = null;

const command = (cmd, root) => {
  const el = root.__origamiHeader;
  if (cmd === "edit") root._enableEditMode ? root._enableEditMode() : root.lovelace.setEditMode(true);
  else if (cmd === "sidebar") fire(root, "hass-toggle-menu");
  else if (el?.slot === "toolbar" && ["open", "close", "toggle"].includes(cmd)) el[cmd]();
};

let keyboard = false;

// Like the Home Assistant bottom sheet, the menu follows a swipe toward its edge and closes past a quarter.
const swipe = (el, direction, close) => {
  let start = null;
  let offset = 0;
  el.addEventListener("touchstart", (ev) => {
    const atEdge = direction() < 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1 : el.scrollTop <= 0;
    start = atEdge && ev.touches.length === 1 ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : null;
    offset = 0;
  }, { passive: true });
  el.addEventListener("touchmove", (ev) => {
    if (!start) return;
    const dir = direction();
    const dy = (ev.touches[0].clientY - start.y) * dir;
    if (dy <= Math.abs(ev.touches[0].clientX - start.x)) return;
    ev.preventDefault();
    offset = dy;
    el.style.transition = "none";
    el.style.transform = `translateY(${dy * dir}px)`;
  }, { passive: false });
  const end = (ev) => {
    if (!start) return;
    start = null;
    el.style.transition = el.style.transform = "";
    if (ev.type === "touchend" && offset > Math.min(el.offsetHeight / 4, 80)) close();
  };
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", end);
};

// Home Assistant's action handler adds hold and double tap, as on tiles and badges. Without it, buttons still react to taps.
const bindActions = (el, button, run) => {
  el.addEventListener("action", (ev) => {
    ev.stopPropagation();
    run(ev.detail.action);
  });
  const handler = customElements.get("action-handler") &&
    (document.querySelector("action-handler") || document.body.appendChild(document.createElement("action-handler")));
  if (handler) handler.bind(el, { hasHold: active(button.hold_action), hasDoubleClick: active(button.double_tap_action) });
  else el.addEventListener("click", () => run("tap"));
};

const PAD = "var(--ha-space-6, 24px)";
const RADIUS = "var(--ha-bottom-sheet-border-radius, var(--ha-dialog-border-radius, var(--ha-border-radius-2xl, 20px)))";
// Home Assistant sets this to 1ms when reduced motion is enabled.
const TIME = "var(--ha-animation-duration-normal, 250ms)";

// The menu has the medium Home Assistant shadow. The large one of the bottom sheet looks heavy across the whole screen width.
// Buttons look like badges in the header and like cards in the menu.
const STYLE = sheet(`
:host { position: relative; display: block; height: 0; pointer-events: none; font-family: var(--ha-font-family-body); -webkit-tap-highlight-color: transparent; }
:host([mode="header"]) { height: auto; }
.bar { position: relative; }
:host([mode="header"]) .bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ha-space-2, 8px); box-sizing: border-box; min-height: 56px;
  padding: var(--ha-space-2, 8px) var(--ha-space-4, 16px); border-bottom: var(--app-header-border-bottom, none); pointer-events: auto; }
:host([mode="header"]) .cards { flex: 1 1 12rem; min-width: 0; }
:host([mode="header"]) .buttons { display: flex; flex-wrap: wrap; justify-content: flex-end; margin-inline-start: auto; }
.note { display: none; }
.scrim { position: fixed; inset: 0; opacity: 0; visibility: hidden; pointer-events: none; touch-action: none;
  backdrop-filter: var(--ha-dialog-scrim-backdrop-filter, brightness(68%)); -webkit-backdrop-filter: var(--ha-dialog-scrim-backdrop-filter, brightness(68%));
  transition: opacity ${TIME} ease, visibility 0s ${TIME}; }
.sheet { position: fixed; inset: 0 0 auto; display: flex; flex-direction: column; gap: var(--ha-space-4, 16px); box-sizing: border-box;
  width: min(100%, 560px); max-height: 85vh; margin-inline: auto; overflow: auto; overscroll-behavior: contain; will-change: transform;
  pointer-events: none; visibility: hidden; padding: calc(${PAD} + var(--safe-area-inset-top, 0px)) ${PAD} ${PAD}; border-radius: 0 0 ${RADIUS} ${RADIUS};
  background: var(--app-header-background-color, var(--primary-background-color)); color: var(--primary-text-color); outline: none; box-shadow: var(--ha-box-shadow-m);
  transform: translateY(-100%); transition: transform ${TIME} cubic-bezier(0.2, 0, 0, 1), visibility 0s ${TIME}; }
:host([bottom]) .sheet { inset: auto 0 0; padding: ${PAD} ${PAD} calc(${PAD} + var(--safe-area-inset-bottom, 0px));
  border-radius: ${RADIUS} ${RADIUS} 0 0; background: var(--primary-background-color); box-shadow: 0 -3px 6px -1px rgba(0, 0, 0, 0.1), 0 -8px 16px -2px rgba(0, 0, 0, 0.15);
  transform: translateY(100%); }
:host([open]) .scrim, :host([open]) .sheet { visibility: visible; transition-delay: 0s; }
:host([open]) .scrim { opacity: 1; pointer-events: auto; }
:host([open]) .sheet { transform: none; pointer-events: auto; }
.cards { display: flex; flex-direction: column; gap: var(--ha-space-2, 8px); }
.cards:empty, .buttons:empty { display: none; }
.buttons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ha-space-2, 8px); }
:host([grid]) .buttons { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.button { --button-color: var(--color, var(--state-inactive-color)); --ha-ripple-color: var(--button-color); --ha-ripple-hover-opacity: 0.04; --ha-ripple-pressed-opacity: 0.12;
  position: relative; display: flex; align-items: center; gap: var(--ha-space-3, 12px); box-sizing: border-box; min-width: 0; min-height: var(--ha-space-12, 48px);
  padding: 0 var(--ha-space-4, 16px);
  border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #e0e0e0)); border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg, 12px));
  background: var(--ha-card-background, var(--card-background-color, white)); box-shadow: var(--ha-card-box-shadow, none); backdrop-filter: var(--ha-card-backdrop-filter, none);
  color: var(--primary-text-color); cursor: pointer; outline: none; user-select: none; transition: box-shadow 180ms ease-in-out, border-color 180ms ease-in-out; }
.button:focus-visible { border-color: var(--button-color); box-shadow: var(--ha-card-box-shadow, 0 0 0 0 transparent), 0 0 0 1px var(--button-color); }
.button ha-ripple { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
.button ha-icon { flex: none; display: flex; color: var(--button-color); --mdc-icon-size: 20px; }
.button:not(:has(.name)) { justify-content: center; }
.name { min-width: 0; overflow: hidden; overflow-wrap: break-word; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
  font-size: var(--ha-font-size-m, 14px); font-weight: var(--ha-font-weight-medium, 500); line-height: var(--ha-line-height-condensed, 1.2); letter-spacing: 0.1px; }
:host([grid]) .button { flex-direction: column; justify-content: center; gap: var(--ha-space-2, 8px); padding: var(--ha-space-3, 12px) var(--ha-space-2, 8px); text-align: center; }
:host([grid]) .button ha-icon { align-items: center; justify-content: center; width: 36px; height: 36px; --mdc-icon-size: 24px;
  border-radius: var(--ha-tile-icon-border-radius, var(--ha-border-radius-pill, 9999px)); background: color-mix(in srgb, var(--button-color) 20%, transparent); }
:host([mode="header"]) .button { gap: var(--ha-space-2, 8px); height: var(--ha-badge-size, 36px); min-height: 0; min-width: var(--ha-badge-size, 36px); padding: 0 var(--ha-space-3, 12px);
  border-radius: var(--ha-badge-border-radius, calc(var(--ha-badge-size, 36px) / 2)); }
:host([mode="header"]) .button:not(:has(.name)) { padding: 0; }
:host([mode="header"]) .button ha-icon { margin-inline-start: -4px; --mdc-icon-size: var(--ha-badge-icon-size, 18px); }
:host([mode="header"]) .button:not(:has(.name)) ha-icon { margin: 0; }
:host([mode="header"]) .name { display: block; white-space: nowrap; font-size: var(--ha-badge-font-size, var(--ha-font-size-s, 12px)); }
`);

// The card shows the same header or menu, but in place instead of fixed to the screen.
const PREVIEW = sheet(`
:host { height: auto !important; pointer-events: none !important; }
:host([hidden]) { display: none !important; }
:host(:not([drawer])) .sheet, :host(:not([mode="header"])) .bar, .scrim { display: none !important; }
.bar { background: var(--app-header-background-color, var(--primary-background-color)); border-radius: var(--ha-card-border-radius, 12px); }
:host([mode="hidden"]) .note { display: block; padding: var(--ha-space-3, 12px); color: var(--secondary-text-color); text-align: center; }
.sheet { position: relative !important; inset: auto !important; transform: none !important; visibility: visible !important; transition: none !important;
  width: auto !important; max-width: none !important; max-height: none !important; margin: 0 !important; overflow: visible !important; border-radius: ${RADIUS} !important;
  box-shadow: none !important; }
`);

class Panel extends HTMLElement {
  constructor(extra = []) {
    super();
    const root = this.attachShadow({ mode: "open" });
    this._css = new CSSStyleSheet();
    root.adoptedStyleSheets = [STYLE, this._css, ...extra];
    root.innerHTML = `
      <div class="bar"></div>
      <div class="note"></div>
      <div class="scrim"></div>
      <div class="sheet" role="dialog" aria-modal="true" tabindex="-1" inert><div class="cards"></div><div class="buttons"></div></div>`;
    this._bar = root.querySelector(".bar");
    this._sheet = root.querySelector(".sheet");
    this._cards = root.querySelector(".cards");
    this._buttons = root.querySelector(".buttons");
    this._onKey = (ev) => ev.key === "Escape" && this.close();
    this._onNav = () => this.close();
    root.querySelector(".scrim").addEventListener("click", () => this.close());
    swipe(this._sheet, () => (this.hasAttribute("bottom") ? 1 : -1), () => this.close());
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
    this.toggleAttribute("bottom", conf.position === "bottom");
    this.toggleAttribute("grid", mode === "menu" && conf.layout === "grid");
    this._css.replaceSync(typeof conf.css === "string" ? conf.css : "");
    this._sheet.setAttribute("aria-label", t("mode_menu"));
    this.shadowRoot.querySelector(".note").textContent = t("mode_hidden");
    this._items = Array.isArray(conf.buttons) ? conf.buttons.filter(isObj) : defaultButtons();
    this._built = false;
    (mode === "header" ? this._bar : this._sheet).prepend(this._cards, this._buttons);
    if (mode === "header") this._build();
    return true;
  }

  _card(config) {
    const card = Object.assign(document.createElement("hui-card"), { hass: this._hass, preview: false, config });
    card.load();
    return card;
  }

  _button(button) {
    const el = document.createElement("div");
    const label = String(button.name || t(`special_${button.special}`) || "").replaceAll("\u00ad", "");
    el.className = "button";
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    if (label) el.setAttribute("aria-label", label);
    if (button.color) el.style.setProperty("--color", cssColor(button.color));
    el.append(document.createElement("ha-ripple"));
    if (button.icon) el.append(Object.assign(document.createElement("ha-icon"), { icon: button.icon }));
    if (button.name) el.append(Object.assign(document.createElement("span"), { className: "name", textContent: button.name }));
    bindActions(el, button, (action) => this._run(button, action));
    return el;
  }

  _build() {
    if (this._built) return;
    this._built = true;
    // Only admins can edit a dashboard, as with the edit button of the default header.
    const admin = !!this._hass?.user?.is_admin;
    this._buttons.replaceChildren(...this._items.filter((b) => b.special !== "edit" || admin).map((b) => this._button(b)));
    const conf = this._conf;
    const cards = cardsOf(conf);
    customElements.whenDefined("hui-card").then(() => {
      if (conf === this._conf) this._cards.replaceChildren(...cards.map((config) => this._card(config)));
    });
  }

  _feed() {
    if (!this._live && this.getAttribute("mode") !== "header") return;
    for (const card of this._cards.children) if (card.hass !== this._hass) card.hass = this._hass;
  }

  _run(button, action) {
    this.close();
    if (action === "tap" && button.special) command(button.special, this._root);
    else if (active(button[`${action}_action`])) fire(this, "hass-action", { config: button, action });
  }

  open() {
    if (this._open || !this.hasAttribute("drawer")) return;
    this._build();
    this._opener = deepActive();
    this._open = this._live = true;
    this._feed();
    this._sheet.inert = false;
    this.setAttribute("open", "");
    addEventListener("keydown", this._onKey);
    addEventListener("location-changed", this._onNav);
    requestAnimationFrame(() => {
      if (this._open) ((keyboard && this._buttons.querySelector(".button")) || this._sheet).focus({ preventScroll: true });
    });
  }

  close() {
    if (!this._open) return;
    this._open = this._live = false;
    if (this.shadowRoot.activeElement) this._opener?.focus?.({ preventScroll: true });
    this._sheet.inert = true;
    this.removeAttribute("open");
    removeEventListener("keydown", this._onKey);
    removeEventListener("location-changed", this._onNav);
  }

  toggle() {
    if (this._open) this.close();
    else this.open();
  }
}

const setHeight = (root, value) => {
  if (value === null) root.style.removeProperty("--header-height");
  else if (root.style.getPropertyValue("--header-height") !== value) root.style.setProperty("--header-height", value);
};

class OrigamiHeader extends Panel {
  constructor() {
    super();
    // In header mode the view starts below the header, as with the default one.
    this._resize = new ResizeObserver(() => {
      if (this._root && this.getAttribute("mode") === "header") setHeight(this._root, `${Math.ceil(this._bar.getBoundingClientRect().height)}px`);
    });
  }

  disconnectedCallback() {
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
}

const select = (pairs) => ({ select: { mode: "dropdown", options: pairs.map(([value, key]) => ({ value, label: t(key) })) } });
// Buttons have no entity, so they offer the same actions as the button badges of a heading card.
const ACTIONS = ["navigate", "url", "perform-action", "assist", "none"];
const uiAction = (key) => ({ label: t(key), selector: { ui_action: { actions: ACTIONS, default_action: "none" } } });
const SHOWN = { field: "mode", operator: "not_eq", value: "hidden" };
const MENU = { field: "mode", value: "menu" };
const form = () => ({
  schema: [
    {
      name: "mode",
      selector: {
        select: {
          mode: "box",
          box_max_columns: 1,
          options: ["header", "menu", "hidden"].map((value) => ({ value, label: t(`mode_${value}`), description: t(`mode_${value}_info`) })),
        },
      },
    },
    {
      name: "buttons",
      visible: SHOWN,
      selector: {
        object: {
          label_field: "name",
          description_field: "icon",
          multiple: true,
          fields: {
            name: { label: t("name"), selector: { text: {} } },
            icon: { label: t("icon"), selector: { icon: {} } },
            color: { label: t("color"), selector: { ui_color: {} } },
            special: { label: t("special"), description: t("special_info"), selector: select([["edit", "special_edit"], ["sidebar", "special_sidebar"]]) },
            tap_action: uiAction("tap_action"),
            hold_action: uiAction("hold_action"),
            double_tap_action: uiAction("double_tap_action"),
          },
        },
      },
    },
    { name: "cards", visible: SHOWN, selector: { object: {} } },
    {
      name: "",
      type: "grid",
      visible: MENU,
      schema: [
        { name: "position", selector: select([["top", "top"], ["bottom", "bottom"]]) },
        { name: "layout", selector: select([["list", "list"], ["grid", "grid"]]) },
      ],
    },
    { name: "all_users", visible: SHOWN, selector: { boolean: {} } },
    // Home Assistant has no CSS field. The template selector is its code editor for plain text, and default sets the placeholder.
    { name: "css", visible: SHOWN, default: ".scrim { backdrop-filter: blur(12px); }", selector: { template: { preview: false } } },
  ],
  computeLabel: (schema) => t(schema.name),
  computeHelper: (schema) => (["all_users", "css"].includes(schema.name) ? t(`${schema.name}_help`) : undefined),
  assertConfig: (config) => {
    const list = (value) => Array.isArray(value) && value.every(isObj);
    if (config.buttons !== undefined && !list(config.buttons)) throw new Error("buttons must be a list");
    if (config.cards !== undefined && !isObj(config.cards) && !list(config.cards)) throw new Error("cards must be a card or a list of cards");
  },
});

// Home Assistant removes cards whose element is hidden from the layout. It sets preview
// in edit mode and in the card editor, where the card shows the header or menu instead.
class OrigamiHeaderCard extends Panel {
  static getConfigForm() {
    return form();
  }

  static getStubConfig() {
    return { mode: "header", buttons: defaultButtons().map((button) => ({ ...button, name: button.name.replaceAll("\u00ad", "") })) };
  }

  constructor() {
    super([PREVIEW]);
    this._bar.inert = true;
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
// A backdrop-filter would make .header the containing block of the fixed menu.
const OVERLAY = sheet(".header { background: none !important; box-shadow: none !important; backdrop-filter: none !important; pointer-events: none; }");

const adopt = (root, style, on) => {
  const sr = root.shadowRoot;
  if (sr && sr.adoptedStyleSheets.includes(style) !== on) {
    sr.adoptedStyleSheets = on ? [...sr.adoptedStyleSheets, style] : sr.adoptedStyleSheets.filter((s) => s !== style);
  }
};

const findCard = (cards) => {
  for (const card of Array.isArray(cards) ? cards : []) {
    if (!isObj(card)) continue;
    if (card.type === `custom:${CARD}`) return card;
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
  lastRoot = root;
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

const patch = (proto) => {
  const updated = proto.updated;
  proto.updated = function (changed) {
    updated?.call(this, changed);
    try {
      sync(this);
    } catch (err) {
      console.error("origami-header:", err);
    }
  };
};

const findRoots = (node, found = []) => {
  if (node.localName === ROOT) found.push(node);
  if (node.shadowRoot) findRoots(node.shadowRoot, found);
  for (const child of node.children) findRoots(child, found);
  return found;
};

const init = () => {
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD,
    name: "Origami Header",
    description: "Your own header or a fold-out menu in place of the dashboard header.",
    preview: false,
    documentationURL: "https://github.com/hazymorning/origami_header#styling",
  });

  addEventListener("keydown", () => (keyboard = true), true);
  addEventListener("pointerdown", () => (keyboard = false), true);

  // Home Assistant looks up cards in the registry polyfill that comes with its app bundle.
  // Once hui-root exists the polyfill is installed. A dashboard that rendered before then renders again.
  customElements.whenDefined(ROOT).then(() => {
    customElements.define(TAG, OrigamiHeader);
    customElements.define(CARD, OrigamiHeaderCard);
    patch(customElements.get(ROOT).prototype);
    findRoots(document.body).forEach((root) => root.requestUpdate());
  });

  // Any card can open, close or toggle the menu, edit the dashboard or toggle the sidebar with a fire-dom-event action.
  addEventListener("ll-custom", (ev) => {
    const cmd = ev.detail?.origami_header;
    const root = ev.composedPath().find((node) => node.localName === ROOT) || lastRoot;
    if (cmd && root?.isConnected) command(cmd, root);
  });

  console.info(`origami-header ${VERSION}`);
};

if (!window.origamiHeader) {
  window.origamiHeader = VERSION;
  init();
}
