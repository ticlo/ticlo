# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Environment Note

This project is located in the Windows file system (`/mnt/c/`). When running Node.js, pnpm, or any other development commands, they must be executed as Windows commands, not WSL/Linux commands. For example:
- Use: `cmd.exe /c "pnpm dev:main"`
- Not: `pnpm dev:main` (in WSL)

## Project Overview

Ticlo is a general-purpose visual programming language built with TypeScript and React. It provides a block-based visual programming interface with real-time execution capabilities.

## Development Commands

### Essential Commands
- `pnpm install` - Install dependencies (uses pnpm workspaces)
- `npm run vite-dev` - Start development server on port 3003
- `npm test` - Run tests with Vitest
- `npm run test-coverage` - Run tests with coverage report
- `npm run prettier-check` - Check code formatting
- `npm run prettier-write` - Auto-fix code formatting

### Build Commands
- `npm run vite-build` - Build production bundles
- `npm run build-less` - Build CSS from LESS files
- `npm run build-icons` - Build icon assets
- `npm run build-i18n` - Build internationalization files
- `npm run build-package` - Build all packages

### Testing
- Tests use Vitest framework
- Test files follow `*.spec.ts` pattern in `__spec__` directories
- Run a single test file: `npx vitest run path/to/file.spec.ts`
- Run tests in watch mode: `npx vitest`
- Browser tests: `npm run test-browser`

## Architecture Overview

### Core Concepts
1. **Block**: Fundamental unit containing Properties (key-value pairs) with optional Functions
2. **Property**: Stores values, can contain child Blocks creating a tree structure
3. **Function**: Can be native (JavaScript) or custom (defined in Flow)
4. **Flow**: Entry point for save/load operations, handles history and execution

### Package Structure
- `@ticlo/core` - Core runtime and block system
- `@ticlo/editor` - Visual editor components (React-based)
- `@ticlo/html` - Browser-specific functionality
- `@ticlo/node` - Node.js-specific functionality
- `@ticlo/react` - React integration components
- `@ticlo/web-server` - Web server functionality

### Key Property Types
- **Config Properties**: Start with `#` (e.g., `#is`, `#mode`, `#sync`, `#call`)
- **Attribute Properties**: Start with `@` for editing purposes
- **Regular Properties**: Standard data properties

### Function Categories
Located in `packages/core/functions/`:
- `math/` - Arithmetic, comparisons, boolean logic
- `string/` - String manipulation
- `date/` - Date operations and scheduling
- `http/` - HTTP client functionality
- `script/` - JavaScript execution
- `data/` - Object and state management
- `time/` - Delays and timers
- `worker/` - Multi-worker functions

## Development Workflow

### Working with the Editor
1. Start dev server: `npm run vite-dev`
2. Access endpoints:
   - `/playground.html` - Playground environment
   - `/editor.html` - Main editor interface
   - `/server.html` - Server interface

### Code Style
- TypeScript with strict mode enabled
- Prettier formatting (2 spaces, single quotes, semicolons)
- TSLint for linting (note: project uses TSLint, not ESLint)
- No trailing commas except for ES5 compatibility

### Testing Approach
- Unit tests alongside source files in `__spec__` directories
- Flow tests for visual programming validation
- Coverage reporting to Coveralls
- Browser testing with Chrome headless

### Internationalization
- Translation files in YAML format
- Located in function-specific `i18n/` directories
- Languages: English (en), French (fr), Chinese (zh)
- Build with `npm run build-i18n`

## Important Notes

### Git Workflow
- Current branch: master
- Main development branch: develop
- Create pull requests against develop branch

### Module System
- Uses ES modules with TypeScript path aliases
- Vite handles bundling and module resolution
- Supports both Node.js and browser environments

### Dependencies
- React 18.2 with Ant Design 4.24 for UI
- CodeMirror 6 for code editing
- Luxon for date/time operations
- Axios for HTTP requests
- rc-dock for docking panels

### Performance Considerations
- Block system supports efficient property updates
- Real-time execution with minimal overhead
- Worker support for CPU-intensive operations
- Tree structure allows lazy loading of nested blocks