const path = require('path');
const response = require('../core/response');
const { getDefaultDirectory } = require('../core/defaultDirectory');

function home(reqId) {
    response.ok(reqId, { path: getDefaultDirectory(), sep: path.sep, platform: process.platform });
}

module.exports = { home };
