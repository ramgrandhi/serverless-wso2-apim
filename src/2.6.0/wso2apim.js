// ---------------------------------------
// --- WSO2 API Manager 2.6.0 specific ---
// ---------------------------------------

// for sane code 🍻
// ----------------
// * Deals with data & config variables of HTTP requests
// * Acts as a last-mile bridge to specific WSO2 APIM version's management APIs
// * Use no console.log() at this level, only resolve's or reject's being thrown back
// ----------------

const axios = require('axios');
const https = require('https');
const qs = require('qs');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');
const utils = require('../utils/utils');

// Register a new client
async function registerClient(url, user, pass) {
  try {
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
async function generateToken(url, user, pass, clientId, clientSecret, scope) {
  try {
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

async function isAPIDeployed(url, accessToken, apiName, apiVersion, apiContext) {
  try {
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

async function isCertUploaded(url, accessToken, certAlias) {
  try {
    url = url + '/' + certAlias;
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



function constructAPIDef(user, gatewayEnv, apiDef, apiId) {
  try {

    // Construct backend-specific parameters
    var backendBaseUrl, backendType, backendTransport;
    // 1. HTTP-based backend
    if (apiDef.backend.http) {
      if (apiDef.backend.http.baseUrl) {
        backendBaseUrl = apiDef.backend.http.baseUrl;
      }
      backendType = 'HTTP';
      backendTransport = ['https'];
    }
    // 2. JMS-based backend
    else if (apiDef.backend.jms) {
      if (apiDef.backend.jms.destination) {
        backendBaseUrl = ['jms:', apiDef.backend.jms.destination].join('/');
        backendBaseUrl = [backendBaseUrl, qs.stringify(apiDef.backend.jms.parameters, { encode: false })].join('?');
      }
      backendType = 'HTTP';
      backendTransport = ['https'];            
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
      name: apiDef.name,
      description: apiDef.description,
      context: apiDef.rootContext,
      version: apiDef.version,
      provider: user,
      apiDefinition: JSON.stringify(apiDef.swaggerSpec),
      status: 'CREATED',
      isDefaultVersion: false,
      type: backendType,
      transport: backendTransport,
      tags: [...apiDef.tags, 'serverless-wso2-apim'],
      tiers: ['Unlimited'],
      maxTps: {
        sandbox: (apiDef.maxTps) ? apiDef.maxTps : undefined,
        production: (apiDef.maxTps) ? apiDef.maxTps : undefined
      },
      visibility: apiDef.visibility,
      endpointConfig: JSON.stringify({
        production_endpoints: {
          url: backendBaseUrl,
          config: null
        },
        sandbox_endpoints: {
          url: backendBaseUrl,
          config: null
        },
        endpoint_type: 'http'
      }),
      endpointSecurity: null,
      gatewayEnvironments: gatewayEnv,
      sequences: mediationPolicies,
      additionalProperties: ((apiDef.apiProperties) && (Object.keys(apiDef.apiProperties).length > 0)) ? apiDef.apiProperties : undefined,
      subscriptionAvailability: 'current_tenant',
      subscriptionAvailableTenants: [],
      businessInformation: {
        businessOwnerEmail: ((apiDef.swaggerSpec.info) && (apiDef.swaggerSpec.info.contact) && (apiDef.swaggerSpec.info.contact.email)) ? apiDef.swaggerSpec.info.contact.email : undefined,
        technicalOwnerEmail: ((apiDef.swaggerSpec.info) && (apiDef.swaggerSpec.info.contact) && (apiDef.swaggerSpec.info.contact.email)) ? apiDef.swaggerSpec.info.contact.email : undefined,
        technicalOwner: ((apiDef.swaggerSpec.info) && (apiDef.swaggerSpec.info.contact) && (apiDef.swaggerSpec.info.contact.name)) ? apiDef.swaggerSpec.info.contact.name : undefined,
        businessOwner: ((apiDef.swaggerSpec.info) && (apiDef.swaggerSpec.info.contact) && (apiDef.swaggerSpec.info.contact.name)) ? apiDef.swaggerSpec.info.contact.name : undefined,
      }
    };

    if (apiId)
      wso2ApiDefinition.id = apiId;

    backendBaseUrl = '';
    backendType = '';
    backendTransport = '';

    return wso2ApiDefinition;
  }
  catch (err) {
    utils.renderError(err);
  }
}

// Creates API definition
async function createAPIDef(url, user, accessToken, gatewayEnv, apiDef) {
  try {
    var data = constructAPIDef(user, gatewayEnv, apiDef);
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
async function publishAPIDef(url, accessToken, apiId) {
  try {
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
async function listInvokableAPIUrl(url, accessToken, apiId) {
  try {
    url = url + '/' + apiId;
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
async function uploadCert(url, accessToken, certAlias, cert, backendUrl) {
  try {
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
async function updateAPIDef(url, user, accessToken, gatewayEnv, apiDef, apiId) {
  try {
    url = url + '/' + apiId;
    var data = constructAPIDef(user, gatewayEnv, apiDef, apiId);
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
async function removeAPIDef(url, accessToken, apiId) {
  try {
    url = url + '/' + apiId;
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
async function removeCert(url, accessToken, certAlias) {
  try {
    url = url + '/' + certAlias;
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
async function updateCert(url, accessToken, certAlias, cert) {
  try {
    url = url + '/' + certAlias;
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
async function listCertInfo(url, accessToken, certAlias) {
  try {
    url = url + '/' + certAlias;
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
