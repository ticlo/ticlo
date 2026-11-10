# Editor

Commands with parameters or named results open a submenu with local value editors,
an explicit Run button, and readonly results. Opening or editing a command does
not execute it. Draft values and results stay in the browser and do not modify
Flow properties. The `editValue(value, desc, onChange?)` layout action opens a local
text/object editor; omitting `onChange` makes it readonly. Table editors also accept
local values without a connection or property paths.

## Current stage and commands

`TicloApp` owns a registry of views. Each `TicloStage` has a stable unique `id`
and a `basePath`; multiple views can share one Flow. `currentPath` identifies the
Flow, while `activeStage` owns the current selection and commands.

`useTicloStage` registers snapshots without changing the active view. Standalone
stages activate on mount; supplying `stageId` leaves activation to the host.
Dock tabs activate through `StagePanelFocus`. An ID can activate before its stage
registers. Removing a background stage preserves the active view; removing the
active stage clears it until another activates.

Save, copy, paste, delete, undo, and redo target only the active stage. Unsupported
or declined commands do not fall through. External controls use `runStageCommand`.
`activateStage(id)` selects a view; `onFlowFocus(path)` preserves the active view
when its path already matches. Designer-specific activation and input are in
[designer](designer.md#selection-and-commands).

Block Stage status subscribes to each Block's `#emit` and `#wait`. Error values
use the [core error contract](core.md#errors-and-runtime-status); status updates
do not invalidate the Block's body or the stage.

## Property editors

Descriptor `type` selects an editor from the
[value registry](../packages/editor/property/value/index.ts). Unknown types are
read-only. Common types include `number`, `string`, `toggle`, `select`,
`multi-select`, `combo-box`, `radio-button`, `password`, `color`, `date`,
`date-range`, `time`, `object`, `array`, `table`, `type`, `worker`, `event`,
`schedule`, `any`, and `none`. `service` uses a dedicated binding editor.
Use `toggle` for booleans and Luxon `DateTime` for dates; `bool`, `datetime`,
and `js` are not value-editor types. `any` treats two dates as an array;
choose `date-range` explicitly for range editing.

Service providers expose their runtime objects through readonly `object`
outputs. A consuming `service` input uses `options` as source-function tags;
its picker discovers `^`-prefixed global Blocks with matching tags and binds to
their `#output`.

Descriptors, bindings, and connection policies determine editability. Flow-local
descriptors require the owning `funcModule` path; see
[connection scope](core.md#connection-layer).

A property with `create` can convert an object to a helper or convert its output
back to a value. Each selected Block retains its own full value. Helper creation
establishes the output binding; setting the object removes the binding and helper.
Optional/custom fields and `#extend` preserve unlisted data; functions with
`recipient` receive the full object in that property.

`optionalSuggestions` seeds optional-property suggestions. Search history is
local to the function type, including its module path for local functions;
suggestions do not enable fields. Ranking and cache limits are implementation
choices in [OptionalPropertyHistory](../packages/editor/property/OptionalPropertyHistory.ts).

Property value trees use array preview lengths to select nested arrays without
first downloading the enclosing object. Truncated arrays of at least 1000 items
load pages as their last loaded item scrolls into view; smaller arrays read the
selected value directly. Page boundary mismatches stop loading until reloaded.

## Table editor

`type: 'table'` accepts arrays of objects or an explicit schema and row arrays:

```ts
{
  columns: [{name: 'label', type: 'string'}, {name: 'count', type: 'number'}],
  rows: [['First', 1], ['Second', 2]],
}
```

Columns use property descriptors. Legacy descriptor-level `rowType` and `columns`
remain supported, with string keys for object rows and nonnegative integer keys
for array rows. Unlisted fields are preserved. New rows use `init`; `default`
affects display only.

Tables read pages as the user scrolls and render visible rows virtually.
Editing stays disabled until all rows have loaded. Object arrays without an
explicit schema infer columns from the first and last rows of the whole table;
scanning all loaded rows can reveal additional columns. See
[paged reads](core.md#connection-layer) for the continuity contract.

Edits remain in a draft until the complete value is committed to the original
property paths. External changes require reloading the draft before submission.
Inline worker cells remain in the draft; named workers save to their module.
Property and column permissions apply throughout.

## File manager

The Library menu uses runtime commands independently of file access. Without a
file catalog, a supported runtime can show loaded libraries and load a name
entered by the user. Catalog access adds browsing and project creation; a
file-only connection can change the browsing Library without loading it.
Unavailable capabilities are omitted or disabled. Menu state refreshes on open
without polling. `editor.html` keeps its open tabs when the browsing Library changes.
Explicit load/unload operations affect the connected server's runtime.

`FileManager` accepts a storage instance and project ID, including `#root`:

```tsx
<FileManager storage={storage} project="main" />
```

The panel is confined to that project and protects its root from rename, copy,
move, and deletion. Changing storage or project cancels outstanding requests
and confirmations and clears selection and clipboard state.

`onOpen(entry)` opens `.ticlo` files, including Library context and modules.
Creating a dataflow persists the new file before calling `onOpen` and fails on
collisions. Navigation-created flows remain in memory until saved.
`onSelect` receives selected entries. `onChange` runs after a mutation attempt
and refresh, including partial failures. File operations do not reload runtime
Flows; hosts handle that explicitly. `onFilesDeleted` and `onFileDiscarded`
notify hosts about deletion and restoration respectively.

Copies and uploads preserve directory structure and empty folders. Replacement
requires confirmation; moves can partially succeed. Project changes cancel old
previews and operations. Supported small previews load automatically; larger
files require an explicit request. Text previews show source without executing
it. File scopes, revisions, backups, and Git are defined in
[storage](remote-storage.md) and [file-server contracts](file-server.md).

## Themes

Editor and rc-dock styles consume Ant Design CSS variables. Use the exported
`theme` or `darkTheme` from `@ticlo/editor/style/theme.ts` with `ConfigProvider`
and Ant Design `App`. Popups outside `App` need the same variable scope.
Themes use `zeroRuntime`; load generated Ant Design CSS. Custom algorithm lists
include `ticloThemeAlgorithm` last. Token defaults live in
[theme.ts](../packages/editor/style/theme.ts).

Components provide fallback colors without Ant Design variables. React pages
also work without designer styles. See [builds and style imports](development.md#assets-and-builds)
and [function icons](function-icons.md). Saved block widget settings are in
[block widgets](block-widgets.md).
