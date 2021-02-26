const ServerlessPlugin = require('./index');
const wso2apim = require('./2.6.0/wso2apim');

afterEach(() => {
  jest.clearAllMocks();
});

jest.mock('./2.6.0/wso2apim', () => ({
  registerClient: jest.fn(() =>
    Promise.resolve({
      clientId: 'foo',
      clientSecret: 'bar',
    })
  ),
  generateToken: jest.fn(() =>
    Promise.resolve({
      accessToken: 'footoken',
    })
  ),
  isAPIDeployed: jest.fn(() =>
    Promise.resolve({
      list: [
        {
          id: 'apifooid',
          name: 'apidefname',
          version: 1,
          context: 'apirootctx',
        },
      ],
    })
  ),
  createAPIDef: jest.fn(() => Promise.resolve({})),
  updateAPIDef: jest.fn(() => Promise.resolve({})),
  removeAPIDef: jest.fn(() => Promise.resolve({})),
}));

function getPluginInstance() {
  const pluginInstance = new ServerlessPlugin({
    service: {
      custom: {
        wso2apim: {
          host: 'foohost',
          user: 'baruser',
          pass: 'bazpassword',
          status: 'deployed',
          apidefs: [
            {
              name: 'apidefname',
              version: 1,
              rootContext: 'apirootctx',
            },
          ],
        },
      },
    },
    pluginManager: {
      serverlessConfigFile: {},
      cliCommands: ['test', 'deploy'],
    },
    cli: {
      log: jest.fn(),
    },
  });

  pluginInstance.initPluginState();

  return pluginInstance;
}

describe('WSO2APIM ServerlessPlugin', () => {
  it('should instantiate properly with options', () => {
    const pluginInstance = getPluginInstance();

    ['after:deploy:deploy', 'after:info:info', 'after:remove:remove'].forEach(
      (prop) => {
        expect(pluginInstance.hooks).toHaveProperty(prop);
      }
    );
  });

  describe('registerClient()', () => {
    it('success state', async () => {
      const pluginInstance = getPluginInstance();
      await pluginInstance.registerClient();
      expect(pluginInstance.cache.clientId).toEqual('foo');
      expect(pluginInstance.cache.clientSecret).toEqual('bar');
    });

    it('error state', async () => {
      wso2apim.registerClient.mockImplementationOnce(() => Promise.reject());

      const pluginInstance = getPluginInstance();
      expect(pluginInstance.registerClient()).rejects.toThrow();
    });
  });

  describe('generateToken()', () => {
    it('success state', async () => {
      const pluginInstance = getPluginInstance();
      await pluginInstance.generateToken();
      expect(pluginInstance.cache.accessToken).toEqual('footoken');
    });

    it('error state', async () => {
      wso2apim.generateToken.mockImplementationOnce(() => Promise.reject());

      const pluginInstance = getPluginInstance();
      expect(pluginInstance.generateToken()).rejects.toThrow();
    });
  });

  describe('listAPIDefs()', () => {
    it('success state', async () => {
      const pluginInstance = getPluginInstance();
      await pluginInstance.listAPIDefs();
      expect(pluginInstance.cache.deploymentStatus).toEqual([
        {
          apiContext: 'apirootctx',
          apiId: 'apifooid',
          apiName: 'apidefname',
          apiStatus: undefined,
          apiVersion: 1,
          invokableAPIURL: 'null 🚀',
        },
      ]);
    });

    it('error state', async () => {
      wso2apim.isAPIDeployed.mockImplementationOnce(() => Promise.reject());

      const pluginInstance = getPluginInstance();
      expect(pluginInstance.listAPIDefs()).rejects.toThrow();
    });
  });
});
