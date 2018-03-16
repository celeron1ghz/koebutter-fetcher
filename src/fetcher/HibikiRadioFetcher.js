const debug = require('debug')('koebutter.fetcher.hibiki');
const tempy = require('tempy');
const request = require('superagent');
const { sprintf } = require("sprintf-js");

const Fetcher = require('../common/Fetcher');

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

  fetch_program_list() {
    const pid = this.programId;
    debug("FETCH_PROGRAM_LIST:", pid);
    return this._api_call('https://vcms-api.hibiki-radio.jp/api/v1/programs').then(data => data.body);
  }

  get_filename(p) {
    const pid = this.programId;
    debug("FETCH_PROGRAM_INFO:", pid);
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

  get_recorder_params(f) {
    const pid = this.programId;
    const { program, localFile } = f;

    debug("FETCH_EPISODE_INFO:", pid);
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
      ]);
  }
}

module.exports = HibikiRadioFetcher;