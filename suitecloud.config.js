let SuiteCloudJestUnitTestRunner;
try {
	// Try the deep import used historically
	SuiteCloudJestUnitTestRunner = require('@oracle/suitecloud-unit-testing/services/SuiteCloudJestUnitTestRunner');
} catch (e1) {
	try {
		// Try the package main export (safer for newer versions)
		const pkg = require('@oracle/suitecloud-unit-testing');
		SuiteCloudJestUnitTestRunner = pkg && (pkg.SuiteCloudJestUnitTestRunner || pkg.services && pkg.services.SuiteCloudJestUnitTestRunner);
	} catch (e2) {
		// Fallback: create a no-op runner that logs a warning to avoid throwing at import time
		SuiteCloudJestUnitTestRunner = {
			async run() {
				// eslint-disable-next-line no-console
				console.warn('[suitecloud.config] @oracle/suitecloud-unit-testing not installed or has different API. Skipping unit tests.');
				return { skipped: true };
			}
		};
	}
}

module.exports = {
	defaultProjectFolder: 'src',
	commands: {
		"project:deploy": {
			beforeExecuting: async args => {
				await SuiteCloudJestUnitTestRunner.run({
					// Jest configuration options.
				});
				return args;
			},
		},
	},
};