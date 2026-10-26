# Agent instructions

- Keep changes minimal and scoped; prefer simple, readable code.
- Pause on errors, blockers, or unclear requirements; don't guess.
- See `.agents/skills/ticlo/SKILL.md` for package architecture.
- Editor must not depend on designer; use generics for shared types and keep designer behavior in designer.
- `packages/editor` and `packages/designer` do not need a11y support; avoid ARIA and a11y-only roles.
- React components must work without designer styles.
- Document concepts, contracts, and setup; omit incidental UI choices and implementation walkthroughs.

## Editor and designer testing

Applies to `packages/editor` and `packages/designer`; core testing requirements are unchanged.

- Ordinary UI changes affect wording, icons, spacing, layout, menu order, or control visibility, without changing value parsing/commit, stored data, command targets, permissions, or interaction algorithms. They do not need new tests; use existing tests or manual checks.
- When designs change, update or replace existing tests and remove obsolete or redundant coverage.
- Add tests only for distinct, lasting risks (data loss, wrong-target edits, undo/redo, permissions, complex interactions), or when explicitly requested.
- Prefer representative cases and reusable fixtures. Avoid duplicate coverage and assertions about incidental UI choices such as labels, menu order, defaults, or styling.
