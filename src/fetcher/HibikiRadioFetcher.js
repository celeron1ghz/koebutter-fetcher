const fs = require("fs");
const vo = require('vo');
const tempy = require('tempy');
const request = require('superagent');
const { sprintf } = require("sprintf-js");
const debug = require('debug')('koebutter.fetcher.hibiki');

const Fetcher = require('../common/Fetcher');
const recorder = require('../recorder/FfmpegRecorder');

const __PROGRAM_LIST_CACHE = {};

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
      ])
  }

  fetch() {
    const self = this;

    return vo(function*(){
      const pid = self.programId;
      const clazz = self.constructor.name;

      // get program list
      if (!__PROGRAM_LIST_CACHE[clazz]) {
        __PROGRAM_LIST_CACHE[clazz] = yield self.fetch_program_list();
      }


      // pid exist check
      const matched = __PROGRAM_LIST_CACHE[clazz].filter(p => p.access_id === pid);

      if (matched.length === 0) {
        console.log(`SKIP: ID '${pid}' is not exist.`);
        return;
      }


      // recorded file exist check
      const f = yield self.get_filename(matched[0]);

      if (yield self.fileExists(f.remoteFile)) {
        console.log("file already recorded.");
        return;
      }


      // recording...
      const param = yield self.get_recorder_params(f);
      debug("RECORDER_RET", yield recorder.record(pid, f.localFile, param));


      // put recorded file to s3...
      const stream = fs.createReadStream(f.localFile);
      debug("S3_VIDEO_RET", yield self.publish(f.remoteFile, stream));
      debug("S3_INFO_RET",  yield self.publish(f.remoteFile + ".json", JSON.stringify(f.program)));
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