import { getEnvConfig } from '../utils';

describe('getConfig', (): void => {
	it('should support .secretsrc and parses it correctly', (): void => {
		const expectedJson = JSON.stringify({ beep: 'boop' });

		process.env.beep = 'boop';

		expect(getEnvConfig('secrets')).toEqual(expectedJson);
	});
});
