const os = require('os');
const path = require('path');

function getDefaultDirectory() {
    const configured = String(process.env.MEEM_FILES_DIR || '').trim();
    if (configured) return path.resolve(configured);
    return path.resolve(process.cwd(), 'files');
}

module.exports = { getDefaultDirectory };
