'use strict';

var request = require('request');
var baseUrl = 'https://auth.firebase.com/auth/firebase';
var firebaseName = null;

module.exports.setFirebaseName = function(name) {
  firebaseName = name;
}

module.exports.createUser = function(username, password, callback) {
  // Validate the parameters

  request(baseUrl + '/create', { qs: { email: username, password: password, firebase: firebaseName }}, function(err, res, body) {
    try {
      var data = JSON.parse(body);

      if(data.error)
      {
        callback(data.error, null);
      } else {
        callback(null, data);
      }
    } catch (e) {
      callback({ code: 'PROBLEMS', message: 'Unable to authenticate, the login system may be experiencing problems.' }, null);
    }
  });

};

module.exports.removeUser = function(username, password) {
  // Validate the parameters

  request(baseUrl + '/remove', { qs: { email: username, password: password, firebase: firebaseName }}, function(err, res, body) {
    var data = JSON.parse(body);

    // IF ERROR, PROMPT ERROR IN CALLBACK
    // IF SUCCESS, CALL OTHER CALLBACK
  });

};

module.exports.login = function(username, password, callback) {
  // Validate the parameters

  request(baseUrl, { qs: { email: username, password: password, firebase: firebaseName }}, function(err, res, body) {
    try {
      var data = JSON.parse(body);

      if(data.error)
      {
        callback(data.error, null);
      } else {
        callback(null, data);
      }
    } catch (e) {
      callback({ code: 'PROBLEMS', message: 'Unable to authenticate, the login system may be experiencing problems.' }, null);
    }
  });
};