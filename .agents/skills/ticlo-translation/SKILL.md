---
name: ticlo-translation
description: Edit Ticlo translations and i18n tooling while preserving manual translations and regenerating locale JSON.
---

# Ticlo translation

Edit `packages/**/i18n/*.yaml`, then run `pnpm build-i18n` to generate
`i18n/<package>/<locale>.json`. Hand-edit JSON only when explicitly working on
generated output. English sources are `en.yaml`; the merger skips `en.base.yaml`.

## Translation ownership

Rows without `translated from:` or legacy `auto translated from hash:` comments
are manual. Do not replace, retranslate, or normalize them through automatic/AI
translation unless the user explicitly asks to change that manual translation.
Ownership exists only in YAML comments, not generated JSON.

For AI-generated rows, add `# translated from: <sourceKey>`:

```yaml
add:
  '@name': Ajouter # translated from: Add
```

Compute markers with `translationSourceKey()` in `tool/translate/YamlData.ts`.
It uses source text up to 25 characters, prefix/hash for longer text, and escapes
backslashes, newlines, and edge spaces. Do not build markers by hand for complex text.
Generated rows can be reused only while the source key/legacy hash matches;
changed sources may be retranslated. Keep values marked `# no translate` unchanged.

## Lookup

Runtime helpers: `packages/core/util/i18n.ts`. Namespaces: `ticlo-<package>`.

| Value | Lookup and fallback |
| --- | --- |
| Function name | `<function>.@name` |
| Property name | `<function>.<property>.@name` → `@shared.<property>.@name` in current namespace → same in `ticlo-core` |
| Option label | `<function>.<property>.@options.<value>` → `@shared.<property>.@options.<value>` in `ticlo-core` |
| Editor string | `translateEditor(key)` in `ticlo-editor` |

## YAML and tooling

- Match `en.yaml` keys/nesting and nearby quoting, comments, and multiline style.
  Quote special keys (`@`, `#`, `:`, edge spaces). `@name` holds display names,
  `@keywords` search terms, and `@options` option labels.
- `tool/merge-lng.ts` skips top-level identity entries (`key: key`) when first
  creating a locale output; it does not recursively strip identity translations.
- `tool/translate/YamlData.ts` preserves current manual keys. Removed top-level
  manual entries go under `# no longer used`; removed nested entries are not retained.
- `pnpm build-i18n-pre-collect-en` collects literal editor keys and rewrites
  `packages/editor/i18n/en.yaml`; review the diff for dynamically referenced keys.
