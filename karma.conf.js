module.exports = function (config) {
    config.set({
        frameworks: ["mocha"],
        preprocessors: {
            'build/**/*.js': ['coverage']
        },
        files: [
            'build/specs.js'
        ],
        plugins: ['karma-remap-istanbul', 'karma-mocha', 'karma-coverage', 'karma-chrome-launcher'],
        reporters: ['dots', 'coverage', 'karma-remap-istanbul'],
        remapIstanbulReporter: {
            reports: {
                "lcovonly": ".karma_coverage/lcov.txt"
            }
        },
        singleRun: true,
        browsers: ["ChromeHeadless"]
    });
};