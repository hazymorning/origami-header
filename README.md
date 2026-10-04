# ◪ Origami Header

Origami Header replaces the Home Assistant dashboard header with your own buttons and cards. Unlike hiding the header with kiosk-mode or a theme, nothing flashes while the dashboard loads, and edit mode and the sidebar stay within reach.

## Installation

Add this repository to HACS as a custom repository of type Dashboard and download it. Then add it to `configuration.yaml` as an extra module, not as a dashboard resource, and restart Home Assistant:

```yaml
frontend:
  extra_module_url:
    - /hacsfiles/origami_header/origami-header.js
```

<details>
<summary>Manual installation</summary>

Download `origami-header.js` from the latest release into `config/www` and use `/local/origami-header.js?v=0.2.0` as the extra module URL. Change the version after each update so browsers load the new file.

</details>

## Usage

Edit a dashboard, add the Origami Header card to any view and choose a mode. The card is invisible on the dashboard and shows a preview while you edit. In edit mode the default header comes back.

| Mode | What you see |
| --- | --- |
| `menu` (default) | The header is hidden. A handle at the top opens a menu with your buttons and cards. |
| `header` | Your buttons and cards are the header. |
| `hidden` | The header is hidden. |

Only admins see it unless you turn on `all_users`. Other users get no header.

<details>
<summary>Buttons</summary>

Each button has a `label`, an `icon` and a `tap_action`. Use `special: edit` or `special: sidebar` instead of an action to turn on edit mode or open the sidebar.

```yaml
type: custom:origami-header-card
mode: header
buttons:
  - label: Edit
    icon: mdi:pencil-outline
    special: edit
  - label: Automations
    icon: mdi:robot-outline
    tap_action:
      action: navigate
      navigation_path: /config/automation/dashboard
  - label: Menu
    icon: mdi:menu
    special: sidebar
```

</details>

<details>
<summary>Opening the menu</summary>

Tap the handle or pull it down. To close the menu, tap outside, press Escape or push the grip back.

To open it from your own button, use this action. `open` and `close` work as well.

```yaml
tap_action:
  action: fire-dom-event
  origami_header: toggle
```

</details>

<details>
<summary>Options</summary>

All options are also available in the card editor.

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `menu` | `menu`, `header` or `hidden` |
| `buttons` | Edit, Automations, Tools, Menu | Your buttons |
| `cards` | | A card or a list of cards, shown above the buttons |
| `position` | `top` | Where the menu opens, `top` or `bottom` |
| `layout` | `list` | `list`, `grid` or `icons`. In the header the buttons always stay in one row. |
| `all_users` | `false` | Show it to all users, not only admins |
| `hide_handle` | `false` | Hide the handle when you open the menu from your own button |
| `css` | | Custom styles |

</details>

<details>
<summary>Styling</summary>

The `css` option is applied inside the card, so you can target its parts directly.

| Class | Part |
| --- | --- |
| `.bar` | Header |
| `.handle`, `.grip` | Handle that opens the menu, grip that closes it |
| `.scrim` | Backdrop behind the menu |
| `.sheet` | Menu |
| `.cards`, `.grid` | Cards, buttons |
| `.tile`, `.tile ha-icon`, `.label` | Button, its icon, its label |

```yaml
css: |
  .sheet { border-radius: 0 0 28px 28px; }
  .scrim { backdrop-filter: blur(12px); }
```

The [examples](examples) folder has a header and a menu with custom styles. They use [paper-buttons-row](https://github.com/jcwillox/lovelace-paper-buttons-row) and the System Monitor integration.

</details>

<details>
<summary>How it works</summary>

Home Assistant renders the header into a slot inside `hui-root`. Origami Header fills that slot with its own element during the same render, before the browser paints, so the default header is never drawn. If a Home Assistant update changes this, the module logs a warning and leaves the default header alone.

</details>

## Made with AI

After years of kiosk-mode and theme workarounds, AI helped me find a real fix for the header flash and polish the code further than I would have had time for.
