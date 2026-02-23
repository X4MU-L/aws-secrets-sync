import { mergeSecretValues } from '../secrets-manager';
import { SecretValues } from '../types';

describe('mergeSecretValues', () => {
	describe('partial merge strategy (default)', () => {
		it('should preserve existing keys not in incoming', () => {
			const existing: SecretValues = {
				KEY1: 'value1',
				KEY2: 'value2',
				KEY3: 'value3',
			};

			const incoming: SecretValues = {
				KEY2: 'updated',
				KEY4: 'new',
			};

			const result = mergeSecretValues(existing, incoming, 'partial');

			expect(result).toEqual({
				KEY1: 'value1', // preserved
				KEY2: 'updated', // updated
				KEY3: 'value3', // preserved
				KEY4: 'new', // added
			});
		});

		it('should add new keys from incoming', () => {
			const existing: SecretValues = { KEY1: 'value1' };
			const incoming: SecretValues = { KEY2: 'value2', KEY3: 'value3' };

			const result = mergeSecretValues(existing, incoming, 'partial');

			expect(result).toEqual({
				KEY1: 'value1',
				KEY2: 'value2',
				KEY3: 'value3',
			});
		});

		it('should handle empty existing object', () => {
			const existing: SecretValues = {};
			const incoming: SecretValues = { KEY1: 'value1' };

			const result = mergeSecretValues(existing, incoming, 'partial');

			expect(result).toEqual({ KEY1: 'value1' });
		});

		it('should default to partial when strategy not specified', () => {
			const existing: SecretValues = { KEY1: 'old', KEY2: 'preserve' };
			const incoming: SecretValues = { KEY1: 'new' };

			const result = mergeSecretValues(existing, incoming);

			expect(result).toEqual({
				KEY1: 'new',
				KEY2: 'preserve', // preserved because partial is default
			});
		});
	});

	describe('override merge strategy', () => {
		it('should replace all keys with incoming', () => {
			const existing: SecretValues = {
				KEY1: 'value1',
				KEY2: 'value2',
				KEY3: 'value3',
			};

			const incoming: SecretValues = {
				KEY4: 'new',
			};

			const result = mergeSecretValues(existing, incoming, 'override');

			expect(result).toEqual({
				KEY4: 'new',
			});
		});

		it('should delete all existing keys not in incoming', () => {
			const existing: SecretValues = {
				OLD_KEY: 'old_value',
				ANOTHER_OLD: 'another',
			};

			const incoming: SecretValues = { NEW_KEY: 'new_value' };

			const result = mergeSecretValues(existing, incoming, 'override');

			expect(result).toEqual({ NEW_KEY: 'new_value' });
			expect(result).not.toHaveProperty('OLD_KEY');
			expect(result).not.toHaveProperty('ANOTHER_OLD');
		});

		it('should handle empty incoming object', () => {
			const existing: SecretValues = { KEY1: 'value1', KEY2: 'value2' };
			const incoming: SecretValues = {};

			const result = mergeSecretValues(existing, incoming, 'override');

			expect(result).toEqual({});
		});
	});

	describe('edge cases', () => {
		it('should handle numeric values', () => {
			const existing: SecretValues = { PORT: 3000 };
			const incoming: SecretValues = { PORT: 8080, TIMEOUT: 5000 };

			const result = mergeSecretValues(existing, incoming, 'partial');

			expect(result).toEqual({ PORT: 8080, TIMEOUT: 5000 });
		});

		it('should handle boolean values', () => {
			const existing: SecretValues = { DEBUG: false, ENABLED: true };
			const incoming: SecretValues = { DEBUG: true };

			const result = mergeSecretValues(existing, incoming, 'partial');

			expect(result).toEqual({ DEBUG: true, ENABLED: true });
		});

		it('should handle mixed value types', () => {
			const existing: SecretValues = {
				STRING: 'text',
				NUMBER: 42,
				BOOLEAN: true,
			};

			const incoming: SecretValues = {
				STRING: 'updated',
				NEW_VALUE: false,
			};

			const result = mergeSecretValues(existing, incoming, 'partial');

			expect(result).toEqual({
				STRING: 'updated',
				NUMBER: 42,
				BOOLEAN: true,
				NEW_VALUE: false,
			});
		});
	});
});
