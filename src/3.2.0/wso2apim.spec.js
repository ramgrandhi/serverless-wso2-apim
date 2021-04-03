const {
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
  listInvokableAPIUrl
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
        `https://${wso2APIM.host}:${wso2APIM.port}/client-registration/v0.17/register`,
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
      axios.post.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(registerClient(wso2APIM)).rejects.toThrow();
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
        `https://${wso2APIM.host}:${wso2APIM.port}/oauth2/token`,
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
      axios.post.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(generateToken(wso2APIM, 'foo123', 'xxxyyyzzz')).rejects.toThrow();
    });
  });

  describe('isAPIDeployed()', () => {
    it('should handle a successful response', async () => {

      const response = await isAPIDeployed(wso2APIM, 'xxx', wso2APIM.apidefs[0].name, wso2APIM.apidefs[0].version, wso2APIM.apidefs[0].rootContext);

      expect(axios.get).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis?query=name:${wso2APIM.apidefs[0].name} version:${wso2APIM.apidefs[0].version} context:${wso2APIM.apidefs[0].rootContext}`,
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
      axios.get.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(
        isAPIDeployed(wso2APIM, 'xxx', wso2APIM.apidefs[0].name, wso2APIM.apidefs[0].version, wso2APIM.apidefs[0].rootContext)
      ).rejects.toThrow();
    });
  });

  describe('isCertUploaded()', () => {
    it('should handle a successful response', async () => {

      const response = await isCertUploaded(wso2APIM, 'xxx', 'alias');

      expect(axios.get).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/certificates/alias`,
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
      axios.get.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(
        isCertUploaded(wso2APIM, 'xxx', 'alias')
      ).rejects.toThrow();
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
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis?openAPIVersion=V3`,
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
      axios.post.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(createAPIDef(wso2APIM, 'xxx', wso2APIM.apidefs[0])).rejects.toThrow();
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
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis/change-lifecycle`,
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
      axios.post.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(publishAPIDef(wso2APIM, 'xxx', apiId)).rejects.toThrow();
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
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/store/${wso2APIM.versionSlug}/apis/${apiId}`,
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
      axios.get.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(listInvokableAPIUrl(wso2APIM, 'xxx', apiId)).rejects.toThrow();
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
      axios.post.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(uploadCert(wso2APIM, 'xxx', 'alias', wso2APIM.apidefs[0].backend.http.certChain, wso2APIM.apidefs[0].backend.http.baseUrl)).rejects.toThrow();
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
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis/${apiId}`,
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
      axios.put.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(updateAPIDef(wso2APIM, 'xxx', wso2APIM.apidefs[0], apiId)).rejects.toThrow();
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
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis/${apiId}`,
        {
          headers: {
            Authorization: 'Bearer xxx',
          },
          httpsAgent: expect.objectContaining({}),
        });
      expect(response).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.delete.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(removeAPIDef(wso2APIM, 'xxx', apiId)).rejects.toThrow();
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
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/certificates/alias`,
        {
          headers: {
            Authorization: 'Bearer xxx',
          },
          httpsAgent: expect.objectContaining({}),
        });
      expect(response.data).toEqual('foo');
    });

    it('should handle a faulty response', async () => {
      axios.delete.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(removeCert(wso2APIM, 'xxx', 'alias')).rejects.toThrow();
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
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/endpoint-certificates/alias`,
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
      axios.put.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(updateCert(wso2APIM, 'xxx', 'alias', wso2APIM.apidefs[0].backend.http.certChain)).rejects.toThrow();
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
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/certificates/alias`,
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
      axios.get.mockImplementationOnce(() =>
        Promise.reject()
      );

      expect(listCertInfo(wso2APIM, 'xxx', 'alias')).rejects.toThrow();
    });

  });
  
});
