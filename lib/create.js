'use strict';

var fs    = require('fs');
var Zip   = require('adm-zip');
var async = require('async');

require('colors');

var request  = require('request');
var winSpawn = require('child_process').spawn;
var wrench   = require('wrench');
var inquirer = require('inquirer');
var firebaseLogin = require('./firebase-login');
console.warn = function() {};
var firebase = require('firebase');
var firebaseRoot = null;

function uniqueId() {
  return Date.now() + 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

var unescapeSite = function(site) {
  return site.replace(/,1/g, '.');
}

module.exports = function (options) {

  // Set of basic configuration for this (Defaults)
  var config = {
    baseGit: 'http://dump.webhook.com/static',
    siteName: options.siteName,
    siteToken: null,
    webhookUsername: options.email || '',
    webhookEscapedUsername: '',
    webhookPassword: '',
    firebaseName: options.firebase || 'webhook',
    firebaseToken: options.token || '',
  };

  firebaseLogin.setFirebaseName(config.firebaseName);

  firebaseRoot = new firebase('https://' + config.firebaseName + '.firebaseio.com/management');

  // Directory where git repository is unzipped
  var tmpFolder = '.wh-generate';

  printLogo();

  async.series([

    function(step) {

      if(config.firebaseToken) {
        config.webhookEscapedUsername = config.webhookUsername.replace(/\./g, ',1');
        step();
        return;
      }

      getUserLoginInformation('Webhook', function(username, password) {
        config.webhookUsername = username;
        config.webhookEscapedUsername = username.replace(/\./g, ',1');
        config.webhookPassword = password;
        step();
      });
    },

    function(step) {

      if(config.firebaseToken) {
        step();
        return;
      }

      firebaseLoginOrCreateUser(config, step);
    },

    function(step) {
      firebaseReserverSite(config, step);
    },

    function(step) {
      firebaseCreateSite(config, step);
    },

    function (step) {
      // Download the repo to temp folder
      downloadRepo(config, tmpFolder, function (error, gitFolder) {
        if (error) {
          console.log('No repository found at '.red + config.baseGit.blue);
          return process.exit(1);
        }

        step();

      });
    },

    function (step) {
      console.log('Installing project to folder...'.magenta);
      // Generates actual project
      generateProject(config, step);
    },

  ], function () {

    // Cleanup temporary folder
    wrench.rmdirSyncRecursive(tmpFolder);

    console.log('Running initialization...'.magenta);

    // Run first time initialization

    var dirName = config.siteName;

    if(config.firebase !== 'webhook') {
      dirName = unescapeSite(dirName);
    }

    runInDir(options.npm || 'npm', dirName, ['install'], function() {
      var params = ['init', '--copycms=true', '--sitename=' + config.siteName, '--secretkey=' + config.siteToken];

      if(options.firebase) {
        params.push('--firebase=' + config.firebaseName);
      }

      if(options.node && options.grunt) {
        params.unshift(options.grunt);
      }

      runInDir(options.node || 'grunt', dirName, params, function() {

        console.log('\n========================================================'.blue);
        console.log('# We just created a new site on your computer.         #'.blue);
        console.log('========================================================'.blue);
        console.log('#'.blue + ' Next step: Type '+ 'cd '.cyan + dirName.cyan + ' and then' + ' wh serve'.cyan + ''.blue)
        console.log('# ---------------------------------------------------- #'.blue)

        process.exit(0);
      });
    });

  });
};

/**
 * Downloads repository from github and stores in temporary folder
 * @param  {Object}    config     Configuration information
 * @param  {String}    tmpFolder  Temporary foler to save unzipped item into
 * @param  {Function}  callback   Called on completion
 */
function downloadRepo(config, tmpFolder, callback) {

  console.log('Downloading repo...'.magenta);

  // Keep track if the request fails to prevent the continuation of the install
  var requestFailed = false;

  var repoRequest = request(config.baseGit + '/generate-repo.zip');

  repoRequest
    .on('response', function (response) {
      // If we fail, set it as failing and remove zip file
      if (response.statusCode !== 200) {
        requestFailed = true;
        fs.unlinkSync('repo.zip');
        callback(true);
      }
    })
    .pipe(fs.createWriteStream('repo.zip'))
    .on('close', function () {
      if (requestFailed) return;

      console.log('Extracting Files...'.magenta);
      // Unzip into temporary file
      var zip = new Zip('repo.zip');
      zip.extractAllTo(tmpFolder);
      fs.unlinkSync('repo.zip');
      callback(null, tmpFolder + '/' + fs.readdirSync(tmpFolder)[0]);
    });
}

/**
 * Generates project from copied repository
 * @param  {Object}    config     Configuration information
 * @param  {String}    gitFolder  Temporary foler to save unzipped item into
 * @param  {Function}  callback   Called on completion
 */
function generateProject(config, callback) {
  var dirName = config.siteName;

  if(config.firebase !== 'webhook') {
    dirName = unescapeSite(dirName);
  }

  wrench.copyDirSyncRecursive('.wh-generate/', process.cwd() + '/' + dirName, {
      forceDelete: true
  });

  callback();
}

function printLogo() {
  var logo = '';
  logo = logo + '┬ ┬┌─┐┌┐ ┬ ┬┌─┐┌─┐┬┌─\n'
  logo = logo + '│││├┤ ├┴┐├─┤│ ││ │├┴┐\n'
  logo = logo + '└┴┘└─┘└─┘┴ ┴└─┘└─┘┴ ┴\n'
  logo = logo + 'Documentation at http://www.webhook.com/docs/\n'

  console.log('\nHowdy partner, welcome to...\n'.blue);
  console.log(logo)
  console.log('To begin log in or create a Webhook account below.\n'.green);
}

function firebaseLoginOrCreateUser(config, step) {

  var promptSecondPassword = function() {
    inquirer.prompt({
        type: 'password',
        name: 'password',
        message: 'Re-enter your password:',
      }, function(answer) {
        if(answer.password !== '' && answer.password === config.webhookPassword)
        {
          firebaseLogin.createUser(config.webhookUsername, config.webhookPassword, function(err, user) {
            if(err) {
              console.log(err.message);
              process.exit(1);
            }

            firebaseRoot.auth(user.token, function(err, success) {
              firebaseRoot.child('users/' + config.webhookUsername.replace(/\./g, ',1') + '/exists').set(true, function(err) {
                config.firebaseToken = user.token;
                var data = {
                  userid: user.email,
                  id: uniqueId()
                };

                firebaseRoot.child('commands/verification/' + user.email.replace(/\./g, ',1')).set(data, function(err) {
                  step();
                });
              });
            });

          });
        } else if (answer.password.trim() === '') {
          console.log('\n========================================================'.red);
          console.log('# No second password entered, please re-enter          #'.red);
          console.log('========================================================'.red);
          promptSecondPassword();
        } else {
          console.log('\n========================================================'.red);
          console.log('# Your passwords didn\'t match                         #'.red);
          console.log('========================================================'.red);
          console.log('# Happens to everyone. Why don\'t you give it another try.'.red);
          console.log('# ---------------------------------------------------- #'.red);
          process.exit(1);
        }
    });
  }

  firebaseLogin.login(config.webhookUsername, config.webhookPassword, function(err, user) {
    if(err && err.code === 'INVALID_USER')
    {
      if(config.webhookPassword === '') {
        console.log('\n========================================================'.red);
        console.log('# Account not created                                  #'.red);
        console.log('========================================================'.red);
        console.log('# You need to set a real password, it can\'t be empty'.red);
        console.log('# ---------------------------------------------------- #'.red);
      } else {
        console.log('To create an account, please type your password again.'.blue);
        promptSecondPassword();
      }
    } else if (err) {
      if(err.code && err.code === 'INVALID_PASSWORD') {
        console.log('\n========================================================'.red);
        console.log('# Password is incorrect                                #'.red);
        console.log('========================================================'.red);
        console.log('# Please doublecheck your records. You can change your password at:.'.red);
        console.log('# http://www.webhook.com/secret/password-reset/'.yellow);
        console.log('# ---------------------------------------------------- #'.red);
      } else {
        console.log(err.message.red);
      }

      process.exit(1);
    } else {
      config.firebaseToken = user.token;
      step();
    }
  });
};

function firebaseReserverSite(config, step) {
  firebaseRoot.auth(config.firebaseToken, function(error, auth) {
    if(error) {
      process.exit(2);
    }

    var data = {};
    data[config.webhookEscapedUsername] = config.webhookUsername;

    firebaseRoot.child('sites/'+ config.siteName).once('value', function(data) {
      data = data.val();
      if(data.key) {
        config.siteToken = data.key
      }

      if(!data.owners[config.webhookEscapedUsername]) {
        console.log('\n========================================================'.red);
        console.log('# The site '.red + config.siteName + ' is already taken'.red);
        console.log('========================================================'.red);
        console.log('# This name has already been taken by another user.'.red);
        console.log('# Please try a different one. Site names have nothing'.red);
        console.log('# to do with the domain you\'ll eventually use.'.red);
        console.log('# ---------------------------------------------------- #'.red);
        process.exit(3);
      }

      step();
    }, function(err) {
      if(err.code === 'PERMISSION_DENIED') // Either this doesn't exist yet or it does and we dont have access
      {
        firebaseRoot.child('sites/'+ config.siteName + '/owners').set(data, function(err, data) {
          if(err)
          {
            console.log('\n========================================================'.red);
            console.log('# The site '.red + config.siteName + ' is already taken'.red);
            console.log('========================================================'.red);
            console.log('# This name has already been taken by another user.'.red);
            console.log('# Please try a different one. Site names have nothing'.red);
            console.log('# to do with the domain you\'ll eventually use.'.red);
            console.log('# ---------------------------------------------------- #'.red);
            process.exit(3);
          }

          step();
        });
      } else {
        process.exit(1);
      }
    });
  });
};

function firebaseCreateSite(config, step) {
  if(config.siteToken)
  {
    console.log('Site information downloaded from webhook, creating project directory'.cyan);
    step();
  } else {
    console.log('Signaling webhook to create site'.green);
    var data = {
      userid: config.webhookUsername,
      sitename: config.siteName,
      id: uniqueId()
    }

    firebaseRoot.child('sites/' + config.siteName + '/error/').set(false, function(err, something) {
      firebaseRoot.child('commands/create/' + config.siteName).set(data, function(err, data) {
        if(err) {
          console.log(err.message.red);
          process.exit(1);
        }

        var listener = firebaseRoot.child('sites/' + config.siteName).on('value', function(data) {
          data = data.val();

          if(data.key)
          {
            config.siteToken = data.key;
            firebaseRoot.child('sites/' + config.siteName).off('value', listener);
            step();
          }

          if(data.error) {
            console.log('Unable to create '.red + config.siteName.red + '. Please make sure your site name is valid.'.red);
            process.exit(1);
          }

        }, function(error) {
          console.log(error.message.red);
          process.exit(1);
        });
      });
    });
  }
}

function getUserLoginInformation(service, callback) {
  var username = '';
  var password = '';

  inquirer.prompt({
    type: 'input',
    name: 'username',
    message: 'Enter your ' + service + ' email:',
  }, function (answer) {
    username = answer.username;

    function promptPassword(cb) {
      inquirer.prompt({
        type: 'password',
        name: 'password',
        message: 'Enter your ' + service +' password:',
      }, function (answer) {
        password = answer.password;
        if(password.trim() === '') {
          console.log('\n========================================================'.red);
          console.log('# No password entered, please re-enter                 #'.red);
          console.log('========================================================'.red);
          promptPassword(cb);
        } else {
          cb(password);
        }
      }); 
    }

    promptPassword(function(password) {
      callback(username, password)
    });
  });
}

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
