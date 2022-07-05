const {
  registerClient,
  generateToken,
  isAPIDeployed,
  isCertUploaded,
  createAPIDef,
  publishAPIDef,
  constructAPIDef,
  uploadCert,
  updateCert,
  removeCert,
  listCertInfo,
  upsertSwaggerSpec,
  updateAPIDef,
  removeAPIDef,
  listInvokableAPIUrl,
} = require("./wso2apim");
const axios = require("axios");
const qs = require("qs");

afterEach(() => {
  jest.clearAllMocks();
});

jest.mock("axios", () => ({
  post: jest.fn(() => Promise.resolve({ data: "foo" })),
  get: jest.fn(() => Promise.resolve({ data: "foo" })),
  put: jest.fn(() => Promise.resolve({ data: "foo" })),
  delete: jest.fn(() => Promise.resolve({ data: "foo" })),
}));

const wso2APIM = {
  enabled: true,
  host: "wso2-apimanager.com",
  port: 443,
  versionSlug: "v0.14",
  user: "foo",
  pass: "bar",
  gatewayEnv: "Local",
  apidefs: [
    {
      name: "MyAwesomeAPI",
      description: "My Awesome API",
      rootContext: "/myawesomeapi",
      version: "v1",
      visibility: "PUBLIC",
      backend: {
        http: {
          baseUrl: "https://backend.url",
          certChain: "file://xxx.cer",
        },
      },
      tags: ["awesomeness", "myawesomeapi"],
      maxTps: 999,
      swaggerSpec: "xxx",
    },
  ],
};
const apiId = "123456789";

describe("wso2apim-2.6.0", () => {
  describe("registerClient()", () => {
    it("should handle a successful response", async () => {
      axios.post.mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            clientId: "foo",
            clientSecret: "bar",
          },
        })
      );

      const response = await registerClient(wso2APIM);

      expect(axios.post).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/client-registration/${wso2APIM.versionSlug}/register`,
        {
          clientName: "serverless-wso2-apim",
          grantType: "password refresh_token",
          owner: wso2APIM.user,
          saasApp: true,
        },
        expect.objectContaining({})
      );

      expect(response).toEqual({
        clientId: "foo",
        clientSecret: "bar",
      });
    });

    it("should handle a faulty response", async () => {
      axios.post.mockImplementationOnce(() => Promise.reject());

      expect(registerClient(wso2APIM)).rejects.toThrow();
    });
  });

  describe("generateToken()", () => {
    it("should handle a successful response", async () => {
      axios.post.mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            access_token: "xxx",
          },
        })
      );

      const response = await generateToken(wso2APIM, "foo123", "xxxyyyzzz");

      expect(axios.post).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/oauth2/token`,
        qs.stringify({
          grant_type: "password",
          username: wso2APIM.user,
          password: wso2APIM.pass,
          scope:
            "apim:api_create apim:api_publish apim:api_view apim:subscribe apim:tier_view apim:tier_manage apim:subscription_view apim:subscription_block",
        }),
        expect.objectContaining({})
      );

      expect(response).toEqual({
        accessToken: "xxx",
      });
    });

    it("should handle a faulty response", async () => {
      axios.post.mockImplementationOnce(() => Promise.reject());

      expect(generateToken(wso2APIM, "foo123", "xxxyyyzzz")).rejects.toThrow();
    });
  });

  describe("isAPIDeployed()", () => {
    it("should handle a successful response", async () => {
      const response = await isAPIDeployed(
        wso2APIM,
        "xxx",
        wso2APIM.apidefs[0].name,
        wso2APIM.apidefs[0].version,
        wso2APIM.apidefs[0].rootContext
      );

      expect(axios.get).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis?query=name:${wso2APIM.apidefs[0].name} version:${wso2APIM.apidefs[0].version} context:${wso2APIM.apidefs[0].rootContext}`,
        {
          headers: {
            Authorization: "Bearer xxx",
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response).toEqual("foo");
    });

    it("should handle a faulty response", async () => {
      axios.get.mockImplementationOnce(() => Promise.reject());

      expect(
        isAPIDeployed(
          wso2APIM,
          "xxx",
          wso2APIM.apidefs[0].name,
          wso2APIM.apidefs[0].version,
          wso2APIM.apidefs[0].rootContext
        )
      ).rejects.toThrow();
    });
  });

  describe("isCertUploaded()", () => {
    it("should handle a successful response", async () => {
      const response = await isCertUploaded(wso2APIM, "xxx", "alias");

      expect(axios.get).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/certificates/alias`,
        {
          headers: {
            Authorization: "Bearer xxx",
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response).toEqual("foo");
    });

    it("should handle a faulty response", async () => {
      axios.get.mockImplementationOnce(() => Promise.reject());

      expect(isCertUploaded(wso2APIM, "xxx", "alias")).rejects.toThrow();
    });
  });

  describe("createAPIDef()", () => {
    it("should handle a successful response", async () => {
      axios.post.mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            id: "123456789",
            name: wso2APIM.apidefs[0].name,
            context: wso2APIM.apidefs[0].rootContext,
            status: "CREATED",
          },
        })
      );

      const response = await createAPIDef(wso2APIM, "xxx", wso2APIM.apidefs[0]);

      expect(axios.post).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis`,
        expect.objectContaining({}),
        {
          headers: {
            Authorization: "Bearer xxx",
            "Content-Type": "application/json",
          },
          httpsAgent: expect.objectContaining({}),
        }
      );

      expect(response).toEqual({
        apiId,
        apiName: wso2APIM.apidefs[0].name,
        apiContext: wso2APIM.apidefs[0].rootContext,
        apiStatus: "CREATED",
      });
    });

    it("should handle a faulty response", async () => {
      axios.post.mockImplementationOnce(() => Promise.reject());

      expect(
        createAPIDef(wso2APIM, "xxx", wso2APIM.apidefs[0])
      ).rejects.toThrow();
    });
  });

  describe("publishAPIDef()", () => {
    it("should handle a successful response", async () => {
      const response = await publishAPIDef(wso2APIM, "xxx", apiId);

      expect(axios.post).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis/change-lifecycle`,
        expect.objectContaining({}),
        {
          headers: {
            Authorization: "Bearer xxx",
          },
          params: {
            apiId: apiId,
            action: "Publish",
          },
          httpsAgent: expect.objectContaining({}),
        }
      );

      expect(response.data).toEqual("foo");
    });

    it("should handle a faulty response", async () => {
      axios.post.mockImplementationOnce(() => Promise.reject());

      expect(publishAPIDef(wso2APIM, "xxx", apiId)).rejects.toThrow();
    });
  });

  describe("listInvokableAPIUrl()", () => {
    it("should handle a successful response", async () => {
      const response = await listInvokableAPIUrl(wso2APIM, "xxx", apiId);

      expect(axios.get).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/store/${wso2APIM.versionSlug}/apis/${apiId}`,
        {
          headers: {
            Authorization: "Bearer xxx",
          },
          httpsAgent: expect.objectContaining({}),
        }
      );

      expect(response).toEqual("foo");
    });

    it("should handle a faulty response", async () => {
      axios.get.mockImplementationOnce(() => Promise.reject());

      expect(listInvokableAPIUrl(wso2APIM, "xxx", apiId)).rejects.toThrow();
    });
  });

  describe("uploadCert()", () => {
    it("should handle a successful response", async () => {
      const response = await uploadCert(
        wso2APIM,
        "xxx",
        "alias",
        wso2APIM.apidefs[0].backend.http.certChain,
        wso2APIM.apidefs[0].backend.http.baseUrl
      );

      expect(response.data).toEqual("foo");
    });

    it("should handle a faulty response", async () => {
      axios.post.mockImplementationOnce(() => Promise.reject());

      expect(
        uploadCert(
          wso2APIM,
          "xxx",
          "alias",
          wso2APIM.apidefs[0].backend.http.certChain,
          wso2APIM.apidefs[0].backend.http.baseUrl
        )
      ).rejects.toThrow();
    });
  });

  describe("updateAPIDef()", () => {
    it("should handle a successful response", async () => {
      const response = await updateAPIDef(
        wso2APIM,
        "xxx",
        wso2APIM.apidefs[0],
        apiId
      );

      expect(axios.put).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis/${apiId}`,
        expect.objectContaining({}),
        {
          headers: {
            Authorization: "Bearer xxx",
            "Content-Type": "application/json",
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response).toEqual("foo");
    });

    it("should handle a faulty response", async () => {
      axios.put.mockImplementationOnce(() => Promise.reject());

      expect(
        updateAPIDef(wso2APIM, "xxx", wso2APIM.apidefs[0], apiId)
      ).rejects.toThrow();
    });
  });

  describe("removeAPIDef()", () => {
    it("should handle a successful response", async () => {
      const response = await removeAPIDef(wso2APIM, "xxx", apiId);

      expect(axios.delete).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis/${apiId}`,
        {
          headers: {
            Authorization: "Bearer xxx",
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response).toEqual("foo");
    });

    it("should handle a faulty response", async () => {
      axios.delete.mockImplementationOnce(() => Promise.reject());

      expect(removeAPIDef(wso2APIM, "xxx", apiId)).rejects.toThrow();
    });
  });

  describe("removeCert()", () => {
    it("should handle a successful response", async () => {
      const response = await removeCert(wso2APIM, "xxx", "alias");

      expect(axios.delete).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/certificates/alias`,
        {
          headers: {
            Authorization: "Bearer xxx",
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response.data).toEqual("foo");
    });

    it("should handle a faulty response", async () => {
      axios.delete.mockImplementationOnce(() => Promise.reject());

      expect(removeCert(wso2APIM, "xxx", "alias")).rejects.toThrow();
    });
  });

  describe("updateCert()", () => {
    it("should handle a successful response", async () => {
      const response = await updateCert(
        wso2APIM,
        "xxx",
        "alias",
        wso2APIM.apidefs[0].backend.http.certChain
      );

      expect(axios.put).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/certificates/alias`,
        expect.objectContaining({}),
        {
          headers: {
            Authorization: "Bearer xxx",
            "Content-Type": "multipart/form-data",
          },
          httpsAgent: expect.objectContaining({}),
        }
      );
      expect(response.data).toEqual("foo");
    });

    it("should handle a faulty response", async () => {
      axios.put.mockImplementationOnce(() => Promise.reject());

      expect(
        updateCert(
          wso2APIM,
          "xxx",
          "alias",
          wso2APIM.apidefs[0].backend.http.certChain
        )
      ).rejects.toThrow();
    });
  });

  describe("listCertInfo()", () => {
    it("should handle a successful response", async () => {
      const response = await listCertInfo(wso2APIM, "xxx", "alias");

      expect(axios.get).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/certificates/alias`,
        {
          headers: {
            Authorization: "Bearer xxx",
            Accept: "application/json",
          },
          httpsAgent: expect.objectContaining({}),
        }
      );

      expect(response).toEqual("foo");
    });

    it("should handle a faulty response", async () => {
      axios.get.mockImplementationOnce(() => Promise.reject());

      expect(listCertInfo(wso2APIM, "xxx", "alias")).rejects.toThrow();
    });
  });

  describe("upsertSwaggerSpec()", () => {
    it("should handle a successful response", async () => {
      const response = await upsertSwaggerSpec(wso2APIM, "xxx", "id001", wso2APIM.apidefs[0].swaggerSpec);

      expect(axios.put).toHaveBeenCalledWith(
        `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis/id001/swagger`,
        expect.objectContaining({}),
        {
          headers: {
            Authorization: "Bearer xxx",
            "Content-Type": "multipart/form-data"
          },
          httpsAgent: expect.objectContaining({})
        }
      );
    });

      it("should handle a faulty response", async () => {
        axios.put.mockImplementationOnce(() => Promise.reject());
        expect(upsertSwaggerSpec(wso2APIM, "xxx", "id001", wso2APIM.apidefs[0].swaggerSpec)).rejects.toThrow();
    });
  });

  describe("cors configuration", () => {
    it("no cors", async () => {
      const apiDef = await constructAPIDef(
        wso2APIM.user,
        wso2APIM.gatewayEnv,
        wso2APIM.apidefs[0]
      );

      expect(apiDef.corsConfiguration).toBeUndefined();
    });

    it("only origin", async () => {
      const config = {
        ...wso2APIM,
        apidefs: [
          {
            ...wso2APIM.apidefs[0],
            cors: {
              origins: ["https://www.example.com"],
            },
          },
        ],
      };

      const apiDef = await constructAPIDef(
        config.user,
        config.gatewayEnv,
        config.apidefs[0]
      );

      expect(apiDef.corsConfiguration).toEqual({
        corsConfigurationEnabled: true,
        accessControlAllowOrigins: ["https://www.example.com"],
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: [
          "Authorization",
          "Access-Control-Allow-Origin",
          "Content-Type",
          "SOAPAction",
        ],
        accessControlAllowMethods: [
          "GET",
          "PUT",
          "POST",
          "DELETE",
          "PATCH",
          "OPTIONS",
        ],
      });
    });

    it("fully specified", async () => {
      const config = {
        ...wso2APIM,
        apidefs: [
          {
            ...wso2APIM.apidefs[0],
            cors: {
              origins: ["https://www.example.com", "https://www.example.org"],
              credentials: true,
              headers: ["Authorization", "x-custom"],
              methods: ["GET"],
            },
          },
        ],
      };

      const apiDef = await constructAPIDef(
        config.user,
        config.gatewayEnv,
        config.apidefs[0]
      );

      expect(apiDef.corsConfiguration).toEqual({
        corsConfigurationEnabled: true,
        accessControlAllowOrigins: [
          "https://www.example.com",
          "https://www.example.org",
        ],
        accessControlAllowCredentials: true,
        accessControlAllowHeaders: ["Authorization", "x-custom"],
        accessControlAllowMethods: ["GET"],
      });
    });
  });
});
