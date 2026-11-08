# View Deck animations

The [container contract](react-containers.md) defines child resolution and page
lifecycle. `react:view-deck` optionally animates a change between existing pages.

| Property | Values |
| --- | --- |
| `animation` | `none` (default), `slide`, `fade`, `zoom`, `custom` |
| `showEffect` | Incoming CSS `@keyframes` name in custom mode |
| `hideEffect` | Outgoing CSS `@keyframes` name in custom mode |

Slide direction follows indices: higher enters from the right, lower from the
left. Fade and zoom do not move horizontally. Timing is shared by all decks;
its current values are in [ViewDeckAnimation.ts](../packages/react/layout/ViewDeckAnimation.ts).

## Custom effects

Load keyframes in the application's stylesheet and set `animation: 'custom'`:

```css
@keyframes page-show {
  from { transform: translateX(var(--ticl-view-deck-x)); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

Use `showEffect: 'page-show'`; `hideEffect` is optional. `--ticl-view-deck-x`
is the page's offscreen horizontal position following the same index direction
as slide. Missing names leave that side stationary. No valid effects means an
immediate switch. Animation uses native browser APIs and accepts no executable
callbacks.

## Transition boundaries

The incoming page is interactive immediately; the outgoing page is not.
The incoming page determines automatic deck size. Dedicated layers preserve
the child's own styles and stable React identity through completion.

Initial display, list changes, empty selection, and designer reveals switch
immediately. A new selection during an animation cancels it and shows the latest
page; intermediate transitions are not queued. Settings are captured at transition
start; settings changes alone do not remount a page. Entering design mode,
resizing the viewport, or unmounting cancels the transition. Environments without
the animation API switch immediately. Structural styles belong to React and
work without designer CSS.
