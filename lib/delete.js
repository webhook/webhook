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

var unescapeSite = function(site) {
  return site.replace(/,1/g, '.');
}

module.exports = function (options) {

  // Set of basic configuration for this (Defaults)
  var config = {
    baseGit: 'http://dump.webhook.com/static',
    siteName: options.siteName,
    webhookUsername: options.email || '',
    webhookEscapedUsername: '',
    webhookPassword: '',
    firebaseName: options.firebase || 'webhook',
    firebaseToken: options.token || '',
  };

  if(options.node || options.npm) {
    winSpawn = require('child_process').spawn;
  }
  
  firebaseLogin.setFirebaseName(config.firebaseName);

  firebaseRoot = new firebase('https://' + config.firebaseName + '.firebaseio.com/management');

  // Directory where git repository is unzipped
  var tmpFolder = '.wh-generate';

  printLogo();

  async.series([

    function (step) {
      if(options.force === 'true') {
        step();
        return;
      }

      inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: 'This will fully remove your site from webhooks database. Proceed?'
      }, function(answer) {
        if(answer.confirm) {
          step();
        } else {
          process.exit(0);
        }
      });
    },

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
      var intial = true;
      firebaseRoot.auth(config.firebaseToken, function(error, auth) {
        firebaseRoot.child('sites/' + config.siteName).on('value', function(data) {
          var val = data.val();
          if(!val && intial) {
            console.log('Site does not exit.'.green);
            process.exit(0);
          }

          if(intial) {
            step();
            intial = false;
          }
        }, function(err) {
          if(intial) {
            console.log('\n========================================================'.red);
            console.log('# The site '.red + config.siteName + ' is not owned by you'.red);
            console.log('========================================================'.red);
            console.log('# You must be an owner on a site to delete it.'.red);
            console.log('# ---------------------------------------------------- #'.red);
            process.exit(1);
          } else {
            console.log('Site deleted from webhook.'.green);
            process.exit(0);
          }
        });
      });
    },

    function(step) {
      console.log('Requesting delete'.green);
      firebaseDeleteSite(config, step);
    },

  ], function () {

  });
};

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

function firebaseDeleteSite(config, step) {
  firebaseRoot.auth(config.firebaseToken, function(error, auth) {
    if(error) {
      process.exit(2);
    }

    var data = {
      sitename: config.siteName,
      userid: config.webhookUsername,
      id: uniqueId(),
    };

    firebaseRoot.child('commands/delete/' + config.siteName).set(data, function(error) {
      if(error && error.code === 'PERMISSION_DENIED') // Either this doesn't exist yet or it does and we dont have access
      {
        console.log('\n========================================================'.red);
        console.log('# The site '.red + config.siteName + ' is not owned by you'.red);
        console.log('========================================================'.red);
        console.log('# You must be an owner on a site to delete it.'.red);
        console.log('# ---------------------------------------------------- #'.red);
        process.exit(1);
      } else {
        step();
      }
    });
  });
};

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
};