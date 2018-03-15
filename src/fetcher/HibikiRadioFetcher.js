const vo = require('vo');
const tempy = require('tempy');
const request = require('superagent');
const { sprintf } = require("sprintf-js");
const debug = require('debug')('koebutter');

const recorder = require('../recorder/FfmpegRecorder');

class HibikiRadioFetcher {
  constructor(programId) {
    if (!programId) { throw new Error("programId not specified") }
    this.programId = programId;
  }

  _api_call(url, param) {
    return request.get(url, param)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Origin', 'http://hibiki-radio.jp');
  }

  /*
  const ret = yield (
    request.get('https://vcms-api.hibiki-radio.jp/api/v1//programs')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Origin', 'http://hibiki-radio.jp')
  );
  */

  fetch() {
    const self = this;

    return vo(function*(){
      const pid = self.programId;

      debug("FETCH_PROGRAM_INFO:", pid);
      const program = (yield self._api_call('https://vcms-api.hibiki-radio.jp/api/v1/programs/' + pid)).body;

      const m        = program.episode.name.match(/\d+/);
      const ep_no    = sprintf("%03d", m ? m[0] : 0);
      const basename = pid + ep_no + '.mp4';
      const output   = tempy.file({ name: basename });
      console.log(`RESOLVE: ${pid} ==> ${program.name}[${ep_no}] (id=${program.episode.id})`);

      debug("FETCH_EPISODE_INFO:", pid);
      const episode = (yield self._api_call('https://vcms-api.hibiki-radio.jp/api/v1/videos/play_check', { video_id: program.episode.video.id })).body;

      const args = [
        '-loglevel', 'error',
        '-y',
        '-i', episode.playlist_url,
        '-vcodec', 'copy',
        '-acodec', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        output,
      ];

      return recorder.record(pid, output, args);
    })
    .catch(err => {
      if (err.response) {
        throw new Error(err.response.error.message); // network error
      } else {
        throw err; // other error
      }
    });
  }
}

module.exports = HibikiRadioFetcher;