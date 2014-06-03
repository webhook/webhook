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
        console.log('#'.red + ' npm install -g wh');
        console.log('# ---------------------------------------------------- #\n'.red);
      }

      callback();
    } else {
      callback();
    }
  });
};
