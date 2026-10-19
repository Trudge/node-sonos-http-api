import type { ActionApi, ActionHandler } from '../../src/types/actions';

const report = require('../../src/report');

export = function (api: ActionApi): void {
  api.registerAction('report', report.handleReport as ActionHandler);
};
