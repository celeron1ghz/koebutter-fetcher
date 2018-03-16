const debug = require('debug')('koebutter.fetcher');
const fs = require("fs");
const vo = require('vo');
const aws = require('aws-sdk');
const s3  = new aws.S3();

const Recorder = require('../recorder/FfmpegRecorder');

const __PROGRAM_LIST_CACHE = {};

class Fetcher {
  constructor(args) {
    this.PublishBucket = 'koebutter-fetcher';
  }

  fileExists(filename) {
    return s3.headObject({ Bucket: this.PublishBucket, Key: filename })
      .promise()
      .catch(() => null);
  }

  publish(filename, content) {
    console.log("PUT", filename);
    return s3.putObject({ Bucket: this.PublishBucket, Key: filename, Body: content }).promise();
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
      debug("RECORDER_RET", yield Recorder.record(pid, f.localFile, param));


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

module.exports = Fetcher;