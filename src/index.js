'use strict';
var wso2apim;
const utils = require('./utils/utils');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const pluginNameSuffix = '[serverless-wso2-apim] ';

const wso2ApimVersionsSupported = ['2.6.0', '3.2.0'];
const versionSlugsSupported = {
  '2.6.0': {
    'versionSlug': 'v0.14'
  },
  '3.2.0': {
    'versionSlug': 'v1.2'
  }
};

class Serverless_WSO2_APIM {
  constructor(serverless, options) {
    this.cache = {};

    this.serverless = serverless;
    this.options = options;
    this.cmd = this.serverless.pluginManager.cliCommands.join('|');

    this.commands = {
      remove: {
        commands: {
          apidefs: {
            usage: 'Deletes API definitions in WSO2 API Manager.',
            lifecycleEvents: [
              'removeAPIDefsAndCerts'
            ],
          },
        }
      }
    };

    this.hooks = {
      'after:deploy:deploy': this.deploy.bind(this),
      'after:info:info': this.info.bind(this),
      'after:remove:remove': this.remove.bind(this),
      'remove:apidefs:removeAPIDefsAndCerts': this.remove.bind(this)
    };
  }

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

  async initPluginState() {
    this.wso2APIM = this.serverless.service.custom.wso2apim;
    this.apiDefs = this.wso2APIM.apidefs;

    //Retrieve tenantSuffix in case of multi-tenant setup
    if (this.wso2APIM.user.includes('@')) {
      this.cache.tenantSuffix = this.wso2APIM.user.split('@')[1];
    }
  }
  async deploy() {
    await this.initPluginState();
    await this.validateConfig();
    if (
      this.wso2APIM.enabled !== undefined &&
      this.wso2APIM.enabled === false
    ) {
      this.serverless.cli.log(
        pluginNameSuffix +
          'Configuration is disabled globally, Skipping deployment.. OK'
      );
      return;
    }
    await this.registerClient();
    await this.generateToken();
    await this.uploadCerts();
    await this.createOrUpdateAPIDefs();
  }
  async info() {
    await this.initPluginState();
    await this.validateConfig();
    if (
      this.wso2APIM.enabled !== undefined &&
      this.wso2APIM.enabled === false
    ) {
      this.serverless.cli.log(
        pluginNameSuffix +
          'Configuration is disabled globally, Skipping retrieval.. OK'
      );
      return;
    }
    await this.registerClient();
    await this.generateToken();
    await this.listAPIDefs();
  }
  async remove() {
    await this.initPluginState();
    await this.validateConfig();
    if (
      this.wso2APIM.enabled !== undefined &&
      this.wso2APIM.enabled === false
    ) {
      this.serverless.cli.log(
        pluginNameSuffix +
          'Configuration is disabled globally, Skipping deletion.. OK'
      );
      return;
    }
    await this.registerClient();
    await this.generateToken();
    await this.removeAPIDefsAndCerts();
  }

  async splitCertChain(certChainContent) {
    const split = '\n';
    let chain = certChainContent;

    var certs = [];
    if (
      chain.indexOf('-END CERTIFICATE-') < 0 ||
      chain.indexOf('-BEGIN CERTIFICATE-') < 0
    ) {
      throw Error(
        'Incompatible certificate format, make sure it\'s base64 encoded..'
      );
    }
    chain = chain.split(split);
    var cert = [];
    var _i, _len;
    for (_i = 0, _len = chain.length; _i < _len; _i++) {
      var line = chain[_i];
      if (!(line.length !== 0)) {
        continue;
      }
      cert.push(line);
      if (line.match(/-END CERTIFICATE-/)) {
        certs.push(cert.join(split));
        cert = [];
      }
    }
    return certs;
  }

  async validateConfig() {
    try {
      // this.serverless.cli.log(pluginNameSuffix + "Validating configuration..");
      const wso2APIM = this.serverless.service.custom.wso2apim;

      // Key value checks, with corresponding error messages
      const conditionsArray = [
        ((wso2APIM.enabled) && (typeof wso2APIM.enabled === 'boolean')),
        ((wso2APIM.host) && (wso2APIM.host.length > 0)),
        ((wso2APIM.port) && (wso2APIM.port > 0)),
        ((wso2APIM.user) && (wso2APIM.user.length > 0)),
        ((wso2APIM.pass) && (wso2APIM.pass.length > 0)),
        ((wso2APIM.gatewayEnv) && (wso2APIM.gatewayEnv.length > 0)),
        (wso2APIM.apidefs.length > 0)
      ];
      const messagesArray = [
        'Invalid value assigned to `custom.wso2apim.enabled`',
        'Invalid value assigned to `custom.wso2apim.host`',
        'Invalid value assigned to `custom.wso2apim.port`',
        'Invalid value assigned to `custom.wso2apim.user`',
        'Invalid value assigned to `custom.wso2apim.pass`',
        'Invalid value assigned to `custom.wso2apim.gatewayEnv`',
        'No API definitions supplied `custom.wso2apim.apidefs`',
      ];

      if (conditionsArray.indexOf(false) !== -1) {
        throw new Error(`${messagesArray[Number(conditionsArray.indexOf(false))]}`);
      }

      // Detect WSO2 API Manager product version to use correct management APIs
      const { data } = await this.detectProductVersion();
      if ((data) && (data.includes('WSO2 API Manager-'))) {
        this.cache.wso2apimVersion = data.split('WSO2 API Manager-')[1].split('</')[0];
        if (wso2ApimVersionsSupported.includes(this.cache.wso2apimVersion)) {
          this.serverless.cli.log(
            pluginNameSuffix + 'Auto-detected WSO2 API Manager version.. ' + this.cache.wso2apimVersion
          );
          wso2apim = require('./' + this.cache.wso2apimVersion + '/wso2apim');
          wso2APIM.versionSlug = versionSlugsSupported[this.cache.wso2apimVersion].versionSlug;
        }
        else {
          throw new Error('Incompatible WSO2 API Manager version.. ' + this.cache.wso2apimVersion);
        }
      }
      else {
        throw new Error('Unable to detect WSO2 API Manager version.. ');
      }
      this.serverless.cli.log(
        pluginNameSuffix + 'Validating configuration.. OK'
      );
    } 
    catch (err) {
      utils.renderError(err);
      this.serverless.cli.log(
        pluginNameSuffix + 'Validating configuration.. NOT OK'
      );
      throw new Error(err);
    }
  }

  async detectProductVersion() {
    const wso2APIM = this.serverless.service.custom.wso2apim;
    let url = `https://${wso2APIM.host}:${wso2APIM.port}/services/Version`;
    let config = {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };
    return axios.get(url, config);
  }

  async registerClient() {
    // this.serverless.cli.log(pluginNameSuffix + "Registering client..");
    const wso2APIM = this.serverless.service.custom.wso2apim;
    try {
      const data = await wso2apim.registerClient(wso2APIM);
      this.cache.clientId = data.clientId;
      this.cache.clientSecret = data.clientSecret;
      this.serverless.cli.log(pluginNameSuffix + 'Registering client.. OK');
    } catch (err) {
      this.serverless.cli.log(pluginNameSuffix + 'Registering client.. NOT OK');
      throw new Error(err);
    }
  }

  async generateToken() {
    // this.serverless.cli.log(pluginNameSuffix + "Generating temporary token..");
    const wso2APIM = this.serverless.service.custom.wso2apim;
    try {
      const data = await wso2apim.generateToken(
        wso2APIM,
        this.cache.clientId,
        this.cache.clientSecret
      );
      this.cache.accessToken = data.accessToken;
      this.serverless.cli.log(
        pluginNameSuffix + 'Generating temporary token.. OK'
      );
    } catch (err) {
      this.serverless.cli.log(
        pluginNameSuffix + 'Generating temporary token.. NOT OK'
      );
      throw new Error(err);
    }
  }

  async listAPIDefs() {
    if (this.cmd === 'info') {
      // this.serverless.cli.log(pluginNameSuffix + "Retrieving API Definitions..");
    }
    const wso2APIM = this.serverless.service.custom.wso2apim;
    const apiDefs = wso2APIM.apidefs;

    //Retrieve tenantSuffix in case of multi-tenant setup
    if (this.wso2APIM.user.includes('@')) {
      this.cache.tenantSuffix = this.wso2APIM.user.split('@')[1];
    }

    this.cache.deploymentStatus = [];
    // Loops thru each api definition found in serverless configuration
    for (let apiDef of apiDefs) {
      try {
        // Check if API is already deployed using the following combination:
        // It takes the form of <APIName>___<Version>___<RootContext>
        var apiDefClob =
          apiDef.name + '___' + apiDef.version + '___' + apiDef.rootContext;
        const data = await wso2apim.isAPIDeployed(
          wso2APIM,
          this.cache.accessToken,
          apiDef.name,
          apiDef.version,
          apiDef.rootContext
        );

        // Loops thru all deployed api definitions returned from WSO2 API Manager (we need to find exact match out of 1:n results returned)
        this.cache.deployedAPIs = [];
        if (data.list.length > 0) {
          data.list.forEach((deployedAPI) => {
            // Remove /t/* suffix if exists
            var deployedAPIContext = deployedAPI.context;
            if (deployedAPIContext.startsWith('/t/')) {
              deployedAPIContext = deployedAPIContext.split(
                this.cache.tenantSuffix
              )[1];
            }
            this.cache.deployedAPIs.push({
              apiId: deployedAPI.id,
              apiClob:
                deployedAPI.name +
                '___' +
                deployedAPI.version +
                '___' +
                deployedAPIContext,
              apiStatus: deployedAPI.status || deployedAPI.lifeCycleStatus,
            });
          });
        }

        // Compare apples-to-apples (configured-vs-deployed APIs) and record their deployment status
        if (
          this.cache.deployedAPIs.some(
            (deployedAPI) => deployedAPI.apiClob == apiDefClob
          )
        ) {
          const apiStatus = this.cache.deployedAPIs.find(
            (deployedAPI) => deployedAPI.apiClob == apiDefClob
          ).apiStatus;
          const apiId = this.cache.deployedAPIs.find(
            (deployedAPI) => deployedAPI.apiClob == apiDefClob
          ).apiId;
          var invokableAPIURL = null;

          // if API is PUBLISHED then retrieve invokable API URL
          try {
            if (apiStatus == 'PUBLISHED') {
              const data = await wso2apim.listInvokableAPIUrl(
                wso2APIM,
                this.cache.accessToken,
                apiId
              );
              const invokableAPIURLObj = data.endpointURLs.filter((Url) => {
                return Url.environmentName === wso2APIM.gatewayEnv;
              });
              if (invokableAPIURLObj[0].environmentURLs) {
                invokableAPIURL = invokableAPIURLObj[0].environmentURLs.https;
              }
              else if (invokableAPIURLObj[0].URLs) {
                invokableAPIURL = invokableAPIURLObj[0].URLs.https;
              }
            }
          } catch (err) {
            console.log(err);
            this.serverless.cli.log(
              pluginNameSuffix +
                'An error occurred while retrieving Invokable API URL, proceeding further.'
            );
          }

          this.cache.deploymentStatus.push({
            apiName: apiDef.name,
            apiVersion: apiDef.version,
            apiContext: apiDef.rootContext,
            apiStatus: apiStatus,
            apiId,
            invokableAPIURL: invokableAPIURL + ' 🚀 ',
          });
        } else {
          this.cache.deploymentStatus.push({
            apiName: apiDef.name,
            apiVersion: apiDef.version,
            apiContext: apiDef.rootContext,
            apiStatus: 'TO BE CREATED',
            apiId: undefined,
            invokableAPIURL: 'TO BE CREATED',
          });
        }
      } catch (err) {
        console.log(err);
        this.serverless.cli.log(
          pluginNameSuffix + 'Retrieving API Definitions.. NOT OK'
        );
        throw new Error(err);
      }
      this.cache.deployedAPIs = [];
    }

    if (this.cmd === 'info') {
      this.serverless.cli.log(
        pluginNameSuffix + 'Retrieving API Definitions.. OK'
      );
      console.table(this.cache.deploymentStatus);
    }
  }

  async detectAndSplitCerts(certChain) {
    var certs = [];
    var certOutput;

    // if certChain is an object
    if (typeof certChain == 'object') {
      // If certChain ARN is obtained via Cloud Formation's intrinsic function syntax (!Ref or Fn::ImportValue)
      if (certChain['Fn::ImportValue']) {
        this.provider = this.serverless.getProvider('aws');
        certChain = await utils.resolveCfImportValue(
          this.provider,
          certChain['Fn::ImportValue']
        );
        if (certChain.startsWith('arn:aws:acm:')) {
          certOutput = await this.provider.request('ACM', 'getCertificate', {
            CertificateArn: certChain,
          });
          if (certOutput) {
            const leafCert = certOutput.Certificate;
            const CAs = certOutput.CertificateChain;
            // Push the leaf certificate to the list
            certs.push(leafCert);
            certs.push(await this.splitCertChain(CAs));

            return certs;
          }
        }
      }
    }
    // if certChain is NOT an object
    else {
      // If certChain is provided as a file (relative to where serverless.yml is located)
      if (certChain.startsWith('file://')) {
        certOutput = fs.readFileSync(certChain.split('file://')[1], 'utf8');
        certs = await this.splitCertChain(certOutput);

        return certs;
      }
      // If certChain is provided as an AWS ACM ARN
      else if (certChain.startsWith('arn:aws:acm:')) {
        this.provider = this.serverless.getProvider('aws');
        certOutput = await this.provider.request('ACM', 'getCertificate', {
          CertificateArn: certChain,
        });
        if (certOutput) {
          const leafCert = certOutput.Certificate;
          const CAs = certOutput.CertificateChain;
          // Push the leaf certificate to the list
          certs.push(leafCert);
          certs.push(await this.splitCertChain(CAs));

          return certs;
        }
      }
    }
  }

  async saveCert(certContent, certAlias) {
    // Create individual certificate files under /.serverless directory
    const slsDir = this.serverless.config.servicePath + '/.serverless';
    if (certContent && certContent.length > 0) {
      let certFile = slsDir + '/' + certAlias + '.cer';
      fs.writeFileSync(certFile, certContent, 'utf8');
    }
  }

  async uploadCerts() {
    const wso2APIM = this.serverless.service.custom.wso2apim;
    const apiDefs = wso2APIM.apidefs;
    const slsDir = this.serverless.config.servicePath + '/.serverless';
    try {
      // Loops thru each api definition found in serverless configuration
      for (const [, apiDef] of apiDefs.entries()) {
        if (apiDef.backend.http && apiDef.backend.http.certChain) {
          this.serverless.cli.log(
            pluginNameSuffix +
              'Uploading / Updating backend certificates for ' +
              apiDef.name +
              '..'
          );
          try {
            let certs = await this.detectAndSplitCerts(
              apiDef.backend.http.certChain
            );

            // Loop thru all certificates, e.g. Leaf cert, Intermediary CA, Root CA etc
            // Create individual certificate files under /.serverless directory
            if (certs && certs.length > 0) {
              for (let j = 0; j < certs.length; j++) {
                let cert = certs[j];
                var certAlias;
                if (this.cache.tenantSuffix) {
                  // certAlias takes the form of <APIName>___<Version>___<index>_at_<tenantSuffix>
                  certAlias =
                    apiDef.name +
                    '___' +
                    apiDef.version +
                    '___' +
                    j +
                    '_at_' +
                    this.cache.tenantSuffix;
                } else {
                  // certAlias takes the form of <APIName>___<Version>___<index>
                  certAlias = apiDef.name + '___' + apiDef.version + '___' + j;
                }
                await this.saveCert(cert.toString(), certAlias);

                // Upload Cert to WSO2 API Manager
                try {
                  await wso2apim.uploadCert(
                    wso2APIM,
                    this.cache.accessToken,
                    certAlias,
                    slsDir + '/' + certAlias + '.cer',
                    apiDef.backend.http.baseUrl
                  );
                  this.serverless.cli.log(
                    pluginNameSuffix + 'Uploading certificate #' + j + ' .. OK'
                  );
                  await utils.goToSleep(1000);
                } catch (err) {
                  // If Certificate-exists-for-that-Alias error occurs.. then update it.
                  if (err.response.data && err.response.data.code == '409') {
                    await wso2apim.updateCert(
                      wso2APIM,
                      this.cache.accessToken,
                      certAlias,
                      slsDir + '/' + certAlias + '.cer'
                    );
                    this.serverless.cli.log(
                      pluginNameSuffix + 'Updating certificate #' + j + ' .. OK'
                    );
                    await utils.goToSleep(1000);
                  }
                  // Handle all other exceptions as Errors
                  else {
                    this.serverless.cli.log(
                      pluginNameSuffix +
                        'Uploading certificate #' +
                        j +
                        ' .. NOT OK, proceeding further'
                    );
                    utils.renderError(err);
                  }
                }
              }
              this.serverless.cli.log(
                pluginNameSuffix +
                  'Uploading / Updating backend certificates for ' +
                  apiDef.name +
                  '.. OK'
              );
            }
          } catch (err) {
            if (err.response.data && err.response.data.code != '409') {
              this.serverless.cli.log(
                pluginNameSuffix +
                  'Uploading / Updating backend certificates for ' +
                  apiDef.name +
                  '.. NOT OK, proceeding further.'
              );
            }
          }
        }
      }
    } catch (err) {
      throw new Error(err);
    }
  }

  async createOrUpdateAPIDefs() {
    const wso2APIM = this.serverless.service.custom.wso2apim;
    const apiDefs = wso2APIM.apidefs;

    //Retrieve tenantSuffix in case of multi-tenant setup
    if (this.wso2APIM.user.includes('@')) {
      this.cache.tenantSuffix = this.wso2APIM.user.split('@')[1];
    }

    try {
      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager into this.cache.deploymentStatus
      await this.listAPIDefs();

      // Loop thru this.cache.deploymentStatus array
      // Create API definitions, if they do not exist
      // Update API definitions, if they exist
      for (const [i, api] of this.cache.deploymentStatus.entries()) {
        try {
          //Update
          if (api.apiId !== undefined) {
            // this.serverless.cli.log(pluginNameSuffix + "Updating " + api.apiName + " (" + api.apiId + ")..");
            await wso2apim.updateAPIDef(
              wso2APIM,
              this.cache.accessToken,
              apiDefs[i],
              api.apiId
            );
            this.serverless.cli.log(
              pluginNameSuffix +
                'Updating ' +
                api.apiName +
                ' (' +
                api.apiId +
                ').. OK'
            );
          }
          //Create
          else {
            // this.serverless.cli.log(pluginNameSuffix + "Creating " + api.apiName + "".."");
            await wso2apim.createAPIDef(
              wso2APIM,
              this.cache.accessToken,
              apiDefs[i]
            );
            this.serverless.cli.log(
              pluginNameSuffix + 'Creating ' + api.apiName + '.. OK'
            );
          }
        } catch (err) {
          this.serverless.cli.log(
            'Creating / Updating ' +
              `${apiDefs[i].name}` +
              '.. NOT OK, proceeding further.'
          );
        }
      }

      await utils.goToSleep(3000);

      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager
      await this.listAPIDefs();

      // Publish or Re-Publish API definitions, based on whether they are in CREATED or PUBLISHED states
      for (const [i, api] of this.cache.deploymentStatus.entries()) {
        try {
          if (api.apiId !== undefined) {
            if (api.apiStatus === 'CREATED') {
              // this.serverless.cli.log(pluginNameSuffix + "Publishing " + api.apiName + " (" + api.apiId + ")..");
            } else if (api.apiStatus === 'PUBLISHED') {
              // this.serverless.cli.log(pluginNameSuffix + "Re-publishing " + api.apiName + " (" + api.apiId + ")..");
            }
            await wso2apim.publishAPIDef(
              wso2APIM,
              this.cache.accessToken,
              api.apiId
            );
            this.serverless.cli.log(
              pluginNameSuffix +
                'Publishing ' +
                api.apiName +
                ' (' +
                api.apiId +
                ').. OK'
            );
          }
        } catch (err) {
          this.serverless.cli.log(
            pluginNameSuffix +
              'Publishing ' +
              apiDefs[i].name +
              ' (' +
              api.apiId +
              ').. NOT OK, proceeding further.'
          );
        }
      }
    } catch (err) {
      this.serverless.cli.log(
        pluginNameSuffix + 'Creating / Updating API definitions.. NOT OK'
      );
      throw new Error(err);
    }
    await this.listAPIDefs();
    console.table(this.cache.deploymentStatus);
  }

  async removeAPIDefsAndCerts() {
    const wso2APIM = this.serverless.service.custom.wso2apim;

    try {
      // By calling listAPIDefs(), we are re-collecting the current deployment status in WSO2 API Manager
      await this.listAPIDefs();

      // Loop thru this.cache.deploymentStatus array
      // Delete API definitions, if they exist and there are NO active subscriptions/users
      // It does NOT force delete API definitions, if there are any active subscriptions/users
      for (let api of this.cache.deploymentStatus) {
        try {
          if (api.apiId) {
            // this.serverless.cli.log(pluginNameSuffix + "Deleting " + api.apiId + "..");
            await wso2apim.removeAPIDef(
              wso2APIM,
              this.cache.accessToken,
              api.apiId
            );
            this.serverless.cli.log(
              pluginNameSuffix + 'Deleting ' + api.apiName + '.. OK'
            );

            // Delete associated backend Certificates, if any
            var certAlias;
            for (let j = 0; j < 5; j++) {
              try {
                if (this.cache.tenantSuffix) {
                  // certAlias takes the form of <APIName>___<Version>___<index>_at_<tenantSuffix>
                  certAlias =
                    api.apiName +
                    '___' +
                    api.apiVersion +
                    '___' +
                    j +
                    '_at_' +
                    this.cache.tenantSuffix;
                } else {
                  // certAlias takes the form of <APIName>___<Version>___<index>
                  certAlias = api.apiName + '___' + api.apiVersion + '___' + j;
                }

                await wso2apim.removeCert(
                  wso2APIM,
                  this.cache.accessToken,
                  certAlias
                );
                this.serverless.cli.log(
                  pluginNameSuffix +
                    'Deleting certificate #' +
                    j +
                    ' for ' +
                    api.apiName +
                    '.. OK'
                );
              } catch (err) {
                // Ignore Certificate-not-found-for-that-Alias error gracefully
                if ((err.response.data && err.response.data.code != '404') || (err.response.status != '404')) {
                  this.serverless.cli.log(
                    pluginNameSuffix +
                      'Deleting certificate #' +
                      j +
                      ' for ' +
                      api.apiName +
                      '.. NOT OK, proceeding further.'
                  );
                }
              }
            }
          }
        } catch (err) {
          this.serverless.cli.log(
            pluginNameSuffix +
              'Deleting ' +
              api.apiName +
              '.. NOT OK, proceeding further.'
          );
        }
      }
      this.serverless.cli.log(
        pluginNameSuffix + 'Deleting API definitions.. OK'
      );
    } catch (err) {
      this.serverless.cli.log(
        pluginNameSuffix + 'Deleting API defintions.. NOT OK'
      );
      throw new Error(err);
    }
  }
}

module.exports = Serverless_WSO2_APIM;
