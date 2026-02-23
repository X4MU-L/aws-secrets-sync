# Installation & Setup Guide

## Installation Methods

### Global Installation (Recommended for CLI usage)

```bash
# Using npm
npm install -g aws-secret-sync

# Using yarn
yarn global add aws-secret-sync

# Using pnpm
pnpm add -g aws-secret-sync

# Using bun
bun add -g aws-secret-sync
```

After global installation, you can use the CLI:

```bash
aws-secret-sync configure #optional
aws-secret-sync createOrUpdateSecret --stage prod
aws-secret-sync createLocalEnvironment --stage dev
```

### Local Installation (Recommended for npm scripts)

```bash
# Using npm
npm install --save-dev aws-secret-sync

# Using yarn
yarn add --dev aws-secret-sync

# Using pnpm
pnpm add --save-dev aws-secret-sync

# Using bun
bun add --dev aws-secret-sync
```

Use in `package.json` scripts:

```json
{
	"scripts": {
		"secrets:setup": "aws-secret-sync configure",
		"secrets:push": "aws-secret-sync createOrUpdateSecret --stage dev",
		"secrets:pull": "aws-secret-sync createLocalEnvironment --stage dev",
		"secrets:push:prod": "aws-secret-sync createOrUpdateSecret --stage prod"
	}
}
```

Then run:

```bash
npm run secrets:push
npm run secrets:pull
```

### As a Dependency in Code

```bash
npm install aws-secret-sync
```

```typescript
import secretsManagerFactory from 'aws-secret-sync';

const secretsManager = secretsManagerFactory('secrets');

const secrets = await secretsManager.getSecretValues('my-secret');
```

## System Requirements

- **Node.js**: >= 14.0.0
- **Package Manager**: npm, yarn, pnpm, or bun (latest versions recommended)

## Platform Compatibility

✅ **Supported Platforms:**

- Linux
- macOS
- Windows

All package managers work cross-platform without any modifications needed.

## Verification

After installation, verify it works:

```bash
# Check version
aws-secret-sync --help

# Should output usage information
```

## Uninstallation

```bash
# Global
npm uninstall -g aws-secret-sync

# Local
npm uninstall aws-secret-sync
```

## Troubleshooting

**Command not found after global install:**

```bash
# Update npm's global path
npm config get prefix
# Add this path to your PATH environment variable
```

**Permission denied (macOS/Linux):**

```bash
# Use sudo with npm's prefix
sudo npm install -g aws-secret-sync --unsafe-perm
```

**Different Node versions with nvm:**

```bash
# Install for current Node version
nvm install 20
nvm use 20
npm install -g aws-secret-sync
```
