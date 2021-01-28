const {
  registerClient,
  generateToken,
  isAPIDeployed,
  createAPIDef,
  updateAPIDef,
  removeAPIDef,
} = require('./wso2apim');
const axios = require('axios');

afterEach(() => {
  jest.clearAllMocks();
});

jest.mock('axios', () => ({
  post: jest.fn(() => Promise.resolve({ data: 'foo' })),
  get: jest.fn(() => Promise.resolve({ data: 'foo' })),
  put: jest.fn(() => Promise.resolve({ data: 'foo' })),
  delete: jest.fn(() => Promise.resolve({ data: 'foo' })),
}));

describe('wso2apim', () => {
  describe('registerClient()', () => {
    it('should handle a successful response', async () => {
      const response = await registerClient('https://some-url', 'foo', 'bar');

      expect(axios.post).toHaveBeenCalledWith(
        'https://some-url',
        {
          clientName: 'serverless-wso2-apim',
          grantType: 'password refresh_token',
          owner: 'foo',
          saasApp: true,
        },
        expect.objectContaining({})
      );
      expect(response).toEqual({
        clientId: undefined,
        clientSecret: undefined,
      });
    });

    it('should handle a faulty response', async () => {
      axios.post.mockImplementationOnce(() =>
        Promise.reject(new Error('some fault'))
      );

      expect(registerClient('https://some-url', 'foo', 'bar')).rejects.toThrow({
        error: 'some fault',
      });
    });
  });

  describe('generateToken()', () => {
    it('should handle a successful response', async () => {
      const response = await generateToken(
        'https://some-url',
        'foo',
        'bar',
        'fooid',
        'barsecret',
        'baz'
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://some-url',
        'grant_type=password&username=foo&password=bar&scope=baz',
        expect.objectContaining({})
      );
      expect(response).toEqual({
        accessToken: undefined,
      });
    });

    it('should handle a faulty response', async () => {
      axios.post.mockImplementationOnce(() =>
        Promise.reject(new Error('some fault'))
      );

      expect(
        generateToken(
          'https://some-url',
          'foo',
          'bar',
          'fooid',
          'barsecret',
          'baz'
        )
      ).rejects.toThrow({
        error: 'some fault',
      });
    });
  });

  describe('isAPIDeployed()', () => {
    it('should handle a successful response', async () => {
      const response = await isAPIDeployed(
        'https://some-url',
        'foo',
        'bar',
        'fooid',
        'barsecret'
      );

      expect(axios.get).toHaveBeenCalledWith(
        'https://some-url?query=name:bar version:fooid context:barsecret',
        {
          headers: {
            Authorization: 'Bearer foo',
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.get.mockImplementationOnce(() =>
        Promise.reject(new Error('some fault'))
      );

      expect(
        isAPIDeployed('https://some-url', 'foo', 'bar', 'fooid', 'barsecret')
      ).rejects.toThrow({
        error: 'some fault',
      });
    });
  });

  describe('createAPIDef()', () => {
    it('should handle a successful response', async () => {
      const response = await createAPIDef(
        'https://some-url',
        'foo',
        'bar',
        'fooid',
        {
          tags: [],
          backend: {
            http: {},
          },
          swaggerSpec: {
            info: {
              contact: {},
            },
          },
        }
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://some-url',
        expect.anything(),
        {
          headers: {
            Authorization: 'Bearer bar',
            'Content-Type': 'application/json',
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response).toEqual({
        apiId: undefined,
        apiName: undefined,
        apiContext: undefined,
        apiStatus: undefined,
      });
    });

    it('should handle a faulty response', async () => {
      axios.post.mockImplementationOnce(() =>
        Promise.reject(new Error('some fault'))
      );

      expect(
        createAPIDef('https://some-url', 'foo', 'bar', 'fooid', {
          tags: [],
          backend: {
            http: {},
          },
          swaggerSpec: {
            info: {
              contact: {},
            },
          },
        })
      ).rejects.toThrow({
        error: 'some fault',
      });
    });
  });

  describe('updateAPIDef()', () => {
    it('should handle a successful response', async () => {
      const response = await updateAPIDef(
        'https://some-url',
        'foo',
        'bar',
        'fooid',
        {
          tags: [],
          backend: {
            http: {},
          },
          swaggerSpec: {
            info: {
              contact: {},
            },
          },
        }
      );

      expect(axios.put).toHaveBeenCalledWith(
        'https://some-url/undefined',
        expect.anything(),
        {
          headers: {
            Authorization: 'Bearer bar',
            'Content-Type': 'application/json',
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.put.mockImplementationOnce(() =>
        Promise.reject(new Error('some fault'))
      );

      expect(
        updateAPIDef('https://some-url', 'foo', 'bar', 'fooid', {
          tags: [],
          backend: {
            http: {},
          },
          swaggerSpec: {
            info: {
              contact: {},
            },
          },
        })
      ).rejects.toThrow({
        error: 'some fault',
      });
    });
  });

  describe('removeAPIDef()', () => {
    it('should handle a successful response', async () => {
      const response = await removeAPIDef(
        'https://some-url',
        'foo',
        'bar',
        'fooid',
        {
          tags: [],
          backend: {
            http: {},
          },
          swaggerSpec: {
            info: {
              contact: {},
            },
          },
        }
      );

      expect(axios.delete).toHaveBeenCalledWith('https://some-url/bar', {
        headers: {
          Authorization: 'Bearer foo',
        },
        httpsAgent: expect.objectContaining({}),
      });
      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.put.mockImplementationOnce(() =>
        Promise.reject(new Error('some fault'))
      );

      expect(
        updateAPIDef('https://some-url', 'foo', 'bar', 'fooid', {
          tags: [],
          backend: {
            http: {},
          },
          swaggerSpec: {
            info: {
              contact: {},
            },
          },
        })
      ).rejects.toThrow({
        error: 'some fault',
      });
    });
  });
});
