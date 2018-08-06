module.exports = function (config) {
    config.set({
        frameworks: ["mocha", "karma-typescript"],
        files: [
            {pattern: "src/common/**/*.ts"}
        ],
        preprocessors: {
            "**/*.ts": ["karma-typescript"]
        },
        karmaTypescriptConfig: {
            tsconfig: './tsconfig.json',
            reports: {
                "lcovonly": {
                    "directory": ".karma_coverage",
                    "subdirectory": "lcov",
                    "filename": "lcov.txt"
                }
            }
        },
        singleRun: true,
        reporters: ["progress", "karma-typescript"],
        browsers: ["ChromeHeadless"]
    });
};