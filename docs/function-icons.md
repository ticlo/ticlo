# Function icons

Function and category descriptors use an `icon` string. Each expression contains a
prefix, a colon and a value. Separate expressions with two or more consecutive
spaces. Single spaces and additional colons in the value are preserved.

An icon can contain any number of text layers and one SVG background. Text is
always drawn over the background, in expression order. If multiple backgrounds
are supplied, only the first valid background is used. Invalid expressions are
ignored.

## Text

The prefix selects a position and an optional font size in pixels:

| Expression | Meaning |
| --- | --- |
| `:str` | Centered text, default size 18 |
| `13:str` | Centered text at size 13 |
| `l:a`, `t:a`, `r:a`, `b:a` | Left, top, right or bottom, centered on the other axis |
| `tl:a`, `tr:a`, `bl:a`, `br:a` | A corner; `t` or `b` must come first |
| `tl13:a` | Top-left text at size 13 |
| `17^:[ ]` | Centered text at size 17, shifted upward by `0.1em` |

An optional `^` immediately before the colon shifts the entire text layer upward
by `0.1em` of its own font size. It works with any position and font size,
including the defaults: `^:text`, `t^:text`, `br13^:text`. Other layers are
unaffected. Built-in text icons whose first character is not an uppercase letter
use this marker explicitly; custom text is shifted only when `^` is present.

Positioned text defaults to size 9. Opposing positions such as `lr` and `tb` are
invalid. Text uses system Noto Sans 700. There is no automatic sizing or
truncation; choose an explicit size when text needs to fit a smaller area.

```text
tl:s  br:2
svg:react  b9:ui
path:M12 12H84V84H12Z  :A
```

## SVG backgrounds

`svg:plus` uses `icons/plus.svg`. The curated SVG files are all in `icons/`;
use the filename without its extension. SVG files retain their own viewBox and
fill settings. Run `pnpm build-icons` to regenerate `css/icons.css` after changing
assets. Vite and browser-test startup regenerate it automatically.

`path:M12 12H84V84H12Z` creates a white SVG path from the supplied `d` data, using
`viewBox="0 0 96 96"`. Use single spaces within the path data: double spaces
separate icon expressions. Its background class is derived from a stable hash of
the path. Identical paths share one CSS rule, which is removed when no mounted
icons use it.

## Migrating existing definitions

The old `txt:`, `fas:`, `fab:` and `fa:` prefixes are replaced by the syntax above:

| Before | After |
| --- | --- |
| `txt:A` | `:A` |
| `txt:long:12` | `12:long` |
| `fas:plus` | `svg:plus` |
| `fab:react` | `svg:react` |

Built-in definitions have been migrated. Update custom descriptors and saved
`#desc` or `@b-style` values that still contain old icon strings. Only SVGs used
by built-in icons and drag feedback are retained; add other assets to `icons/`
before referencing them.
