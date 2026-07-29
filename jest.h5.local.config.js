const fs = require('fs')
const path = require('path')

const h5Url = 'http://127.0.0.1:8080/#/'
const browsersRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || '.ms-playwright'
const expectedBrowserExe = path.resolve(
  process.cwd(),
  browsersRoot,
  'chromium_headless_shell-1217',
  'chrome-headless-shell-win64',
  'chrome-headless-shell.exe'
)

console.log(
  `[e2e-startup] node=${process.version} cwd=${process.cwd()} h5.url=${h5Url} ` +
    `PLAYWRIGHT_BROWSERS_PATH=${browsersRoot} browserExe=${expectedBrowserExe} ` +
    `exeExists=${fs.existsSync(expectedBrowserExe)}`
)

module.exports = {
  globalTeardown: '@dcloudio/uni-automator/dist/teardown.js',
  testEnvironment: '@dcloudio/uni-automator/dist/environment.js',
  testEnvironmentOptions: {
    platform: 'h5',
    compile: false,
    h5: {
      url: h5Url
    }
  },
  testTimeout: 120000,
  testMatch: ['<rootDir>/tests/**/*.spec.js']
}

