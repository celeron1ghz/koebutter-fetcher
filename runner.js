
const config = [
  { channel: 'hibiki', programId: 'llss' },
];

const CHANNELS = {
  hibiki: require('./src/fetcher/HibikiRadioFetcher'),
}

for (const c of config) {
  const fetcher = CHANNELS[c.channel];

  if (!fetcher) {
    console.log(`Error: unknown channel '${c.channel}'. skipped...`);
    continue;
  }

  new fetcher(c).fetch()
    .then(data => {
      console.log(c.channel, ": ok")
    })
    .catch(err => {
      console.log("Error:", err.message);
    });
}