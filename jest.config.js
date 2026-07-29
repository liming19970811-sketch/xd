module.exports = {
  globalTeardown: '@dcloudio/uni-automator/dist/teardown.js',
  testEnvironment: '@dcloudio/uni-automator/dist/environment.js',
  testEnvironmentOptions: {
    platform: 'h5',
    cliPath: 'node_modules/@dcloudio/vue-cli-plugin-uni/bin/uniapp-cli.js',
    compile: true,
    h5: {
      options: {
        headless: true
      }
    }
  },
  testTimeout: 120000,
  testMatch: ['<rootDir>/tests/**/*.spec.js']
}
