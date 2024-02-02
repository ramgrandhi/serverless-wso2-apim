const { retryWithExponentialBackoff, validateConfig, normalizeConfig } = require('./retryWithExponentialBackoff');

describe('retryWithExponentialBackoff', () => {
  describe('normalizeConfig', () => {
    it('should return default config if no config provided', () => {
      const result = normalizeConfig();
      expect(result).toEqual({
        intervalSeconds: 1,
        maxAttempts: 3,
        backoffRate: 2,
      });
    });

    it('should override default values with provided values', () => {
      const result = normalizeConfig({
        intervalSeconds: 5,
        maxAttempts: 10,
        backoffRate: 3,
      });
      expect(result).toEqual({
        intervalSeconds: 5,
        maxAttempts: 10,
        backoffRate: 3,
      });
    });

    it('should merge the default values with provided values', () => {
      const result = normalizeConfig({
        backoffRate: 2.5,
      });
      expect(result).toEqual({
        intervalSeconds: 1,
        maxAttempts: 3,
        backoffRate: 2.5,
      });
    });
  });

  describe('validateConfig', () => {
    const intervalSecondsError = new Error('retryWithExponentialBackoff: config.intervalSeconds must be a number greater than 0');
    const maxAttemptsError = new Error('retryWithExponentialBackoff: config.maxAttempts must be a number greater than 0');
    const backoffRateError = new Error('retryWithExponentialBackoff: config.backoffRate must be a number greater than 0');

    it('should pass the default config', () => {
      expect(() => validateConfig(normalizeConfig())).not.toThrow();
    });

    it('should pass the provided config', () => {
      expect(() => validateConfig({
        intervalSeconds: 1,
        maxAttempts: 10,
        backoffRate: 5,
      })).not.toThrow();
    });

    it.each([
      {
        caseName: 'invalid intervalSeconds',
        config: normalizeConfig({ intervalSeconds: 'invalid' }),
        error: intervalSecondsError,
      },
      {
        caseName: 'zero intervalSeconds',
        config: normalizeConfig({ intervalSeconds: 0 }),
        error: intervalSecondsError,
      },
      {
        caseName: 'negative intervalSeconds',
        config: normalizeConfig({ intervalSeconds: -10 }),
        error: intervalSecondsError,
      },
      {
        caseName: 'invalid maxAttempts',
        config: normalizeConfig({ maxAttempts: 'invalid' }),
        error: maxAttemptsError,
      },
      {
        caseName: 'zero maxAttempts',
        config: normalizeConfig({ maxAttempts: 0 }),
        error: maxAttemptsError,
      },
      {
        caseName: 'negative maxAttempts',
        config: normalizeConfig({ maxAttempts: -10 }),
        error: maxAttemptsError,
      },
      {
        caseName: 'invalid backoffRate',
        config: normalizeConfig({ backoffRate: 'invalid' }),
        error: backoffRateError,
      },
      {
        caseName: 'zero backoffRate',
        config: normalizeConfig({ backoffRate: 0 }),
        error: backoffRateError,
      },
      {
        caseName: 'negative backoffRate',
        config: normalizeConfig({ backoffRate: -10 }),
        error: backoffRateError,
      },
    ])('should throw an error for $caseName', ({ config, error }) => {
      expect(() => validateConfig(config)).toThrow(error);
    });
  });

  describe('retryWithExponentialBackoff', () => {
    const fnError = new Error('retryWithExponentialBackoff: fn must be a function to be retried');

    it('should retry and succeed after a certain number of attempts', async () => {
      const mockFunction = jest
        .fn()
        .mockRejectedValueOnce(new Error('Simulated error'))
        .mockResolvedValueOnce('Success');

      const result = await retryWithExponentialBackoff(mockFunction);

      expect(result).toBe('Success');
      expect(mockFunction).toHaveBeenCalledTimes(2); // 1 initial attempt + 1 retry
    });

    it('should throw an error after reaching maxAttempts', async () => {
      const mockFunction = jest.fn().mockRejectedValue(new Error('Simulated error'));

      await expect(
        retryWithExponentialBackoff(mockFunction, {
          maxAttempts: 2,
        })
      ).rejects.toThrow('Simulated error');

      expect(mockFunction).toHaveBeenCalledTimes(2); // 1 initial attempt + 1 retry
    });

    it('should not retry when succeed in the first call', async () => {
      const mockFunction = jest.fn().mockResolvedValue('Success');

      const result = await retryWithExponentialBackoff(mockFunction);

      expect(result).toBe('Success');
      expect(mockFunction).toHaveBeenCalledTimes(1);
    });

    it('should provide the attempt number to the caller function', async () => {
      const mockFunction = jest.fn().mockRejectedValue(new Error('Simulated error'));

      await expect(
        retryWithExponentialBackoff(mockFunction, { backoffRate: 0.01 })
      ).rejects.toThrow('Simulated error');

      expect(mockFunction).toHaveBeenNthCalledWith(1, { attempt: 1 });
      expect(mockFunction).toHaveBeenNthCalledWith(2, { attempt: 2 });
      expect(mockFunction).toHaveBeenNthCalledWith(3, { attempt: 3 });
    });

    it('should be able to execute an async function', async () => {
      const testFn = async (input) => input;

      const result = await retryWithExponentialBackoff(() => testFn('Success'));
      expect(result).toBe('Success');
    });

    it('should be able to execute a sync function', async () => {
      const testFn = (input) => input;

      const result = await retryWithExponentialBackoff(() => testFn('Success'));
      expect(result).toBe('Success');
    });

    it('should throw error if fn is not a function', async () => {
      await expect(retryWithExponentialBackoff('function')).rejects.toEqual(fnError);
    });

    it('should throw error if fn is a promise', async () => {
      const fn = async () => 'test';
      const promiseFnCall = fn();

      await expect(retryWithExponentialBackoff(promiseFnCall)).rejects.toEqual(fnError);
    });
  });
});
