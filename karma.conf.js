module.exports = function (config) {
    config.set({
        frameworks: ["mocha", "karma-typescript"],
        files: [
            "src/common/**/*.ts"
        ],
        preprocessors: {
            "src/common/**/*.ts": ["karma-typescript"]
        },
        karmaTypescriptConfig: {
            tsconfig: './tsconfig.json',
            reports: {
                "lcovonly": {
                    "directory": "coverage",
                    "subdirectory": "chrome",
                    "filename": "karma.log"
                }
            }
        },
        singleRun: true,
        reporters: ["dots", "karma-typescript"],
        browsers: ["ChromeHeadless"]
    });
};
