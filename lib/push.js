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

const CONFIG_FILE_PATH = 'webhookconfig.json'


module.exports = function (options) {

  // Set of basic configuration for this (Defaults)
  var config = {
    uploadUrl: 'http://server.webhook.com/upload/',
    siteName: ''
  };

  if(options.node || options.npm) {
    winSpawn = require('child_process').spawn;
  }

  var custom = false;

  if(options.server) {
    custom = true;

    if(options.server.indexOf('http://') === 0) {
      options.server = options.server.replace('http://');
    }

    config.uploadUrl = 'http://' + options.server  + '/upload/';
  }

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

    function(step) {

      var params = ['build', '--strict=true'];

      if(options.node && options.grunt) {
        params.unshift(options.grunt);
      }

      runInDir(options.node || 'grunt', '.', params, function(err) {
        if(err) {
          console.log('\n========================================================'.red);
          console.log('# Deploy halted. Templates not pushed.'.red);
          console.log('========================================================'.red);
          console.log('# There was an error in your build and we don\'t want to'.red);
          console.log('# deploy it to your live version. Please check over your'.red);
          console.log('# templates before trying to deploy again.'.red);
          console.log('# ---------------------------------------------------- #'.red)
          process.exit(3);
        } else {
          step();
        }
      });
    },

    function (step) {
      var params = ['assets'];

      if(options.node && options.grunt) {
        params.unshift(options.grunt);
      }

      runInDir(options.node || 'grunt', '.', params, function() {
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
      var excludedPaths = ['.build', '.git', '.whdist', '.push.zip'];
      if (!custom)
      {
        excludedPaths = excludedPaths.concat('package.json', 'node_modules', 'Gruntfile.js', 'libs', 'tasks', 'options');
      }

      if (fs.existsSync(CONFIG_FILE_PATH)) {
        var raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
        if (raw.length !== 0) {
          var contents;
          try {
            contents = JSON.parse(raw);
          } catch(err) {
            console.log('Unable to parse '.red + CONFIG_FILE_PATH.red + ' as JSON'.red);
          }
          if (contents && contents.pathsToExclude) {
            excludedPaths = excludedPaths.concat(contents.pathsToExclude);
          }
        }
      }

      files.forEach(function(file) {
        for(var i in excludedPaths)
        {
          if(file.indexOf(excludedPaths[i]) === 0)
          {
            return;
          }
        }

        if(!fs.lstatSync(file).isDirectory() && !alreadyAdded[file])
        {
          zipFile.file(file, { name:  file });
        }

        if(!fs.lstatSync(file).isDirectory() && alreadyAdded[file]) {
          zipFile.file(file, { name: '.wh-original/' + file });
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
          url: config.uploadUrl,
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
          var error = body.error || 'Unknown error';
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

    if(!custom) {
      console.log('# Find your site at '.blue + 'http://'.cyan + config.siteName.cyan + '.webhook.org'.cyan);
      console.log('# ---------------------------------------------------- #'.blue)
    }

    process.exit(0);
  });
};


function runInDir(command, cwd, args, callback) {
  var spawnedCommand = winSpawn(command, args, {
    stdio: 'inherit',
    cwd: cwd
  });

  spawnedCommand.on('error', function() {
    console.log('There was an error trying to run this command'.red);
    console.log('Please make sure you have grunt installed'.red);
  });

  spawnedCommand.on('close', function(exit, signal) {

    if(exit === 0) {
      callback(null);
    } else {
      callback(exit);
    }

  });
}
