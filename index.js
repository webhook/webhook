'use strict';

require('colors');
var program = require('commander');

module.exports = function (argv) {

  require('./lib/notifier.js')('v14', function() {
    program
      .version(require('./package.json').version);

    program
      .command('create <siteName>')
      .description('Create a new webhook site')
      .action(function (siteName) {
        require('./lib/create.js')({
          siteName: siteName.toLowerCase()
        });
      });

    program
      .command('init <siteName>')
      .description('Initializes a site with configuration files')
      .action(function (siteName) {
        require('./lib/init.js')({
          siteName: siteName.toLowerCase()
        });
      });

    program
      .command('list-sites')
      .description('Lists all the sites that the user is an owner/user on')
      .action(function () {
        require('./lib/list-sites.js')();
      });

    program
      .command('preset-build')
      .description('Generates a preset-data.json file from a webhook directory')
      .action(function () {
        require('./lib/preset-build.js')(false);
      });

    program
      .command('preset-build-all')
      .description('Generates a preset-data.json file from a webhook directory which includes data')
      .action(function () {
        require('./lib/preset-build.js')(true);
      });

    program
      .command('update')
      .description('Updates a webhook site with the latest generate code')
      .action(function () {
        require('./lib/update.js')();
      });

    program
      .command('push')
      .description('Push webhook directory to server')
      .action(function () {
        require('./lib/push.js')();
      });
      
    program
      .command('deploy')
      .description('Push webhook directory to server')
      .action(function () {
        require('./lib/push.js')();
      });

    program
      .command('serve [port]')
      .description('Serves a webhook site locally')
      .action(function (port) {
        require('./lib/serve.js')({
          port: port || null
        });
      });
    
    program
      .parse(argv);

    if (!program.args.length) program.help();
  });
};
