import { test, expect } from "@playwright/test";

const BUTTONS = [
  { label: "One", icon: "mdi:numeric-1", special: "edit" },
  { label: "Two", icon: "mdi:numeric-2", special: "sidebar" },
  { label: "Three", icon: "mdi:numeric-3", tap_action: { action: "navigate", navigation_path: "/config/three" } },
];
const CARD = { type: "custom:origami-header-card", buttons: BUTTONS, cards: [{ type: "entities" }], css: ".sheet { outline: 3px solid red; }" };
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
      handle: s.querySelector(".handle").getBoundingClientRect().width > 0,
      bar: rect(".bar"),
      scrim: rect(".scrim"),
      barLabels: [...s.querySelectorAll(".bar .label")].map((l) => l.textContent),
      barCards: [...s.querySelectorAll(".bar hui-card")].map((c) => c.textContent),
      labels: [...s.querySelectorAll(".label")].map((l) => l.textContent),
      focus: deep(document.activeElement)?.className ?? null,
    };
  });

const command = (page, cmd) =>
  page.evaluate((cmd) => {
    const ev = new Event("ll-custom", { bubbles: true, composed: true });
    ev.detail = { action: "fire-dom-event", origami_header: cmd };
    window.root.dispatchEvent(ev);
  }, cmd);

const center = (page, selector) =>
  page.evaluate((selector) => {
    const r = window.root.querySelector("origami-header").shadowRoot.querySelector(selector).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector);

const settled = (page) =>
  expect
    .poll(() => page.evaluate(() => getComputedStyle(window.root.querySelector("origami-header").shadowRoot.querySelector(".sheet")).transform))
    .toBe("none");

async function drag(page, selector, dy) {
  const { x, y } = await center(page, selector);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps: 6 });
  await page.mouse.up();
}

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

test("hidden mode, or a card with nothing to show, only hides the header", async ({ page }) => {
  for (const card of [{ type: "custom:origami-header-card", mode: "hidden" }, { type: "custom:origami-header-card", mode: "header", buttons: [] }]) {
    await start(page, { config: dashboard(card) });
    expect(await snapshot(page)).toMatchObject({ headerDisplay: "none", assigned: [] });
  }
});

test("header mode shows the buttons and cards as the header and starts the view below it", async ({ page }) => {
  await start(page, { config: dashboard(HEADER) });
  await expect.poll(async () => (await drawer(page)).barCards).toEqual(["card:entities"]);
  expect(await drawer(page)).toMatchObject({ barLabels: ["One", "Two", "Three"], handle: false });
  expect((await snapshot(page)).headerBackground).not.toBe("rgba(0, 0, 0, 0)");
  await expect
    .poll(async () => (await snapshot(page)).viewPadding === `${(await drawer(page)).bar[3]}px`)
    .toBe(true);
});

test("takes a single card as the card editor copies it, without a leading dash", async ({ page }) => {
  await start(page, { config: dashboard({ ...HEADER, buttons: [], cards: { type: "entities" } }) });
  await expect.poll(async () => (await drawer(page))?.barCards).toEqual(["card:entities"]);
});

test("header mode shows the buttons in one row and has no menu", async ({ page }) => {
  await start(page, { config: dashboard(HEADER) });
  const rows = await page.evaluate(() => {
    const tiles = window.root.querySelector("origami-header").shadowRoot.querySelectorAll(".bar .tile");
    return new Set([...tiles].map((tile) => Math.round(tile.getBoundingClientRect().top))).size;
  });
  expect(rows).toBe(1);
  await command(page, "open");
  expect((await drawer(page)).open).toBe(false);
});

test("the handle opens on tap and on pull, the grip closes on tap and on pull", async ({ page }) => {
  await start(page);
  expect((await drawer(page)).handle).toBe(true);

  await page.click("origami-header >> .handle");
  expect((await drawer(page)).open).toBe(true);
  await page.click("origami-header >> .grip");
  expect((await drawer(page)).open).toBe(false);

  await drag(page, ".handle", 60);
  expect((await drawer(page)).open).toBe(true);
  await settled(page);
  await drag(page, ".grip", -60);
  expect((await drawer(page)).open).toBe(false);
});

test("hide_handle removes the handle, a card can still open the menu", async ({ page }) => {
  await start(page, { config: dashboard({ ...CARD, hide_handle: true }) });
  expect((await drawer(page)).handle).toBe(false);
  await command(page, "toggle");
  expect((await drawer(page)).open).toBe(true);
  await page.keyboard.press("Escape");
  expect((await drawer(page)).open).toBe(false);
});

test("focus moves to a button only when opened with the keyboard", async ({ page }) => {
  await start(page);
  await page.click("origami-header >> .handle");
  await expect.poll(async () => (await drawer(page)).focus).toBe("sheet");
  await page.keyboard.press("Escape");

  await page.evaluate(() => window.root.querySelector("origami-header").shadowRoot.querySelector(".handle").focus());
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await drawer(page)).focus).toBe("tile");
  await page.keyboard.press("Escape");
  expect((await drawer(page)).focus).toBe("handle");
});

test("follows dashboard changes without a reload", async ({ page }) => {
  await start(page);
  await command(page, "open");
  await expect.poll(async () => (await drawer(page)).labels).toEqual(["One", "Two", "Three"]);

  await page.evaluate((config) => window.save(config), dashboard({ ...CARD, buttons: [{ label: "New", icon: "mdi:star" }] }));
  await command(page, "open");
  await expect.poll(async () => (await drawer(page)).labels).toEqual(["New"]);

  await page.evaluate((config) => window.save(config), dashboard());
  await expect.poll(async () => (await snapshot(page)).viewPadding).toBe("56px");
  expect(await snapshot(page)).toMatchObject({ headerDisplay: "block", assigned: [] });
});

test("shows the default header in edit mode", async ({ page }) => {
  await start(page, { config: dashboard(HEADER) });
  await page.evaluate(() => window.root.lovelace.setEditMode(true));
  await expect.poll(async () => (await snapshot(page)).viewPadding).toBe("56px");
  expect(await page.evaluate(() => !!window.root.shadowRoot.querySelector(".toolbar.edit"))).toBe(true);
});

test("runs the buttons in the menu and in the header", async ({ page }) => {
  for (const card of [CARD, HEADER]) {
    await start(page, { config: dashboard(card) });
    for (const index of [1, 2, 0]) {
      await command(page, "open");
      await page.evaluate((i) => window.root.querySelector("origami-header").shadowRoot.querySelectorAll(".tile")[i].click(), index);
    }
    const events = await page.evaluate(() => window.events);
    expect(events.map((e) => e.type)).toEqual(["hass-toggle-menu", "hass-action", "enable-edit-mode"]);
    expect(events[1].detail.config.tap_action.navigation_path).toBe("/config/three");
  }
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
        position: getComputedStyle(s.querySelector(".sheet")).position,
        labels: [...s.querySelectorAll(".label")].map((l) => l.textContent),
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
  expect(await card()).toMatchObject({ hidden: false, attached: true, bar: false, sheet: true, position: "relative", labels: ["One", "Two", "Three"], size: 4 });
  await expect.poll(async () => (await card()).cards).toEqual(["card:entities"]);

  await mount(HEADER);
  await expect.poll(async () => (await card())?.hidden).toBe(true);
  await preview();
  await expect.poll(async () => (await card()).cards).toEqual(["card:entities"]);
  expect(await card()).toMatchObject({ bar: true, sheet: false, labels: ["One", "Two", "Three"] });

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
    const buttons = form.schema.find((s) => s.name === "buttons").selector.object;
    const rejects = (config) => {
      try {
        form.assertConfig(config);
        return false;
      } catch {
        return true;
      }
    };
    const names = form.schema.map((s) => s.name);
    return {
      names,
      modes: form.schema[0].selector.select.options.map((o) => o.value),
      fields: Object.keys(buttons.fields),
      label: form.computeLabel({ name: "buttons" }),
      helpers: names.filter((name) => form.computeHelper({ name })),
      rejects: [rejects({ buttons: "x" }), rejects({ cards: "x" }), rejects({ buttons: [], cards: [] }), rejects({ cards: { type: "entities" } })],
      stub: Card.getStubConfig().buttons.map((b) => b.special || b.tap_action.navigation_path),
    };
  });
  expect(editor).toEqual({
    names: ["mode", "buttons", "cards", "", "all_users", "hide_handle", "css"],
    modes: ["menu", "header", "hidden"],
    fields: ["label", "icon", "special", "tap_action"],
    label: "Buttons",
    helpers: ["all_users", "css"],
    rejects: [true, true, false, false],
    stub: ["edit", "/config/automation/dashboard", "/config/tools", "sidebar"],
  });
});

test("starts only once when loaded twice", async ({ page }) => {
  await start(page, { query: "twice" });
  expect(await page.evaluate(() => window.customCards.filter((c) => c.type === "origami-header-card").length)).toBe(1);
  await command(page, "toggle");
  expect((await drawer(page)).open).toBe(true);
});

test("uses German labels when Home Assistant runs in German", async ({ page }) => {
  await start(page, { query: "lang=de", config: dashboard({ type: "custom:origami-header-card" }) });
  await command(page, "open");
  await expect.poll(async () => (await drawer(page)).labels).toContain("Menü");
  const modes = await page.evaluate(() => customElements.get("origami-header-card").getConfigForm().schema[0].selector.select.options.map((o) => o.label));
  expect(modes).toEqual(["Menü", "Header", "Ausgeblendet"]);
});
