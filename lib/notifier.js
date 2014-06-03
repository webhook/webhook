'use strict';

var fs  = require('fs');

require('colors');

console.warn = function() {};
var request = require('request');
var firebaseRoot = null;

module.exports = function (version, callback) {

  // Set of basic configuration for this (Defaults)
  var config = {
    firebaseName: 'webhook',
  };

  firebaseRoot = 'https://' + config.firebaseName + '.firebaseio.com/install_version.json';

  request({ url : firebaseRoot, json: true }, function(e, r, body) {
    if(body) {
      if(body !== version) {
        console.log('========================================================'.red);
        console.log('# Your Webhook command line tools are out of date.     #'.red);
        console.log('========================================================'.red);
        console.log('#'.red + ' Update by running:');
        console.log('#'.red + ' npm install -g http://dump.webhook.com/static/install-repo.tar.gz')
        console.log('# ---------------------------------------------------- #\n'.red)
      }

      callback();
    } else {
      callback();
    }
  });
 /* var timedOut = false;
  var timeout = setTimeout(function() {
    timedOut = true;
    callback();
  }, 10000);

  firebaseRoot.once('value', function(snap) {

    clearTimeout(timeout);
    if(timedOut) {
      return;
    }

    if(snap.val() !== version) {
      console.log('You are using an old version of the Webhook Command Line Tools'.red)
      console.log('Please re-install them by running \'npm install -g http://dump.webhook.com/static/install-repo.tar.gz\''.red)
    }

    callback();
  });*/
};
