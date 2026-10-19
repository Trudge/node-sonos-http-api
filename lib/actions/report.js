'use strict';
const report = require('../../src/report');

module.exports = function (api) {
  api.registerAction('report', report.handleReport);
};
