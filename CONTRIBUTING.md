# Let's get going..

<a href="https://github.com/ramgrandhi/serverless-wso2-apim/fork">![x](./assets/fork-me-on-github.png)</a>

Thank you for considering to contribute.  Just follow these simple steps.

1. `Fork` the repository by clicking the link above.
2. Create a `feature` branch and start building your feature.
3. Regression test your changes locally to ensure that existing functionality has not been broken.  
    a. Run docker image of **WSO2 API Manager 2.6.0**.  

    > `docker run -it --name api-manager-260 -p 127.0.0.1:8260:8243 -p 127.0.0.1:9260:9443 --rm wso2/wso2am:2.6.0`

    b. Run docker image of **WSO2 API Manager 3.2.0**.  

    > `docker run -it --name api-manager-320 -p 127.0.0.1:8320:8243 -p 127.0.0.1:9320:9443 --rm wso2/wso2am:3.2.0`

    c. Start regression tests.
    
    > `yarn e2e:test`

4. Now, do not forget to add tests related to the feature you just built by creating folders under `src/__tests__/e2e/*` (follow the naming). Run `yarn e2e:test` again. 

5. If all tests are passing, you're ready to create a `merge request` into `develop` branch of main repository. _Voila!_

----


# Thanks for contributing! 🙌 

