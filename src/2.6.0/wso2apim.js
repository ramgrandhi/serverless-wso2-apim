const axios = require('axios');
const https = require('https');
const qs = require('qs');
const path = require('path');
const fs = require('fs');
const swagger = require('swagger-client');

function renderError(err) {
    if (err.response) {
        return({
            response: err.response.data,
            responseCode: err.response.status,
            responseHeaders: err.response.headers,
        });            
    }
    else if (err.request) {
        return ({
            request: err.request
        });
    }
    else {
        return ({
            error: err.message
        });
    }
};


// Register a new client
async function registerClient(url, user, pass) {
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
                resolve({
                    clientId: res.data.clientId,
                    clientSecret: res.data.clientSecret
                });
            })
            .catch((err) => {
                reject(
                    renderError(err)
                );
            });
    });
};

// Generate a new token
async function generateToken(url, user, pass, clientId, clientSecret, scope) {
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
                reject(
                    renderError(err)
                );
            });
    });
};


async function isAPIDeployed(url, accessToken, apiName, apiVersion, apiContext) {
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
                reject(
                    renderError(err)
                );
            });
    });
};


function constructAPIDef(user, gatewayEnv, apiDef, apiId) {
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
};

// Updates API definition
async function updateAPIDef(url, user, accessToken, gatewayEnv, apiDef, apiId) {
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
                reject(
                    renderError(err)
                );
            });
    });
};


// Creates API definition
async function createAPIDef(url, user, accessToken, gatewayEnv, apiDef) {
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
                    renderError(err)
                );
            });
    });
};

async function removeAPIDef(url, accessToken, apiId) {
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
                console.log(res.data);
                resolve(res.data);
            })
            .catch((err) => {
                reject(
                    renderError(err)
                );
            });
    });
};


module.exports = {
    registerClient,
    generateToken,
    isAPIDeployed,
    createAPIDef,
    updateAPIDef,
    removeAPIDef
};