const start = require('./start');
const help = require('./help');
const reset = require('./reset');
const timezone = require('./timezone');

const handlers = {
  [start.command]: start.handler,
  [help.command]: help.handler,
  [reset.command]: reset.handler,
  [timezone.command]: timezone.handler,
};

module.exports = handlers;
