// ---------------------------------------
// --- WSO2 API Manager 3.2.0 specific ---
// ---------------------------------------

// for sane code 🍻
// ----------------
// * Deals with data & config variables of HTTP requests
// * Acts as a last-mile bridge to specific WSO2 APIM version's management APIs
// * Use no console.log() at this level, only Promises being returned
// ----------------

const axios = require('axios');
const https = require('https');
const qs = require('qs');
const FormData = require('form-data');
const fs = require('fs');
const utils = require('../utils/utils');

// Parse your swagger online @ https://apitools.dev/swagger-parser/online/
const parser = require('swagger-parser');

// Register a new client
async function registerClient(wso2APIM) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/client-registration/' + 'v0.17' + '/register';
    let { user, pass } = wso2APIM;
    let authToken = user + ':' + pass;
    let authTokenBase64 = Buffer.from(authToken).toString('base64');
    var data = {
      'clientName': 'serverless-wso2-apim',
      'owner': user,
      'grantType': 'password refresh_token',
      'saasApp': true
    };
    var config = {
      headers: {
        'Authorization': 'Basic ' + authTokenBase64,
        'Content-Type': 'application/json'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.post(url, data, config)
        .then((res) => {
          resolve(res.data);
        })
        .catch((err) => {
          utils.renderError(err);
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}


// Generate a new token
async function generateToken(wso2APIM, clientId, clientSecret) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/oauth2/token';
    let { user, pass } = wso2APIM;
    let scope = 'apim:api_create apim:api_publish apim:api_view apim:subscribe apim:tier_view apim:tier_manage apim:subscription_view apim:subscription_block';
    let authToken = clientId + ':' + clientSecret;
    let authTokenBase64 = Buffer.from(authToken).toString('base64');
    var data = qs.stringify({
      'grant_type': 'password',
      'username': user,
      'password': pass,
      'scope': scope
    });
    var config = {
      headers: {
        'Authorization': 'Basic ' + authTokenBase64,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.post(url, data, config)
        .then((res) => {
          resolve({
            accessToken: res.data.access_token
          });
        })
        .catch((err) => {
          utils.renderError(err);
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}

async function isAPIDeployed(wso2APIM, accessToken, apiName, apiVersion, apiContext) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/api/am/publisher/' + wso2APIM.versionSlug + '/apis';
    let queryStr = 'query=name:' + apiName + ' version:' + apiVersion + ' context:' + apiContext;
    url = url + '?' + queryStr;
    let config = {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.get(url, config)
        .then((res) => {
          resolve(res.data);
        })
        .catch((err) => {
          utils.renderError(err);
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}

async function isCertUploaded(wso2APIM, accessToken, certAlias) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/api/am/publisher/' + wso2APIM.versionSlug + '/certificates/' + certAlias;
    let config = {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.get(url, config)
        .then((res) => {
          resolve(res.data);
        })
        .catch((err) => {
          // Ignore Certificate-not-found-for-that-Alias error gracefully
          if (err.response.data.code != '404') {
            utils.renderError(err);
          }
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}

async function constructAPIDef(user, gatewayEnv, apiDef, apiId) {
  try {
    // Construct backend-specific parameters
    var backendBaseUrl, backendType;
    // 1. HTTP-based backend
    if (apiDef.backend.http) {
      if (apiDef.backend.http.baseUrl) {
        backendBaseUrl = apiDef.backend.http.baseUrl;
      }
      backendType = 'HTTP';
    }
    // 2. JMS-based backend
    else if (apiDef.backend.jms) {
      if (apiDef.backend.jms.destination) {
        backendBaseUrl = ['jms:', apiDef.backend.jms.destination].join('/');
        backendBaseUrl = [backendBaseUrl, qs.stringify(apiDef.backend.jms.parameters, { encode: false })].join('?');
      }
      backendType = 'HTTP';
    }

    // Construct mediation policies
    var mediationPolicies = [];
    if (apiDef.mediationPolicies) {
      if (apiDef.mediationPolicies.in) {
        mediationPolicies.push({ 'name': apiDef.mediationPolicies.in, 'type': 'in' });
      }
      if (apiDef.mediationPolicies.out) {
        mediationPolicies.push({ 'name': apiDef.mediationPolicies.out, 'type': 'out' });
      }
      if (apiDef.mediationPolicies.fault) {
        mediationPolicies.push({ 'name': apiDef.mediationPolicies.fault, 'type': 'fault' });
      }
    }

    const wso2ApiDefinition = {
      id: (apiId) ? apiId: undefined,
      name: apiDef.name,
      description: apiDef.description,
      context: apiDef.rootContext,
      version: apiDef.version,
      operations: await constructAPIOperations(apiDef.swaggerSpec),
      lifeCycleStatus: 'CREATED', 
      isDefaultVersion: false,
      enableStore: true,
      type: backendType,
      transport: ['https'],
      tags: [...apiDef.tags, 'serverless-wso2-apim'],
      policies: ['Unlimited'],
      apiThrottlingPolicy: 'Unlimited',
      securityScheme: ['oauth2'],
      maxTps: {
        production: (apiDef.maxTps) ? apiDef.maxTps : undefined
      },
      visibility: apiDef.visibility,
      endpointConfig: {
        production_endpoints: {
          url: backendBaseUrl            },
        sandbox_endpoints: {
          url: backendBaseUrl
        },
        endpoint_type: 'http'
      },
      endpointImplementationType: 'ENDPOINT',
      endpointSecurity: null,
      gatewayEnvironments: [ gatewayEnv ],
      mediationPolicies: mediationPolicies,
      additionalProperties: ((apiDef.apiProperties) && (Object.keys(apiDef.apiProperties).length > 0)) ? apiDef.apiProperties : undefined,
      subscriptionAvailability: 'CURRENT_TENANT',
      subscriptionAvailableTenants: [],
      businessInformation: {
        businessOwnerEmail: ((apiDef.swaggerSpec.info) && (apiDef.swaggerSpec.info.contact) && (apiDef.swaggerSpec.info.contact.email)) ? apiDef.swaggerSpec.info.contact.email : undefined,
        technicalOwnerEmail: ((apiDef.swaggerSpec.info) && (apiDef.swaggerSpec.info.contact) && (apiDef.swaggerSpec.info.contact.email)) ? apiDef.swaggerSpec.info.contact.email : undefined,
        technicalOwner: ((apiDef.swaggerSpec.info) && (apiDef.swaggerSpec.info.contact) && (apiDef.swaggerSpec.info.contact.name)) ? apiDef.swaggerSpec.info.contact.name : undefined,
        businessOwner: ((apiDef.swaggerSpec.info) && (apiDef.swaggerSpec.info.contact) && (apiDef.swaggerSpec.info.contact.name)) ? apiDef.swaggerSpec.info.contact.name : undefined,
      }
    };

    backendBaseUrl = '';
    backendType = '';

    return wso2ApiDefinition;
  }
  catch (err) {
    utils.renderError(err);
  }
}

async function constructAPIOperations(apiDef) {
  var wso2Operations = [];
  let swaggerObj = await parser.dereference(apiDef);

  // Traverse through paths
  for (var pathObj in swaggerObj.paths) {
    if (Object.prototype.hasOwnProperty.call(swaggerObj.paths, pathObj)) {
      // Traverse through verbs
      for (var verbObj in swaggerObj.paths[pathObj]) {
        // Traverse through verb properties
        var authType = undefined;
        for (var verbProp in swaggerObj.paths[pathObj][verbObj]) {
          if (verbProp.toLowerCase() === 'x-auth-type') {
            authType = swaggerObj.paths[pathObj][verbObj][verbProp];
          }
        }
        wso2Operations.push({
          target: pathObj,
          verb: verbObj,
          authType: (authType) ? authType : 'Any',
          throttlingPolicy: 'Unlimited'
        });
      }
    }
  }

  return wso2Operations;
}

// Creates API definition
async function createAPIDef(wso2APIM, accessToken, apiDef) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/api/am/publisher/' + wso2APIM.versionSlug + '/apis';
    let { user, gatewayEnv } = wso2APIM;
    var data = await constructAPIDef(user, gatewayEnv, apiDef);

    // TODO - dynamically retrieve swaggerSpec version
    let queryStr = 'openAPIVersion=V3';
    url = url + '?' + queryStr;
    var config = {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.post(url, data, config)
        .then((res) => {
          resolve({
            apiId: res.data.id,
            apiName: res.data.name,
            apiContext: res.data.context,
            apiStatus: res.data.status
          });
        })
        .catch((err) => {
          reject(
            utils.renderError(err)
          );
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}

// Publishes API definition
async function publishAPIDef(wso2APIM, accessToken, apiId) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/api/am/publisher/' + wso2APIM.versionSlug + '/apis/change-lifecycle';
    var data = {};
    var config = {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      params: {
        'apiId': apiId,
        'action': 'Publish'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.post(url, data, config)
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          utils.renderError(err);
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}

// Retrieves invokable API endpoint
async function listInvokableAPIUrl(wso2APIM, accessToken, apiId) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/api/am/store/' + wso2APIM.versionSlug + '/apis/' + apiId;
    var config = {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.get(url, config)
        .then((res) => {
          resolve(res.data);
        })
        .catch((err) => {
          utils.renderError(err);
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}


// Uploads backend certificate
async function uploadCert(wso2APIM, accessToken, certAlias, cert, backendUrl) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/api/am/publisher/' + wso2APIM.versionSlug + '/endpoint-certificates';
    var data = new FormData();
    data.append('certificate', fs.createReadStream(cert));
    data.append('alias', certAlias);
    data.append('endpoint', backendUrl);
    var config = {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'multipart/form-data'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.post(url, data, config)
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          // Ignore Certificate-exists-for-that-Alias error gracefully
          if (err.response.data.code != '409') {
            utils.renderError(err);
          }
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}

// Updates API definition
async function updateAPIDef(wso2APIM, accessToken, apiDef, apiId) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/api/am/publisher/' + wso2APIM.versionSlug + '/apis/' + apiId;
    let { user, gatewayEnv } = wso2APIM;
    var data = await constructAPIDef(user, gatewayEnv, apiDef, apiId);
    var config = {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.put(url, data, config)
        .then((res) => {
          resolve(res.data);
        })
        .catch((err) => {
          utils.renderError(err);
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}

// Removes API definition (if possible)
async function removeAPIDef(wso2APIM, accessToken, apiId) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/api/am/publisher/' + wso2APIM.versionSlug + '/apis/' + apiId;
    let config = {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.delete(url, config)
        .then((res) => {
          resolve(res.data);
        })
        .catch((err) => {
          utils.renderError(err);
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}


// Removes backend certificate
async function removeCert(wso2APIM, accessToken, certAlias) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/api/am/publisher/' + wso2APIM.versionSlug + '/certificates/' + certAlias;
    let config = {
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.delete(url, config)
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          // Ignore Certificate-not-found-for-that-Alias error gracefully
          if (err.response.data.code != '404') {
            utils.renderError(err);
          }
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}


// Updates backend certificate
async function updateCert(wso2APIM, accessToken, certAlias, cert) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/api/am/publisher/' + wso2APIM.versionSlug + '/endpoint-certificates/' + certAlias;
    var data = new FormData();
    data.append('certificate', fs.createReadStream(cert));
    let config = {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'multipart/form-data'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.put(url, data, config)
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          utils.renderError(err);
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}

// Lists certificate information (like validFrom, validTo, subject etc)
async function listCertInfo(wso2APIM, accessToken, certAlias) {
  try {
    let url = 'https://' + wso2APIM.host + ':' + wso2APIM.port + '/api/am/publisher/' + wso2APIM.versionSlug + '/certificates/' + certAlias;
    let config = {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    return new Promise((resolve, reject) => {
      axios.get(url, config)
        .then((res) => {
          resolve(res.data);
        })
        .catch((err) => {
          utils.renderError(err);
          reject(err);
        });
    });
  }
  catch (err) {
    utils.renderError(err);
  }
}


module.exports = {
  registerClient,
  generateToken,
  isAPIDeployed,
  isCertUploaded,
  createAPIDef,
  publishAPIDef,
  uploadCert,
  updateCert,
  removeCert,
  listCertInfo,
  updateAPIDef,
  removeAPIDef,
  listInvokableAPIUrl,
};
