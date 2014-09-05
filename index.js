'use strict';

require('colors');
var program = require('commander');

module.exports = function (argv) {

  require('./lib/notifier.js')('v14', function() {
    program
      .version(require('./package.json').version)
      .option('-f, --firebase [firebasename]', 'Use the specified firebase instead of webhook main, for self hosting mode')
      .option('-s, --server [uploadserver]', 'Use this server when uploading files, for self hosting mode');


    program
      .command('create <siteName>')
      .description('Create a new webhook site')
      .action(function (siteName) {
        var siteName = siteName.toLowerCase();

        if(program.firebase) {
          siteName = siteName.replace(/\./g, ',1');
        }

        require('./lib/create.js')({
          siteName: siteName,
          firebase: program.firebase
        });
      });

    program
      .command('init <siteName>')
      .description('Initializes a site with configuration files')
      .action(function (siteName) {
        var siteName = siteName.toLowerCase();

        if(program.firebase) {
          siteName = siteName.replace(/\./g, ',1');
        }
        
        require('./lib/init.js')({
          siteName: siteName,
          firebase: program.firebase
        });
      });

    program
      .command('list-sites')
      .description('Lists all the sites that the user is an owner/user on')
      .action(function () {
        require('./lib/list-sites.js')({
          firebase: program.firebase
        });
      });

    program
      .command('preset-build')
      .description('Generates a preset-data.json file from a webhook directory')
      .action(function () {
        require('./lib/preset-build.js')(false, {
          firebase: program.firebase
        });
      });

    program
      .command('preset-build-all')
      .description('Generates a preset-data.json file from a webhook directory which includes data')
      .action(function () {
        require('./lib/preset-build.js')(true, {
          firebase: program.firebase
        });
      });

    program
      .command('update')
      .description('Updates a webhook site with the latest generate code')
      .action(function () {
        require('./lib/update.js')({
          firebase: program.firebase
        });
      });

    program
      .command('push')
      .description('Push webhook directory to server')
      .action(function () {
        require('./lib/push.js')({
          firebase: program.firebase,
          server: program.server
        });
      });
      
    program
      .command('deploy')
      .description('Push webhook directory to server')
      .action(function () {
        require('./lib/push.js')({
          firebase: program.firebase,
          server: program.server
        });
      });

    program
      .command('serve [port]')
      .description('Serves a webhook site locally')
      .action(function (port) {
        require('./lib/serve.js')({
          port: port || null,
          firebase: program.firebase
        });
      });
    
    program
      .parse(argv);

    if (!program.args.length) program.help();
  });
};
