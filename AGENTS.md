# Agent instructions

- Keep changes minimal; prefer simple code. Pause on errors, blockers, or unclear requirements; don't guess.
- Start with `.agents/skills/ticlo/SKILL.md` for task routing. Search the relevant package before widening a search; read only the needed source and reference sections.
- Core runtime performance takes priority. Avoid whole-flow serialization, deep comparisons, and repeated allocations on execution, notification, and loading paths. Measure changes to scaling or hot paths.
- React components should subscribe only to the values they render and keep unchanged snapshots stable. Keep designer selection and gesture state out of component contexts.
- Editor must not depend on designer; use generics for shared types and keep designer behavior in designer.
- `packages/editor` and `packages/designer` do not need a11y support; avoid ARIA and a11y-only roles.
- React components must work without designer styles.

## Testing

- Protect runtime semantics, data integrity, wrong-target edits, undo/redo, permissions, and complex interactions with representative tests and reusable fixtures.
- Remove obsolete or duplicate tests. Wording, icons, spacing, menu order, visibility, and exact default layouts do not need tests unless they protect a distinct functional risk.
- Validate the affected package first. Broaden for shared behavior; repeat passed checks only after new changes or failures. Commands and test routing are in `docs/development.md`.

## Documentation

- Treat code as the authority. Keep each contract in one reference and link to it elsewhere.
- Keep READMEs introductory. Document concepts, contracts, and setup; omit incidental UI choices and implementation walkthroughs.
