# Contributing to aws-secret-sync

Thank you for your interest in contributing! 🎉

This project evolved from [`aws-secrets-dotenv`](https://github.com/supersoniko/aws-secrets-dotenv) and welcomes all kinds of contributions — bug fixes, features, documentation improvements, and tests.

## Getting Started

### 1. Fork & Clone

```bash
git clone https://github.com/supersoniko/aws-secret-sync.git
cd aws-secret-sync
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a Branch

```bash
git checkout -b feat/my-feature
# or
git checkout -b fix/my-bug-fix
```

## Development Workflow

### Run Tests

```bash
npm test
```

Run with verbose output:

```bash
npm test -- --verbose
```

Run a specific test file:

```bash
npm test -- src/__tests__/index.ts
```

### Build

```bash
npm run build
```

This runs:

1. `rimraf .dist` — clears old output
2. `tsc --emitDeclarationOnly --declaration` — generates `.d.ts` type definitions
3. `tsx build.ts` — bundles source with esbuild into `.dist/`

### Lint & Format

```bash
npm run lint        # check for issues
npm run fix         # auto-fix issues
```

## Project Structure

```
aws-secret-sync/
├── src/               # TypeScript source files
│   ├── index.ts       # Main entry & CLI export
│   ├── secrets-manager.ts
│   ├── get-config.ts
│   ├── types.ts
│   └── __tests__/     # Jest test files
├── bin/
│   └── aws-secret-sync.js   # CLI entry point
├── .dist/             # Compiled output (git-ignored)
├── build.ts           # esbuild bundler script
├── tsconfig.json
└── jest.json
```

## Submitting a Pull Request

1. Make sure all tests pass: `npm test`
2. Add tests for any new behaviour
3. Keep commits focused and descriptive
4. Open a PR against `master` with a clear description of what changed and why

### Commit Style

Use conventional commits where possible:

```
feat: add support for --override flag
fix: handle missing .secretsrc gracefully
docs: update installation guide
test: add coverage for secrets-manager error paths
chore: bump esbuild to 0.20
```

## Reporting Issues

Please open an issue on [GitHub](https://github.com/x4mu-l/aws-secrets-sync/issues) with:

- A clear description of the bug or feature request
- Steps to reproduce (for bugs)
- Expected vs actual behaviour
- Node.js version and OS

## Code of Conduct

Be respectful and constructive. This is a welcoming space for all skill levels.

---

Thank you for helping make `aws-secret-sync` better! 🚀
