const {
  registerClient,
  generateToken,
  isAPIDeployed,
  isCertUploaded,
  createAPIDef,
  publishAPIDef,
  constructAPIDef,
  uploadCert,
  uploadClientCert,
  updateCert,
  updateClientCert,
  removeCert,
  removeClientCert,
  listCertInfo,
  listClientCertInfo,
  upsertSwaggerSpec,
  updateAPIDef,
  removeAPIDef,
  listInvokableAPIUrl,
  getApiDef,
  checkApiDefIsUpdated,
} = require('./wso2apim');
const axios = require('axios');
const qs = require('qs');

afterEach(() => {
  jest.clearAllMocks();
});

jest.mock('axios', () => ({
  post: jest.fn(() => Promise.resolve({ data: 'foo' })),
  get: jest.fn(() => Promise.resolve({ data: 'foo' })),
  put: jest.fn(() => Promise.resolve({ data: 'foo' })),
  delete: jest.fn(() => Promise.resolve({ data: 'foo' })),
}));

const wso2APIM = {
  enabled: true,
  host: 'wso2-apimanager.com',
  port: 443,
  versionSlug: 'v0.17',
  user: 'foo',
  pass: 'bar',
  gatewayEnv: 'Local',
  apidefs: [
    {
      name: 'MyAwesomeAPI',
      description: 'My Awesome API',
      rootContext: '/myawesomeapi',
      version: 'v1',
      visibility: 'PUBLIC',
      backend: {
        http: {
          baseUrl: 'https://backend.url',
          certChain: 'file://xxx.cer'
        }
      },
      securityScheme: {
        mutualssl: {
          enabled: true,
          clientCert: 'file://xxx.cer'
        }
      },
      tags: [ 'awesomeness', 'myawesomeapi'],
      maxTps: 999,
      swaggerSpec: {
        'openapi': '3.0.0',
        'info': {
          'title': 'MyAwesomeAPI',
          'version': 'v1',
          'contact': {
            'name': 'MyTeam',
            'email': 'myteam@myteam.com'
          }
        },
        'paths': {
          '/*': {
            'post': {
              'responses': {
                '201': {
                  'description': 'Created'
                }
              }
            }
          }
        }
      }
    }
  ]
};

const apiId = '123456789';

const baseUrl = `https://${wso2APIM.host}:${wso2APIM.port}`;
const publisherBaseUrl = `${baseUrl}/api/am/publisher/${wso2APIM.versionSlug}`;
const storeBaseUrl = `${baseUrl}/api/am/store/${wso2APIM.versionSlug}`;

const defaultFaulty = {
  response: {
    data: { message: 'failed' },
    status: 500,
    headers: {},
  },
};

describe('wso2apim-3.2.0', () => {

  describe('registerClient()', () => {
    it('should handle a successful response', async () => {
      axios.post.mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            clientId: 'foo',
            clientSecret: 'bar',
          },
        })
      );

      const response = await registerClient(wso2APIM);

      expect(axios.post).toHaveBeenCalledWith(
        `${baseUrl}/client-registration/v0.17/register`,
        {
          clientName: 'serverless-wso2-apim',
          owner: wso2APIM.user,
          grantType: 'password refresh_token',
          saasApp: true,
        },
        expect.objectContaining({})
      );

      expect(response).toEqual({
        clientId: 'foo',
        clientSecret: 'bar',
      });
    });

    it('should handle a faulty response', async () => {
      axios.post.mockRejectedValueOnce(defaultFaulty);

      await expect(registerClient(wso2APIM)).rejects.toEqual(defaultFaulty);
    });
  });

  describe('generateToken()', () => {
    it('should handle a successful response', async () => {

      axios.post.mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            access_token: 'xxx'
          },
        })
      );

      const response = await generateToken(wso2APIM, 'foo123', 'xxxyyyzzz');

      expect(axios.post).toHaveBeenCalledWith(
        `${baseUrl}/oauth2/token`,
        qs.stringify({
          'grant_type': 'password',
          'username': wso2APIM.user,
          'password': wso2APIM.pass,
          'scope': 'apim:api_create apim:api_view apim:api_publish apim:api_delete'
        }),
        expect.objectContaining({})
      );

      expect(response).toEqual({
        accessToken: 'xxx',
      });
    });

    it('should handle a faulty response', async () => {
      axios.post.mockRejectedValueOnce(defaultFaulty);

      await expect(generateToken(wso2APIM, 'foo123', 'xxxyyyzzz')).rejects.toEqual(defaultFaulty);
    });
  });

  describe('isAPIDeployed()', () => {
    it('should handle a successful response', async () => {

      const response = await isAPIDeployed(wso2APIM, 'xxx', wso2APIM.apidefs[0].name, wso2APIM.apidefs[0].version, wso2APIM.apidefs[0].rootContext);

      expect(axios.get).toHaveBeenCalledWith(
        `${publisherBaseUrl}/apis?query=name:${wso2APIM.apidefs[0].name} version:${wso2APIM.apidefs[0].version} context:${wso2APIM.apidefs[0].rootContext}`,
        {
          headers: {
            Authorization: 'Bearer xxx',
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.get.mockRejectedValueOnce(defaultFaulty);

      await expect(
        isAPIDeployed(wso2APIM, 'xxx', wso2APIM.apidefs[0].name, wso2APIM.apidefs[0].version, wso2APIM.apidefs[0].rootContext)
      ).rejects.toEqual(defaultFaulty);
    });
  });

  describe('isCertUploaded()', () => {
    it('should handle a successful response', async () => {

      const response = await isCertUploaded(wso2APIM, 'xxx', 'alias');

      expect(axios.get).toHaveBeenCalledWith(
        `${publisherBaseUrl}/certificates/alias`,
        {
          headers: {
            Authorization: 'Bearer xxx',
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.get.mockRejectedValueOnce(defaultFaulty);

      await expect(
        isCertUploaded(wso2APIM, 'xxx', 'alias')
      ).rejects.toEqual(defaultFaulty);
    });
  });

  describe('createAPIDef()', () => {
    it('should handle a successful response', async () => {

      axios.post.mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            id: apiId,
            name: wso2APIM.apidefs[0].name,
            context: wso2APIM.apidefs[0].rootContext,
            status: 'CREATED'
          }
        })
      );
      const response = await createAPIDef(
        wso2APIM,
        'xxx',
        wso2APIM.apidefs[0]
      );

      expect(axios.post).toHaveBeenCalledWith(
        `${publisherBaseUrl}/apis?openAPIVersion=V3`,
        expect.objectContaining({}),
        {
          headers: {
            Authorization: 'Bearer xxx',
            'Content-Type': 'application/json',
          },
          httpsAgent: expect.objectContaining({}),
        }
      );

      expect(response).toEqual({
        apiId,
        apiName: wso2APIM.apidefs[0].name,
        apiContext: wso2APIM.apidefs[0].rootContext,
        apiStatus: 'CREATED'
      });
    });

    it('should handle a faulty response', async () => {
      axios.post.mockRejectedValueOnce(defaultFaulty);

      await expect(createAPIDef(wso2APIM, 'xxx', wso2APIM.apidefs[0])).rejects.toBeUndefined();
    });

  });

  describe('publishAPIDef()', () => {
    it('should handle a successful response', async () => {

      const response = await publishAPIDef(
        wso2APIM,
        'xxx',
        apiId
      );

      expect(axios.post).toHaveBeenCalledWith(
        `${publisherBaseUrl}/apis/change-lifecycle`,
        expect.objectContaining({}),
        {
          headers: {
            Authorization: 'Bearer xxx'
          },
          params: {
            'apiId': apiId,
            'action': 'Publish'
          },
          httpsAgent: expect.objectContaining({}),
        }
      );

      expect(response.data).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.post.mockRejectedValueOnce(defaultFaulty);

      await expect(publishAPIDef(wso2APIM, 'xxx', apiId)).rejects.toEqual(defaultFaulty);
    });

  });

  describe('listInvokableAPIUrl()', () => {
    it('should handle a successful response', async () => {

      const response = await listInvokableAPIUrl(
        wso2APIM,
        'xxx',
        apiId
      );

      expect(axios.get).toHaveBeenCalledWith(
        `${storeBaseUrl}/apis/${apiId}`,
        {
          headers: {
            Authorization: 'Bearer xxx'
          },
          httpsAgent: expect.objectContaining({}),
        }
      );

      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.get.mockRejectedValueOnce(defaultFaulty);

      await expect(listInvokableAPIUrl(wso2APIM, 'xxx', apiId)).rejects.toEqual(defaultFaulty);
    });

  });

  describe('uploadCert()', () => {
    it('should handle a successful response', async () => {

      const response = await uploadCert(
        wso2APIM,
        'xxx',
        'alias',
        wso2APIM.apidefs[0].backend.http.certChain,
        wso2APIM.apidefs[0].backend.http.baseUrl
      );

      expect(response.data).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.post.mockRejectedValueOnce(defaultFaulty);

      await expect(
        uploadCert(
          wso2APIM,
          'xxx',
          'alias',
          wso2APIM.apidefs[0].backend.http.certChain,
          wso2APIM.apidefs[0].backend.http.baseUrl,
        ),
      ).rejects.toEqual(defaultFaulty);
    });

  });

  describe('uploadClientCert()', () => {
    it('should handle a successful response', async () => {

      const response = await uploadClientCert(
        wso2APIM,
        'xxx',
        'alias',
        wso2APIM.apidefs[0].securityScheme.mutualssl.clientCert,
        '123'
      );

      expect(response.data).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.post.mockRejectedValueOnce(defaultFaulty);

      await expect(
        uploadClientCert(
          wso2APIM,
          'xxx',
          'alias',
          wso2APIM.apidefs[0].backend.http.certChain,
          wso2APIM.apidefs[0].securityScheme.mutualssl.clientCert,
          '123',
        ),
      ).rejects.toEqual(defaultFaulty);
    });

  });

  describe('updateAPIDef()', () => {

    it('should handle a successful response', async () => {

      const response = await updateAPIDef(
        wso2APIM,
        'xxx',
        wso2APIM.apidefs[0],
        apiId
      );

      expect(axios.put).toHaveBeenCalledWith(
        `${publisherBaseUrl}/apis/${apiId}`,
        expect.objectContaining({}),
        {
          headers: {
            Authorization: 'Bearer xxx',
            'Content-Type': 'application/json',
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.put.mockRejectedValueOnce(defaultFaulty);

      await expect(updateAPIDef(wso2APIM, 'xxx', wso2APIM.apidefs[0], apiId)).rejects.toEqual(defaultFaulty);
    });

  });

  describe('removeAPIDef()', () => {
    it('should handle a successful response', async () => {

      const response = await removeAPIDef(
        wso2APIM,
        'xxx',
        apiId
      );

      expect(axios.delete).toHaveBeenCalledWith(
        `${publisherBaseUrl}/apis/${apiId}`,
        {
          headers: {
            Authorization: 'Bearer xxx',
          },
          httpsAgent: expect.objectContaining({}),
        });
      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.delete.mockRejectedValueOnce(defaultFaulty);

      await expect(removeAPIDef(wso2APIM, 'xxx', apiId)).rejects.toEqual(defaultFaulty);
    });

  });

  describe('removeCert()', () => {
    it('should handle a successful response', async () => {

      const response = await removeCert(
        wso2APIM,
        'xxx',
        'alias'
      );

      expect(axios.delete).toHaveBeenCalledWith(
        `${publisherBaseUrl}/certificates/alias`,
        {
          headers: {
            Authorization: 'Bearer xxx',
          },
          httpsAgent: expect.objectContaining({}),
        });
      expect(response.data).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.delete.mockRejectedValueOnce(defaultFaulty);

      await expect(removeCert(wso2APIM, 'xxx', 'alias')).rejects.toEqual(defaultFaulty);
    });

  });

  describe('removeClientCert()', () => {
    it('should handle a successful response', async () => {

      const response = await removeClientCert(
        wso2APIM,
        'xxx',
        'alias',
        '123'
      );

      expect(axios.delete).toHaveBeenCalledWith(
        `${publisherBaseUrl}/apis/123/client-certificates/alias`,
        {
          headers: {
            Authorization: 'Bearer xxx',
          },
          httpsAgent: expect.objectContaining({}),
        });
      expect(response.data).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.delete.mockRejectedValueOnce(defaultFaulty);

      await expect(removeClientCert(wso2APIM, 'xxx', 'alias', '123')).rejects.toEqual(defaultFaulty);
    });

  });

  describe('updateCert()', () => {

    it('should handle a successful response', async () => {

      const response = await updateCert(
        wso2APIM,
        'xxx',
        'alias',
        wso2APIM.apidefs[0].backend.http.certChain
      );

      expect(axios.put).toHaveBeenCalledWith(
        `${publisherBaseUrl}/endpoint-certificates/alias`,
        expect.objectContaining({}),
        {
          headers: {
            Authorization: 'Bearer xxx',
            'Content-Type': 'multipart/form-data',
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response.data).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.put.mockRejectedValueOnce(defaultFaulty);

      await expect(updateCert(wso2APIM, 'xxx', 'alias', wso2APIM.apidefs[0].backend.http.certChain)).rejects.toEqual(defaultFaulty);
    });

  });

  describe('updateClientCert()', () => {

    it('should handle a successful response', async () => {

      const response = await updateClientCert(
        wso2APIM,
        'xxx',
        'alias',
        wso2APIM.apidefs[0].securityScheme.mutualssl.clientCert,
        '123'
      );

      expect(axios.put).toHaveBeenCalledWith(
        `${publisherBaseUrl}/apis/123/client-certificates/alias`,
        expect.objectContaining({}),
        {
          headers: {
            Authorization: 'Bearer xxx',
            'Content-Type': 'multipart/form-data',
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response.data).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.put.mockRejectedValueOnce(defaultFaulty);

      await expect(
        updateClientCert(
          wso2APIM,
          'xxx',
          'alias',
          wso2APIM.apidefs[0].securityScheme.mutualssl.clientCert,
          '123',
        ),
      ).rejects.toEqual(defaultFaulty);
    });

  });

  describe('listCertInfo()', () => {
    it('should handle a successful response', async () => {

      const response = await listCertInfo(
        wso2APIM,
        'xxx',
        'alias'
      );

      expect(axios.get).toHaveBeenCalledWith(
        `${publisherBaseUrl}/certificates/alias`,
        {
          headers: {
            Authorization: 'Bearer xxx',
            Accept: 'application/json'
          },
          httpsAgent: expect.objectContaining({}),
        }
      );

      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.get.mockRejectedValueOnce(defaultFaulty);

      await expect(listCertInfo(wso2APIM, 'xxx', 'alias')).rejects.toEqual(defaultFaulty);
    });

  });

  describe('listClientCertInfo()', () => {
    it('should handle a successful response', async () => {

      const response = await listClientCertInfo(
        wso2APIM,
        'xxx',
        'alias',
        '123'
      );

      expect(axios.get).toHaveBeenCalledWith(
        `${publisherBaseUrl}/apis/123/client-certificates/alias`,
        {
          headers: {
            Authorization: 'Bearer xxx',
            Accept: 'application/json'
          },
          httpsAgent: expect.objectContaining({}),
        }
      );

      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.get.mockRejectedValueOnce(defaultFaulty);

      await expect(listClientCertInfo(wso2APIM, 'xxx', 'alias', '123')).rejects.toEqual(defaultFaulty);
    });

  });

  describe('upsertSwaggerSpec()', () => {
    it('should handle a successful response', async () => {
      await upsertSwaggerSpec(wso2APIM, 'xxx', 'id001', wso2APIM.apidefs[0].swaggerSpec);

      expect(axios.put).toHaveBeenCalledWith(
        `${publisherBaseUrl}/apis/id001/swagger`,
        expect.objectContaining({}),
        {
          headers: {
            Authorization: 'Bearer xxx',
            'Content-Type': 'multipart/form-data'
          },
          httpsAgent: expect.objectContaining({})
        }
      );
    });

    it('should handle a faulty response', async () => {
      axios.put.mockRejectedValueOnce(defaultFaulty);
      await expect(upsertSwaggerSpec(wso2APIM, 'xxx', 'id001', wso2APIM.apidefs[0].swaggerSpec)).rejects.toEqual(defaultFaulty);
    });
  });

  describe('cors configuration', () => {

    it('no cors', async () => {
      const apiDef = await constructAPIDef(wso2APIM.user, wso2APIM.gatewayEnv, wso2APIM.apidefs[0]);

      expect(apiDef.corsConfiguration).toBeUndefined();
    });

    it('only origin', async () => {
      const config = {...wso2APIM, apidefs: [{...wso2APIM.apidefs[0], cors: {
        origins: ['https://www.example.com']
      }}]};

      const apiDef = await constructAPIDef(config.user, config.gatewayEnv, config.apidefs[0]);

      expect(apiDef.corsConfiguration).toEqual({
        corsConfigurationEnabled: true,
        accessControlAllowOrigins: [ 'https://www.example.com' ],
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: [
          'Authorization',
          'Access-Control-Allow-Origin',
          'Content-Type',
          'SOAPAction'
        ],
        accessControlAllowMethods: [ 'GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS' ]
      });
    });

    it('fully specified', async () => {
      const config = {...wso2APIM, apidefs: [{...wso2APIM.apidefs[0], cors: {
        origins: ['https://www.example.com', 'https://www.example.org'],
        credentials: true,
        headers: ['Authorization', 'x-custom'],
        methods: ['GET']
      }}]};

      const apiDef = await constructAPIDef(config.user, config.gatewayEnv, config.apidefs[0]);

      expect(apiDef.corsConfiguration).toEqual({
        corsConfigurationEnabled: true,
        accessControlAllowOrigins: [ 'https://www.example.com', 'https://www.example.org' ],
        accessControlAllowCredentials: true,
        accessControlAllowHeaders: ['Authorization', 'x-custom'],
        accessControlAllowMethods: ['GET']
      });
    });
  });

  describe('business information', () => {
    it('businessInformation provided', async () => {
      const config = {
        ...wso2APIM,
        apidefs: [
          {
            ...wso2APIM.apidefs[0],
            businessInformation: {
              technicalOwnerEmail: 'technical@email.com',
              businessOwnerEmail: 'business@email.com',
              technicalOwner: 'NL NN/Techical/Owner',
              businessOwner: 'NL NN/Business/Owner',
            },
          },
        ],
      };

      const apiDef = await constructAPIDef(
        config.user,
        config.gatewayEnv,
        config.apidefs[0]
      );

      expect(apiDef.businessInformation).toEqual({
        technicalOwnerEmail: 'technical@email.com',
        businessOwnerEmail: 'business@email.com',
        technicalOwner: 'NL NN/Techical/Owner',
        businessOwner: 'NL NN/Business/Owner',
      });
    });
    it('businessInformation not provided', async () => {
      const config = {
        ...wso2APIM,
        apidefs: [
          {
            ...wso2APIM.apidefs[0]
          },
        ],
      };

      const apiDef = await constructAPIDef(
        config.user,
        config.gatewayEnv,
        config.apidefs[0]
      );

      expect(apiDef.businessInformation).toEqual({
        technicalOwnerEmail: 'myteam@myteam.com',
        businessOwnerEmail: 'myteam@myteam.com',
        technicalOwner: 'MyTeam',
        businessOwner: 'MyTeam',
      });
    });
  });

  describe('getApiDef()', () => {
    it('should handle a successful response', async () => {
      const response = await getApiDef(wso2APIM, 'xxx', 'alias');

      expect(axios.get).toHaveBeenCalledWith(
        `${publisherBaseUrl}/apis/alias`,
        {
          headers: {
            Authorization: 'Bearer xxx',
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.get.mockRejectedValueOnce(defaultFaulty);
      await expect(getApiDef(wso2APIM, 'xxx', 'alias')).rejects.toEqual(defaultFaulty);
    });
  });

  describe('checkApiDefIsUpdated()', () => {
    const corsConfiguration = {
      corsConfigurationEnabled: true,
      accessControlAllowOrigins: [
        '*'
      ],
      accessControlAllowCredentials: false,
      accessControlAllowHeaders: [
        'Authorization',
        'Access-Control-Allow-Origin',
        'Content-Type',
        'SOAPAction',
        'x-custom-header',
      ],
      accessControlAllowMethods: [
        'GET',
        'PUT',
        'POST',
        'DELETE',
        'PATCH',
        'OPTIONS'
      ]
    };

    const endpointConfig = {
      production_endpoints: {
        url: wso2APIM.apidefs[0].backend.http.baseUrl,
      },
      sandbox_endpoints: {
        url: wso2APIM.apidefs[0].backend.http.baseUrl,
      },
      endpoint_type: 'http',
    };

    const config = {
      ...wso2APIM,
      apidefs: [
        {
          ...wso2APIM.apidefs[0],
          cors: {
            headers: corsConfiguration.accessControlAllowHeaders,
          },
        },
      ],
    };

    it('should return truthy when the apidef is updated', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          ...config.apidefs[0],
          corsConfiguration,
          endpointConfig,
        }
      });

      const response = await checkApiDefIsUpdated(wso2APIM, 'xxx', 'alias', config.apidefs[0]);
      expect(response).toBeTruthy();
    });

    it('should return falsy when the apidef cors configuration is outdated', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          ...config.apidefs[0],
          endpointConfig,
          corsConfiguration: {
            ...corsConfiguration,
            accessControlAllowHeaders: [
              ...corsConfiguration.accessControlAllowHeaders,
              'x-new-custom-header',
            ],
          },
        }
      });

      const response = await checkApiDefIsUpdated(wso2APIM, 'xxx', 'alias', config.apidefs[0]);
      expect(response).toBeFalsy();
    });

    it('should return falsy when the apidef endpoint configuration is outdated', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          ...config.apidefs[0],
          endpointConfig: {
            ...endpointConfig,
            production_endpoints: {
              baseUrl: 'https://new-backend.url'
            }
          },
        }
      });

      const response = await checkApiDefIsUpdated(wso2APIM, 'xxx', 'alias', config.apidefs[0]);
      expect(response).toBeFalsy();
    });

    it('should return falsy when the apidef endpoint and cors configurations are outdated', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          ...config.apidefs[0],
          corsConfiguration: {
            ...corsConfiguration,
            accessControlAllowHeaders: [
              ...corsConfiguration.accessControlAllowHeaders,
              'x-new-custom-header',
            ],
          },
          endpointConfig: {
            ...endpointConfig,
            production_endpoints: {
              baseUrl: 'https://new-backend.url'
            }
          },
        }
      });

      const response = await checkApiDefIsUpdated(wso2APIM, 'xxx', 'alias', config.apidefs[0]);
      expect(response).toBeFalsy();
    });

    it('edge case: should return truthy when the apidef endpoint configuration has properties in different order', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          ...config.apidefs[0],
          corsConfiguration,
          endpointConfig: {
            endpoint_type: 'http',
            production_endpoints: {
              url: wso2APIM.apidefs[0].backend.http.baseUrl,
            },
            sandbox_endpoints: {
              url: wso2APIM.apidefs[0].backend.http.baseUrl,
            },
          },
        }
      });

      const response = await checkApiDefIsUpdated(wso2APIM, 'xxx', 'alias', config.apidefs[0]);
      expect(response).toBeTruthy();
    });
  });
});
