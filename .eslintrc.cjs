module.exports = {
	env: {
		es2021: true,
		node: true,
	},
	extends: [
		'airbnb-base',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
		'prettier',
	],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: '2021',
		sourceType: 'module',
	},
	plugins: ['@typescript-eslint', 'prettier'],
	rules: {
		// TypeScript specific rules
		'no-shadow': 'off', // Disable base rule
		'@typescript-eslint/no-shadow': 'error', // Enable TypeScript version
		
		// not sure why we need this if Typescript already enforces it.
		// If we want to enable these rules, we need use: eslint-import-resolver-typescript
		'import/no-unresolved': 'off',
		'import/extensions': 'off',
		'import/no-extraneous-dependencies': 'off',
		'no-return-assign': 'off',
		'no-param-reassign': 'off',
	},
	overrides: [
		{
			files: ['src/logger.ts', 'src/utils.ts'],
			rules: {
				'no-console': 'off',
			},
		},
	],
};
