const _ = require('lodash');
const vo = require('vo');
const aws = require('aws-sdk');
const ssm = new aws.SSM();
const s3  = new aws.S3();
const Podcast = require('podcast');

const HOST   = 'https://kb.camelon.info/';
const BUCKET = 'koebutter-fetcher';

module.exports.feed = (event, context, callback) => {
  vo(function*(){
    const files = yield s3.listObjectsV2({ Bucket: BUCKET })
      .promise()
      .then(data => data.Contents.filter(f => f.Key.match(/mp4$/)));

    const genred = {};

    for (const file of files) {
      const p = file.Key.split('/')[1];
      if (!genred[p]) { genred[p] = [] }
      genred[p].push(file);
    }

    const keyId   = (yield ssm.getParameter({ Name: '/cloudfront/key_pair_id', WithDecryption: true }).promise() ).Parameter.Value;
    const secret  = (yield ssm.getParameter({ Name: '/cloudfront/private_key', WithDecryption: true }).promise() ).Parameter.Value;
    const sign    = new aws.CloudFront.Signer(keyId, secret);
    const expires = Math.floor(new Date().getTime() / 1000) + 3600;
    const rssFiles = [];

    // generate each rss
    for (const programs of _.values(genred)) {
      const feeds = [];

      for (const meta of programs) {
        const ret = yield s3.getObject({ Bucket: BUCKET, Key: meta.Key + '.json' }).promise();
        const info = JSON.parse(ret.Body.toString());
        const { type, data } = info;

        const url       = HOST + meta.Key;
        const signedUrl = sign.getSignedUrl({ url: url, expires: expires });


        if (type === "onsen") {
          feeds.push({
            id:            data.$.id,
            title:         `${data.title}`,
            description:   `${data.title} (${data.program_number})`,
            date:          data.up_date,
            enclosure :    { url: signedUrl, size: meta.Size },
            itunesImage:   'http://www.onsen.ag' + data.banner_image,
            itunesEpisode: data.program_number,
          });
        }

        if (type === "hibikiradio") {
          const epno = data.episode.name.match(/\d+/)[0];

          feeds.push({
            id:            data.access_id,
            title:         `${data.name}`,
            description:   data.description,
            date:          data.episode_updated_at,
            url:           url,
            enclosure :    { url: signedUrl, size: meta.Size },
            itunesImage:   data.sp_image_url,
            itunesEpisode: epno,
          });
        }
      }

      const latest = feeds[0];
      rssFiles.push(latest);

      const feed = new Podcast({
        title: `[KB] ${latest.title}`,
        description: latest.title,
        image_url: latest.itunesImage,
        language: 'ja',
      });

      for (const f of feeds) {
        feed.addItem(f);
      }

      const feedKey = `feed/${latest.id}.rss`;
      const body = feed.buildXml(true);
      console.log("PUT", feedKey, body.length);
      yield s3.putObject({ Bucket: BUCKET, Key: feedKey, Body: body }).promise();
    }


    // generate index page
    const page = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no" />
    <meta name="theme-color" content="#000000">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">
    <title>Koebutter</title>
    <script src="https://code.jquery.com/jquery-2.1.4.min.js"></script>
    <script src="https://cdn.jsdelivr.net/clipboard.js/1.5.3/clipboard.min.js"></script>
    <script>
        $(function () {
          var clipboard = new Clipboard('.btn');
          clipboard.on('success', function(e) {
            alert("クリップボードにコピーしたのでPodcastに貼り付けろ！！！！！");
            e.clearSelection();
          });
          clipboard.on('error', function(e) {
            alert("コピペが対応していないみたいなので下のテキストボックスからがんばってコピーして。")
          });
        });
    </script>
  </head>
  <body>
  <div class="container">
    <br/>
    <div class="alert alert-warning">番組に対応したURLをコピーして「URLから追加」みたいなメニューから追加してください。</div>
    <div class="list-group">
    ${rssFiles.map(f => {
      const url = `${HOST}feed/${f.id}.rss`;
      const signed = sign.getSignedUrl({ url: url, expires: expires });
      return `
        <div class="list-group-item">
          <h4 class="list-group-item-heading">${f.title} <a class="btn btn-primary" data-clipboard-text="${signed}">Copy!!</a></h4>
          <p class="list-group-item-text"><textarea class="form-control" rows="10" style="font-family:monospace" readonly>${signed}</textarea></p>
        </div>
      `;
    }).join("")}
    </div>
  </div>
  </body>
</html>
    `;
    yield s3.putObject({ Bucket: BUCKET, Key: 'index.html', Body: page, ContentType: 'text/html' }).promise();

    console.log( sign.getSignedUrl({ url: HOST + 'index.html', expires: expires }) );

    callback(null, "OK");
  })
  .catch(err => {
    console.log("Uncaught error:", err);
    callback(err);
  });
};