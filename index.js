'use strict';
const wso2apim = require("./src/2.6.0/wso2apim");
const utils = require('./src/utils/utils');

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
            usage: 'Creates or Updates API definitions in WSO2 API Manager.',
            lifecycleEvents: [
              'registerClient',
              'generateToken',
              'uploadCerts',
              'createOrUpdateAPIDefs',
            ],
          }
        },
      },
      list: {
        commands: {
          apidefs: {
            usage: 'Lists the deployment status of API definitions in WSO2 API Manager.',
            lifecycleEvents: [
              'registerClient',
              'generateToken',
              'listAPIDefs',
            ]
          },
          certs: {
            usage: 'Lists the backend certificates associated with API definitions in WSO2 API Manager.',
            lifecycleEvents: [
              'registerClient',
              'generateToken',
              'listCerts',
            ]
          }
        }
      },
      remove: {
        commands: {
          apidefs: {
            usage: 'Deletes API definitions in WSO2 API Manager.',
            lifecycleEvents: [
              'registerClient',
              'generateToken',
              'removeAPIDefs',
            ],
          },
          certs: {
            usage: 'Deletes backend certificates associated with API definitions in WSO2 API Manager.',
            lifecycleEvents: [
              'registerClient',
              'generateToken',
              'removeCerts',
            ],
          }
        },
      },
    };


    this.hooks = {
      'deploy:apidefs:registerClient': this.registerClient.bind(this),
      'deploy:apidefs:generateToken': this.generateToken.bind(this),
      'deploy:apidefs:uploadCerts': this.uploadCerts.bind(this),
      'deploy:apidefs:createOrUpdateAPIDefs': this.createOrUpdateAPIDefs.bind(this),
      'list:apidefs:registerClient': this.registerClient.bind(this),
      'list:apidefs:generateToken': this.generateToken.bind(this),
      'list:apidefs:listAPIDefs': this.listAPIDefs.bind(this),
      'list:certs:registerClient': this.registerClient.bind(this),
      'list:certs:generateToken': this.generateToken.bind(this),
      'list:certs:listCerts': this.listCerts.bind(this),
      'remove:apidefs:registerClient': this.registerClient.bind(this),
      'remove:apidefs:generateToken': this.generateToken.bind(this),
      'remove:apidefs:removeAPIDefs': this.removeAPIDefs.bind(this),
      'remove:certs:registerClient': this.registerClient.bind(this),
      'remove:certs:generateToken': this.generateToken.bind(this),
      'remove:certs:removeCerts': this.removeCerts.bind(this),
    };
  };

// -----------------------------------------
// --- WSO2 API Manager version agnostic ---
// -----------------------------------------

// for sane code 🍻
// ----------------
// * Deals with URL of HTTP requests, so it can handle other versions of WSO2 API Manager too (at high-level)
// * Acts as a first-mile bridge between Serverless Framework and WSO2 API Manager's dictionary
// * Use no `console.log()` but use `this.serverless.cli.log()` 
// * Use `throw new Error(err)` when you want the execution to halt!
// -----------------

  async registerClient() {
    try {
      this.serverless.cli.log("Registering client..");
      const data = await wso2apim.registerClient(
        "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/client-registration/" + this.wso2APIM.versionSlug + "/register",
        this.wso2APIM.user,
        this.wso2APIM.pass
      );
      this.cache.clientId = data.clientId;
      this.cache.clientSecret = data.clientSecret;
    }
    catch (err) {
      this.serverless.cli.log("An error occurred during client registration.");
      throw new Error(err);
    }
  }

  async generateToken() {
    try {
      this.serverless.cli.log("Generating temporary token..\n");
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
      this.serverless.cli.log("An error occurred while generating temporary token.");
      throw new Error(err);
    }
  }


  async listCerts() {
    try {
      this.serverless.cli.log("Retrieving backend certificates..");
      this.cache.certAvailability = [];
      // Loops thru each api definition found in serverless configuration
      for (let apiDef of this.apiDefs) {
        try {
          // certAlias takes the form of <APIName>-<Version>
          var certAliasClob = apiDef.name + "-" + apiDef.version;
          const certData = await wso2apim.isCertUploaded(
            "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/api/am/publisher/" + this.wso2APIM.versionSlug + "/certificates",
            this.cache.accessToken,
            certAliasClob
          );
          //Record certificate availability if found
          this.cache.certAvailability.push({
            apiName: apiDef.name,
            apiVersion: apiDef.version,
            apiContext: apiDef.rootContext,
            backendCertValidUntil: certData.validity.to,
            backendCertStatus: certData.status,
          });
        }
        catch (err) {
          if (err.response.data.code != '404') {
            this.serverless.cli.log("An error occurred while listing backend certificate for " + `${apiDef.name}` + ", proceeding further.");
          }
          //Record certificate availability if not found
          this.cache.certAvailability.push({
            apiName: apiDef.name,
            apiVersion: apiDef.version,
            apiContext: apiDef.rootContext,
            backendCertValidUntil: "NOT FOUND",
            backendCertStatus: "NOT FOUND",
          });
        }
      }
      console.table(this.cache.certAvailability);
    }
    catch (err) {
      console.log(err);
      
    }
  }


  async listAPIDefs() {
    if (this.cmd === 'list|apidefs')
      this.serverless.cli.log("Retrieving API Definitions..");
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
        // Loops thru all deployed api definitions returned from WSO2 API Manager (we need to find exact match out of 1:n results returned)
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
        if (this.cache.deployedAPIs.some(deployedAPI => deployedAPI.apiClob == apiDefClob)) {
          const apiStatus = this.cache.deployedAPIs.find(deployedAPI => deployedAPI.apiClob == apiDefClob).apiStatus;
          const apiId = this.cache.deployedAPIs.find(deployedAPI => deployedAPI.apiClob == apiDefClob).apiId;
          var invokableAPIURL = null;

          // Check for PUBLISHED state, if PUBLISHED then retrieve Invokable API URL
          try {
            if (apiStatus == 'PUBLISHED') {
              const data = await wso2apim.listInvokableAPIUrl(
                "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/api/am/store/" + this.wso2APIM.versionSlug + "/apis",
                this.cache.accessToken,
                apiId);
              invokableAPIURL = data.endpointURLs.filter((Url) => { return Url.environmentName == this.wso2APIM.gatewayEnv })[0].environmentURLs.https; 
            }
          }
          catch (err) {
            this.serverless.cli.log("An error occurred while retrieving Invokable API URL for " + `${this.apiDefs[i].name}` + ", proceeding further.");
          }

          this.cache.deploymentStatus.push({
            apiName: apiDef.name,
            apiVersion: apiDef.version,
            apiContext: apiDef.rootContext,
            apiStatus: apiStatus,
            apiId, apiId,
            invokableAPIURL: invokableAPIURL + " 🚀",
          });
        }
        else {
          this.cache.deploymentStatus.push({
            apiName: apiDef.name,
            apiVersion: apiDef.version,
            apiContext: apiDef.rootContext,
            apiStatus: "TO BE CREATED",
            apiId: null,
            invokableAPIURL: "TO BE CREATED",
          })
        }
      }
      catch (err) {
        this.serverless.cli.log("An error occurred while listing API deployment status.");
        throw new Error(err);
        }
      this.cache.deployedAPIs = [];
    };
    if (this.cmd === 'list|apidefs')
      console.table(this.cache.deploymentStatus);
  }

  async uploadCerts() {
    try {
      // Loops thru each api definition found in serverless configuration
      for (const [i, apiDef] of this.apiDefs.entries()) {
        try {
          // If backend is HTTPS and `publicCertChain` is present in serverless configuration
          if (apiDef.backend.http.publicCertChain) {
            // certAlias takes the form of <APIName>-<Version>
            var certAlias = apiDef.name + "-" + apiDef.version;
            this.serverless.cli.log("Uploading backend certificate for " + this.apiDefs[i].name + "..");
            const data = await wso2apim.uploadCert(
              "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/api/am/publisher/" + this.wso2APIM.versionSlug + "/certificates",
              this.cache.accessToken,
              certAlias,
              apiDef.backend.http.publicCertChain,
              apiDef.backend.http.baseUrl,
            );
          }
        }
        catch (err) {
          // Ignore Certificate-exists-for-that-Alias error gracefully
          if (err.response.data.code != '409') {
            this.serverless.cli.log("An error occurred while uploading backend certificate for " + `${this.apiDefs[i].name}` + ", proceeding further.");
          }
        }
      }
    }
    catch (err) {
      this.serverless.cli.log("An error occurred while uploading certificates.");
      throw new Error(err);
    }
  }


  async createOrUpdateAPIDefs() {
    try {
      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager
      await this.listAPIDefs();

      // Create API definitions, if they do not exist
      for (const [i, api] of this.cache.deploymentStatus.entries()) {
        try {
          if (api.apiId !== undefined) {
            this.serverless.cli.log("Updating " + this.apiDefs[i].name + " (" + api.apiId + ")..");
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
            this.serverless.cli.log("Creating " + this.apiDefs[i].name + "..");
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
          this.serverless.cli.log("An error occurred while creating / updating " + `${this.apiDefs[i].name}` + ", proceeding further.");
        }
      }

      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager
      await this.listAPIDefs();

      // Publish or Re-Publish API definitions, based on whether they are in CREATED or PUBLISHED states
      for (const [i, api] of this.cache.deploymentStatus.entries()) {
        try {
          if (api.apiId !== undefined) {
            if (api.apiStatus === 'CREATED') {
              this.serverless.cli.log("Publishing " + this.apiDefs[i].name + " (" + api.apiId + ")..");
            }
            else if (api.apiStatus === 'PUBLISHED') {
              this.serverless.cli.log("Re-publishing " + this.apiDefs[i].name + " (" + api.apiId + ")..");
            }
            const data = await wso2apim.publishAPIDef(
              "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/api/am/publisher/" + this.wso2APIM.versionSlug + "/apis/change-lifecycle",
              this.cache.accessToken,
              api.apiId
            );
          }
        }
        catch (err) {
          this.serverless.cli.log("An error occurred while publishing / republishing " + `${this.apiDefs[i].name}` + ", proceeding further.");
        }
      }
    }
    catch (err) {
      this.serverless.cli.log("An error occurred while creating / updating API definitions.");
      throw new Error(err);
    }    
    this.serverless.cli.log("Deployment complete. \n   Use `sls list apidefs` to view the deployment status.");
  }


  async removeAPIDefs() {
    try {
      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager
      await this.listAPIDefs(); 
      for (let api of this.cache.deploymentStatus) {
        if (api.apiId !== undefined) {
          this.serverless.cli.log("Deleting " + api.apiId + "..");
          const data = await wso2apim.removeAPIDef(
            "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/api/am/publisher/" + this.wso2APIM.versionSlug + "/apis",
            this.cache.accessToken,
            api.apiId
          );
        }
      };
      this.serverless.cli.log("Removal complete. \n Use `sls list apidefs` to view the deployment status.");
    }
    catch(err) {
      this.serverless.cli.log("An error occurred while removing API definitions.");
      throw new Error(err);
    }
  }


  async removeCerts() {
    try {
      // Loops thru each api definition found in serverless configuration
      for (const [i, apiDef] of this.apiDefs.entries()) {
        try {
          // certAlias takes the form of <APIName>-<Version>
          var certAlias = apiDef.name + "-" + apiDef.version;
          this.serverless.cli.log("Removing backend certificate for " + this.apiDefs[i].name + " if present..");
          const data = await wso2apim.removeCert(
            "https://" + this.wso2APIM.host + ":" + this.wso2APIM.port + "/api/am/publisher/" + this.wso2APIM.versionSlug + "/certificates",
            this.cache.accessToken,
            certAlias
          );
        }
        catch (err) {
          console.log(err);
          // Ignore Certificate-not-found-for-that-Alias error gracefully
          if (err.response.data.code != '404') {
            this.serverless.cli.log("An error occurred while removing backend certificate for " + `${this.apiDefs[i].name}` + ", proceeding further.");
          }
        }
      }
    }
    catch (err) {
      this.serverless.cli.log("An error occurred while removing certificates.");
      throw new Error(err);
    }
    this.serverless.cli.log("Removal complete. \n   Use `sls list apidefs` to view the deployment status.");
  }

}

module.exports = ServerlessPlugin;
