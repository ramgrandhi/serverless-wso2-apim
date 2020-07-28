'use strict';
const wso2apim = require("./src/2.6.0/wso2apim");

console.log.apply(null);

class ServerlessPlugin {

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
  
    this.wso2APIM = serverless.service.custom.wso2apim;
    this.apiDefs = serverless.pluginManager.serverlessConfigFile.apidefs;
    this.cache = {}
    this.cmd = this.serverless.pluginManager.cliCommands.join('|');

    //Retrieve tenantSuffix in case of multi-tenant setup
    if (this.wso2APIM.user.includes("@")) {
      this.cache.tenantSuffix = this.wso2APIM.user.split("@")[1];
    }

    this.commands = {
      deploy: {
        commands: {
          apidefs: {
            usage: 'Creates or Updates API definitions in WSO2 API Manager',
            lifecycleEvents: [
              'registerClient',
              'generateToken',
              'createOrUpdateAPIDefs'
            ],
          }
        },
      },
      list: {
        commands: {
          apidefs: {
            usage: 'Lists the deployment status of API definitions in WSO2 API Manager',
            lifecycleEvents: [
              'registerClient',
              'generateToken',
              'listAPIDefs'
            ]
          }
        }
      },
      remove: {
        commands: {
          apidefs: {
            usage: 'Deletes API definitions in WSO2 API Manager',
            lifecycleEvents: [
              'registerClient',
              'generateToken',
              'removeAPIDefs'
            ],
          }
        },
      }
    };


    this.hooks = {
      'deploy:apidefs:registerClient': this.registerClient.bind(this),
      'deploy:apidefs:generateToken': this.generateToken.bind(this),
      'deploy:apidefs:createOrUpdateAPIDefs': this.createOrUpdateAPIDefs.bind(this),
      'list:apidefs:registerClient': this.registerClient.bind(this),
      'list:apidefs:generateToken': this.generateToken.bind(this),
      'list:apidefs:listAPIDefs': this.listAPIDefs.bind(this),
      'remove:apidefs:registerClient': this.registerClient.bind(this),
      'remove:apidefs:generateToken': this.generateToken.bind(this),
      'remove:apidefs:removeAPIDefs': this.removeAPIDefs.bind(this)
    };
  };

  async registerClient() {
    try {
      console.log("Registering client..");
      const data = await wso2apim.registerClient(
        "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/client-registration/" + this.wso2APIM.versionSlug + "/register",
        this.wso2APIM.user,
        this.wso2APIM.pass
      );
      this.cache.clientId = data.clientId;
      this.cache.clientSecret = data.clientSecret;
    }
    catch(err) {
      console.log(err);
      throw new Error(err);
    }
  }

  async generateToken() {
    try {
      console.log("Generating temporary token..\n");
      const data = await wso2apim.generateToken(
        "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/oauth2/token",
        this.wso2APIM.user,
        this.wso2APIM.pass,
        this.cache.clientId,
        this.cache.clientSecret,
        "apim:api_create apim:api_publish apim:api_view apim:subscribe apim:tier_view apim:tier_manage apim:subscription_view apim:subscription_block",
      );
      this.cache.accessToken = data.accessToken;
    }
    catch(err) {
      console.log(err);
      throw new Error(err);
    }
  }

  async listAPIDefs() {
    if (this.cmd === 'list|apidefs')
      console.log("Retrieving API Definitions..");
    this.cache.deploymentStatus = [];
    // Loops thru each api definition found in serverless configuration
    for (let apiDef of this.apiDefs) {
      try {
        var apiDefClob = apiDef.name + "|-|" + apiDef.version + "|-|" + apiDef.rootContext;
        const data = await wso2apim.isAPIDeployed(
          "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/api/am/publisher/" + this.wso2APIM.versionSlug + "/apis",
          this.cache.accessToken,
          apiDef.name,
          apiDef.version,
          apiDef.rootContext
        );

        this.cache.deployedAPIs = [];
        // Loops thru each deployed api definition returned from WSO2 API Manager (we need to find exact match out of 1:n results returned)
        data.list.forEach(async (deployedAPI) => {
          // Remove /t/* suffix if exists
          if (deployedAPI.context.startsWith("/t/")) {
            deployedAPI.context = deployedAPI.context.split(this.cache.tenantSuffix)[1]
          }
          this.cache.deployedAPIs.push({
            apiId: deployedAPI.id,
            apiClob: deployedAPI.name + "|-|" + deployedAPI.version + "|-|" + deployedAPI.context,
            apiStatus: deployedAPI.status
          });
        });

        // Compare apples-to-apples (configured-to-deployed) and record deployment status
        if (this.cache.deployedAPIs.some(deployedAPI => deployedAPI.apiClob === apiDefClob)) {
          this.cache.deploymentStatus.push({
            apiName: apiDef.name,
            apiVersion: apiDef.version,
            apiContext: apiDef.rootContext,
            apiStatus: this.cache.deployedAPIs.find(deployedAPI => deployedAPI.apiClob === apiDefClob).apiStatus,
            apiId: this.cache.deployedAPIs.find(deployedAPI => deployedAPI.apiClob === apiDefClob).apiId,
          });
        }
        else {
          this.cache.deploymentStatus.push({
            apiName: apiDef.name,
            apiVersion: apiDef.version,
            apiContext: apiDef.rootContext,
            apiStatus: "TO BE CREATED",
          })
        }
      }
      catch (err) {
        console.log(err);
        throw new Error(err);
      }
      this.cache.deployedAPIs = [];
    };
    if (this.cmd === 'list|apidefs')
      console.table(this.cache.deploymentStatus);
  }

  async createOrUpdateAPIDefs() {
    try {
      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager
      await this.listAPIDefs();

      // Create API definitions, if they do not exist
      for (const [i, api] of this.cache.deploymentStatus.entries()) {
        try {
          if (api.apiId !== undefined) {
            console.log("Updating " + this.apiDefs[i].name + " (" + api.apiId + ")..");
            const data = await wso2apim.updateAPIDef(
              "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/api/am/publisher/" + this.wso2APIM.versionSlug + "/apis",
              this.wso2APIM.user,
              this.cache.accessToken,
              this.wso2APIM.gatewayEnv,
              this.apiDefs[i],
              api.apiId
            );
          }
          else {
            console.log("Creating " + this.apiDefs[i].name + "..");
            const data = await wso2apim.createAPIDef(
              "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/api/am/publisher/" + this.wso2APIM.versionSlug + "/apis",
              this.wso2APIM.user,
              this.cache.accessToken,
              this.wso2APIM.gatewayEnv,
              this.apiDefs[i]
            );
          }
        }
        catch (err) {
          console.log(err);
        }
      }

      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager
      await this.listAPIDefs();
      console.log("\n");

      // Publish or Re-Publish API definitions, based on whether they are in CREATED or PUBLISHED states
      for (const [i, api] of this.cache.deploymentStatus.entries()) {
        try {
          if (api.apiId !== undefined) {
            if (api.apiStatus === 'CREATED') {
              console.log("Publishing " + this.apiDefs[i].name + " (" + api.apiId + ")..");
            }
            else if (api.apiStatus === 'PUBLISHED') {
              console.log("Re-publishing " + this.apiDefs[i].name + " (" + api.apiId + ")..");
            }
            const data = await wso2apim.publishAPIDef(
              "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/api/am/publisher/" + this.wso2APIM.versionSlug + "/apis/change-lifecycle",
              this.cache.accessToken,
              api.apiId
            );
          }
        }
        catch (err) {
          console.log(err);
        }
      }
    }
    catch (err) {
      console.log(err);
      throw new Error(err);
    }    
    console.log("\nDeployment successful.", "\n", "Use `sls list apidefs` to view the deployment status.");
  }


  async removeAPIDefs() {
    try {
      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager
      await this.listAPIDefs(); 
      for (let api of this.cache.deploymentStatus) {
        if (api.apiId !== undefined) {
          console.log("Deleting " + api.apiId + "..");
          const data = await wso2apim.removeAPIDef(
            "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/api/am/publisher/" + this.wso2APIM.versionSlug + "/apis",
            this.cache.accessToken,
            api.apiId
          );
        }
      };
      console.log("\nRemoval successful.", "\n", "Use `sls list apidefs` to view the deployment status.");
    }
    catch(err) {
      console.log(err);
      throw new Error(err);
    }
  }

}

module.exports = ServerlessPlugin;
