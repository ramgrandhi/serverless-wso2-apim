# Thank you for considering to contribute.

<a href="https://github.com/ramgrandhi/serverless-wso2-apim/fork">![x](./assets/fork-me-on-github.png)</a>

# Let's get going..
Just follow these simple steps.

1. `Fork` the repository by clicking the link above.

2. Create a `feature` branch and start building your feature.

3. Start docker daemon if it is not running.

4. Regression test your changes by running these two commands.  

    > `yarn test:e2e:setup`  
    > `yarn test:e2e`
  
    ![img](./assets/e2e-tests-ok.png)

5. Now, do not forget to add tests related to the feature you just built by creating folders under `src/__tests__/e2e/*` (follow the naming). Run `yarn e2e:test` again. 

6. If all tests are passing, you're ready to create a `merge request` into `develop` branch of main repository. _Voila!_ 🚀

# Troubleshooting
If you run into issues running above scripts then you may try these steps individually.

a. Start the following docker containers separately in multiple terminals.

> `docker run --name api-manager-260 -p 127.0.0.1:8260:8243 -p 127.0.0.1:9260:9443 --rm wso2/wso2am:2.6.0`

> `docker run --name api-manager-320 -p 127.0.0.1:8320:8243 -p 127.0.0.1:9320:9443 --rm wso2/wso2am:3.2.0`

> `docker run --name localstack -p 127.0.0.1:4566:4566 -p 127.0.0.1:4571:4571 --rm localstack/localstack`

b. Start regression tests.
    
> `yarn test:e2e`

