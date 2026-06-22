const start = require('./start');
const help = require('./help');
const reset = require('./reset');
const timezone = require('./timezone');
const setName = require('./setName');
const setTone = require('./setTone');
const wipe = require('./wipe');
const adminHandlers = require('./admin');

const handlers = {
  [start.command]: start.handler,
  [help.command]: help.handler,
  [reset.command]: reset.handler,
  [timezone.command]: timezone.handler,
  [setName.command]: setName.handler,
  [setTone.command]: setTone.handler,
  [wipe.command]: wipe.handler,
  stats: adminHandlers.stats,
  broadcast: adminHandlers.broadcast,
};

module.exports = handlers;
