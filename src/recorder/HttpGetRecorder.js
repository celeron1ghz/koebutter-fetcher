const fs = require("fs");
const debug = require('debug')('koebutter.recorder.http');

const request = require('superagent');

class HttpGetRecorder {
  static record(pid, output, url) {
    const timer_label = 'hibiki_recorder_' + pid;
    console.time(timer_label);

    debug("FETCH", url);
    return request.get(url)
      .buffer()
      .then(res => {
        const body = res.text ? res.text : res.body;
        console.log("STATUS:", "CODE=" + res.status, "BODY=" + body.length);
        fs.writeFileSync(output, body);
        console.timeEnd(timer_label);
      });
  }
}

module.exports = HttpGetRecorder;