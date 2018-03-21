const debug = require('debug')('koebutter.fetcher.onsen');
const tempy = require('tempy');
const request = require('superagent');
const { sprintf } = require("sprintf-js");

const xml2js = require('xml2js');
const parser = new xml2js.Parser({explicitArray : false});

const Fetcher = require('../common/Fetcher');
const Recorder = require('../recorder/HttpGetRecorder');

const transform = (data) => new Promise((resolve,reject) => {
  parser.parseString(data, (err,data) => {
    if (err) { reject(err) } else { resolve(data) }
  });
});


class OnsenFetcher extends Fetcher {
  constructor(args) {
    super();
    if (!args.programId) { throw new Error("programId not specified") }
    this.programId = args.programId;
  }

  fetchProgramList() {
    const pid = this.programId;
    debug("FETCH_PROGRAM_LIST:", pid);
    return request('http://www.onsen.ag/app/programs.xml')
      .then(data => transform(data.text))
      .then(data => data.programs.program);
  }

  filterProgram(list) {
    const pid = this.programId;
    return list.filter(p => p.$.id === pid);
  }

  getFilename(program) {
    const pid = this.programId;
    const basename = sprintf("%s%03d.mp4", pid, program.program_number);

    console.log(`RESOLVE: ${pid} ==> ${program.title} (file=${basename})`);

    return {
      program,
      basename,
      remoteFile: `onsen/${pid}/${basename}`,
      localFile: tempy.file({ name: basename }),
    };
  }

  getRecorder(f) {
    const pid = this.programId;
    const { program, localFile } = f;
    return Recorder.record(pid, localFile, program.movie_url);
  }
}

module.exports = OnsenFetcher;