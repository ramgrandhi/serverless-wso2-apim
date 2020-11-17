serverless-wso2-apim
====================
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Serverless Framework plugin to manage APIs in [WSO2 API Manager](https://wso2.com/api-management/).

![img](./assets/serverless-wso2-apim.png)
---

## Compatible with
* serverlessˆ1.75
* [WSO2 API Manager 2.6.0](https://docs.wso2.com/display/AM260/)

## Features
* Create or Update your API definitions (including backend certificates) seamlessly with one command - `sls deploy`.  
* Manage your API definitions via `sls info` and `sls remove`.  
* Automatically uploads backend certificates (including CAs) to enable HTTP/S based connectivity with backends.
* Backend certificates can be supplied using `file://` (relative to where `serverless.yml` file is located) or `arn:aws:acm:..` (AWS ACM Certificate ARN).  
* Automatically publish / re-publish APIs to WSO2 API Store on every deploy.

---

## Install Plugin
* Discover it on npmjs.com @ [here](https://www.npmjs.com/package/serverless-wso2-apim)

* `yarn add -D serverless-wso2-apim`   
or   
`npm install --save serverless-wso2-apim`  

* Then in `serverless.yml` add following entry to the plugins array:
  ```yml
  plugins:
    - serverless-wso2-apim
  ```

## Using the Plugin

- Make sure you have a Serverless project set up as described [here](https://www.serverless.com/framework/docs/getting-started/).  

- Add configuration options to your Serverless configuration, as below.
  ```yml
  custom:
    wso2apim:
      enabled: false # Default is 'true'. When set to 'false' explicitly, deployment will be skipped
      host: 'wso2-apimanager.com' # WSO2 API Manager Host
      port: 443 # WSO2 API Manager Port
      versionSlug: 'v0.14'  # WSO2 API Manager's Management API version
      user: 'user@tenant' # Username, with tenant symbol
      pass: 'pass' # Password
      gatewayEnv: 'Production'  # Target Gateway Environment
  ```

- Add one or more API definitions to your Serverless configuration, as below.

  ```yml
  custom:
    wso2apim:
      apidefs:
        - myAwesomeAPI: # Identifier of your API definition
          name: 'MyAwesomeAPI'  # (CANNOT BE UPDATED LATER) Name of API that shows up in WSO2 API Console
          version: 'v1' # (CANNOT BE UPDATED LATER) Version, which also forms a part of the API URL ultimately 
          rootContext: '/myawesomeapi'  # (CANNOT BE UPDATED LATER) Runtime context of API which will be exposed by WSO2 API Gateway. Must be unique across the Gateway Environment.
          description: 'My Awesome API'
          visibility: 'PUBLIC'  # Accessible from Public Internet, Visible to everyone
          backend: 
            http: # HTTP-based Backends
              baseUrl: 'https://backend:port/123'  # Backend RESTful base URL
              certChain: 'file://certs/backend.cer'  # Optional, certificate chain in PEM (base64) format. 
                                                     # Alternatively, you can also supply AWS ACM Certificate ARN (e.g. arn:aws:acm:...) too.
          maxTps: 100 # Throttling, Transactions per second
          tags:
            - my-awesome-api
            - awesomeness
          swaggerSpec:  # Swagger specification in YML, currently supports 2.0
            swagger: '2.0'
            ...
            info:
              ...
            paths:
              ...
  ```

- Run `sls deploy` to create-and-publish (or) update-and-republish API definitions (and associated backend certificates, if supplied) in WSO2 API Manager.

- Run `sls info` to view the status of API deployment on WSO2 API Manager.

- Run `sls remove` to delete API definitions (and associated backend certificates, if exists) when there are no active subscriptions exist on those APIs.


- ** COMING SOON **   
Run `sls remove --force` (** USE WITH CAUTION **) to forcefully delete API definitions (and associated backend certificates) despite any active subscriptions that may exist. API definitions will be retired and deprecated before removing it completely from WSO2 API Manager.


## Limitations and Backlog items
* Limited to creation of RESTful APIs using Swagger 2.0 on WSO2 API Manager. 
* Limited to WSO2 API Manager 2.6.0 which uses v0.14 as management API version. 
* For a full list of backlog items, refer to [what's coming up?](https://github.com/ramgrandhi/serverless-wso2-apim/projects/1)

## Need Help?
* Join us on Slack [here](https://join.slack.com/t/serverless-wso2-apim/shared_invite/zt-gidayta8-3kEztQh8QzA2lO4fBGv3IA)

## License
[MIT](https://github.com/99xt/serverless-dynamodb-local/blob/v1/LICENSE)