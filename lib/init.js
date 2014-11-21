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

var unescapeSite = function(site) {
  return site.replace(/,1/g, '.');
}


module.exports = function (options) {

  var config = {
    siteName: options.siteName,
    siteToken: null,
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
      firebaseRetrieveToken(config, step);
    },

  ], function () {

    // Cleanup temporary folder
    console.log('Running initialization...'.magenta);

    var runNpm = null;

    if(options.cache) {
      runNpm = function(cb) {
        runInDir(options.npm || 'npm', '.', ['config', 'get', 'cache'], true, function(diroutput) {
          var oldCacheDir = diroutput.trim();
          runInDir(options.npm || 'npm', '.', ['config', 'set', 'cache', options.cache], function() {
            runInDir(options.npm || 'npm', '.', ['install'], function() {
              runInDir(options.npm || 'npm', '.', ['config', 'set', 'cache', oldCacheDir], function() {
                cb();
              });
            });
          });
        });
      };
    } else {
      runNpm = function(cb) {
        runInDir(options.npm || 'npm', '.', ['install'], function() {
          cb();
        });
      }
    }

    runNpm(function()  {
      var params = ['init', '--copycms=true', '--sitename=' + config.siteName, '--secretkey=' + config.siteToken];
      if(options.firebase) {
        params.push('--firebase=' + options.firebase);
      }

      if(options.node && options.grunt) {
        params.unshift(options.grunt);
      }

      runInDir(options.node || 'grunt', '.', params, function() {

        console.log('Done installing, cd into your new directory and run wh serve to load the site'.green);

        process.exit(0);
      });
    });

  });
};

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

function firebaseRetrieveToken(config, step) {
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

function runInDir(command, cwd, args, pipe, callback) {

  if(typeof pipe === 'function') {
    callback = pipe;
    pipe = false;
  }
  var command = winSpawn(command, args, {
    stdio: [process.stdin, pipe ? 'pipe' : process.stdout, process.stderr],
    cwd: cwd
  });

  var output = '';

  if(pipe) {
    command.stdout.on('data', function (data) {
      output += data;
    });
  }

  command.on('error', function() {
    console.log('There was an error trying to run this command'.red);
    console.log('Please make sure you have node, npm, and grunt installed'.red);
  });

  command.on('close', function() {
    callback(output);
  });
};