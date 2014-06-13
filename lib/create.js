'use strict';

var fs    = require('fs');
var Zip   = require('adm-zip');
var async = require('async');

require('colors');

var request  = require('request');
var winSpawn = require('win-spawn');
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

module.exports = function (options) {

  // Set of basic configuration for this (Defaults)
  var config = {
    baseGit: 'http://dump.webhook.com/static',
    siteName: options.siteName,
    siteToken: null,
    webhookUsername: '',
    webhookEscapedUsername: '',
    webhookPassword: '',
    firebaseName: 'webhook',
    firebaseToken: '',
  };

  firebaseLogin.setFirebaseName(config.firebaseName);

  firebaseRoot = new firebase('https://' + config.firebaseName + '.firebaseio.com/management');

  // Directory where git repository is unzipped
  var tmpFolder = '.wh-generate';

  printLogo();

  async.series([

    function(step) {
      getUserLoginInformation('Webhook', function(username, password) {
        config.webhookUsername = username;
        config.webhookEscapedUsername = username.replace(/\./g, ',1');
        config.webhookPassword = password;
        step();
      });
    },

    function(step) {
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

    runInDir('npm', config.siteName, ['install'], function() {
      runInDir('grunt', config.siteName, ['init', '--copycms=true', '--sitename=' + config.siteName, '--secretkey=' + config.siteToken], function() {

        console.log('\n========================================================'.blue);
        console.log('# We just created a new site on your computer.         #'.blue);
        console.log('========================================================'.blue);
        console.log('#'.blue + ' Next step: Type '+ 'cd '.cyan + config.siteName.cyan + ' and then' + ' wh serve'.cyan + ''.blue)
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

  wrench.copyDirSyncRecursive('.wh-generate/', process.cwd() + '/' + config.siteName, {
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

  firebaseLogin.login(config.webhookUsername, config.webhookPassword, function(err, user) {

    if(err && err.code === 'INVALID_USER')
    {
      console.log('To create an account, please type your password again.'.blue);
      inquirer.prompt({
          type: 'password',
          name: 'password',
          message: 'Re-enter your password:',
        }, function(answer) {
          if(answer.password === config.webhookPassword)
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
          } else {
            console.log('\n========================================================'.red);
            console.log('# Password is incorrect                                     #'.red);
            console.log('========================================================'.red);
            console.log('# Please doublecheck your records. You can change your password at:.'.red);
            console.log('# http://www.webhook.com/secret/password-reset/'.yellow);
            console.log('# ---------------------------------------------------- #'.red);
            process.exit(1);
          }
        });
    } else if (err) {
      if(err.code && err.code === 'INVALID_PASSWORD') {
        console.log('\n========================================================'.red);
        console.log('# Password is incorrect                                     #'.red);
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
    var data = {};
    data[config.webhookEscapedUsername] = config.webhookUsername;

    firebaseRoot.child('sites/'+ config.siteName).once('value', function(data) {
      data = data.val();
      if(data.key) {
        config.siteToken = data.key
      }

      step();
    }, function(err) {
      if(err.code === 'PERMISSION_DENIED') // Either this doesn't exist yet or it does and we dont have access
      {
        firebaseRoot.child('sites/'+ config.siteName + '/owners').set(data, function(err, data) {
          if(err)
          {
            console.log('\n========================================================'.red);
            console.log('# You don\'t have permission'.red);
            console.log('========================================================'.red);
            console.log('# During Webhook\'s beta period only whitelisted emails'.red);
            console.log('# can create new sites. Alternatively this site name may'.red);
            console.log('# already be taken.'.red);
            console.log('# ---------------------------------------------------- #'.red);
            process.exit(1);
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

      }, function(error) {
        console.log(error.message.red);
        process.exit(1);
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
    message: 'Enter your email:',
  }, function (answer) {
    username = answer.username;

    inquirer.prompt({
      type: 'password',
      name: 'password',
      message: 'Set, or enter your password:',
    }, function (answer) {
      password = answer.password;

      callback(username, password);
    });
  });
}

function runInDir(command, cwd, args, callback) {
  var command = winSpawn(command, args, {
    stdio: 'inherit',
    cwd: cwd
  });

  command.on('close', function() {
    callback();
  });
};
