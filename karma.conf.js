module.exports = function (config) {
  config.set({
    frameworks: ["mocha", "karma-typescript"],
    files: [
      "src/core/**/*.ts?(x)",
      "src/ui/**/*.ts?(x)",
      "src/editor/**/*.ts?(x)",
      "dist/*.css"
    ],
    preprocessors: {
      "src/**/*.ts?(x)": ["karma-typescript"]
    },
    karmaTypescriptConfig: {
      reports: {
        "lcovonly": {
          "directory": "coverage",
          "subdirectory": "chrome",
          "filename": "karma.log"
        },
        "html": {
          "directory": "coverage"
        }
      },
      compilerOptions: {
        "target": "es2015",
        "module": "commonjs",
        "jsx": "react",
        "moduleResolution": "node",
        "esModuleInterop": true,
        "lib": [
          "es2017",
          "dom"
        ],
        "alwaysStrict": true,
        "noImplicitAny": true,
        "sourceMap": true,
        "typeRoots": [
          "node_modules/@types",
          "@types"
        ]
      },
      compileOnSave: true,
      include: [
        "src/**/*"
      ],
      exclude: [
        "node_modules"
      ]
    },
    singleRun: true,
    reporters: ["dots", "karma-typescript"],
    browsers: ["ChromeHeadless"]
  });
};
