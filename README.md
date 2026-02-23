![npm version](https://img.shields.io/npm/v/aws-secret-sync)
![npm downloads](https://img.shields.io/npm/dm/aws-secret-sync)
![license](https://img.shields.io/npm/l/aws-secret-sync)
![node version](https://img.shields.io/node/v/aws-secret-sync)

# aws-secret-sync

A powerful CLI tool to manage your environment variables using AWS Secrets Manager. Easily synchronize secrets between your local development environment, CI/CD pipelines, and AWS.

## Features

✨ **Key Features:**

- Secure secret management with AWS Secrets Manager
- Works as a global CLI or npm script
- Cross-platform: npm, yarn, pnpm, bun
- Works on Linux, macOS, and Windows
- Intelligent merge strategies for secrets
- Reads from .env in current working directory if available
- CI/CD ready with environment detection
- Interactive configuration wizard
- Type-safe TypeScript implementation

## Quick Start

### Installation

**Global installation (recommended for CLI):**

```bash
npm install -g aws-secret-sync
yarn global add aws-secret-sync
pnpm add -g aws-secret-sync
bun add -g aws-secret-sync
```

**Local installation (recommended for npm scripts):**

```bash
npm install --save-dev aws-secret-sync
yarn add --dev aws-secret-sync
pnpm add --dev aws-secret-sync
bun add --dev aws-secret-sync
```

### Basic Usage

```bash
# Interactive configuration setup
aws-secret-sync configure

# Push environment variables to AWS Secrets Manager
aws-secret-sync createOrUpdateSecret --stage dev

# Pull secrets from AWS to .env file
aws-secret-sync createLocalEnvironment --stage dev
```

### npm Scripts

Add to your `package.json`:

```json
{
	"scripts": {
		"secrets:setup": "aws-secret-sync configure",
		"secrets:push": "aws-secret-sync createOrUpdateSecret --stage dev",
		"secrets:pull": "aws-secret-sync createLocalEnvironment --stage dev"
	}
}
```

Run with:

```bash
npm run secrets:push
npm run secrets:pull
```

## How It Works

### 1. Configuration (`.aws-config`)

Create a configuration file with your AWS settings:

```json
{
	"Name": "my-project",
	"Description": "My awesome project",
	"Region": "us-east-1",
	"Profile": "default"
}
```

Or use explicit credentials:

```json
{
	"Name": "my-project",
	"Description": "My awesome project",
	"Region": "us-east-1",
	"AWS_ACCESS_KEY_ID": "AKIA_...",
	"AWS_SECRET_ACCESS_KEY": "...",
	"AWS_SESSION_TOKEN": "..."
}
```

### 2. Secret Registry (`.secretsrc`)

Define which environment variables to sync:

```json
{
	"LIST_OF_SECRETS": ["API_KEY", "DATABASE_URL", "JWT_SECRET", "STRIPE_API_KEY"]
}
```

### 3. Push to AWS

```bash
# Reads from environment variables defined in LIST_OF_SECRETS
# Creates/updates secret in AWS Secrets Manager
aws-secret-sync createOrUpdateSecret --stage dev
```

Creates: `my-project-dev` in AWS Secrets Manager

### 4. Pull to .env

```bash
# Fetches secret from AWS
# Creates .env file with values
aws-secret-sync createLocalEnvironment --stage dev
```

Creates `.env` file locally

## System Requirements

- **Node.js**: >= 14.0.0
- **npm**: >= 6.0.0
- **AWS Account** with Secrets Manager access

## Documentation

- [Installation Guide](./INSTALLATION.md) - Detailed install instructions for all package managers
- [Publishing Guide](./PUBLISHING.md) - How to publish and maintain releases

## Examples

### Development Workflow

```bash
# 1. Setup configuration
npm run secrets:setup

# 2. Pull secrets locally
npm run secrets:pull

# 3. Push changes to AWS
npm run secrets:push
```

### CI/CD Pipeline

```bash
CI=true npm run secrets:push -- --stage prod
```

## CLI Options

- `--stage <name>` - Secret stage/environment (default: dev)
- `--override` - Force full replacement of existing secret
- `--ci` - Run in CI mode (no interactive prompts)
- `--debug` - Show debug information
- `--help` - Show help message

## Security Best Practices

⚠️ **IMPORTANT:**

1. **Never commit .env to git**

   ```bash
   echo ".env" >> .gitignore
   echo ".aws-config" >> .gitignore
   ```

2. **Use AWS IAM roles in production**
   - Avoid hardcoding credentials
   - Use temporary STS credentials

3. **Rotate credentials regularly**
   - Update AWS access keys frequently
   - Use temporary credentials with short TTL

4. **Use separate secrets per environment**
   - dev, staging, production should have different secrets

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md)

## Credits

`aws-secret-sync` is an evolution of [`aws-secrets-dotenv`](https://github.com/supersoniko/aws-secrets-dotenv), the original tool created by [supersoniko](https://github.com/supersoniko).

The core concept and architecture originate from that project. This package builds upon it with a new name, improved TypeScript types, CI/CD tooling, and multi-package-manager support.

## License

MIT © [Chukwuebuka Okoli](https://github.com/x4mu-l)

---

**Built with ❤️ for AWS developers**
