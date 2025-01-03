// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-mocha-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // if you run into a randomly failing test, you can run the same test order with `JASMINE_SEED=123 ng test`
        // you can find the culprit seed in the Chrome window when running `ng test`
        seed: process.env['JASMINE_SEED']
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    coverageIstanbulReporter: {
      dir: require('path').join(__dirname, './coverage/frontend'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }, { type: 'lcovonly' }]
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    reporters: process.env.CI === 'true' ? ['dots'] : ['mocha', 'kjhtml'],
    browsers: ['ChromeHeadless'],
    restartOnFileChange: true,
    proxies: {
      '/api/certificates': '',
      '/api/south': '',
      '/vendor/monaco-editor/vs/loader.js': ''
    }
  });
};
