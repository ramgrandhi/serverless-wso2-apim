const { goToSleep } = require('./utils');

/**
 * The retry with exponential backoff config
 * @typedef {Object} Config
 * @property {undefined|number} intervalSeconds A positive integer that represents the number of seconds before the first retry attempt (1 by default).
 * @property {undefined|number} maxAttempts A positive integer that represents the maximum number of retry attempts (3 by default).
 * @property {undefined|number} backoffRate The multiplier by which the retry interval denoted by IntervalSeconds increases after each retry attempt (2.0 by default).
 */

/**
 * Add the default values to the config
 * @param {Config} config 
 * @returns {Config}
 */
const normalizeConfig = (config) => ({
  intervalSeconds: 1,
  maxAttempts: 3,
  backoffRate: 2,
  ...config,
});

/**
 * Validates the config object
 * @param {Config} config 
 */
const validateConfig = ({ intervalSeconds, maxAttempts, backoffRate }) => {
  if (typeof intervalSeconds !== 'number' || intervalSeconds <= 0) {
    throw new Error('retryWithExponentialBackoff: config.intervalSeconds must be a number greater than 0');
  }

  if (typeof maxAttempts !== 'number' || maxAttempts <= 0) {
    throw new Error('retryWithExponentialBackoff: config.maxAttempts must be a number greater than 0');
  }

  if (typeof backoffRate !== 'number' || backoffRate <= 0) {
    throw new Error('retryWithExponentialBackoff: config.backoffRate must be a number greater than 0');
  }
};

/**
 * Execute a promise and retry with exponential backoff
 * based on the maximum retry attempts it can perform
 * @param {<T>(...params: unknown[]) => Promise<T>} fn function to be executed
 * @param {Config} configParams retry config
 * @returns Promise<T>
 */
async function retryWithExponentialBackoff(fn, configParams) {
  if (typeof fn !== 'function') {
    throw new Error('retryWithExponentialBackoff: fn must be a function to be retried');
  }

  const { backoffRate, intervalSeconds, maxAttempts } = normalizeConfig(configParams);
  validateConfig({ backoffRate, intervalSeconds, maxAttempts });

  let attempt = 0;
  const intervalMs = intervalSeconds * 1000;

  const execute = async () => {
    try {
      return await fn();
    } catch (error) {
      const delayMs = intervalMs * (backoffRate ** attempt);
      await goToSleep(delayMs);

      attempt++;

      if (attempt === maxAttempts) {
        throw error;
      }

      return execute();
    }
  };

  return execute();
}

module.exports = {
  validateConfig,
  normalizeConfig,
  retryWithExponentialBackoff,
};
