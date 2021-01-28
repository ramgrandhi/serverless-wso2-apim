const wso2apim = require('./src/2.6.0/wso2apim');

console.log.apply(null);

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.wso2APIM = serverless.service.custom.wso2apim;
    this.apiDefs = serverless.pluginManager.serverlessConfigFile.apidefs;
    this.cache = {};
    this.cmd = this.serverless.pluginManager.cliCommands.join('|');

    //Retrieve tenantSuffix in case of multi-tenant setup
    if (this.wso2APIM.user.includes('@')) {
      this.cache.tenantSuffix = this.wso2APIM.user.split('@')[1];
    }

    this.commands = {
      deploy: {
        commands: {
          apidefs: {
            usage: 'Creates or Updates API definitions in WSO2 API Manager',
            lifecycleEvents: [
              'registerClient',
              'generateToken',
              'createOrUpdateAPIDefs',
            ],
          },
        },
      },
      list: {
        commands: {
          apidefs: {
            usage:
              'Lists the deployment status of API definitions in WSO2 API Manager',
            lifecycleEvents: ['registerClient', 'generateToken', 'listAPIDefs'],
          },
        },
      },
      remove: {
        commands: {
          apidefs: {
            usage: 'Deletes API definitions in WSO2 API Manager',
            lifecycleEvents: [
              'registerClient',
              'generateToken',
              'removeAPIDefs',
            ],
          },
        },
      },
    };

    this.hooks = {
      'deploy:apidefs:registerClient': this.registerClient.bind(this),
      'deploy:apidefs:generateToken': this.generateToken.bind(this),
      'deploy:apidefs:createOrUpdateAPIDefs': this.createOrUpdateAPIDefs.bind(
        this
      ),
      'list:apidefs:registerClient': this.registerClient.bind(this),
      'list:apidefs:generateToken': this.generateToken.bind(this),
      'list:apidefs:listAPIDefs': this.listAPIDefs.bind(this),
      'remove:apidefs:registerClient': this.registerClient.bind(this),
      'remove:apidefs:generateToken': this.generateToken.bind(this),
      'remove:apidefs:removeAPIDefs': this.removeAPIDefs.bind(this),
    };
  }

  async registerClient() {
    try {
      console.log('Registering client..');
      const data = await wso2apim.registerClient(
        'https://' +
          this.wso2APIM.host +
          ':' +
          this.wso2APIM.port +
          '/client-registration/' +
          this.wso2APIM.versionSlug +
          '/register',
        this.wso2APIM.user,
        this.wso2APIM.pass
      );
      this.cache.clientId = data.clientId;
      this.cache.clientSecret = data.clientSecret;
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }
  }

  async generateToken() {
    try {
      console.log('Generating temporary token..');
      const data = await wso2apim.generateToken(
        'https://' +
          this.wso2APIM.host +
          ':' +
          this.wso2APIM.port +
          '/oauth2/token',
        this.wso2APIM.user,
        this.wso2APIM.pass,
        this.cache.clientId,
        this.cache.clientSecret,
        'apim:api_create apim:api_publish apim:api_view apim:subscribe apim:tier_view apim:tier_manage apim:subscription_view apim:subscription_block'
      );
      this.cache.accessToken = data.accessToken;
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }
  }

  async listAPIDefs() {
    if (this.cmd === 'list|apidefs') {
      console.log('Retrieving API Definitions..');
    }

    this.cache.deploymentStatus = [];
    const { host, port, versionSlug } = this.wso2APIM;

    // Loops thru each api definition found in serverless configuration
    for (let apiDef of this.apiDefs) {
      try {
        var apiDefClob =
          apiDef.name + '|-|' + apiDef.version + '|-|' + apiDef.rootContext;
        const data = await wso2apim.isAPIDeployed(
          `https://${host}:${port}/api/am/publisher/${versionSlug}/apis`,
          this.cache.accessToken,
          apiDef.name,
          apiDef.version,
          apiDef.rootContext
        );

        this.cache.deployedAPIs = [];
        // Loops thru each deployed api definition returned from WSO2 API Manager (we need to find exact match out of 1:n results returned)
        data.list.forEach((deployedAPI) => {
          // Remove /t/* suffix if exists
          if (deployedAPI.context.startsWith('/t/')) {
            deployedAPI.context = deployedAPI.context.split(
              this.cache.tenantSuffix
            )[1];
          }
          this.cache.deployedAPIs.push({
            apiId: deployedAPI.id,
            apiClob:
              deployedAPI.name +
              '|-|' +
              deployedAPI.version +
              '|-|' +
              deployedAPI.context,
            apiStatus: deployedAPI.status,
          });
        });

        // Compare apples-to-apples (configured-to-deployed) and record deployment status
        if (
          this.cache.deployedAPIs.some(
            (deployedAPI) => deployedAPI.apiClob === apiDefClob
          )
        ) {
          this.cache.deploymentStatus.push({
            apiName: apiDef.name,
            apiVersion: apiDef.version,
            apiContext: apiDef.rootContext,
            apiStatus: this.cache.deployedAPIs.find(
              (deployedAPI) => deployedAPI.apiClob === apiDefClob
            ).apiStatus,
            apiId: this.cache.deployedAPIs.find(
              (deployedAPI) => deployedAPI.apiClob === apiDefClob
            ).apiId,
          });
        } else {
          this.cache.deploymentStatus.push({
            apiName: apiDef.name,
            apiVersion: apiDef.version,
            apiContext: apiDef.rootContext,
            apiStatus: 'TO BE CREATED',
          });
        }
      } catch (err) {
        console.log(err);
        throw new Error(err);
      }
      this.cache.deployedAPIs = [];
    }

    if (this.cmd === 'list|apidefs') {
      console.table(this.cache.deploymentStatus);
    }
  }

  async getCreateOrUpdateApiDefMethod(apiDef, apiId) {
    const { host, port, versionSlug, user, gatewayEnv } = this.wso2APIM;
    const wso2Method =
      apiId !== undefined ? wso2apim.updateAPIDef : wso2apim.createAPIDef;
    const wso2Url = `https://${host}:${port}/api/am/publisher/${versionSlug}/apis`;
    const logMessage =
      apiId !== undefined
        ? 'Updating ' + apiDef.name + '(' + apiId + ')..'
        : 'Creating ' + apiDef.name + '..';

    console.log(logMessage);

    await wso2Method(
      wso2Url,
      user,
      this.cache.accessToken,
      gatewayEnv,
      apiDef,
      apiId
    );
  }

  async createOrUpdateAPIDefs() {
    try {
      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager
      await this.listAPIDefs();

      const mappedCreateOrUpdateAPIDefToRequests = this.cache.deploymentStatus
        .entries()
        .map(([i, { apiId }]) =>
          this.getCreateOrUpdateApiDefMethod(this.apiDefs[i], apiId)
        );

      await Promise.all(mappedCreateOrUpdateAPIDefToRequests);
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }
    console.log(
      'Deployment successful.',
      '\n',
      'Use `sls list apidefs` to view the deployment status.'
    );
  }

  async removeAPIDefs() {
    try {
      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager
      await this.listAPIDefs();

      const mappedRemoveApiDefsToRequests = this.cache.deploymentStatus
        .filter((api) => api.apiId.length > 0)
        .map((api) =>
          wso2apim.removeAPIDef(
            'https://' +
              this.wso2APIM.host +
              ':' +
              this.wso2APIM.port +
              '/api/am/publisher/' +
              this.wso2APIM.versionSlug +
              '/apis',
            this.cache.accessToken,
            api.apiId
          )
        );

      await Promise.all(mappedRemoveApiDefsToRequests);

      console.log(
        'Removal successful.',
        '\n',
        'Use `sls list apidefs` to view the deployment status.'
      );
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }
  }
}

module.exports = ServerlessPlugin;
