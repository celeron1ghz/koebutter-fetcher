const tempy = require('tempy');
const request = require('superagent');
const { sprintf } = require("sprintf-js");

const Fetcher = require('../common/Fetcher');
const Recorder = require('../recorder/FfmpegRecorder');

class HibikiRadioFetcher extends Fetcher {
  constructor(args) {
    super();
    if (!args.programId) { throw new Error("programId not specified") }
    this.programId = args.programId;
  }

  _api_call(url, param) {
    return request.get(url, param)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Origin', 'http://hibiki-radio.jp');
  }

  fetchProgramList() {
    return this._api_call('https://vcms-api.hibiki-radio.jp/api/v1/programs').then(data => data.body);
  }

  filterProgram(list) {
    const pid = this.programId;
    return list.filter(p => p.access_id === pid);
  }

  getFilename(p) {
    const pid = this.programId;
    return this._api_call('https://vcms-api.hibiki-radio.jp/api/v1/programs/' + pid)
      .then(data => data.body)
      .then(program => {
        const m = program.episode.name.match(/\d+/);
        const basename = sprintf("%s%03d.mp4", pid, (m ? m[0] : 0));
        console.log(`RESOLVE: ${pid} ==> ${program.name} (id=${program.episode.id}, file=${basename})`);

        return {
          program,
          basename,
          remoteFile: `hibiki/${pid}/${basename}`,
          localFile: tempy.file({ name: basename }),
        };
      });
  }

  getRecorder(f) {
    const pid = this.programId;
    const { program, localFile } = f;

    if (!program.episode.video) {
      throw new Error("hibiki." + pid + " error: program.episode.video === null");
    }

    return this._api_call('https://vcms-api.hibiki-radio.jp/api/v1/videos/play_check', { video_id: program.episode.video.id })
      .then(data => data.body)
      .then(episode => [
        '-loglevel', 'error',
        '-y',
        '-i', episode.playlist_url,
        '-vcodec', 'copy',
        '-acodec', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        localFile,
      ])
      .then(data => Recorder.record(pid, f.localFile, data));
  }
}

module.exports = HibikiRadioFetcher;