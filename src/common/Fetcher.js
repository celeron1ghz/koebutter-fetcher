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
      .catch(() => null);
      //.catch((err) => { console.log("ERR", err); return null });
  }

  publish(filename, content) {
    return s3.putObject({ Bucket: this.PublishBucket, Key: filename, Body: content }).promise();
  }

  fetch() {
    const self = this;
    debug("fetch.vo() GENERATE");

    return vo(function*(){
      debug("fetch.vo() START");
      const pid = self.programId;
      const clazz = self.constructor.name;

      // get program list
      if (!__PROGRAM_LIST_CACHE[clazz]) {
        debug("fetchProgramList()");
        __PROGRAM_LIST_CACHE[clazz] = yield self.fetchProgramList();
      }


      // pid exist check
      debug("filterProgram()");
      const matched = self.filterProgram(__PROGRAM_LIST_CACHE[clazz]);
      debug("filterProgram() ==>", matched[0]);

      if (matched.length === 0) {
        console.log(`SKIP: ID '${pid}' is not exist.`);
        debug("fetch.vo() RETURN_PID_NOT_EXIST");
        return null;
      }


      // recorded file exist check
      debug("getFilename()");
      const f = yield self.getFilename(matched[0]);
      const remoteInfoFile = f.remoteFile + ".json";
      debug("getFilename() ==>", f);

      debug("fileExists()");
      const exists = !!(yield self.fileExists(f.remoteFile));
      debug("fileExists() ==>", exists);

      if (exists) {
        console.log("EXISTS:", f.remoteFile);
        debug("fetch.vo() RETURN_ALREADY_EXISTS_FILE");
        return null;
      } else {
        console.log("NOT_EXIST:", f.remoteFile);
      }

      // recording...
      debug("getRecorder()");
      const recorder = yield self.getRecorder(f);
      debug("getRecorder() ==>", recorder);


      // put recorded file to s3...
      const stat = fs.statSync(f.localFile);

      if (stat.size < 1000000) {
        console.log("FAIL: Maybe fetch is fail. Please check!!! (size=" + stat.size + ')');
        debug("fetch.vo() RETURN_FETCH_FAIL");
        return null;
      }

      const stream = fs.createReadStream(f.localFile);
      console.log("PUT", f.remoteFile, stat.size);
      debug("S3_VIDEO_RET", yield self.publish(f.remoteFile, stream));

      const moniker = self.constructor.name.replace('Fetcher', '').toLowerCase();
      const decoded = JSON.stringify({ type: moniker, data: f.program });
      console.log("PUT", remoteInfoFile, decoded.length);
      debug("S3_INFO_RET",  yield self.publish(remoteInfoFile, decoded));
      debug("fetch.vo() LAST_LINE");
    })
    .catch(err => {
      if (err.response) {
        debug("fetch.vo() RETURN_ERROR_NETWORK");
        return Promise.reject(new Error(err.response.error.message)); // network error
      } else {
        debug("fetch.vo() RETURN_ERROR_UNKNOWN");
        return Promise.reject(err); // other error
      }
    });
  }
}

module.exports = Fetcher;