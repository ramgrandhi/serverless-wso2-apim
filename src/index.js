'use strict';
const wso2apim = require("./2.6.0/wso2apim");
const utils = require('./utils/utils');
const fs = require('fs');
const pluginNameSuffix = '[serverless-wso2-apim] ';

console.log.apply(null);

class Serverless_WSO2_APIM {

  constructor(serverless, options) {
    this.cache = {}

    this.serverless = serverless;
    this.options = options;
  
    this.wso2APIM = serverless.service.custom.wso2apim;
    this.apiDefs = this.wso2APIM.apidefs;
    this.cmd = this.serverless.pluginManager.cliCommands.join('|');

    //Retrieve tenantSuffix in case of multi-tenant setup
    if (this.wso2APIM.user.includes("@")) {
      this.cache.tenantSuffix = this.wso2APIM.user.split("@")[1];
    }

    this.hooks = {
      'after:deploy:deploy': this.deploy.bind(this),
      'after:info:info': this.info.bind(this),
      'after:remove:remove': this.remove.bind(this)
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

  async deploy() {
    await this.validateConfig();
    await this.registerClient();
    await this.generateToken();
    await this.uploadCerts();
    // await this.createOrUpdateAPIDefs();
  }
  async info() {
    await this.registerClient();
    await this.generateToken();
    await this.listAPIDefs();
  }
  async remove() {
    await this.registerClient();
    await this.generateToken();
    await this.removeAPIDefs();
  }

  async validateConfig() {
    this.serverless.cli.log(pluginNameSuffix + "Validating configuration..");
    const wso2APIM = this.serverless.service.custom.wso2apim;
    if ((wso2APIM.host == undefined) ||
      (wso2APIM.port == undefined) ||
      (wso2APIM.user == undefined) ||
      (wso2APIM.pass == undefined) ||
      (wso2APIM.apidefs == undefined)) {
      this.serverless.cli.log(pluginNameSuffix + "Validating configuration.. NOT OK");
      throw new Error();
    }
    else {
      this.serverless.cli.log(pluginNameSuffix + "Validating configuration.. OK");
    }
  }

  async registerClient() {
    this.serverless.cli.log(pluginNameSuffix + "Registering client..");
    const wso2APIM = this.serverless.service.custom.wso2apim;
    try {
      const data = await wso2apim.registerClient(
        "https://" + wso2APIM.host + ":" + wso2APIM.port + "/client-registration/" + wso2APIM.versionSlug + "/register",
        wso2APIM.user,
        wso2APIM.pass
      );
      this.cache.clientId = data.clientId;
      this.cache.clientSecret = data.clientSecret;
      this.serverless.cli.log(pluginNameSuffix + "Registering client.. OK");
    }
    catch (err) {
      this.serverless.cli.log(pluginNameSuffix + "Registering client.. NOT OK");
      throw new Error(err);
    }
  }

  async generateToken() {
    this.serverless.cli.log(pluginNameSuffix + "Generating temporary token..");
    const wso2APIM = this.serverless.service.custom.wso2apim;
    try {
      const data = await wso2apim.generateToken(
        "https://" + wso2APIM.host + ":" + wso2APIM.port + "/oauth2/token",
        wso2APIM.user,
        wso2APIM.pass,
        this.cache.clientId,
        this.cache.clientSecret,
        "apim:api_create apim:api_publish apim:api_view apim:subscribe apim:tier_view apim:tier_manage apim:subscription_view apim:subscription_block",
      );
      this.cache.accessToken = data.accessToken;
      this.serverless.cli.log(pluginNameSuffix + "Generating temporary token.. OK");
    }
    catch (err) {
      this.serverless.cli.log(pluginNameSuffix + "Generating temporary token.. NOT OK");
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
            this.serverless.cli.log("Retrieving backend certificates.. NOT OK for " + `${apiDef.name}` + ", proceeding further.");
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
      this.serverless.cli.log("Retrieving backend certificates.. OK");
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
        console.log("--is api deployed?", data);

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
            apiId: undefined,
            invokableAPIURL: "TO BE CREATED",
          })
        }
      }
      catch (err) {
        this.serverless.cli.log("Retrieving API Definitions.. NOT OK");
        throw new Error(err);
      }
      this.cache.deployedAPIs = [];
    };
    if (this.cmd === 'list|apidefs')
      this.serverless.cli.log("Retrieving API Definitions.. OK");
    console.table(this.cache.deploymentStatus);
  }

  async detectAndSplitCerts(certChain) {
    var certs = [];
    // If certChain is provided as a file (relative to where serverless.yml is located)
    if (certChain.startsWith("file://")) {
      const certOutput = fs.readFileSync(certChain.split("file://")[1], "utf8");
      certOutput.split("-----END CERTIFICATE-----\n").map((CA) => {
        if (CA.length > 0) {
          certs.push(CA + "-----END CERTIFICATE-----\n");
        }
      });
      return certs;
    }
    // If certChain is provided as an AWS ACM ARN
    else if (certChain.startsWith("arn:aws:acm:")) {
      this.provider = this.serverless.getProvider('aws');
      const certOutput = await this.provider.request('ACM', 'getCertificate', {
        CertificateArn: certChain
      });
      if (certOutput) {
        const leafCert = certOutput.Certificate;
        const CAs = certOutput.CertificateChain;
        // Push the leaf certificate to the list
        certs.push(leafCert);
        // Detect if multiple intermediary CAs are present in the CertificateChain
        // Push the certificates (after splitting, if multiples are found in the chain)
        CAs.split("-----END CERTIFICATE-----\n").map((CA) => {
          if (CA.length > 0) {
            certs.push(CA + "-----END CERTIFICATE-----\n");
          }
        });
        return certs;
      }
      else {
        return undefined;
      }
    }
  }

  async uploadCerts() {
    const wso2APIM = this.serverless.service.custom.wso2apim;
    const apiDefs = wso2APIM.apidefs;
    const slsDir = this.serverless.config.servicePath + "/.serverless";
    try {
      // Loops thru each api definition found in serverless configuration
      for (const [i, apiDef] of apiDefs.entries()) {
        this.serverless.cli.log(pluginNameSuffix + "Uploading backend certificates for " + apiDef.name + "..");

        try {
          // certAlias takes the form of <APIName>|-|<Version>|-|<index>
          let certs = await this.detectAndSplitCerts(apiDef.backend.http.certChain);

          // Loop thru all certificates, e.g. Leaf cert, Intermediary CA, Root CA etc
          // Create individual certificate files under /.serverless directory
          if (certs.length > 0) {
            certs.map(async (cert, j) => {
              let certAlias = apiDef.name + "|-|" + apiDef.version + "|-|" + j;
              let certFile = slsDir + "/" + certAlias + ".cer";
              fs.writeFileSync(certFile, cert);

              // Upload Cert to WSO2 API Manager
              try {
                await wso2apim.uploadCert(
                  "https://" + wso2APIM.host + ":" + wso2APIM.port + "/api/am/publisher/" + wso2APIM.versionSlug + "/certificates",
                  this.cache.accessToken,
                  certAlias,
                  certFile,
                  apiDef.backend.http.baseUrl
                );
                this.serverless.cli.log(pluginNameSuffix + "Uploading certificate #" + j + " .. OK");
              }
              catch (err) {
                if (err.response.data.code != '409') {
                  this.serverless.cli.log(pluginNameSuffix + "Uploading certificate #" + j + " .. NOT OK, proceeding further");
                }
              }
            });
            this.serverless.cli.log(pluginNameSuffix + "Uploading backend certificates for " + apiDef.name + ".. OK");
          }
        }
        catch (err) {
          if (err.response.data.code != '409') {
            this.serverless.cli.log(pluginNameSuffix + "Uploading backend certificates for " + apiDef.name + ".. NOT OK, proceeding further.");
          }
        }
      }
    }
    catch (err) {
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
            this.serverless.cli.log("Updating " + this.apiDefs[i].name + " (" + api.apiId + ").. OK");
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
            this.serverless.cli.log("Creating " + this.apiDefs[i].name + ".. OK");
          }
        }
        catch (err) {
          this.serverless.cli.log("Creating / Updating " + `${this.apiDefs[i].name}` + ".. NOT OK, proceeding further.");
        }
      }

      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager
      await this.listAPIDefs();
      console.log("--- after creating/updating, before publishing", this.cache.deploymentStatus);

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
            this.serverless.cli.log("Publishing / Re-publishing " + this.apiDefs[i].name + " (" + api.apiId + ").. OK");
          }
        }
        catch (err) {
          this.serverless.cli.log("Publishing / Re-publishing " + this.apiDefs[i].name + " (" + api.apiId + ").. NOT OK, proceeding further.");
        }
      }
    }
    catch (err) {
      this.serverless.cli.log("Creating / Updating API definitions.. NOT OK");
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
          this.serverless.cli.log("Deleting " + api.apiId + ".. OK");
        }
      };
      this.serverless.cli.log("Removal complete. \n Use `sls list apidefs` to view the deployment status.");
    }
    catch(err) {
      this.serverless.cli.log("Deleting API defintions.. NOT OK");
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

module.exports = Serverless_WSO2_APIM;
