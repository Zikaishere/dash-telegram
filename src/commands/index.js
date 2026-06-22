const start = require('./start');
const help = require('./help');
const reset = require('./reset');

const handlers = {
  [start.command]: start.handler,
  [help.command]: help.handler,
  [reset.command]: reset.handler,
};

module.exports = handlers;
