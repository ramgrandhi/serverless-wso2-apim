# Changelog


## [0.2.1](https://www.npmjs.com/package/serverless-wso2-apim/v/0.2.1) (2020-08-27)

### New Features
- All parameters under `custom : wso2apim` now supports [Serverless variables](https://www.serverless.com/framework/docs/providers/aws/guide/variables/) syntax.

- `backend.http.certChain` property now accepts certificate chain in two formats:
    - AWS ACM Certificat ARN (e.g. arn:aws:acm:...)
    - local file (e.g. file://certs/abc.cer) relatively from where serverless.yml file is located

- Supports management of backend digital certificates.  

- Improved logging & error handling.  

### Changes since last release

- Usage of commands
    - `sls deploy` will deploy API definitions (and backend certificates associated) in WSO2 API Manager along with your other Serverless resources
    - `sls info` will list the deployment status of API definitions in WSO2 API Manager
    - `sls remove` will remove API definitions (and backend certificates associated) in WSO2 API Manager
    - Motivation is to keep it aligned with how serverless commands are widely used.

- Arrangement within serverless.yml 
    - The entire parameters block `apidefs` has been moved under `custom:wso2apim`


## [0.0.1-alpha.1](https://www.npmjs.com/package/serverless-wso2-apim/v/0.0.1-alpha.1) (2020-07-28)

### Features
- First sane release.
