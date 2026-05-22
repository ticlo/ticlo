---
name: ticlo-translation
description: Work with Ticlo translation and i18n files, including translation lookup logic, source YAML locale files, generated JSON locale files, and auto-translation rules that must preserve manual translations.
---

# Ticlo Translation

Use this skill when changing Ticlo UI/function translations, locale YAML files, generated i18n JSON files, or translation tooling.

## File Layout

- Source translations live in package-local YAML files: `packages/**/i18n/*.yaml`.
- English source files are `en.yaml`. Other locale files, such as `fr.yaml` and `zh.yaml`, are derived from English and may contain manual or generated translations.
- Generated runtime files live under root `i18n/<package>/<locale>.json`.
- Do not hand-edit generated JSON unless the task is specifically about generated output. Edit YAML, then run `pnpm build-i18n` to regenerate JSON.

## Translation Logic

- Runtime translation helpers are in `packages/core/util/i18n.ts`.
- Translation namespaces use `ticlo-<package>`, for example `ticlo-core`, `ticlo-editor`, and `ticlo-test`.
- Function names are looked up as `<function>.@name`.
- Property names are looked up as `<function>.<property>.@name`, then fall back to `@shared.<property>.@name` in the current namespace, then `@shared.<property>.@name` in `ticlo-core`.
- Property option values are looked up as `<function>.<property>.@options.<value>`, then fall back to `@shared.<property>.@options.<value>` in `ticlo-core`.
- Editor strings use `translateEditor(key)` and are stored in the editor namespace.

## YAML Rules

- Keep keys and nesting aligned with `en.yaml`.
- Quote keys that contain special YAML characters, such as `@`, `#`, `:`, or leading/trailing spaces.
- Use `@name` for display names, `@keywords` for search keywords, and `@options` for option labels.
- Use the existing style in nearby locale files for quoting, comments, and multiline strings.
- If an English row has a `# no translate` comment, keep the value unchanged in locale outputs.

## Auto vs Manual Translation

Auto-generated translations are marked in YAML comments with `translated from:`, for example:

```yaml
add:
  '@name': Ajouter # translated from: Add
```

Rows with `translated from:` were produced by the auto translation API or by AI-assisted translation. Auto-translation tooling may update these rows when the English source changes.

Rows without a `translated from:` comment are manually translated. Treat them as owned by humans: do not replace, retranslate, or normalize them with auto translation unless the user explicitly asks to change that manual translation.

When adding AI-generated translations yourself, include the same `# translated from: <source>` comment so future tooling can distinguish generated content from manual content.

## Generated JSON

- `tool/merge-lng.ts` merges package YAML files into `i18n/<package>/<locale>.json`.
- JSON files do not preserve YAML comments, so the manual/generated ownership signal exists only in YAML.
- Regenerated JSON may omit entries whose translated value equals the key, matching the current merge behavior.

## Auto-Translation Tooling

- Auto-translation code is under `tool/translate/`.
- `tool/translate/YamlData.ts` preserves existing translations only when the `translated from:` source still matches the current English source.
- If an existing locale row lacks `translated from:` or the old `auto translated from hash:` comment, it is treated as manual and should not be overwritten by automatic translation.
- Use `pnpm build-i18n` after YAML changes to refresh generated JSON.
