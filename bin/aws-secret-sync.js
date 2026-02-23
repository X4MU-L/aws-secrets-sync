#!/usr/bin/env node
// aws-secret-sync — CLI entry point
// Originally forked from aws-secrets-dotenv by supersoniko (https://github.com/supersoniko/aws-secrets-dotenv)

import { cli } from '../.dist/index.js';

(async () => {
	await cli(process.argv);
})();
