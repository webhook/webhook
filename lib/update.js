'use strict';

var fs    = require('fs');
var Zip   = require('adm-zip');
var async = require('async');

require('colors');

var request  = require('request');
var winSpawn = require('win-spawn');
var inquirer = require('inquirer');
var wrench = require('wrench');
var _ = require('lodash');

console.warn = function() {};

module.exports = function (options) {

  // Set of basic configuration for this (Defaults)
  var config = {
    baseGit: 'http://dump.webhook.com/static',
  };
  var site = '';
  var key = '';
  
  if(options.node || options.npm) {
    winSpawn = require('child_process').spawn;
  }

  async.series([

    function (step) {
      if(options.force === 'true') {
        step();
        return;
      }

      inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: 'This may modify your package.json file. Proceed?'
      }, function(answer) {
        if(answer.confirm) {
          step();
        } else {
          process.exit(0);
        }
      });
    },

    function (step) {
      var json = JSON.parse(fs.readFileSync('.firebase.conf'));
      site = json.siteName;
      key = json.secretKey;
      step();
    },

    function (step) {
      // Download the repo to temp folder
      downloadUpdateRepo(config, function (error, zipFile) {
        if (error) {
          console.log('No repository found at '.red + config.baseGit.blue);
          return process.exit(1);
        }

        // Extract files here
        var zip = new Zip(zipFile);

        console.log('Extracting...'.magenta);

        if(fs.existsSync('node_modules')) {
          wrench.rmdirSyncRecursive('node_modules');
        }

        zip.getEntries().forEach(function(entry) {
          var name = entry.entryName;

          if(name.indexOf('libs/') === 0 || name.indexOf('options/') === 0 || name.indexOf('tasks/') === 0 ) {
             zip.extractEntryTo(entry.entryName, '.', true, true);
          }

          if(name.indexOf('package.json') === 0) {
             zip.extractEntryTo(entry.entryName, '.wh-temp', true, true);
          }
        });

        fs.unlinkSync(zipFile);

        var packageJson = JSON.parse(fs.readFileSync('package.json'));
        var updatedPackageJson = JSON.parse(fs.readFileSync('.wh-temp/package.json'));

        var depends = packageJson.dependencies;
        var updatedDepends = updatedPackageJson.dependencies;

        _.assign(depends, updatedDepends);

        packageJson.dependencies = depends;

        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, "  "));

        runInDir(options.npm || 'npm', '.', ['install'], function() {
          var params = ['init', '--sitename=' + site, '--secretkey=' + key];
          if(options.firebase) {
            params.push('--firebase=' + options.firebase);
          }

          if(options.node && options.grunt) {
            params.unshift(options.grunt);
          }

          runInDir(options.node || 'grunt', '.', params, function() {
            fs.unlinkSync('.wh-temp/package.json');
            fs.rmdirSync('.wh-temp');
            step();
          });
        });
      });
    },

  ], function () {

    console.log('========================================================'.blue);
    console.log('# Update complete                                      #'.blue);
    console.log('========================================================'.blue);
    console.log('#'.blue + ' We updated your local copy.');
    console.log('#'.blue + ' Run ' + 'wh deploy'.cyan + ' to deploy your changes live.')
    console.log('# ---------------------------------------------------- #\n'.blue)
    process.exit(0);

  });
};

function runInDir(command, cwd, args, callback) {
  var command = winSpawn(command, args, {
    stdio: 'inherit',
    cwd: cwd
  });

  command.on('error', function() {
    console.log('There was an error trying to run this command'.red);
    console.log('Please make sure you have node, npm, and grunt installed'.red);
  });

  command.on('close', function() {
    callback();
  });
};

/**
 * Downloads repository from github and stores in temporary folder
 * @param  {Object}    config     Configuration information
 * @param  {Function}  callback   Called on completion
 */
function downloadUpdateRepo(config, callback) {

  console.log('Downloading repo...'.magenta);

  // Keep track if the request fails to prevent the continuation of the install
  var requestFailed = false;

  // TODO: have this hit different templating repos
  var repoRequest = request(config.baseGit + '/generate-repo.zip');

  repoRequest
    .on('response', function (response) {
      // If we fail, set it as failing and remove zip file
      if (response.statusCode !== 200) {
        requestFailed = true;
        fs.unlinkSync('.generate-repo.zip');
        callback(true);
      }
    })
    .pipe(fs.createWriteStream('.generate-repo.zip'))
    .on('close', function () {
      if (requestFailed) return;

      callback(null, '.generate-repo.zip');
    });
}
