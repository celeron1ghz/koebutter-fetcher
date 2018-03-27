const tempy = require('tempy');
const agent = require('cheerio-httpcli');
const { sprintf } = require("sprintf-js");

const Fetcher = require('../common/Fetcher');
const Recorder = require('../recorder/FfmpegRecorder');

class AnimateTimesFetcher extends Fetcher {
  constructor(args) {
    super();
    if (!args.programId) { throw new Error("programId not specified") }
    this.programId = args.programId;
    this.episode   = args.episode;
  }

  fetchProgramList() {
    const self = this;
    return agent.fetch('https://www.animatetimes.com/radio/archive.php?id=' + this.programId, {})
      .then(data => {
        const $ = data.$;
        const ret = [];

        const title = $('div#radio h2').text();

        $('div[class="backNumberList"] div[class="box"]').each(function(idx){
          const e = $(this);
          const meta = {
            id: self.programId,
            title: title,
            episode: e.find('span.title').text().match(/\d+/)[0],
            date:  e.find('span.date').text(),
            link:  'https://www.animatetimes.com' + e.find('a').attr('href'),
            image: e.find('img').attr('src'),
          };

          ret.push(meta);
        });

        return ret;
      });
  }

  filterProgram(list) {
    if (this.episode) {
      return list.filter(l => l.episode === this.episode);
    }
    return [list[0]];
  }

  getFilename(program) {
    const pid = this.programId;
    return agent.fetch(program.link)
      .then(data => {
        const playPage = 'https://www.animatetimes.com' + data.$('div#radio li.video.clearfix a').attr('href');
        return agent.fetch(playPage);
      })
      .then(data => {
        const $ = data.$;
        const m3u8 = $('script[id^=UlizaScript]').html().match(/src:"(.*?)"/)[1];
        const basename = sprintf("%s%03d.mp4", pid, program.episode);
        console.log(`RESOLVE: ${pid} ==> ${program.title} (id=${program.episode}, file=${basename})`);

        return {
          program,
          basename,
          remoteFile: `animatetimes/${pid}/${basename}`,
          localFile: tempy.file({ name: basename }),
          m3u8,
        };
      });
  }

  getRecorder(f) {
    const pid = this.programId;
    const { localFile, m3u8 } = f;

    return Recorder.record(pid, localFile, [
      '-i', m3u8,
      '-movflags', 'faststart',
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      localFile,
    ]);
  }
}

module.exports = AnimateTimesFetcher;