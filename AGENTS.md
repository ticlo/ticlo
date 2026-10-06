# Agent instructions

- Keep changes minimal and scoped; prefer simple, readable code.
- Pause on errors, blockers, or unclear requirements; don't guess.
- See `.agents/skills/ticlo/SKILL.md` for package architecture.
- Editor must not depend on designer; use generics for shared types and keep designer behavior in designer.
- `packages/editor` and `packages/designer` do not need a11y support; avoid ARIA and a11y-only roles.
- React components must work without designer styles.
