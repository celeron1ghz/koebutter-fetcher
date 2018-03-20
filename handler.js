'use strict';

const vo = require('vo');

const config = [
  { channel: 'hibiki', programId: 'llss' },
  { channel: 'hibiki', programId: 'lovelive-ms' },
  { channel: 'hibiki', programId: 'sora' },
  { channel: 'hibiki', programId: 'revuestarlight' },
  { channel: 'onsen',  programId: 'aya-uchida' },
  { channel: 'onsen',  programId: 'ff' },
  { channel: 'onsen',  programId: 'garupa' },
  { channel: 'onsen',  programId: 'mogucomi' },
];

const CHANNELS = {
  hibiki: require('./src/fetcher/HibikiRadioFetcher'),
  onsen:  require('./src/fetcher/OnsenFetcher'),
};

module.exports.fetch = (event, context, callback) => {
  vo(function*(){
    for (const c of config) {
      const fetcher = CHANNELS[c.channel];

      if (!fetcher) {
        console.log(`Error: unknown channel '${c.channel}'. skipped...`);
        continue;
      }

      try {
        yield new fetcher(c).fetch();
      } catch(err) {
        console.log("Error on " + c.channel + ":", err);
      }
    }

    callback(null, "OK");
  })
  .catch(err => {
    console.log("Error:", err);
    callback(err);
  });
};
