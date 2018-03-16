const fs = require("fs");
const aws = require('aws-sdk');
const s3  = new aws.S3();

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
    throw new Error("impl fetch()!!!!");
  }
}

module.exports = Fetcher;