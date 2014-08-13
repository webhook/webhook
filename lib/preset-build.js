'use strict';

var fs    = require('fs');
var async = require('async');

require('colors');

console.warn = function() {};
var firebase = require('firebase');
var firebaseRoot = null;

module.exports = function (all, options) {

  // Set of basic configuration for this (Defaults)
  var config = {
    firebaseConfig: '.firebase.conf',
    firebaseName: options.firebase || 'webhook',
    confData: {},
    typeData: {},
    realData: {},
    settingsData: {},
  };

  firebaseRoot = new firebase('https://' + config.firebaseName + '.firebaseio.com/');

  async.series([

    function (step) {
      console.log('Reading Config'.green);
      if (!fs.existsSync('.firebase.conf')) {
        console.log('No webhook configuration found.'.red);
        console.log('This command must be run from inside of a webhook site directory'.red);
        process.exit(1);
      }

      var data = fs.readFileSync('.firebase.conf');
      config.confData = JSON.parse(data.toString());
      step();
    },

    function (step) {
      console.log('Downloading Data'.green);
      firebaseRoot.child('buckets/' + config.confData.siteName + '/' + config.confData.secretKey + '/dev/contentType').once('value', function(snap) {
        config.typeData = snap.val() || {};
        step();
      }, function(err) { step(); });
    },

    function(step) {
      if(all) {
        firebaseRoot.child('buckets/' + config.confData.siteName + '/' + config.confData.secretKey + '/dev/data').once('value', function(snap) {
          config.realData = snap.val() || {};
          firebaseRoot.child('buckets/' + config.confData.siteName + '/' + config.confData.secretKey + '/dev/settings').once('value', function(snap) {
            config.settingsData = snap.val() || {};
            step();
          }, function(err) { step(); });
        }, function(err) { step(); });
      } else {
        step();
      }
    },

  ], function () {
    console.log('Writing File'.green);

    if(!all) {
      var typeDataString = JSON.stringify(config.typeData, null, 2);
      fs.writeFileSync(".preset-data.json", typeDataString, {'flags': 'w+'});
    } else {
      var dataObj = {
        'data' : config.realData,
        'settings' : config.settingsData,
        'contentType': config.typeData
      };

      var dataString = JSON.stringify(dataObj, null, 2);
      fs.writeFileSync(".preset-data.json", dataString, {'flags': 'w+'});
    }
    process.exit(0);
  });
};
