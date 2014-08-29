# Webhook repositories

This repository is for the Webhook command line tools. We are currently in the process of open sourcing the entirely of Webhook which is split over a few repos. The goal is to have them available by late August.

* [webhook-generate](https://github.com/webhook/webhook-generate) - The local runserver for Webhook.
* [webhook-js](https://github.com/webhook/webhook-js) - A collection of jQuery utils for Webhook.
* [webhook-cms]([webhook-js](https://github.com/webhook/webhook-cms)) - The CMS layer and frotend GUI. A single page Ember app.
* webhook-server - The production server for serving and regenerating live Webhook sites.

## Webhook Command Line Tools

This repository contains the code for the [Webhook CMS](http://www.webhook.com) command line tools.
These tools require a Webhook account which you can create through the command line if you need.
Currently we are in a beta period and all new accounts must be whitelisted for the tools
to function properly.

Webhook uses [Grunt](http://www.gruntjs.com) for its local runserver and task runner.
The Webhook command line tools are sometimes simple aliases to specific Grunt commands.

## Installation

Requires the installation of [Node JS](http://www.nodejs.org). Once installed open your
terminal and run:

```
npm install -g grunt wh
```

## Webhook Command Line

The Webhook CLI has the following commands:

```
wh create sitename                 # Create a new Webhook directory/site at "sitename".
wh serve [port]                    # Serves a Webhook site locally on the optional port. Default port is 2002.
wh deploy                          # Packages local, deploys to the live server, and runs a new build.
wh update                          # Updates the site directory you're in to use the latest Webhook runserver code libraries.

# wh init creates the secret key file for a local site that doesn't have one (say a github clone).
# init must be run in an existing webhook directory.

wh init
```

## Grunt commands in the local server

The following grunt commands are supported.

```
grunt clean                       # Deletes the files in the .build/ directory.
grunt scaffolding:typename        # Generates scaffolding HTML for a passed content-type from the CMS.
grunt build                       # Runs clean, and then rebuilds the .build/ directory.
```


