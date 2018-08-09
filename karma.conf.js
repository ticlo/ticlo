let fixPathRegWin = /^\.\.\\test\/[\w]:\\/;
let fixPathLinux = /^\.\.\/test\/home\//;

function mapFileName(str) {
    if (fixPathRegWin.test(str)) {
        return str.substr(8);
    } else if (fixPathLinux.test(str)) {
        return str.substr(7);
    }
    return str;
}

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
        coverageReporter: {
            dir: '.karma_coverage',
            reporters: [] // no default report
        },
        remapIstanbulReporter: {
            reports: {
                "lcovonly": ".karma_coverage/lcov.txt"
            },
            remapOptions: {
                mapFileName,
                exclude: /node_module/
            }
        },
        singleRun: true,
        browsers: ["ChromeHeadless"]
    });
};