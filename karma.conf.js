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
        reporters: ["karma-typescript"],
        browsers: ["ChromeHeadless"]
    });
};