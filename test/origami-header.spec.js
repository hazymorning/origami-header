import { test, expect } from "@playwright/test";

const BUTTONS = [
  { name: "One", icon: "mdi:numeric-1", special: "edit" },
  { name: "Two", icon: "mdi:numeric-2", special: "sidebar" },
  { name: "Three", icon: "mdi:numeric-3", tap_action: { action: "navigate", navigation_path: "/config/three" } },
];
const CARD = { type: "custom:origami-header-card", mode: "menu", buttons: BUTTONS, cards: [{ type: "entities" }], css: ".sheet { outline: 3px solid red; }" };
const HEADER = { ...CARD, mode: "header" };
const dashboard = (...cards) => ({ views: [{ path: "home", cards }] });

async function start(page, { config = dashboard(CARD), admin = true, query = "" } = {}) {
  await page.goto(`/test/mock/index.html?${query}`);
  await page.evaluate(() => window.ready);
  await page.evaluate((args) => window.boot(args), { config, admin });
  await page.waitForFunction(() => window.firstFrame);
}

const snapshot = (page) => page.evaluate(() => window.snapshot());

const drawer = (page) =>
  page.evaluate(() => {
    const el = window.root.querySelector("origami-header");
    if (!el) return null;
    const s = el.shadowRoot;
    const rect = (q) => {
      const r = s.querySelector(q).getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    };
    const deep = (node) => (node?.shadowRoot?.activeElement ? deep(node.shadowRoot.activeElement) : node);
    return {
      open: el.hasAttribute("open"),
      bar: rect(".bar"),
      cards: rect(".cards"),
      buttons: rect(".buttons"),
      sheet: rect(".sheet"),
      barNames: [...s.querySelectorAll(".bar .name")].map((l) => l.textContent),
      barCards: [...s.querySelectorAll(".bar hui-card")].map((c) => c.textContent),
      names: [...s.querySelectorAll(".name")].map((l) => l.textContent),
      focus: deep(document.activeElement)?.className ?? null,
    };
  });

const buttons = (page) =>
  page.evaluate(() =>
    [...window.root.querySelector("origami-header").shadowRoot.querySelectorAll(".button")].map((el) => {
      const r = el.getBoundingClientRect();
      const icon = el.querySelector("ha-icon");
      return {
        name: el.querySelector(".name")?.textContent ?? null,
        icon: icon?.getAttribute("icon") ?? null,
        iconColor: icon ? getComputedStyle(icon).color : null,
        label: el.getAttribute("aria-label"),
        options: el.actionHandler?.options ?? null,
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      };
    }),
  );

const command = (page, cmd) =>
  page.evaluate((cmd) => {
    const ev = new Event("ll-custom", { bubbles: true, composed: true });
    ev.detail = { action: "fire-dom-event", origami_header: cmd };
    window.root.dispatchEvent(ev);
  }, cmd);

// Like a button press in Home Assistant: the action handler reports tap, hold or double tap.
const press = (page, index, action = "tap") =>
  page.evaluate(
    ([index, action]) => {
      const el = window.root.querySelector("origami-header").shadowRoot.querySelectorAll(".button")[index];
      if (action === "tap") el.click();
      else el.dispatchEvent(new CustomEvent("action", { detail: { action }, bubbles: true, composed: true }));
    },
    [index, action],
  );

const settled = (page) =>
  expect
    .poll(() => page.evaluate(() => getComputedStyle(window.root.querySelector("origami-header").shadowRoot.querySelector(".sheet")).transform))
    .toBe("none");

// Swipes with one finger and returns where the menu was while the finger was down.
const swipe = (page, dy) =>
  page.evaluate((dy) => {
    const el = window.root.querySelector("origami-header").shadowRoot.querySelector(".sheet");
    const r = el.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const send = (type, at) => {
      const touch = new Touch({ identifier: 1, target: el, clientX: x, clientY: at });
      const touches = type === "touchend" ? [] : [touch];
      el.dispatchEvent(new TouchEvent(type, { touches, changedTouches: [touch], bubbles: true, cancelable: true, composed: true }));
    };
    send("touchstart", y);
    for (let i = 1; i <= 5; i++) send("touchmove", y + (dy * i) / 5);
    const during = el.style.transform;
    send("touchend", y + dy);
    return during;
  }, dy);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.requestIdleCallback = (cb) => setTimeout(cb, 0);
  });
});

for (const order of ["module-first", "app-first"]) {
  test(`replaces the header before the first paint (${order})`, async ({ page }) => {
    await start(page, { query: `order=${order}` });
    const frame = await page.evaluate(() => window.firstFrame);
    expect(frame.assigned).toEqual(["origami-header"]);
    expect(frame.headerBackground).toBe("rgba(0, 0, 0, 0)");
    expect(frame.viewPadding).toBe("0px");
    expect(frame.sheetOutline).toBe("3px");
    expect(await page.evaluate(() => !!customElements.get("origami-header-card"))).toBe(true);
  });
}

test("keeps the default header when the toolbar slot is missing", async ({ page }) => {
  const warnings = [];
  page.on("console", (msg) => msg.type() === "warning" && warnings.push(msg.text()));
  await start(page, { query: "noslot" });
  const frame = await snapshot(page);
  expect(frame.headerDisplay).toBe("block");
  expect(frame.headerBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(frame.viewPadding).toBe("56px");
  expect(warnings.some((w) => w.includes("unsupported"))).toBe(true);
});

test("finds the card in sections, stacks and conditional cards", async ({ page }) => {
  const configs = [
    { views: [{ type: "sections", sections: [{ type: "grid", cards: [{ type: "heading" }, CARD] }] }] },
    dashboard({ type: "vertical-stack", cards: [{ type: "grid", cards: [CARD] }] }),
    { views: [{ cards: [] }, { cards: [{ type: "conditional", conditions: [], card: CARD }] }] },
  ];
  for (const config of configs) {
    await start(page, { config });
    expect((await snapshot(page)).assigned).toEqual(["origami-header"]);
  }
});

test("other users get no header unless all_users is set", async ({ page }) => {
  for (const card of [CARD, HEADER]) {
    await start(page, { admin: false, config: dashboard(card) });
    expect(await snapshot(page)).toMatchObject({ headerDisplay: "none", assigned: [] });

    await start(page, { admin: false, config: dashboard({ ...card, all_users: true }) });
    expect((await snapshot(page)).assigned).toEqual(["origami-header"]);
  }
});

test("only admins get the button that edits the dashboard", async ({ page }) => {
  for (const card of [CARD, HEADER]) {
    await start(page, { admin: false, config: dashboard({ ...card, all_users: true }) });
    await command(page, "open");
    await expect.poll(async () => (await drawer(page)).names).toEqual(["Two", "Three"]);
  }
});

test("hidden mode, or a card with nothing to show, only hides the header", async ({ page }) => {
  for (const card of [{ type: "custom:origami-header-card", mode: "hidden" }, { type: "custom:origami-header-card", mode: "header", buttons: [] }]) {
    await start(page, { config: dashboard(card) });
    expect(await snapshot(page)).toMatchObject({ headerDisplay: "none", assigned: [] });
  }
});

test("without a mode, the buttons and cards form the header", async ({ page }) => {
  const { mode, ...card } = CARD;
  await start(page, { config: dashboard(card) });
  await expect.poll(async () => (await drawer(page))?.barNames).toEqual(["One", "Two", "Three"]);
});

test("header mode shows the buttons and cards as the header and starts the view below it", async ({ page }) => {
  await start(page, { config: dashboard(HEADER) });
  await expect.poll(async () => (await drawer(page)).barCards).toEqual(["card:entities"]);
  expect((await drawer(page)).barNames).toEqual(["One", "Two", "Three"]);
  expect((await snapshot(page)).headerBackground).not.toBe("rgba(0, 0, 0, 0)");
  await expect
    .poll(async () => (await snapshot(page)).viewPadding === `${(await drawer(page)).bar[3]}px`)
    .toBe(true);
});

test("takes a single card as the card editor copies it, without a leading dash", async ({ page }) => {
  await start(page, { config: dashboard({ ...HEADER, buttons: [], cards: { type: "entities" } }) });
  await expect.poll(async () => (await drawer(page))?.barCards).toEqual(["card:entities"]);
});

test("an empty cards field, as the editor leaves it when cleared, shows no card", async ({ page }) => {
  await start(page, { config: dashboard({ ...HEADER, cards: {} }) });
  await expect.poll(async () => (await drawer(page))?.barNames).toEqual(["One", "Two", "Three"]);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect((await drawer(page)).barCards).toEqual([]);
});

test("header mode puts the cards and the buttons as badges in one row, and has no menu", async ({ page }) => {
  const icons = BUTTONS.map(({ name, ...button }) => button);
  await start(page, { config: dashboard({ ...HEADER, buttons: icons }) });
  await expect.poll(async () => (await drawer(page)).barCards).toEqual(["card:entities"]);
  const { bar, cards, buttons: row } = await drawer(page);
  expect(cards[0]).toBe(bar[0] + 16);
  expect(cards[0] + cards[2] + 8).toBe(row[0]);
  expect(row[0] + row[2]).toBe(bar[0] + bar[2] - 16);
  expect(Math.abs(cards[1] + cards[3] / 2 - (row[1] + row[3] / 2))).toBeLessThanOrEqual(1);
  expect((await buttons(page)).map((b) => b.rect.slice(2))).toEqual([[36, 36], [36, 36], [36, 36]]);
  await command(page, "open");
  expect((await drawer(page)).open).toBe(false);
});

test("header mode moves the buttons below the cards when they do not fit next to them", async ({ page }) => {
  const many = Array.from({ length: 8 }, (_, i) => ({ name: `Button ${i + 1}`, icon: "mdi:star" }));
  await start(page, { config: dashboard({ ...HEADER, buttons: many }) });
  await expect.poll(async () => (await drawer(page)).barCards).toEqual(["card:entities"]);
  const { cards, buttons: row } = await drawer(page);
  expect(row[1]).toBeGreaterThanOrEqual(cards[1] + cards[3]);
});

test("a button without an icon shows only its name, a button without a name only its icon", async ({ page }) => {
  const mixed = [{ name: "Text", tap_action: { action: "none" } }, { icon: "mdi:menu", special: "sidebar" }];
  for (const card of [CARD, HEADER]) {
    await start(page, { config: dashboard({ ...card, buttons: mixed }) });
    await command(page, "open");
    await expect.poll(async () => (await buttons(page)).length).toBe(2);
    const [text, icon] = await buttons(page);
    expect(text).toMatchObject({ name: "Text", icon: null, label: "Text" });
    expect(icon).toMatchObject({ name: null, icon: "mdi:menu", label: "Toggle sidebar" });
  }
  expect((await buttons(page))[1].rect.slice(2)).toEqual([36, 36]);
});

test("a button color tints its icon, with theme color names as in tiles and badges", async ({ page }) => {
  const colored = [{ name: "Theme", icon: "mdi:star", color: "amber" }, { name: "Hex", icon: "mdi:star", color: "#00ff00" }];
  for (const card of [CARD, HEADER]) {
    await start(page, { config: dashboard({ ...card, buttons: colored }) });
    await command(page, "open");
    await expect.poll(async () => (await buttons(page)).map((b) => b.iconColor)).toEqual(["rgb(1, 2, 3)", "rgb(0, 255, 0)"]);
  }
});

test("the menu shows the buttons in two columns, or as a grid of four with the icon above the name", async ({ page }) => {
  const six = Array.from({ length: 6 }, (_, i) => ({ name: `B${i}`, icon: "mdi:star" }));
  for (const [layout, columns] of [["list", 2], ["grid", 4]]) {
    await start(page, { config: dashboard({ ...CARD, buttons: six, layout }) });
    await command(page, "open");
    await expect.poll(async () => (await buttons(page)).length).toBe(6);
    const rects = (await buttons(page)).map((b) => b.rect);
    expect(new Set(rects.map((r) => r[1])).size).toBe(Math.ceil(6 / columns));
    const above = await page.evaluate(() => {
      const el = window.root.querySelector("origami-header").shadowRoot.querySelector(".button");
      return el.querySelector("ha-icon").getBoundingClientRect().bottom <= el.querySelector(".name").getBoundingClientRect().top;
    });
    expect(above).toBe(layout === "grid");
  }
});

test("icons are plain in the list and in the header, and sit on a tinted circle in the grid", async ({ page }) => {
  const star = [{ name: "Star", icon: "mdi:star", color: "#00ff00" }];
  const icon = () =>
    page.evaluate(() => {
      const style = getComputedStyle(window.root.querySelector("origami-header").shadowRoot.querySelector(".button ha-icon"));
      return { size: style.getPropertyValue("--mdc-icon-size").trim(), tinted: style.backgroundColor !== "rgba(0, 0, 0, 0)", width: style.width };
    });
  for (const [card, look] of [
    [{ ...CARD, buttons: star }, { size: "20px", tinted: false }],
    [{ ...HEADER, buttons: star }, { size: "18px", tinted: false }],
    [{ ...CARD, buttons: star, layout: "grid" }, { size: "24px", tinted: true, width: "36px" }],
  ]) {
    await start(page, { config: dashboard(card) });
    await command(page, "open");
    await expect.poll(icon).toMatchObject(look);
  }
});

test("the menu stays out of sight until a card opens it, and has the same padding below its content as around it", async ({ page }) => {
  await start(page);
  const visible = () =>
    page.evaluate(() =>
      [...window.root.querySelector("origami-header").shadowRoot.querySelectorAll("*")]
        .filter((el) => el.checkVisibility({ visibilityProperty: true }) && el.getBoundingClientRect().height > 0)
        .map((el) => el.className),
    );
  expect(await visible()).toEqual([]);
  await command(page, "open");
  await settled(page);
  expect(await visible()).toContain("sheet");
  const { sheet, buttons: row } = await drawer(page);
  expect(sheet[1] + sheet[3] - (row[1] + row[3])).toBe(24);
});

test("the menu has the medium Home Assistant shadow, toward the middle of the screen", async ({ page }) => {
  const shadow = () => page.evaluate(() => getComputedStyle(window.root.querySelector("origami-header").shadowRoot.querySelector(".sheet")).boxShadow);
  await start(page);
  expect(await shadow()).toBe("rgba(0, 0, 0, 0.1) 0px 3px 6px -1px, rgba(0, 0, 0, 0.15) 0px 8px 16px -2px");
  await start(page, { config: dashboard({ ...CARD, position: "bottom" }) });
  expect(await shadow()).toBe("rgba(0, 0, 0, 0.1) 0px -3px 6px -1px, rgba(0, 0, 0, 0.15) 0px -8px 16px -2px");
});

test("the menu follows a swipe toward its edge and closes, a short swipe lets it spring back", async ({ page }) => {
  for (const [position, sign] of [["top", -1], ["bottom", 1]]) {
    await start(page, { config: dashboard({ ...CARD, position }) });
    await command(page, "open");
    await settled(page);

    expect(await swipe(page, sign * 20)).toBe(`translateY(${sign * 20}px)`);
    expect((await drawer(page)).open).toBe(true);
    await settled(page);

    expect(await swipe(page, -sign * 100)).toBe("");
    expect((await drawer(page)).open).toBe(true);

    await swipe(page, sign * 100);
    expect((await drawer(page)).open).toBe(false);
  }
});

test("focus moves to a button only when a card opens the menu from the keyboard, and goes back when it closes", async ({ page }) => {
  await start(page);
  // A card on the dashboard with a fire-dom-event action.
  await page.evaluate(() => {
    const card = Object.assign(document.createElement("button"), { className: "opener", textContent: "Menu" });
    card.addEventListener("click", () => {
      const ev = new Event("ll-custom", { bubbles: true, composed: true });
      ev.detail = { action: "fire-dom-event", origami_header: "toggle" };
      card.dispatchEvent(ev);
    });
    window.root.shadowRoot.querySelector("#view").append(card);
  });
  await page.click(".opener");
  await expect.poll(async () => (await drawer(page)).focus).toBe("sheet");
  await page.keyboard.press("Escape");
  expect((await drawer(page)).focus).toBe("opener");

  await page.keyboard.press("Enter");
  await expect.poll(async () => (await drawer(page)).focus).toBe("button");
  await page.keyboard.press("Escape");
  expect((await drawer(page)).focus).toBe("opener");
});

test("follows dashboard changes without a reload", async ({ page }) => {
  await start(page);
  await command(page, "open");
  await expect.poll(async () => (await drawer(page)).names).toEqual(["One", "Two", "Three"]);

  await page.evaluate((config) => window.save(config), dashboard({ ...CARD, buttons: [{ name: "New", icon: "mdi:star" }] }));
  await command(page, "open");
  await expect.poll(async () => (await drawer(page)).names).toEqual(["New"]);

  await page.evaluate((config) => window.save(config), dashboard());
  await expect.poll(async () => (await snapshot(page)).viewPadding).toBe("56px");
  expect(await snapshot(page)).toMatchObject({ headerDisplay: "block", assigned: [] });
});

test("shows the default header in edit mode and the custom header again after it", async ({ page }) => {
  const many = Array.from({ length: 8 }, (_, i) => ({ name: `Button ${i + 1}`, icon: "mdi:star" }));
  await start(page, { config: dashboard({ ...HEADER, buttons: many }) });
  const below = async () => (await snapshot(page)).viewPadding === `${(await drawer(page)).bar[3]}px`;
  await expect.poll(below).toBe(true);
  expect((await drawer(page)).bar[3]).toBeGreaterThan(56);

  await page.evaluate(() => window.root.lovelace.setEditMode(true));
  await expect.poll(async () => (await snapshot(page)).viewPadding).toBe("56px");
  expect(await page.evaluate(() => !!window.root.shadowRoot.querySelector(".toolbar.edit"))).toBe(true);

  await page.evaluate(() => window.root.lovelace.setEditMode(false));
  await expect.poll(below).toBe(true);
});

test("runs the buttons in the menu and in the header", async ({ page }) => {
  for (const card of [CARD, HEADER]) {
    await start(page, { config: dashboard(card) });
    for (const index of [1, 2, 0]) {
      await command(page, "open");
      await press(page, index);
    }
    const events = await page.evaluate(() => window.events);
    expect(events.map((e) => e.type)).toEqual(["hass-toggle-menu", "hass-action", "enable-edit-mode"]);
    expect(events[1].detail).toMatchObject({ action: "tap", config: { tap_action: { navigation_path: "/config/three" } } });
    expect((await drawer(page)).open).toBe(false);
  }
});

test("buttons use the hold and double tap actions of Home Assistant", async ({ page }) => {
  const nav = (path) => ({ action: "navigate", navigation_path: path });
  const gestures = [
    { name: "All", icon: "mdi:star", tap_action: nav("/tap"), hold_action: nav("/hold"), double_tap_action: nav("/double") },
    { name: "None", icon: "mdi:star", hold_action: { action: "none" } },
  ];
  await start(page, { config: dashboard({ ...HEADER, buttons: gestures }) });
  expect((await buttons(page)).map((b) => b.options)).toEqual([{ hasHold: true, hasDoubleClick: true }, { hasHold: false, hasDoubleClick: false }]);
  for (const [index, action] of [[0, "hold"], [0, "double_tap"], [0, "tap"], [1, "tap"], [1, "hold"]]) await press(page, index, action);
  const events = await page.evaluate(() => window.events);
  expect(events.map((e) => `${e.detail.action} ${e.detail.config[`${e.detail.action}_action`].navigation_path}`)).toEqual(["hold /hold", "double_tap /double", "tap /tap"]);
});

test("buttons still react to taps without the action handler of Home Assistant", async ({ page }) => {
  await start(page, { config: dashboard(HEADER), query: "noactionhandler" });
  await press(page, 2);
  expect((await page.evaluate(() => window.events)).map((e) => e.type)).toEqual(["hass-action"]);
});

test("any card can open, close and toggle the menu, edit the dashboard and toggle the sidebar", async ({ page }) => {
  await start(page);
  for (const [cmd, open] of [["open", true], ["toggle", false], ["toggle", true], ["close", false]]) {
    await command(page, cmd);
    expect((await drawer(page)).open).toBe(open);
  }
  await command(page, "sidebar");
  await command(page, "edit");
  expect((await page.evaluate(() => window.events)).map((e) => e.type)).toEqual(["hass-toggle-menu", "enable-edit-mode"]);
});

test("cards that hand their actions to Home Assistant can also open the menu, edit the dashboard and toggle the sidebar", async ({ page }) => {
  await start(page);
  const send = (cmd) =>
    page.evaluate((cmd) => {
      const config = { tap_action: { action: "fire-dom-event", origami_header: cmd } };
      const card = window.root.shadowRoot.querySelector("#view");
      card.dispatchEvent(new CustomEvent("hass-action", { detail: { config, action: "tap" }, bubbles: true, composed: true }));
    }, cmd);
  await send("open");
  expect((await drawer(page)).open).toBe(true);
  await send("close");
  expect((await drawer(page)).open).toBe(false);
  await send("sidebar");
  await send("edit");
  const events = (await page.evaluate(() => window.events)).filter((e) => e.type !== "hass-action");
  expect(events.map((e) => [e.type, e.target])).toEqual([["hass-toggle-menu", "hui-root"], ["enable-edit-mode", undefined]]);

  // After a switch to another dashboard, the commands go to that one.
  await page.evaluate((config) => {
    window.root.remove();
    window.boot({ config });
  }, dashboard(CARD));
  await send("open");
  expect((await drawer(page)).open).toBe(true);
});

test("card is invisible on the dashboard and previews the header or menu in edit mode", async ({ page }) => {
  await start(page);
  const mount = (config) =>
    page.evaluate((config) => {
      window.host?.remove();
      const host = document.createElement("hui-card");
      host.config = config;
      host.hass = window.root.hass;
      host.preview = false;
      document.body.append(host);
      host.load();
      window.host = host;
    }, config);
  const card = () =>
    page.evaluate(() => {
      const el = window.host._el;
      if (!el) return null;
      const s = el.shadowRoot;
      const shown = (q) => getComputedStyle(s.querySelector(q)).display !== "none";
      return {
        hidden: window.host.hasAttribute("hidden"),
        attached: el.parentElement === window.host,
        bar: shown(".bar"),
        sheet: shown(".sheet"),
        note: shown(".note"),
        inert: s.querySelector(".bar").inert && s.querySelector(".sheet").inert,
        position: getComputedStyle(s.querySelector(".sheet")).position,
        shadow: getComputedStyle(s.querySelector(".sheet")).boxShadow,
        names: [...s.querySelectorAll(".name")].map((l) => l.textContent),
        cards: [...s.querySelectorAll("hui-card")].map((c) => c.textContent),
        size: el.getCardSize(),
      };
    });
  const preview = () =>
    page.evaluate(() => {
      window.host.preview = true;
    });

  await mount(CARD);
  await expect.poll(async () => (await card())?.hidden).toBe(true);
  expect(await card()).toMatchObject({ attached: false, size: 0 });
  await preview();
  expect(await card()).toMatchObject({ hidden: false, attached: true, bar: false, sheet: true, position: "relative", shadow: "none", names: ["One", "Two", "Three"], size: 4 });
  await expect.poll(async () => (await card()).cards).toEqual(["card:entities"]);

  await mount(HEADER);
  await expect.poll(async () => (await card())?.hidden).toBe(true);
  await preview();
  await expect.poll(async () => (await card()).cards).toEqual(["card:entities"]);
  expect(await card()).toMatchObject({ bar: true, sheet: false, inert: true, names: ["One", "Two", "Three"] });

  await mount({ type: "custom:origami-header-card", mode: "hidden" });
  await expect.poll(async () => (await card())?.hidden).toBe(true);
  await preview();
  expect(await card()).toMatchObject({ bar: false, sheet: false, note: true });
});

test("offers a visual editor and a starter config", async ({ page }) => {
  await start(page);
  const editor = await page.evaluate(() => {
    const Card = customElements.get("origami-header-card");
    const form = Card.getConfigForm();
    const field = (name) => form.schema.find((s) => s.name === name);
    const rejects = (config) => {
      try {
        form.assertConfig(config);
        return false;
      } catch {
        return true;
      }
    };
    // Home Assistant shows a field while its condition holds for the current config.
    const visible = (schema, mode) => {
      const { field: key, operator = "eq", value } = schema.visible ?? {};
      if (!key) return true;
      return operator === "eq" ? mode === value : mode !== value;
    };
    const names = form.schema.map((s) => s.name);
    return {
      names,
      mode: field("mode").selector.select,
      shown: Object.fromEntries([undefined, "menu", "header", "hidden"].map((mode) => [mode ?? "default", names.filter((_, i) => visible(form.schema[i], mode))])),
      fields: Object.keys(field("buttons").selector.object.fields),
      actions: field("buttons").selector.object.fields.tap_action.selector.ui_action,
      label: form.computeLabel({ name: "mode" }),
      helpers: names.filter((name) => form.computeHelper({ name })),
      css: field("css"),
      docs: window.customCards.find((c) => c.type === "origami-header-card").documentationURL,
      rejects: [rejects({ buttons: "x" }), rejects({ cards: "x" }), rejects({ buttons: [], cards: [] }), rejects({ cards: { type: "entities" } }), rejects({ cards: {} })],
      stub: Card.getStubConfig(),
    };
  });
  expect(editor.names).toEqual(["mode", "buttons", "cards", "", "all_users", "css"]);
  expect(editor.mode).toMatchObject({ mode: "box", box_max_columns: 1 });
  expect(editor.mode.options).toEqual([
    { value: "header", label: "Custom header", description: "Your buttons and cards form the header." },
    { value: "menu", label: "Fold-out menu", description: "Hides the header. Your buttons and cards fold out when another card opens the menu." },
    { value: "hidden", label: "No header", description: "Hides the header, for example on wall tablets." },
  ]);
  expect(editor.shown).toEqual({
    default: ["mode", "buttons", "cards", "all_users", "css"],
    menu: ["mode", "buttons", "cards", "", "all_users", "css"],
    header: ["mode", "buttons", "cards", "all_users", "css"],
    hidden: ["mode"],
  });
  expect(editor.fields).toEqual(["name", "icon", "color", "special", "tap_action", "hold_action", "double_tap_action"]);
  expect(editor.actions).toEqual({ actions: ["navigate", "url", "perform-action", "assist", "none"], default_action: "none" });
  expect(editor.label).toBe("Header");
  expect(editor.helpers).toEqual(["all_users", "css"]);
  // CSS gets the same code editor as the cards field, with an example instead of the template placeholder.
  expect(editor.css).toMatchObject({ selector: { template: { preview: false } }, default: ".scrim { backdrop-filter: blur(12px); }" });
  expect(editor.docs).toBe("https://github.com/hazymorning/origami_header#styling");
  expect(editor.rejects).toEqual([true, true, false, false, false]);
  expect(editor.stub.mode).toBe("header");
  expect(editor.stub.buttons.map((b) => b.special || b.tap_action.navigation_path)).toEqual(["edit", "/config/automation/dashboard", "/config/tools", "sidebar"]);
  expect(editor.stub.buttons.map((b) => b.name)).toEqual(["Edit", "Automations", "Tools", "Sidebar"]);
});

test("starts only once when loaded twice", async ({ page }) => {
  await start(page, { query: "twice" });
  expect(await page.evaluate(() => window.customCards.filter((c) => c.type === "origami-header-card").length)).toBe(1);
  await command(page, "toggle");
  expect((await drawer(page)).open).toBe(true);
});

test("uses German labels when Home Assistant runs in German", async ({ page }) => {
  await start(page, { query: "lang=de", config: dashboard({ type: "custom:origami-header-card" }) });
  await expect.poll(async () => (await drawer(page))?.names).toContain("Seiten\u00adleiste");
  const form = await page.evaluate(() => {
    const { schema, computeLabel } = customElements.get("origami-header-card").getConfigForm();
    return { label: computeLabel({ name: "mode" }), modes: schema[0].selector.select.options.map((o) => o.label) };
  });
  expect(form).toEqual({ label: "Kopfzeile", modes: ["Eigene Kopfzeile", "Ausklappmenü", "Keine Kopfzeile"] });
});
