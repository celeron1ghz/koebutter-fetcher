'use strict';
const Fetch = require('./src/handler/fetch');
const Feed = require('./src/handler/feed');
const Log = require('./src/handler/log');
module.exports.fetch = Fetch.fetch;
module.exports.feed = Feed.feed;
module.exports.log = Log.log;