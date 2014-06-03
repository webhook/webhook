'use strict';

var winSpawn = require('win-spawn');

module.exports = function (options) {

  runInDir('grunt', '.', [], function() {
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
