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
        fs.writeFileSync(output, res.body);
        console.timeEnd(timer_label);
      });
  }
}

module.exports = HttpGetRecorder;