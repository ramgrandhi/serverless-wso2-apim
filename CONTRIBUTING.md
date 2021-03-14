


## Regression test your changes locally

1. Run supported versions of **WSO2 API Manager** via Docker in separate terminals.

> `docker run -it --name api-manager-260 -p 127.0.0.1:8260:8243 -p 127.0.0.1:9260:9443 --rm wso2/wso2am:2.6.0`

> `docker run -it --name api-manager-320 -p 127.0.0.1:8320:8243 -p 127.0.0.1:9320:9443 --rm wso2/wso2am:3.2.0`

2. Run `yarn e2e:test`
