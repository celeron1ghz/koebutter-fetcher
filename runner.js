const vo = require('vo');

const config = [
  { channel: 'hibiki', programId: 'llss' },
];

const CHANNELS = {
  hibiki: require('./src/fetcher/HibikiRadioFetcher'),
};

vo(function*(){
  for (const c of config) {
    const fetcher = CHANNELS[c.channel];

    if (!fetcher) {
      console.log(`Error: unknown channel '${c.channel}'. skipped...`);
      continue;
    }

    yield new fetcher(c).fetch().then(data => {
      console.log(c.channel, ": ok");
    });
  }

  return;
})
.catch(err => {
  console.log("Error:", err);
});