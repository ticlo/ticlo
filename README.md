# Ticlo

A general purpose visual programming language.

<a href='https://coveralls.io/github/ticlo/ticlo'><img src='https://coveralls.io/repos/github/ticlo/ticlo/badge.svg?branch=master&service=github' title="coveralls"/></a>
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL%202.0-blue.svg)](https://opensource.org/licenses/MPL-2.0)
<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fticlo%2Fticlo?ref=badge_shield" alt="FOSSA Status"><img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fticlo%2Fticlo.svg?type=shield"/></a>
[![Discord](https://img.shields.io/discord/434106806503997445.svg?color=7289DA&logo=discord&logoColor=white
)](https://discord.gg/d3NcyAw)

Use Node.js 24.11.0 or newer and the pnpm version specified in [package.json](package.json).
Run `pnpm install` to install dependencies, including the published file-server
and file-client packages. See [local setup](docs/remote-storage.md#local-development)
to try remote storage.

`pnpm build-pages` regenerates CSS, icons, and translations, then builds the
browser app into `dist/`. The [Pages workflow](.github/workflows/pages.yml) builds and deploys
that output from `master`.

Read the reference for the task:

- [Architecture and packages](.agents/skills/ticlo/SKILL.md)
- [Runtime startup, persistence, and lifecycle](docs/runtime-lifecycle.md)
- [Flow file format](.agents/skills/ticlo/file-format.md)
- [Workers and subflows](.agents/skills/ticlo/worker-architecture.md)
- [Block configuration](docs/block-configs.md)
- [Property editors](docs/editor.md)
- [Static storage](docs/static-storage.md)
- [Remote storage](docs/remote-storage.md)
- [Translations](.agents/skills/ticlo-translation/SKILL.md)
