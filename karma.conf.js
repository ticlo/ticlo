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
            tsconfig: './tsconfig.json'
        },
        reporters: ["dots", "karma-typescript"],
        browsers: ["Chrome"]
    });
};