const ServerlessPlugin = require('./index');

jest.mock('./src/2.6.0/wso2apim', () => ({
  registerClient: jest.fn(() => Promise.resolve({})),
  generateToken: jest.fn(() => Promise.resolve({})),
  isAPIDeployed: jest.fn(() => Promise.resolve({})),
  createAPIDef: jest.fn(() => Promise.resolve({})),
  updateAPIDef: jest.fn(() => Promise.resolve({})),
  removeAPIDef: jest.fn(() => Promise.resolve({})),
}));

describe('WSO2APIM ServerlessPlugin', () => {
  it('should instantiate properly with options', () => {
    const pluginInstance = new ServerlessPlugin({
      service: {
        custom: {
          wso2apim: { user: 'test' },
        },
      },
      pluginManager: {
        serverlessConfigFile: {
          apidefs: [],
        },
        cliCommands: ['test', 'deploy'],
      },
    });
  });
});
