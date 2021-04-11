const fs = require('fs');
const chalk = require('chalk');
const { spawnSync } = require('child_process');

const wso2ApimVersionsSupported = ['2.6.0', '3.2.0'];

describe('E2E on WSO2 API Manager', () => {
  wso2ApimVersionsSupported.forEach(wso2ApimVersion => {
    // default scenario, run all test cases
    fs.readdirSync('src/__tests__/e2e').forEach(testCase => {
      if (fs.statSync(`src/__tests__/e2e/${testCase}`).isDirectory()) {
        // however, if a specific testCase name(s) are passed as parameters then it executes those selectively
        if (((process.argv.length > 4) && (process.argv.includes(testCase))) || (process.argv.length == 4)) {
          it(`${wso2ApimVersion}/${testCase}`, () => {
            const procDeploy = spawnSync('sls',
              ['deploy'],
              {
                cwd: `src/__tests__/e2e/${testCase}`,
                stdio: 'pipe',
                encoding: 'utf-8',
                env: {
                  TEST_ID_NORMALIZED: (testCase + '-' + wso2ApimVersion).toString().toLowerCase().split('-').join('.'),
                  STACK_NAME: (testCase + '-' + wso2ApimVersion).toString().split('.').join('-'),
                  WSO2_VER: wso2ApimVersion,
                  WSO2_HOST: '127.0.0.1',
                  WSO2_PORT: Number('9' + wso2ApimVersion.split('.').join('')),
                  WSO2_USER: 'admin',
                  WSO2_PASS: 'admin',
                  WSO2_ENV: 'Production and Sandbox',
                  TEST_ID: testCase.split('-').map(a => a[0]).join('-'),
                  ...process.env
                }
              }
            );

            if (testCase.split('-')[0] === 'valid') {
              console.log("Running.. ", chalk.bold.underline(`🔆 ${wso2ApimVersion}/${testCase}`), "\n\n", procDeploy.output.toString());
              expect(procDeploy.status).toBe(0);
              expect(procDeploy.output.toString()).toEqual(expect.not.stringContaining('NOT OK'));
            }
            else if (testCase.split('-')[0] === 'invalid') {
              console.log("Running.. ", chalk.bold.underline(`🌧 ${wso2ApimVersion}/${testCase}`), "\n\n", procDeploy.output.toString());
              expect(procDeploy.output.toString().includes('NOT OK'));
            }

            const procRemove = spawnSync('sls',
              ['remove'],
              {
                cwd: `src/__tests__/e2e/${testCase}`,
                stdio: 'pipe',
                encoding: 'utf-8',
                env: {
                  TEST_ID_NORMALIZED: (testCase + '-' + wso2ApimVersion).toString().toLowerCase().split('-').join('.'),
                  STACK_NAME: (testCase + '-' + wso2ApimVersion).toString().split('.').join('-'),
                  WSO2_VER: wso2ApimVersion,
                  WSO2_HOST: '127.0.0.1',
                  WSO2_PORT: Number('9' + wso2ApimVersion.split('.').join('')),
                  WSO2_USER: 'admin',
                  WSO2_PASS: 'admin',
                  WSO2_ENV: 'Production and Sandbox',
                  TEST_ID: testCase.split('-').map(a => a[0]).join('-'),
                  ...process.env
                }
              }
            );

            if (testCase.split('-')[0] === 'valid') {
              console.log("Cleaning up... ", chalk.bold.underline(`🔆 ${wso2ApimVersion}/${testCase}`), "\n\n", procRemove.output.toString());
            }
            else if (testCase.split('-')[0] === 'invalid') {
              console.log("Cleaning up... ", chalk.bold.underline(`🌧 ${wso2ApimVersion}/${testCase}`), "\n\n", procRemove.output.toString());
            }
            expect(procRemove.status).toBe(0);
            expect(procRemove.output.toString()).toEqual(expect.not.stringContaining('NOT OK'));
          });
        }
        else {
          console.log(chalk.bold(`--- Skipping ${wso2ApimVersion}/${testCase}`));
        }
      }
    });
  });
});
