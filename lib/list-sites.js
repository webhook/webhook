'use strict';

var async = require('async');

require('colors');

var read = require('read');

var firebaseLogin = require('./firebase-login');
console.warn = function() {};
var firebase = require('firebase');
var firebaseRoot = null;

module.exports = function (options) {

  var config = {
    webhookUsername: '',
    webhookEscapedUsername: '',
    webhookPassword: '',
    firebaseName: 'webhook',
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
      firebaseRoot.auth(config.firebaseToken, function() {
        step();
      });
    },

    function(step) {

      firebaseRoot.child('users/' + config.webhookEscapedUsername + '/sites').once('value', function(snap) {
        var ownedSites = [];
        var userSites = [];
        var val = snap.val();

        if(val.owners) {
          console.log('');
          console.log('The Webhook sites I\'m an owner of:'.green);
          for(var site in val.owners) {
            console.log(site);
          }
        }
        if(val.users) {
          console.log('');
          console.log('The Webhook sites I\'m a user of:'.blue);
          for(var site in val.users) {
            console.log(site);
          }
        }

        if(!val.users && !val.owners) {
          console.log('Not an owner or user for any site'.red);
        }
        step();
      });

    }

  ], function () {

    console.log('')
    process.exit(0);

  });
};

function firebaseLoginOrCreateUser(config, step) {

  firebaseLogin.login(config.webhookUsername, config.webhookPassword, function(err, user) {

    if(err && err.code === 'INVALID_USER')
    {
      console.log('User not found, if you would like to register that user please confirm your password'.red);
      read({
        prompt: '[?] Re-enter your password:',
        silent: true,
        replace: '*',
        input: process.stdin,
        output: process.stdout
      }, function(err, newpassword, isDefault) {
        if(newpassword === config.webhookPassword)
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

  read({ 
    prompt: '[?] Enter your email:',
    silent: false,
    input: process.stdin,
    output: process.stdout
  }, function(err, result, isDefault) {
    if(err) { 
      process.exit(0);
    } else {
      username = result;
    }

    read({
      prompt: '[?] Set, or enter your password:',
      silent: true,
      replace: '*',
      input: process.stdin,
      output: process.stdout
    }, function(err, result, isDefault) {
      if(err) {
        process.exit(0);
      } else {
        password = result;
      }

      callback(username, password);
    });
  });

}
