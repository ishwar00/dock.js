const path = require("path");

module.exports = {
    mode: "production",
    target: "node",
    entry: "./dist/index.js",
    output: {
        path: path.resolve(__dirname, "build"),
        filename: "dock.js",
    },
    stats: { errorDetails: true },
};
