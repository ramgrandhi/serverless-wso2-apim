const fs = require('fs');
const chalk = require('chalk');
const { spawnSync } = require('child_process');

describe('E2E on WSO2 API Manager 2.6.0', () => {
  afterEach(() => {
  });

  fs.readdirSync('src/__tests__/e2e/2.6.0').forEach(dir => {
    if (fs.statSync('src/__tests__/e2e/2.6.0/' + dir).isDirectory()) {
      it(dir, () => {
        const child = spawnSync('sls',
          ['deploy', '--noDeploy'],
          {
            cwd: 'src/__tests__/e2e/2.6.0/' + dir,
            stdio: 'pipe',
            encoding: 'utf-8',
            env: {
              ...process.env,
              WSO2_HOST: '127.0.0.1',
              WSO2_PORT: 9260,
              WSO2_USER: 'admin',
              WSO2_PASS: 'admin',
              WSO2_ENV: 'Production and Sandbox',
              TEST_ID: dir
            }
          }
        );

        if (dir.split('-')[0] === 'valid') {
          console.log(chalk.whiteBright.bgGreen('🧪 ' + dir));
          expect(child.status).toBe(0);
          expect(child.output.toString()).toEqual(expect.not.stringContaining('NOT OK'));
        }
        else if (dir.split('-')[0] === 'invalid') {
          console.log(chalk.whiteBright.bgRed('🧪 ' + dir));
          expect(child.output.toString().includes('NOT OK'));
        }
        console.log(child.output.toString());
      });
    }
  });
});

describe('E2E on WSO2 API Manager 3.2.0', () => {
  fs.readdirSync('src/__tests__/e2e/3.2.0').forEach(dir => {
    if (fs.statSync('src/__tests__/e2e/3.2.0/' + dir).isDirectory()) {
      it(dir, () => {
        const child = spawnSync('sls',
          ['deploy', '--noDeploy'],
          {
            cwd: 'src/__tests__/e2e/3.2.0/' + dir,
            stdio: 'pipe',
            encoding: 'utf-8',
            env: {
              ...process.env,
              WSO2_HOST: '127.0.0.1',
              WSO2_PORT: 9320,
              WSO2_USER: 'admin',
              WSO2_PASS: 'admin',
              WSO2_ENV: 'Production and Sandbox',
              TEST_ID: dir
            }
          }
        );

        if (dir.split('-')[0] === 'valid') {
          console.log(chalk.whiteBright.bgGreen('🧪 ' + dir));
          expect(child.status).toBe(0);
          expect(child.output.toString()).toEqual(expect.not.stringContaining('NOT OK'));
        }
        else if (dir.split('-')[0] === 'invalid') {
          console.log(chalk.whiteBright.bgRed('🧪 ' + dir));
          expect(child.output.toString().includes('NOT OK'));
        }
        console.log(child.output.toString());
      });
    }
  });
});
