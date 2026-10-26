# React containers

React containers resolve their children from `content` and `#order`. Content can
be a Block, React element, string, number, or an array of those values. Arrays
expand into individual children; unsupported values are omitted. An explicit
`content` entry in `#order` places those children at that position, including
between other children. Otherwise, content follows the ordered children.
Other ordered children are Blocks. Forwarded `BlockOrder` values resolve entries
from their original owner, including its content slot; the receiving container's
own content is appended separately.

`ViewDeck` (`react:view-deck`) displays the child at `selectedIndex`, using
zero-based positions in that same resolved list. Normally only that React child
is mounted. During an animated switch the previous child stays mounted until
the transition finishes. Hidden Blocks, their bindings, and their dataflow remain
active and available in the node tree. React-local state is reset on remount;
state that must survive switching belongs in Blocks.

[View Deck animations](view-deck-animations.md) describes effects, direction,
timing, and transition behavior. Animation defaults to `none`.

View Deck uses a single-cell inline grid. An in-flow child with automatic
dimensions stretches to the deck's defined size; automatic deck dimensions can
grow from the child's content. Explicit child dimensions are respected. Overflow
and minimum sizes remain configurable on the child.

View Deck defaults to index `0`. Numeric strings are accepted and fractions are
truncated toward zero. Missing, invalid, non-finite, and negative indices use the
container's default. A nonnegative index beyond the child list renders no child.
The shared single-index conversion and property descriptor can also be used by
other layouts; layouts permitting an empty selection can use default index `-1`.

In design mode, selecting a hidden descendant reveals the corresponding child
in each ancestor View Deck. When selection spans pages, the last selected Block
determines the revealed page. These changes update runtime `selectedIndex` only;
saved values and bindings are preserved and no history edit is recorded. Runtime
bindings can subsequently update the index normally. Preview does not reveal
designer selections.
