# Origami Header

Origami Header replaces the header of your Home Assistant dashboards. You can build your own header out of cards, hide the header and keep its buttons in a drawer that slides down, or do both.

If you have ever hidden the header, you know the two catches. It still flashes up every time a dashboard loads, and once it's gone there is no quick way into edit mode or the sidebar. Origami Header takes the header's place before the dashboard is drawn, so nothing flashes, and the drawer keeps edit mode and the sidebar one tap away.

## Installation

Add this repository to HACS as a custom repository of type Dashboard and download Origami Header. Then load it as an extra module in `configuration.yaml` and restart Home Assistant:

```yaml
frontend:
  extra_module_url:
    - /hacsfiles/origami-header/origami-header.js
```

It has to be an extra module, because a dashboard resource loads too late to prevent the flash. HACS may add a resource on its own as well. You can leave it there, the module only starts once.

Without HACS, download `origami-header.js` from the latest release into `config/www` and use `/local/origami-header.js?v=1.0.0` as the URL. Change the version number after every update, or browsers will keep using the old file.

## Usage

Edit a dashboard and add the Origami Header card to any view. You set everything up in the card editor, which shows a preview. On the dashboard the card itself is invisible, and in edit mode you get the normal header back so the dashboard tools still work.

There are three modes:

- `drawer` is the default. It hides the header, and a small handle at the top of the screen opens the drawer.
- `header` shows your own header cards, with the handle just below them.
- `hidden` hides the header and nothing else.

Tap the handle or pull it down to open the drawer. To close it, tap outside, press Escape or push the grip back.

You can also open the drawer from your own button, for example in a navigation bar or in your header. Use this action, or `open` and `close` instead of `toggle`:

```yaml
tap_action:
  action: fire-dom-event
  origami_header: toggle
```

This gives you a header with a title and a temperature badge, and the default shortcuts in the drawer:

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

Add `items: []` for a header without a drawer. The [examples](examples) folder has two complete setups, which use [paper-buttons-row](https://github.com/jcwillox/lovelace-paper-buttons-row) and the System Monitor integration.

## Options

Everything here is also in the visual editor.

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `drawer` | `drawer`, `header` or `hidden` |
| `header` | | Cards for the header in header mode. Without them you get the dashboard title. |
| `cards` | | Cards at the top of the drawer |
| `items` | eight shortcuts | Shortcuts in the drawer. With no items and no cards there is no drawer. |
| `position` | `top` | Whether the drawer comes from the `top` or the `bottom` |
| `layout` | `list` | How the shortcuts are laid out: `list`, `grid` or `icons` |
| `all_users` | `false` | Let everyone open the drawer. Otherwise only admins can, and in drawer mode other users see no header at all. |
| `hide_handle` | `false` | Hide the handle and use your own button instead |
| `css` | | Your own styles, see below |

Each shortcut has a `label`, an `icon` and an action. Use `tap_action` for any normal Home Assistant action, or `special` for the two things a card action can't do: `edit` turns on edit mode and `sidebar` opens the sidebar.

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

## Styling

The `css` option is applied inside the card, so you can style its parts directly:

| Class | Part |
| --- | --- |
| `.bar`, `.bar-cards`, `.title` | The header, its cards, and the title shown when there are no cards |
| `.handle` | The handle that opens the drawer |
| `.scrim` | The backdrop behind the drawer |
| `.sheet` | The drawer |
| `.cards`, `.grid` | The drawer cards and the shortcuts |
| `.tile`, `.tile ha-icon`, `.label` | A shortcut, its icon and its label |
| `.grip` | The grip at the edge of the drawer |

```yaml
css: |
  .sheet { border-radius: 0 0 28px 28px; }
  .scrim { backdrop-filter: blur(12px); }
```

## How it works

Home Assistant renders the dashboard header into a slot inside `hui-root`. Origami Header hooks into `hui-root` and fills that slot with its own element during each render, before the browser paints. Other approaches hide the header after it has already been drawn, and that is where the flash comes from.

This relies on Home Assistant internals. If an update ever breaks it, the module logs a warning and leaves the normal header in place.

## A note on AI

I built this together with AI, and I'd rather be upfront about that.

For literally years I looked for a way to get rid of the header flash. I ran kiosk-mode just for this and tried card-mod and theme tweaks along the way, and the flash was always still there. Working on it with AI is how I finally found an approach that actually solves it. I don't think I would ever have found it on my own.

Also, as you may have noticed, I care a bit too much about code quality. Realistically, I would never have had the time to get it to this point by myself.
