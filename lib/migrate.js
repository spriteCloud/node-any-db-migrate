/*
 * migrate
 * https://github.com/spriteCloud/node-any-db-migrate
 *
 * Copyright (c) 2013 spriteCloud B.V. All rights reserved.
 */


'use strict';

/*****************************************************************************
 * Globals
 **/
var DEFAULT_OPTIONS = {
  migrations_dir: './migrations',
  databases_file: './database.json',
  verbose: false,
  environment: 'default',
  command: undefined,
  arguments: [],
};



/*****************************************************************************
 * Helper functions
 **/
// Create a here document.
var here_doc = function(func)
{
  return func.toString().
    replace(/^[^\/]+\/\*!?/, '').
    replace(/\*\/[^\/]+$/, '');
};




// Parse the command line arguments and return an options object.
var parse_cli = function()
{
  var pkg = require('../package.json');

  // Defaults and return value
  var options = exports.get_default_options();

  // Define CLI options
  var optparse = require('optparse');
  var switches = [
    ['-h', '--help', 'Show help screen (this).'],
    ['--version', 'Show version.'],
    ['-v', '--verbose', 'Turn on verbose logging.'],

    ['-m', '--migrations PATH', 'Directory for database migration files. Defaults to "@DIR@".'.replace('@DIR@', options.migrations_dir)],
    ['-d', '--databases PATH', 'File with database environment definitions. Defaults to "@FILE@".'.replace('@FILE@', options.databases_file)],
    ['-e', '--environment ENV', 'Environment to use. Defaults to "@ENV@".'.replace('@ENV@', options.environment)]
  ];

  // Create parser callbacks
  var parser = new optparse.OptionParser(switches);

  parser.on('help', function() {
    console.log(parser.toString());
    parser.halt();
    process.exit(0);
  });

  parser.on('version', function() {
    console.log(pkg.name + ' @' + pkg.version);
    parser.halt();
    process.exit(0);
  });

  parser.on('verbose', function() {
    options.verbose = true;
  });

  parser.on('migrations', function(opt, value) {
    options.migrations_dir = value;
  });

  parser.on('databases', function(opt, value) {
    options.databases_file = value;
  });

  parser.on('environment', function(opt, value) {
    options.environment = value;
  });

  // Sanity check parameters/defaults
  var fs = require('fs');
  var stats;
  try {
    stats = fs.statSync(options.migrations_dir);
    if (!stats.isDirectory()) {
      console.log('Error: "' + options.migrations_dir + '" is not a directory.');
      process.exit(1);
    }
  } catch (err) {
    console.log(err.toString());
    process.exit(2);
  }

  try {
    stats = fs.statSync(options.databases_file);
    if (!stats.isFile()) {
      console.log('Error: "' + options.databases_file + '" is not a file.');
      process.exit(3);
    }
  } catch (err) {
    console.log(err.toString());
    process.exit(4);
  }

  parser.on(function(opt, value) {
    console.log('Error: option "' + opt + '" unknown: "' + value + '".');
    parser.halt();
    process.exit(1);
  });

  // Parse the command line
  parser.banner = here_doc(function() {/*!
Usage: @PKG@ [OPTIONS] api-package [api-package ...]
*/}).replace('@PKG@', pkg.name);

  var args = parser.parse(process.argv).slice(2);

  options.command = args[0];
  options.arguments = args.slice(1);

  if (options.verbose) {
    console.log('Options:', options);
  }

  return options;
};




/*****************************************************************************
 * Exports
 **/
// Get default options. Use this to customize behaviour of other functions.
exports.get_default_options = function()
{
  return JSON.parse(JSON.stringify(DEFAULT_OPTIONS));
};




// Given the command line options, return matching database configuration.
exports.get_database_config = function(options)
{
  var assert = require('assert');
  assert(options);
  assert(options.databases_file);
  assert(options.environment);

  try {
    // Read config file
    var fs = require('fs');
    var data = fs.readFileSync(options.databases_file, { encoding: 'utf-8', flag: 'r' });

    // Parse config as JSON
    var config = JSON.parse(data);

    // Try the given environment.
    if (!(options.environment in config)) {
      if (options.verbose) {
        console.log('Error: environment "' + options.environment + '" not found in database config.');
      }
      return undefined;
    }

    return config[options.environment];
  } catch (err) {
    if (options.verbose) {
      console.log('Error getting database config: ' + err);
    }
  }

  return undefined;
};




// Given the command line options, find available migrations.
exports.collect_migrations = function(options)
{
  var assert = require('assert');
  assert(options);
  assert(options.migrations_dir);

  var collected = {};
  var names = [];

  try {
    var fs = require('fs');
    var path = require('path');

    var base = path.resolve(options.migrations_dir);

    // Iterate over files
    var reg = /^.*\.js$/;
    var files = fs.readdirSync(base);
    for (var i = 0 ; i < files.length ; ++i) {
      var name = files[i];
      if (!reg.exec(name)) {
        continue;
      }

      var full = base + path.sep + name;

      try {
        // Try to load migration
        var migration = require(full);

        // Sanity checks on migration - it needs an up() and a down() function.
        if ('function' !== typeof(migration.up) || 'function' !== typeof(migration.down)) {
          if (options.verbose) {
            console.log('File "' + full + '" is not a valid migration, skipping.');
          }
          continue;
        }

        // Alright, keep this one
        migration.name = name;
        migration.path = full;
        collected[name] = migration;
        names.push(name);
      } catch (inner_err) {
        if (options.verbose) {
          console.log('Error reading migration file "' + full + '", skipping.');
        }
      }
    }
  } catch (err) {
    if (options.verbose) {
      console.log('Error collecting migrations: ' + err);
    }
    return undefined;
  }

  // Create sorted list of migrations.
  names.sort();
  var migrations = [];
  for (var j = 0 ; j < names.length ; ++j) {
    migrations.push(collected[names[j]]);
  }

  return migrations;
};



// Command for upgrading a database.
exports.cmd_up = function(options)
{
  // TODO
  console.log(options);
};







exports.cli = function()
{
  try {
    var options = parse_cli();

    // Find the command in the options. If it doesn't exist, fail loudly.
    var command_func = 'cmd_' + options.command;
    if (!(command_func in exports) || 'function' !== typeof(exports[command_func])) {
      console.log('Error: unknown command "' + options.command + '", exiting.');
      process.exit(100);
    }
    command_func = exports[command_func];

    // Alright, got the command, now execute it.
    command_func(options);
  } catch (err) {
    console.log('FATAL:', err.stack);
  }
};
