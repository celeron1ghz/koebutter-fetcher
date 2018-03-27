'use strict';

const vo = require('vo');
const debug = require('debug')('koebutter');

const config = [
  { channel: 'hibiki', programId: 'llss' },
  { channel: 'hibiki', programId: 'lovelive_ms' },
  { channel: 'hibiki', programId: 'sora' },
  { channel: 'hibiki', programId: 'revuestarlight' },
  { channel: 'onsen',  programId: 'aya-uchida' },
  { channel: 'onsen',  programId: 'ff' },
  { channel: 'onsen',  programId: 'garupa' },
  { channel: 'onsen',  programId: 'mogucomi' },
  { channel: 'animatetimes',  programId: 'marugotorikako', /*episode: '8'*/ },
];

const CHANNELS = {
  hibiki:       require('../fetcher/HibikiRadioFetcher'),
  onsen:        require('../fetcher/OnsenFetcher'),
  animatetimes: require('../fetcher/AnimateTimesFetcher'),
};

module.exports.fetch = (event, context, callback) => {
  debug("handler.vo() GENERATE");
  vo(function*(){
    debug("handler.vo() START");

    for (const c of config) {
      debug("handler.vo() LOOP_START");

      const fetcher = CHANNELS[c.channel];

      if (!fetcher) {
        console.log(`Error: unknown channel '${c.channel}'. skipped...`);
        debug("handler.vo() CONTINUE_UNKNOWN_CHANNEL");
        continue;
      }

      try {
        yield new fetcher(c).fetch().catch(err => {
          console.log("ERROR:", err.message);
        });
      } catch(err) {
        console.log("Error on " + c.channel + ":", err);
      }

      debug("handler.vo() LOOP_END");
    }

    debug("handler.vo() LAST_LINE");
    callback(null, "OK");
    return null;
  })
  .catch(err => {
    console.log("Uncaught error:", err);
    callback(err);
  });
};
