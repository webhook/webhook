'use strict';

var fs    = require('fs');
var path  = require('path');
var archiver   = require('archiver');
var async = require('async');

require('colors');

var request  = require('request');
var winSpawn = require('win-spawn');
var wrench   = require('wrench');
var inquirer = require('inquirer');
var mime = require('mime');


module.exports = function () {

  // Set of basic configuration for this (Defaults)
  var config = {
    uploadUrl: 'http://server.webhook.com/upload/',
    siteName: ''
  };

  var zipFile = null;

  async.series([

    function(step) {

      if(!fs.existsSync('.firebase.conf'))
      {
        step('This command must be run from within a webhook directory');
        return;
      }

      var configFile = fs.readFileSync('.firebase.conf');
      var configJson = JSON.parse(configFile);
      config.siteName = configJson.siteName;
      config.token = configJson.secretKey;

      if(!config.siteName)
      {
        step('Missing site name from configuration file');
        return;
      }

      step();
    },

    function (step) {
      runInDir('grunt', '.', ['assets'], function() {
        step();
      });
    },

    function (step) {
      // Zip up repo
      zipFile = new archiver.create('zip');

      if(fs.existsSync('.push.zip'))
      {
        fs.unlinkSync('.push.zip');
      }

      var output = fs.createWriteStream('./.push.zip');
      zipFile.pipe(output);

      var alreadyAdded = {};


      if(fs.existsSync('.whdist')) {
        var distFiles = wrench.readdirSyncRecursive('.whdist');

        distFiles.forEach(function(file) {
          if(!fs.lstatSync('.whdist/' + file).isDirectory())
          {
            zipFile.file('.whdist/' + file, { name:  file });
            alreadyAdded[file] = true;
          }
        });
      }

      var files = wrench.readdirSyncRecursive('.');

      files.forEach(function(file) {
        // Make this an array, silly
        if(file.indexOf('node_modules') === 0 || file.indexOf('.build') === 0 || file.indexOf('.git') === 0
            || file === 'Gruntfile.js' || file.indexOf('libs') === 0 || file.indexOf('tasks') === 0
            || file.indexOf('options') === 0  || file === 'package.json' || file.indexOf('.whdist/') === 0 || file.indexOf('.push.zip') === 0)
        {
          return;
        }

        if(!fs.lstatSync(file).isDirectory() && !alreadyAdded[file])
        {
          zipFile.file(file, { name:  file });
         // console.log(file);
        }
      });

      zipFile.on('error', function(err) {
        throw err;
      });

      output.on('close', function() {
        // Remove Dist Here
        if(fs.existsSync('.whdist')) {
          wrench.rmdirSyncRecursive('.whdist');
        }
        step();
      });

      zipFile.finalize();
    },

    function (step) {
      // Upload to site

      process.stdout.write('\nUploading, this might take a minute.'.blue);
      var interval = setInterval(function() {
        process.stdout.write('.');
      }, 100);
      request({
          url: 'http://server.webhook.com/upload/',
          //url: 'http://localhost:3000/upload/',
          headers: {
              'content-type' : 'multipart/form-data'
          },
          method: 'POST',
          multipart: [{
              'Content-Disposition' : 'form-data; name="payload"; filename="' + path.basename('.push.zip') + '"',
              'Content-Type' : mime.lookup('.push.zip'),
              body: fs.readFileSync('.push.zip')
          },{
              'Content-Disposition' : 'form-data; name="site"',
              body: config.siteName
          },{
              'Content-Disposition' : 'form-data; name="token"',
              body: config.token
          }]
      },
      function(err, res, body){
        clearInterval(interval);
        body = JSON.parse(body);

        if(!body || body.error)
        {
          var error = body.error || 'Unkown error';
          console.log(error.red);
          process.exit(1);
        }

        console.log(body.message.green);
        step();
      });
    },

  ], function (err, result) {

    if(fs.existsSync('.push.zip'))
    {
      fs.unlinkSync('.push.zip');
    }

    if(err)
    {
      console.log(err.red);
      return;
    }

    console.log('\n========================================================'.blue);
    console.log('# Success. Your templates were deployed.'.blue);
    console.log('========================================================'.blue);
    console.log('# Find your site at '.blue + 'http://'.cyan + config.siteName.cyan + '.webhook.org'.cyan);
    console.log('# ---------------------------------------------------- #'.blue)

    process.exit(0);
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
