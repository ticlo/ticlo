# View Deck animations

View Deck animates selection changes while keeping its selection,
binding, sizing, and Block lifecycle contracts. Animation is opt-in. An existing
deck continues to switch immediately.

## Properties

All three properties are ordinary bindable Block properties.

| Property | Default | Values |
| --- | --- | --- |
| `animation` | `none` | `none`, `slide`, `fade`, `zoom`, `custom` |
| `showEffect` | Empty | CSS `@keyframes` name for the incoming page in `custom` mode |
| `hideEffect` | Empty | CSS `@keyframes` name for the outgoing page in `custom` mode |

All effects use a fixed duration of 300 ms and `ease` timing, with one iteration.
There are no per-deck duration, easing, or direction properties. Unknown animation
types switch immediately. Other modes ignore `showEffect` and `hideEffect`.

## Effects and direction

| Effect | Incoming page | Outgoing page |
| --- | --- | --- |
| `none` | Appears immediately | Removed immediately |
| `slide` | Enters horizontally from its index position | Moves out toward the opposite side |
| `fade` | Fades in above the outgoing page | Remains underneath until completion |
| `zoom` | Scales from slightly smaller and fades in | Scales slightly larger and fades out |
| `custom` | Uses `showEffect` | Uses `hideEffect` |

Pages with lower indices are to the left; pages with higher indices are to the
right. Selecting a higher index slides the incoming page in from the right and
the outgoing page out to the left. Selecting a lower index reverses this. Skipped
indices use the same rule; wrapping from the last index to the first counts as
moving left, not continuing around a carousel. Fade and zoom do not move pages
horizontally.

`fade` keeps the outgoing page opaque so an opaque incoming page does not expose
the deck background halfway through the transition. Transparent page areas
naturally show the outgoing page until it is removed.

## Custom effects

Load the named keyframes in the application's stylesheet before switching pages:

```json
{
  "#is": "react:view-deck",
  "animation": "custom",
  "showEffect": "page-show",
  "hideEffect": "page-hide"
}
```

```css
@keyframes page-show {
  from { transform: translateX(var(--ticl-view-deck-x)); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes page-hide {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(var(--ticl-view-deck-x)); opacity: 0; }
}
```

`--ticl-view-deck-x` provides each page's offscreen horizontal position. For a
higher selected index, it is `100%` on the incoming page and `-100%` on the
outgoing page; a lower index reverses these values. Use it in custom keyframes
to follow the same index-based direction as slide. Keyframes that do not use
this variable retain their explicitly defined motion.

Empty or missing keyframe names do not animate that side. With only a show
effect, the incoming page moves above a stationary outgoing page. With only a
hide effect, the outgoing page moves above the incoming page. When both run, the
incoming page is above the outgoing page. Remove the outgoing page after all
running effects finish; if neither effect exists, switch immediately.

## Selection and lifecycle

- Update `selectedIndex` immediately. Animation never delays or writes back a
  selection or binding.
- Animate only a selection change between two different, existing pages. Initial
  display, an empty selection, child removal/reordering/replacement, and
  designer reveals switch immediately. Selecting the same resolved page does
  not restart it.
- Normally mount one React page. During a transition, retain only the outgoing
  and incoming pages; unmount the outgoing page on completion. Their Blocks and
  dataflow remain active, as they do today. This does not introduce page caching.
- Preserve each retained page's React identity throughout the transition. In
  particular, finishing an animation must not remount the incoming page.
- Disable interaction with the outgoing page, including keyboard focus. The
  incoming page is the selected, interactive page from the start.
- If selection changes again before completion, cancel the animation and show
  the latest page immediately. Do not queue intermediate pages. This deliberately
  cuts short rapid transitions rather than introducing stale navigation or a
  more complex animation blending system.
- Read animation settings when a transition starts. Settings changes alone do
  not restart, cancel, or remount a page. Entering design mode or unmounting the
  deck cancels any active transition.

## Layout and designer

The selected incoming page determines automatic deck dimensions immediately.
The outgoing page must not enlarge the deck by participating in intrinsic
sizing. Keep its previous layout size for its remaining lifetime. Explicit page
dimensions and the existing stretch behavior remain supported; deck-size
animation is not supported.

Clip transition painting to the deck viewport while an animation runs. Restore
the deck's normal overflow behavior afterward. If the viewport resizes during a
transition, finish at the selected page instead of retaining stale geometry.

Animate dedicated page layers, preserving the child's own transform, opacity,
and styles. Keep layer ancestry stable during entry and cleanup. Layering must
not remount a selected page when settings change, and must preserve percentage,
automatic, and explicit sizing. Element registration continues to identify the
actual child elements.

Design mode always switches immediately, including selection-driven reveals in
nested decks. Preview and published pages animate. Use the existing component
context; the React package must not import designer code. Animation support and
its structural styles belong to `@ticlo/react` and work without designer styles.

Transitions use the native [Web Animations API](https://www.w3.org/TR/web-animations-1/),
including [CSS animations](https://www.w3.org/TR/css-animations-2/) in custom mode.
Environments without the animation API switch immediately. Custom executable
callbacks are not supported.
