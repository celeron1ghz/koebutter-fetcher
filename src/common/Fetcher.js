const debug = require('debug')('koebutter.fetcher');
const fs = require("fs");
const vo = require('vo');
const aws = require('aws-sdk');
const s3  = new aws.S3();

const __PROGRAM_LIST_CACHE = {};

class Fetcher {
  constructor(args) {
    this.PublishBucket = 'koebutter-fetcher';
  }

  fileExists(filename) {
    return s3.headObject({ Bucket: this.PublishBucket, Key: filename })
      .promise()
      .catch((err) => { console.log("ERR", err); return null });
  }

  publish(filename, content) {
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
      const matched = self.filter_program(__PROGRAM_LIST_CACHE[clazz]);

      if (matched.length === 0) {
        console.log(`SKIP: ID '${pid}' is not exist.`);
        return;
      }


      // recorded file exist check
      const f = yield self.get_filename(matched[0]);
      const remoteInfoFile = f.remoteFile + ".json";

      if (yield self.fileExists(f.remoteFile)) {
        console.log("EXISTS:", f.remoteFile);
        return;
      } else {
        console.log("NOT_EXIST:", f.remoteFile);
      }


      // recording...
      const recorder = yield self.get_recorder(f);
      debug("RECORDER_RET", recorder);


      // put recorded file to s3...
      const stream = fs.createReadStream(f.localFile);
      console.log("PUT", f.remoteFile, fs.statSync(f.localFile).size);
      debug("S3_VIDEO_RET", yield self.publish(f.remoteFile, stream));

      const moniker = self.constructor.name.replace('Fetcher', '').toLowerCase();
      const decoded = JSON.stringify({ type: moniker, data: f.program });
      console.log("PUT", remoteInfoFile, decoded.length);
      debug("S3_INFO_RET",  yield self.publish(remoteInfoFile, decoded));
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