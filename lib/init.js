'use strict';

var async = require('async');

require('colors');

var winSpawn = require('win-spawn');
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

  var config = {
    siteName: options.siteName,
    siteToken: null,
    webhookUsername: '',
    webhookEscapedUsername: '',
    webhookPassword: '',
    firebaseName: options.firebase || 'webhook',
    firebaseToken: '',
  };

  firebaseLogin.setFirebaseName(config.firebaseName);

  firebaseRoot = new firebase('https://' + config.firebaseName + '.firebaseio.com/management');

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
      firebaseRetrieveToken(config, step);
    },

  ], function () {

    // Cleanup temporary folder
    console.log('Running initialization...'.magenta);

    // Run first time initialization
    runInDir('npm', '.', ['install'], function() {  
      runInDir('grunt', '.', ['init', '--copycms=true', '--sitename=' + config.siteName, '--secretkey=' + config.siteToken], function() {

        console.log('Done installing, cd into your new directory and run wh serve to load the site'.green);

        process.exit(0);
      });
    });

  });
};

function firebaseLoginOrCreateUser(config, step) {

  firebaseLogin.login(config.webhookUsername, config.webhookPassword, function(err, user) {

    if(err && err.code === 'INVALID_USER')
    {
      console.log('User not found, if you would like to register that user please confirm your password'.red);
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
            console.log('Passwords do not match, must match'.red);
            process.exit(1);
          }
        });
    } else if (err) {
      console.log(err.message.red);
      process.exit(1);
    } else {
      config.firebaseToken = user.token;
      step();
    }
  });
};

function firebaseRetrieveToken(config, step) {
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
        console.log('This site does not exist or you do not have permissions'.red);
        process.exit(1);
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

    inquirer.prompt({
      type: 'password',
      name: 'password',
      message: 'Enter your ' + service +' password:',
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

  command.on('error', function() {
    console.log('There was an error trying to run this command'.red);
    console.log('Please make sure you have node, npm, and grunt installed'.red);
  });

  command.on('close', function() {
    callback();
  });
};
