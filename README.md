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

Download `origami-header.js` from the latest release into `config/www` and use `/local/origami-header.js?v=0.3.0` as the extra module URL. Change the version after each update so browsers load the new file.

</details>

## Usage

Edit a dashboard, add the Origami Header card to any view and choose what happens to the header. The card is invisible on the dashboard and shows a preview while you edit. In edit mode the default header comes back.

| Header | `mode` | What you see |
| --- | --- | --- |
| Fold-out menu | `menu` (default) | The header is hidden. A handle at the edge of the screen opens a menu with your buttons and cards. |
| Custom header | `header` | Your cards and buttons form the header. |
| No header | `hidden` | The header is hidden. |

Only admins see it unless you turn on `all_users`. Other users get no header.

<details>
<summary>Buttons and cards</summary>

Buttons work like the button badges of a heading card. In the menu they look like tiles, in the header like badges. Leave out the icon to show only the name, or the name to show only the icon.

| Option | Description |
| --- | --- |
| `name` | Text of the button |
| `icon` | Icon of the button |
| `color` | A theme color such as `amber` or `primary`, or any CSS color |
| `special` | `edit` turns on edit mode, `sidebar` toggles the sidebar. Replaces `tap_action`. Only admins see the edit button. |
| `tap_action`, `hold_action`, `double_tap_action` | Actions as on tiles and badges |

Cards can be any cards. In the header they take the space before the buttons, and the buttons move to a second row when there is not enough room. A heading card gives you a title and entity badges, like the header of a sections view.

```yaml
type: custom:origami-header-card
mode: header
cards:
  - type: heading
    heading: Home
    badges:
      - type: entity
        entity: sensor.outside_temperature
buttons:
  - icon: mdi:pencil-outline
    special: edit
  - name: Automations
    icon: mdi:robot-outline
    color: blue
    tap_action:
      action: navigate
      navigation_path: /config/automation/dashboard
  - icon: mdi:menu
    special: sidebar
```

</details>

<details>
<summary>Opening the menu</summary>

Tap the handle or pull it. To close the menu, tap outside, press Escape or swipe it back toward its edge.

Any card can use a `fire-dom-event` action with `origami_header` set to `open`, `close`, `toggle`, `edit` or `sidebar`, for example to open the menu when the handle is hidden:

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
| `buttons` | Edit, Automations, Tools, Sidebar | Your buttons |
| `cards` | | A card or a list of cards, shown before the buttons |
| `position` | `top` | Where the menu opens, `top` or `bottom` |
| `layout` | `list` | Buttons in the menu, `list` for two columns or `grid` for four with the icon above the name |
| `hide_handle` | `false` | Hide the handle when another card opens the menu |
| `all_users` | `false` | Show it to all users, not only admins |
| `css` | | Custom styles |

</details>

<details>
<summary>Styling</summary>

Buttons follow the theme variables of tiles and badges, such as `--ha-card-background`, `--ha-card-border-radius` and `--ha-badge-size`. The backdrop of the menu uses `--ha-dialog-scrim-backdrop-filter`, like dialogs.

The `css` option is applied inside the card, so you can target its parts directly.

| Class | Part |
| --- | --- |
| `.bar` | Header |
| `.handle` | Handle that opens the menu |
| `.scrim` | Backdrop behind the menu |
| `.sheet` | Menu |
| `.cards`, `.buttons` | Cards, buttons |
| `.button`, `.button ha-icon`, `.name` | Button, its icon, its name |

```yaml
css: |
  .sheet { border-radius: 0 0 28px 28px; }
  .scrim { backdrop-filter: blur(12px); }
```

The [examples](examples) folder has a header and a menu. They use the System Monitor integration.

</details>

<details>
<summary>How it works</summary>

Home Assistant renders the header into a slot inside `hui-root`. Origami Header fills that slot with its own element during the same render, before the browser paints, so the default header is never drawn. If a Home Assistant update changes this, the module logs a warning and leaves the default header alone.

</details>

## Made with AI

After years of kiosk-mode and theme workarounds, AI helped me find a real fix for the header flash and polish the code further than I would have had time for.
