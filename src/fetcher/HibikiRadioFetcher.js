const fs = require("fs");
const vo = require('vo');
const tempy = require('tempy');
const request = require('superagent');
const { sprintf } = require("sprintf-js");
const debug = require('debug')('koebutter');

const aws = require('aws-sdk');
const s3  = new aws.S3();

const recorder = require('../recorder/FfmpegRecorder');

class HibikiRadioFetcher {
  constructor(args) {
    if (!args.programId) { throw new Error("programId not specified") }
    this.programId = args.programId;
  }

  _api_call(url, param) {
    return request.get(url, param)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Origin', 'http://hibiki-radio.jp');
  }

  fileExists(filename) {
    return s3.headObject({ Bucket: 'koebutter-fetcher', Key: filename })
      .promise()
      .catch(() => null);
  }

  publish(filename, tempfile) {
    console.log("PUT", filename);
    const file = fs.createReadStream(tempfile);
    return s3.putObject({ Bucket: 'koebutter-fetcher', Key: filename, Body: file }).promise();
  }


  fetch() {
    const self = this;

    return vo(function*(){
      const pid = self.programId;

      debug("FETCH_PROGRAM_LIST:", pid);
      const programs = (yield self._api_call('https://vcms-api.hibiki-radio.jp/api/v1//programs')).body;
      const matched = programs.filter(p => p.access_id === pid);

      if (matched.length === 0) {
        console.log(`ID '${pid}' is not exist. skipping...`);
        return;
      }

      debug("FETCH_PROGRAM_INFO:", pid);
      const program = (yield self._api_call('https://vcms-api.hibiki-radio.jp/api/v1/programs/' + pid)).body;

      const m          = program.episode.name.match(/\d+/);
      const ep_no      = sprintf("%03d", m ? m[0] : 0);
      const basename   = pid + ep_no + '.mp4';
      const localFile  = tempy.file({ name: basename });
      const remoteFile = `${pid}/${basename}`;
      console.log(`RESOLVE: ${pid} ==> ${program.name}[${ep_no}] (id=${program.episode.id})`);

      const elpased = program.day_of_week - new Date().getUTCDay();

      // don't fetch after 2 day
      if (elpased !== 0 && elpased !== -1) {
        console.log("out of date.");
        return;
      }

      if (yield self.fileExists(remoteFile)) {
        console.log("file already recorded.");
        return;
      }

      debug("FETCH_EPISODE_INFO:", pid);
      const episode = (yield self._api_call('https://vcms-api.hibiki-radio.jp/api/v1/videos/play_check', { video_id: program.episode.video.id })).body;

      const args = [
        '-loglevel', 'error',
        '-y',
        '-i', episode.playlist_url,
        '-vcodec', 'copy',
        '-acodec', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        localFile,
      ];

      debug("RECORDER_RET", yield recorder.record(pid, localFile, args));
      debug("S3_VIDEO_RET", yield self.publish(remoteFile, localFile));
      debug("S3_INFO_RET",  yield s3.putObject({
        Bucket: 'koebutter-fetcher',
        Key: remoteFile + ".json",
        Body: JSON.stringify(program)
      }).promise());
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