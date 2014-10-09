'use strict';

var winSpawn = require('win-spawn');

module.exports = function (options) {

  var args = [];

  if(options.port) {
    args.push('--port=' + options.port);
  }


  if(options.node && options.grunt) {
    winSpawn = require('child_process').spawn;
    args.unshift(options.grunt);
  }

  if(options.node) {
    args.push('--nodebin=' + options.node);
  }

  if(options.grunt) {
    args.push('--gruntbin=' + options.grunt);
  }

  if(options.npm) {
    args.push('--npmbin=' + options.npm);
  }

  if(options.token) {
    args.push('--token=' + options.token);
  }

  if(options.email) {
    args.push('--email=' + options.email);
  }

  runInDir(options.node || 'grunt', '.', args, function() {
  });
};

function runInDir(command, cwd, args, callback) {
  var command = winSpawn(command, args, {
    stdio: 'inherit',
    cwd: cwd
  });

  command.on('error', function() {
    console.log('There was an error trying to run this command'.red);
    console.log('Please make sure you have grunt installed'.red);
  });

  command.on('close', function() {
    callback();
  });
};
