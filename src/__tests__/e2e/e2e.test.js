const fs = require('fs');
const chalk = require('chalk');
const { spawnSync } = require('child_process');

describe('E2E on WSO2 API Manager', () => {
  afterEach(() => {
  });

  fs.readdirSync('src/__tests__/e2e').forEach(dirTopLevel => {
    if (fs.statSync(`src/__tests__/e2e/${dirTopLevel}`).isDirectory()) {
      fs.readdirSync(`src/__tests__/e2e/${dirTopLevel}`).forEach(dirNextLevel => {
        if (fs.statSync(`src/__tests__/e2e/${dirTopLevel}/${dirNextLevel}`).isDirectory()) {
          it(`${dirTopLevel}/${dirNextLevel}`, () => {
            const child1 = spawnSync('sls',
              ['deploy', '--noDeploy'],
              {
                cwd: `src/__tests__/e2e/${dirTopLevel}/${dirNextLevel}`,
                stdio: 'pipe',
                encoding: 'utf-8',
                env: {
                  ...process.env,
                  WSO2_HOST: '127.0.0.1',
                  WSO2_PORT: Number('9' + dirTopLevel.split('.').join('')),
                  WSO2_USER: 'admin',
                  WSO2_PASS: 'admin',
                  WSO2_ENV: 'Production and Sandbox',
                  TEST_ID: dirNextLevel
                }
              }
            );

            if (dirNextLevel.split('-')[0] === 'valid') {
              console.log(chalk.bold.underline(`🔆 ${dirTopLevel}/${dirNextLevel}`));
              expect(child1.status).toBe(0);
              expect(child1.output.toString()).toEqual(expect.not.stringContaining('NOT OK'));
            }
            else if (dirNextLevel.split('-')[0] === 'invalid') {
              console.log(chalk.bold.underline(`🌧 ${dirTopLevel}/${dirNextLevel}`));
              expect(child1.output.toString().includes('NOT OK'));
            }
            console.log(child1.output.toString());

            const child2 = spawnSync('sls',
              ['remove', 'apidefs'],
              {
                cwd: `src/__tests__/e2e/${dirTopLevel}/${dirNextLevel}`,
                stdio: 'pipe',
                encoding: 'utf-8',
                env: {
                  ...process.env,
                  WSO2_HOST: '127.0.0.1',
                  WSO2_PORT: Number('9' + dirTopLevel.split('.').join('')),
                  WSO2_USER: 'admin',
                  WSO2_PASS: 'admin',
                  WSO2_ENV: 'Production and Sandbox',
                  TEST_ID: dirNextLevel
                }
              }
            );

            console.log(chalk.bold.underline(`🧹  ${dirTopLevel}/${dirNextLevel}`));
            expect(child2.status).toBe(0);
            expect(child2.output.toString()).toEqual(expect.not.stringContaining('NOT OK'));
            console.log(child2.output.toString());
          });
        }
      });
    }
  });
});
