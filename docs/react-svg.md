# React SVG components

The `@ticlo/react` package provides `react:svg`, `react:g`, `react:rect`,
`react:circle`, `react:ellipse`, `react:line`, `react:polyline`, `react:polygon`,
`react:path`, `react:text`, and `react:foreignObject`. They render native SVG
elements and work without designer styles. `react:svg` appears directly under
React; its descendants appear in the React SVG function category.

SVG components use the existing `#order` and `content` child model. `react:text`
uses `content` for text. Leaf shapes do not render children. SVG attributes are
optional properties named like React SVG props, such as `viewBox`, `strokeWidth`,
and `fillOpacity`. `class` and `style` remain common element properties. The
optional catalog follows `React.SVGAttributes` from the installed React types;
the editor suggests common attributes for each component. Enabled attributes
are listed in `#optional` and update the rendered element when their values
change.

| Component | Tags | Accepted child tags |
| --- | --- | --- |
| HTML containers | `react-comp` | `react-comp` |
| `react:svg` | `react-comp`, `react-svg` | `react-svg` |
| `react:g` | `react-svg` | `react-svg` |
| SVG shapes and text | `react-svg` | None |
| `react:foreignObject` | `react-svg` | `react-comp` |

These tags govern editor insertion and worker component composition. They are
not a complete SVG content model. A worker returning an SVG component inherits
`react-svg`; when it declares `#order`, it also inherits the returned
component's accepted child tags. `foreignObject` permits HTML components inside
an SVG tree.

Designer placement and selection support SVG elements. An outer `react:svg`
inside HTML layout can be moved when absolutely positioned and resized through
its CSS `style`, like an HTML container. Dragging SVG shapes inside an `<svg>`
or `<g>` updates their position attributes (`x/y`, `cx/cy`, line endpoints, or
polygon points). Groups and paths use a single `transform` matrix because they
have no separate position attributes. Shape dimensions remain editable through
SVG geometry properties.
