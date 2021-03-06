'use strict';

const aws = require('aws-sdk');
const s3 = new aws.S3();
const zlib = require('zlib');

module.exports.log = (event, context, callback) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;

  s3.getObject({ Bucket: bucket, Key: key }).promise()
    .then(data =>
      new Promise((resolve,reject) =>
        zlib.gunzip(data.Body, (err, res) => {
          if (err) { reject(err) } else { resolve(res) }
        })
      )
    )
    .then(data => {
      const lines = data.toString()
        .split("\n")
        .filter(l => !l.match(/^#/))
        .filter(l => !l.match(/^\s*$/));

      for (const line of lines) {
        const s = line.split("\t");
        console.log(s[0], s[1], s[7], s[8]);
      }
      callback(null,"OK");
    })
    .catch(err => {
      console.log("Uncaught error:", err);
      callback(err);
    });
};
