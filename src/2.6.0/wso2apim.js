const axios = require('axios');
const https = require('https');
const qs = require('qs');

function renderError(err) {
  if (err.response) {
    return {
      response: err.response.data,
      responseCode: err.response.status,
      responseHeaders: err.response.headers,
    };
  } else if (err.request) {
    return {
      request: err.request,
    };
  } else {
    return {
      error: err.message,
    };
  }
}

// Register a new client
async function registerClient(url, user, pass) {
  let authToken = user + ':' + pass;
  let authTokenBase64 = new Buffer(authToken).toString('base64');
  var data = {
    clientName: 'serverless-wso2-apim',
    owner: user,
    grantType: 'password refresh_token',
    saasApp: true,
  };
  var config = {
    headers: {
      Authorization: 'Basic ' + authTokenBase64,
      'Content-Type': 'application/json',
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  };

  try {
    const { data: responseData } = await axios.post(url, data, config);
    return {
      clientId: responseData.clientId,
      clientSecret: responseData.clientSecret,
    };
  } catch (error) {
    throw renderError(error);
  }
}

// Generate a new token
async function generateToken(url, user, pass, clientId, clientSecret, scope) {
  let authToken = `${clientId}:${clientSecret}`;
  let authTokenBase64 = new Buffer(authToken).toString('base64');
  var data = qs.stringify({
    grant_type: 'password',
    username: user,
    password: pass,
    scope: scope,
  });
  var config = {
    headers: {
      Authorization: `Basic ${authTokenBase64}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  };

  try {
    const { data: responseData } = await axios.post(url, data, config);
    return { accessToken: responseData.access_token };
  } catch (error) {
    throw renderError(error);
  }
}

async function isAPIDeployed(
  url,
  accessToken,
  apiName,
  apiVersion,
  apiContext
) {
  const queryStr = `query=name:${apiName} version:${apiVersion} context:${apiContext}`;
  let config = {
    headers: {
      Authorization: 'Bearer ' + accessToken,
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  };

  try {
    const { data } = await axios.get(`${url}?${queryStr}`, config);
    return data;
  } catch (error) {
    throw renderError(error);
  }
}

function constructAPIDef(user, gatewayEnv, apiDef, apiId) {
  var wso2ApiDefinition = {};

  if (apiId !== undefined) wso2ApiDefinition.id = apiId;

  wso2ApiDefinition = {
    name: apiDef.name,
    description: apiDef.description,
    context: apiDef.rootContext,
    version: apiDef.version,
    provider: user,
    apiDefinition: JSON.stringify(apiDef.swaggerSpec),
    status: 'CREATED',
    isDefaultVersion: false,
    type: 'HTTP',
    transport: ['https'],
    tags: [...apiDef.tags, 'serverless-wso2-apim'],
    tiers: ['Unlimited'],
    maxTps: {
      sandbox: apiDef.maxTps,
      production: apiDef.maxTps,
    },
    visibility: apiDef.visibility,
    endpointConfig: JSON.stringify({
      production_endpoints: {
        url: apiDef.backend.http.baseUrl,
        config: null,
      },
      sandbox_endpoints: {
        url: apiDef.backend.http.baseUrl,
        config: null,
      },
      endpoint_type: 'http',
    }),
    endpointSecurity: null,
    gatewayEnvironments: gatewayEnv,
    subscriptionAvailability: 'current_tenant',
    subscriptionAvailableTenants: [],
    businessInformation: {
      businessOwnerEmail: apiDef.swaggerSpec.info.contact.email,
      technicalOwnerEmail: apiDef.swaggerSpec.info.contact.email,
      technicalOwner: apiDef.swaggerSpec.info.contact.name,
      businessOwner: apiDef.swaggerSpec.info.contact.name,
    },
  };
  return wso2ApiDefinition;
}

// Updates API definition
async function updateAPIDef(url, user, accessToken, gatewayEnv, apiDef, apiId) {
  url = url + '/' + apiId;
  var data = constructAPIDef(user, gatewayEnv, apiDef, apiId);
  var config = {
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  };

  try {
    const { data: responseData } = await axios.put(url, data, config);
    return responseData;
  } catch (error) {
    throw renderError(error);
  }
}

// Creates API definition
async function createAPIDef(url, user, accessToken, gatewayEnv, apiDef) {
  var data = constructAPIDef(user, gatewayEnv, apiDef);
  var config = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  };

  try {
    const { data: responseData } = await axios.post(url, data, config);
    return {
      apiId: responseData.id,
      apiName: responseData.name,
      apiContext: responseData.context,
      apiStatus: responseData.status,
    };
  } catch (error) {
    throw renderError(error);
  }
}

async function removeAPIDef(url, accessToken, apiId) {
  url = `${url}/${apiId}`;
  let config = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  };

  try {
    const { data: responseData } = await axios.delete(url, config);
    return responseData;
  } catch (error) {
    throw renderError(error);
  }
}

module.exports = {
  registerClient,
  generateToken,
  isAPIDeployed,
  createAPIDef,
  updateAPIDef,
  removeAPIDef,
};
