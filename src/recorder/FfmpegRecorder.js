const fs = require("fs");
const debug = require('debug')('koebutter');
const { spawn } = require('child_process');

const ffmpeg_bin = './ffmpeg';

class FfmpegRecorder {
  static record(pid, output, args) {
    debug("FETCH:", ffmpeg_bin, ...args);

    const child = spawn(ffmpeg_bin, args);
    console.log("Recorder invoked. wait a moment...");

    const timer_label = 'hibiki_recorder_' + pid;
    console.time(timer_label);

    return new Promise((resolve,reject) => {
      const id = setInterval(() => {
        try {
          const stats = fs.statSync(output);
          debug("  size =", stats.size);
        } catch (e) {
          debug("  file not created yet...");
        }
      },5000);

      child.on('exit', function(code, sig) {
        console.timeEnd(timer_label);

        clearInterval(id);
        const stats = fs.statSync(output);

        debug(`CHILD_EXIT_STATUS=${code}`);
        debug(`CHILD_EXIT_SIGNAL=${sig}`);
        debug(`FILE_SIZE=${stats.size}`);
        debug(`FILE_NAME=${output}`);

        console.log("File output to", output, " size =", stats.size);
        resolve(output);
      });
    });
  }
}

module.exports = FfmpegRecorder;