'use strict';

const Fetch = require('./src/handler/fetch');
const Feed = require('./src/handler/feed');
module.exports.fetch = Fetch.fetch;
module.exports.feed = Feed.feed;
