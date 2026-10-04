# ◪ Origami Header

Origami Header replaces the Home Assistant dashboard header with your own cards, a pull-down drawer, or both. Unlike hiding the header with kiosk-mode or a theme, nothing flashes while the dashboard loads, and edit mode and the sidebar stay within reach.

## Installation

Add this repository to HACS as a custom repository of type Dashboard and download it. Then add it to `configuration.yaml` as an extra module, not as a dashboard resource, and restart Home Assistant:

```yaml
frontend:
  extra_module_url:
    - /hacsfiles/origami_header/origami-header.js
```

<details>
<summary>Manual installation</summary>

Download `origami-header.js` from the latest release into `config/www` and use `/local/origami-header.js?v=0.1.0` as the extra module URL. Change the version after each update so browsers load the new file.

</details>

## Usage

Edit a dashboard, add the Origami Header card to any view and choose a mode. The card is invisible on the dashboard and shows a preview while you edit. In edit mode the default header comes back.

| Mode | Header | Drawer |
| --- | --- | --- |
| `drawer` (default) | Hidden | Handle at the top of the screen |
| `header` | Your header cards | Handle below the header |
| `hidden` | Hidden | None |

<details>
<summary>Opening the drawer</summary>

Tap the handle or pull it down. To close the drawer, tap outside, press Escape or push the grip back.

To open it from your own button, use this action. `open` and `close` work as well.

```yaml
tap_action:
  action: fire-dom-event
  origami_header: toggle
```

</details>

<details>
<summary>Header example</summary>

A title with a temperature badge, and the default shortcuts in the drawer. Add `items: []` to leave out the drawer.

```yaml
type: custom:origami-header-card
mode: header
header:
  - type: heading
    heading: Home
    heading_style: title
    badges:
      - type: entity
        entity: sensor.outdoor_temperature
```

The [examples](examples) folder has two complete setups. They use [paper-buttons-row](https://github.com/jcwillox/lovelace-paper-buttons-row) and the System Monitor integration.

</details>

<details>
<summary>Options</summary>

All options are also available in the card editor.

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `drawer` | `drawer`, `header` or `hidden` |
| `header` | | Cards for the header. Without them the dashboard title is shown. |
| `cards` | | Cards at the top of the drawer |
| `items` | eight shortcuts | Shortcuts in the drawer |
| `position` | `top` | `top` or `bottom` |
| `layout` | `list` | `list`, `grid` or `icons` |
| `all_users` | `false` | Let non-admin users open the drawer. In drawer mode they otherwise see no header. |
| `hide_handle` | `false` | Hide the handle when you open the drawer from a button |
| `css` | | Custom styles |

</details>

<details>
<summary>Shortcuts</summary>

Each shortcut has a `label`, an `icon` and a `tap_action`. Use `special: edit` or `special: sidebar` instead of an action to turn on edit mode or open the sidebar.

```yaml
items:
  - label: Edit
    icon: mdi:pencil-outline
    special: edit
  - label: Automations
    icon: mdi:robot-outline
    tap_action:
      action: navigate
      navigation_path: /config/automation/dashboard
```

</details>

<details>
<summary>Styling</summary>

The `css` option is applied inside the card, so you can target its parts directly.

| Class | Part |
| --- | --- |
| `.bar`, `.bar-cards`, `.title` | Header, header cards, dashboard title |
| `.handle`, `.grip` | Handle that opens the drawer, grip that closes it |
| `.scrim` | Backdrop behind the drawer |
| `.sheet` | Drawer |
| `.cards`, `.grid` | Drawer cards, shortcuts |
| `.tile`, `.tile ha-icon`, `.label` | Shortcut, its icon, its label |

```yaml
css: |
  .sheet { border-radius: 0 0 28px 28px; }
  .scrim { backdrop-filter: blur(12px); }
```

</details>

<details>
<summary>How it works</summary>

Home Assistant renders the header into a slot inside `hui-root`. Origami Header fills that slot with its own element during the same render, before the browser paints, so the default header is never drawn. If a Home Assistant update changes this, the module logs a warning and leaves the default header alone.

</details>

## Made with AI

After years of kiosk-mode and theme workarounds, AI helped me find a real fix for the header flash and polish the code further than I would have had time for.
