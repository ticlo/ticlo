module.exports = function (config) {
  config.set({
    frameworks: ["mocha", "karma-typescript"],
    files: [
      "src/core/**/*.ts?(x)",
      "src/html/**/*.ts?(x)",
      "src/react/**/*.ts?(x)",
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
          "filename": "karma.lcov"
        }
      },
      compilerOptions: {
        "target": "es2018",
        "module": "commonjs",
        "jsx": "react",
        "moduleResolution": "node",
        "esModuleInterop": true,
        "lib": [
          "esnext.bigint",
          "es2017",
          "dom"
        ],
        "alwaysStrict": true,
        "noImplicitAny": true,
        "skipLibCheck": true,
        "sourceMap": true,
        "typeRoots": [
          "node_modules/@types",
          "@types"
        ],
        "paths": {
          "resize-observer-polyfill": ["./@types/resize-observer-polyfill"]
        }
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

// process.on('infrastructure_error', (error) => {
//   console.error('infrastructure_error', error);
// });
