# Origami Header

Replaces the Home Assistant dashboard header with your own buttons and cards, as a custom header or as a fold-out menu. The default header never flashes while the dashboard loads, and edit mode and the sidebar stay within reach.

![Fold-out menu and custom header](https://raw.githubusercontent.com/hazymorning/origami_header/main/.github/screenshot.png)

## Installation

Add this repository to [HACS](https://hacs.xyz) as a custom repository of type Dashboard and download it. Load it as an extra module, not as a dashboard resource, and restart Home Assistant:

```yaml
frontend:
  extra_module_url:
    - /hacsfiles/origami_header/origami-header.js
```

<details>
<summary>Manual installation</summary>

Download `origami-header.js` from the [latest release](https://github.com/hazymorning/origami_header/releases/latest) into `config/www` and use `/local/origami-header.js?v=0.4.3` as the extra module URL. Change the version after each update so browsers load the new file.

</details>

## Usage

Add the Origami Header card to any view and choose what happens to the header. The card is invisible on the dashboard. In edit mode it shows a preview and the default header comes back. Only admins see it, and other users get no header, unless `all_users` is on.

| `mode` | Result |
| --- | --- |
| `header` (default) | Custom header. Your cards and buttons form the header. |
| `menu` | Fold-out menu. The header is hidden, and another card opens your buttons and cards. |
| `hidden` | No header. |

<details>
<summary>Buttons and cards</summary>

Buttons work like the button badges of a heading card. They look like badges in the header and like small cards in the menu.

| Option | Description |
| --- | --- |
| `name`, `icon` | Leave out one to show only the other |
| `color` | A theme color such as `amber`, or any CSS color |
| `special` | `edit` or `sidebar`, used instead of `tap_action`. Only admins see the edit button. |
| `tap_action`, `hold_action`, `double_tap_action` | Actions as on tiles and badges |

`cards` takes any cards. A heading card adds a title and entity badges, as in the header of a sections view. In the header the cards fill the row, and the buttons move to a second row when there is not enough room.

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
  - icon: mdi:menu
    special: sidebar
```

The [examples](examples) folder has a complete header and menu.

</details>

<details>
<summary>Opening the menu</summary>

Give another card, such as a button card or a tile, a `fire-dom-event` action with `origami_header` set to `open` or `toggle`:

```yaml
tap_action:
  action: fire-dom-event
  origami_header: toggle
```

To close the menu, tap outside, press Escape or swipe it back toward its edge. The same action also takes `close`, `edit` and `sidebar`. If no card opens the menu, add `?edit=1` to the dashboard URL to get to edit mode.

</details>

<details>
<summary>Options</summary>

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `header` | `header`, `menu` or `hidden` |
| `buttons` | Edit, Automations, Tools, Sidebar | List of buttons |
| `cards` | | A card or a list of cards |
| `position` | `top` | Edge the menu opens from, `top` or `bottom` |
| `layout` | `list` | Buttons in the menu, `list` with two columns or `grid` with four |
| `all_users` | `false` | Show it to all users, not only admins |
| `css` | | Custom styles, see below |

</details>

<a name="styling"></a>
<details>
<summary>Styling</summary>

Buttons use the theme variables of tiles and badges, such as `--ha-card-background` and `--ha-badge-size`. The menu uses `--ha-box-shadow-m` for its shadow and `--ha-dialog-scrim-backdrop-filter` for its backdrop. The `css` option applies inside the card:

| Class | Part |
| --- | --- |
| `.bar` | Header |
| `.scrim`, `.sheet` | Backdrop and menu |
| `.cards`, `.buttons` | Cards, buttons |
| `.button`, `.button ha-icon`, `.name` | Button, icon, name |

```yaml
css: |
  .scrim { backdrop-filter: blur(12px); }
```

</details>

<details>
<summary>How it works</summary>

Home Assistant renders the header into a slot inside `hui-root`. Origami Header fills that slot with its own element during the same render, before the browser paints, so the default header is never drawn. If a Home Assistant update changes this, the module logs a warning and leaves the default header alone.

</details>

<sub>Made with AI. After years of kiosk-mode and theme workarounds, it helped me find a real fix for the header flash.</sub>
