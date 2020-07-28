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
* Create, Update API definitions using `sls deploy apidefs`

  ![img](./assets/sls-deploy-apidefs.png)

* View API deployment status using `sls list apidefs`

  ![img](./assets/sls-list-apidefs-1.png)
  ![img](./assets/sls-list-apidefs-2.png)

* Delete API definitions using `sls remove apidefs`

  ![img](./assets/sls-remove-apidefs.png)

* Automatically publish / re-publish APIs to WSO2 API Store when changes occur to API definitions

---

## Install Plugin
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
      host: 'wso2-apimanager.com' # WSO2 API Manager Host
      port: 443 # WSO2 API Manager Port
      versionSlug: 'v0.14'  # WSO2 API Manager's Management API version
      user: 'user@tenant' # Username, with tenant symbol
      pass: 'pass' # Password
      gatewayEnv: 'Production'  # Target Gateway Environment
  ```

- Add one or more API definitions to your Serverless configuration, as below.

  ```yml
  apidefs:
    - myAwesomeAPI: # Identifier of your API definition
      name: 'MyAwesomeAPI'  # Name of API that shows up in WSO2 API Console (CANNOT BE UPDATED LATER)
      description: 'My Awesome API'
      rootContext: '/myawesomeapi'  # Runtime context of API which will be appended to the base URL exposed by WSO2 API Gateway. Must be unique across the Gateway Environment. (CANNOT BE UPDATED LATER)
      version: 'v1' # Version, which also forms a part of the API URL ultimately (CANNOT BE UPDATED LATER)
      visibility: 'PUBLIC'  # Accessible from Public Internet, Visible to everyone
      backend: 
        http: # HTTP-based Backends
          baseUrl: 'https://backend-host:port/123'  # Backend RESTful base URL
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

- Run `sls deploy apidefs` to create-and-publish (or) update-and-republish API definitions in WSO2 API Manager.

- Run `sls list apidefs` to view the status of API deployment on WSO2 API Manager.

- Run `sls remove apidefs` to delete API definitions from WSO2 API Manager when there are no active subscriptions made to those APIs.

- ** COMING SOON **   
Run `sls remove apidefs --force` (** USE WITH CAUTION **) to forcefully delete API definitions despite any active subscriptions. It will retire, deprecate and delete API definitions if they cannot be deleted normally.


## Limitations and Backlog items
* Limited to creation of RESTful APIs using Swagger 2.0 on WSO2 API Manager. 
* Limited to WSO2 API Manager 2.6.0 which uses v0.14 as management API version. 
* Does not support managing APIs which are already created in another manner without using this Plugin.
* Does not support custom certificates for backend endpoints.
* Does not work with Websocket-style APIs.  
* Does not support publishing API definitions to multiple Gateway environments.  
* Does not support CORS configuration.

## Help?
* Raise an Issue 

## License
[MIT](https://github.com/99xt/serverless-dynamodb-local/blob/v1/LICENSE)