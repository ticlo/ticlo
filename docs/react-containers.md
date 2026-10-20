# React containers

React containers resolve their children from `content` and `#order`. An unordered
renderable `content` occupies the first position. Ordered children are Blocks;
forwarded `BlockOrder` values resolve them from their original owner.

`ViewDeck` (`react:view-deck`) mounts only the child at `selectedIndex`, using
zero-based positions in that same resolved list. Switching the index unmounts
the previous React child. Hidden Blocks, their bindings, and their dataflow remain
active and available in the node tree. React-local state is reset on remount;
state that must survive switching belongs in Blocks.

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
