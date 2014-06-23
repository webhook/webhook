'use strict';

var winSpawn = require('win-spawn');

module.exports = function (options) {

  var args = [];

  if(options.port) {
    args.push('--port=' + options.port);
  }

  runInDir('grunt', '.', args, function() {
  });
};

function runInDir(command, cwd, args, callback) {
  var command = winSpawn(command, args, {
    stdio: 'inherit',
    cwd: cwd
  });

  command.on('close', function() {
    callback();
  });
};
