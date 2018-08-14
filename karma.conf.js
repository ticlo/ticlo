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
                    "directory": ".karma_coverage",
                    "subdirectory": "lcov",
                    "filename": "lcov.txt"
                },
                "html": {
                    "directory": ".karma_coverage",
                    "subdirectory": "html"
                }
            }
        },
        singleRun: true,
        reporters: ["dots", "karma-typescript"],
        browsers: ["ChromeHeadless"]
    });
};
