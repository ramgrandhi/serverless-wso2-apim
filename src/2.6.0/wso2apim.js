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
const swagger = require('swagger-client');
const utils = require('../utils/utils');

// Register a new client
async function registerClient(url, user, pass) {
    try {
        let authToken = user + ":" + pass;
        let authTokenBase64 = new Buffer(authToken).toString('base64');
        var data = {
            "clientName": 'serverless-wso2-apim',
            "owner": user,
            "grantType": "password refresh_token",
            "saasApp": true
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
};

// Generate a new token
async function generateToken(url, user, pass, clientId, clientSecret, scope) {
    try {
        let authToken = clientId + ":" + clientSecret;
        let authTokenBase64 = new Buffer(authToken).toString('base64');
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
};

async function isAPIDeployed(url, accessToken, apiName, apiVersion, apiContext) {
    try {
        let queryStr = "query=name:" + apiName + " version:" + apiVersion + " context:" + apiContext;
        url = url + "?" + queryStr;
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
};

async function isCertUploaded(url, accessToken, certAlias) {
    try {
        url = url + "/" + certAlias;
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
};
    


function constructAPIDef(user, gatewayEnv, apiDef, apiId) {
    try {
        var wso2ApiDefinition = {};

        if (apiId !== undefined)
            wso2ApiDefinition.id = apiId;

        wso2ApiDefinition = {
            'name': apiDef.name,
            'description': apiDef.description,
            'context': apiDef.rootContext,
            'version': apiDef.version,
            'provider': user,
            'apiDefinition': JSON.stringify(apiDef.swaggerSpec),
            'status': 'CREATED',
            'isDefaultVersion': false,
            'type': 'HTTP',
            'transport': ['https'],
            'tags': [...apiDef.tags, "serverless-wso2-apim"],
            'tiers': ['Unlimited'],
            'maxTps': {
                'sandbox': apiDef.maxTps,
                'production': apiDef.maxTps
            },
            'visibility': apiDef.visibility,
            'endpointConfig': JSON.stringify({
                'production_endpoints': {
                    'url': apiDef.backend.http.baseUrl,
                    'config': null
                },
                'sandbox_endpoints': {
                    'url': apiDef.backend.http.baseUrl,
                    'config': null
                },
                'endpoint_type': 'http'
            }),
            'endpointSecurity': null,
            'gatewayEnvironments': gatewayEnv,
            'subscriptionAvailability': 'current_tenant',
            'subscriptionAvailableTenants': [],
            'businessInformation': {
                'businessOwnerEmail': apiDef.swaggerSpec.info.contact.email,
                'technicalOwnerEmail': apiDef.swaggerSpec.info.contact.email,
                'technicalOwner': apiDef.swaggerSpec.info.contact.name,
                'businessOwner': apiDef.swaggerSpec.info.contact.name
            }
        };
        return wso2ApiDefinition;
    }
    catch (err) {
        utils.renderError(err);
    }  
};

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
};

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
};

// Uploads backend certificate
async function uploadCert(url, accessToken, certAlias, certFile, backendUrl) {
    try {
        var data = new FormData();
        data.append('certificate', fs.createReadStream(certFile));
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
};

// Updates API definition
async function updateAPIDef(url, user, accessToken, gatewayEnv, apiDef, apiId) {
    try {
        url = url + "/" + apiId;
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
};

// Removes API definition (if possible)
async function removeAPIDef(url, accessToken, apiId) {
    try {
        url = url + "/" + apiId;
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
};

    
// Removes backend certificate
async function removeCert(url, accessToken, certAlias) {
    try {
        url = url + "/" + certAlias;
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
};


module.exports = {
    registerClient,
    generateToken,
    isAPIDeployed,
    isCertUploaded,
    createAPIDef,
    publishAPIDef,
    uploadCert,
    updateAPIDef,
    removeAPIDef,
    removeCert
};