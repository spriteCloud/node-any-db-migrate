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



// Sanity checks command line options, exiting if there is anything wrong.
var check_options = function(options)
{
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

  if (undefined === options.command) {
    console.log(parser.toString());
    console.log('');
    options.command = 'help';
  }

  if (options.verbose) {
    console.log('Options:', options);
  }

  return options;
};




// Do some common stuff for commands - assert that parameters work exists,
// ensure the database is initialized, etc.
var migration_command = function(options, name, handler, finalizer, callback)
{
  var assert = require('assert');
  assert.strictEqual('object', typeof(options));
  assert.strictEqual('string', typeof(name));
  assert.strictEqual('function', typeof(handler));
  assert.strictEqual('function', typeof(finalizer));
  assert.strictEqual('function', typeof(callback));

  check_options(options);

  var baton = {
    to_apply: [],
  };

  // Try to connect to the database.
  var dbconf = exports.get_database_config(options);
  if (undefined === dbconf) {
    callback(new Error('Could not find database environment "' + options.environment + '" in "' + options.databases_file + '", exiting.'));
    return;
  }

  var dbm = require('any-db');
  baton.conn = dbm.createConnection(dbconf);
  if (undefined === baton.conn) {
    callback(new Error('Could not connect to database.'));
    return;
  }

  // Gather current migrations.
  baton.migrations = exports.collect_migrations(options);
  if (0 === Object.keys(baton.migrations).length) {
    callback(new Error('No migrations found.'));
    return;
  }

  // FIXME
  if (options.verbose) {
    console.log('MIG', baton.migrations);
    console.log('ARGS', options.arguments);
  }

  // Start series
  var async = require('async');
  async.series([
      // Initialize database in case it isn't yet.
      function(cb) {
        exports.initialize_database(baton.conn, function(err) {
          cb(err);
        });
      },

      // Retrieve applied migrations. This is where we hand over to the handler
      // function.
      function(cb) {
        exports.retrieve_applied(baton.conn, function(err, applied) {
          // FIXME
          if (options.verbose) {
            console.log('APPLIED', err, applied);
          }
          if (err) {
            callback(err);
            return;
          }

          baton.applied = applied;
          try {
            handler(options, baton, cb);
          } catch (handler_err) {
            cb(handler_err);
          }
        });
      },

      // Finally, apply anything left in to_apply.
      function(cb) {
        // FIXME
        if (options.verbose) {
          console.log('TO APPLY', baton.to_apply);
        }
        exports.apply_migrations(options, name, baton.to_apply, baton.conn, finalizer, function(err) {
          if (err) {
            cb(err);
            return;
          }

          // Done.
          cb(null);
        });
      },
  ],

  function(error) {
    callback(error);
  });
};




// Handler for cmd_apply()
var handler_apply = function(options, baton, callback)
{
  // We only accept a single argument, no more, no less.
  var assert = require('assert');
  assert.strictEqual(1, options.arguments.length, 'Must have exactly one arguent.');

  // Filter out applied.
  baton.to_apply = exports.filter_migrations(baton.migrations, baton.applied);

  // We only care about the first argument; the rest are ignored.
  baton.to_apply = exports.filter_migrations(baton.to_apply, options.arguments[0]);

  if (0 === baton.to_apply.length) {
    callback(new Error('All (specified) migrations are already applied.'));
    return;
  }

  callback(null);
};




// Handler for cmd_revert()
var handler_revert = function(options, baton, callback)
{
  // We only accept a single argument, no more, no less.
  var assert = require('assert');
  assert.strictEqual(1, options.arguments.length, 'Must have exactly one arguent.');

  // FIXME
  baton.to_apply = [];
  callback(null);
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

  return collected;
};



// Filter & sort migrations, given
// - a set of all migrations
// - a list of migration names to skip OR
// - a migration name to use.
exports.filter_migrations = function(migrations, skip_or_use)
{
  var assert = require('assert');
  assert.strictEqual('object', typeof(migrations));
  assert('string' === typeof(skip_or_use) || Array.isArray(skip_or_use));

  // First, ensure that the migrations are not an array - they may be if they
  // have already been run through this function. It's easier to work with
  // migrations being a hash.
  if (Array.isArray(migrations)) {
    var mig = {};
    for (var k = 0 ; k < migrations.length ; ++k) {
      mig[migrations[k].name] = migrations[k];
    }
    migrations = mig;
  }

  // Second parameter specifies a migration to pick.
  if ('string' === typeof(skip_or_use)) {
    if (undefined === migrations[skip_or_use]) {
      return [];
    }
    return [migrations[skip_or_use]];
  }

  // Second parameter specifies a list of names to avoid. Turn this into an
  // object, eliminating duplicate names and making lookups non-linear.
  var to_skip = {};
  for (var i = 0 ; i < skip_or_use.length ; ++i) {
    to_skip[skip_or_use[i]] = true;
  }

  // Sort migrations, we want to return them in order.
  var names = Object.keys(migrations).sort();

  // Now we can process the migrations.
  var result = [];
  for (var j = 0 ; j < names.length ; ++j) {
    if (names[j] in to_skip) {
      continue;
    }
    result.push(migrations[names[j]]);
  }

  return result;
};




// Initialize the database with a migrations table. Expects an any-db connection
// object and a callback.
exports.initialize_database = function(conn, callback)
{
  var assert = require('assert');
  assert.strictEqual('object', typeof(conn));
  assert.strictEqual('function', typeof(callback));

  try {
    conn.query('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY NOT NULL, date TEXT);', function(error) {
        if (error) {
          callback(error, undefined);
          return;
        }

        callback(null, undefined);
    });
  } catch (err) {
    process.nextTick(function() {
        callback(err, undefined);
    });
    return;
  }
};



// Given the database connection and a list of migrations or migration names,
// register them in the database.
exports.register_migrations = function(conn, migrations, callback)
{
  var assert = require('assert');
  assert.strictEqual('object', typeof(conn));
  assert(Array.isArray(migrations));
  assert(migrations.length > 0);
  assert.strictEqual('function', typeof(callback));

  var now;
  switch (conn.adapter) {
    case 'sqlite3':
      now = "datetime('now')";
      break;

    case 'mysql':
      now = 'NOW()';
      break;

    case 'postgres':
      now = 'CURRENT_TIMESTAMP';
      break;

    default:
      process.nextTick(function() {
          callback(new Error('Unsupported adapter "' + conn.adapter + '".'), undefined);
      });
      return;
  }

  var async = require('async');
  async.eachSeries(migrations,
      function(item, cb) {
        var name = item;
        if ('object' === typeof(item)) {
          name = item.name;
        }

        var stmt = 'INSERT INTO migrations (name, date) VALUES (?, ' + now + ');';
        conn.query(stmt, [name], function(error) {
          cb(error);
        });
      },
      function(err) {
        callback(err);
      }
  );
};



// Given the database connection and a list of migrations or migration names,
// deregister them from the database.
exports.deregister_migrations = function(conn, migrations, callback)
{
  var assert = require('assert');
  assert.strictEqual('object', typeof(conn));
  assert(Array.isArray(migrations));
  assert(migrations.length > 0);
  assert.strictEqual('function', typeof(callback));

  var async = require('async');
  async.eachSeries(migrations,
      function(item, cb) {
        var name = item;
        if ('object' === typeof(item)) {
          name = item.name;
        }

        var stmt = 'DELETE FROM migrations WHERE name = ?;';
        conn.query(stmt, [name], function(error) {
          cb(error);
        });
      },
      function(err) {
        callback(err);
      }
  );
};





// Retrieve applied migrations. Expects an any-db connection object and a callback.
// First callback parameter is an (optional) error, second a sorted list of
// applied migration names.
exports.retrieve_applied = function(conn, callback)
{
  var assert = require('assert');
  assert.strictEqual('object', typeof(conn));
  assert.strictEqual('function', typeof(callback));

  try {
    conn.query('SELECT name FROM migrations ORDER BY name ASC;', function(error, results) {
        if (error) {
          callback(error, undefined);
          return;
        }

        var applied = [];
        for (var i = 0 ; i < results.rows.length ; ++i) {
          applied.push(results.rows[i].name);
        }

        callback(null, applied);
    });
  } catch (err) {
    process.nextTick(function() {
        callback(err, undefined);
    });
    return;
  }
};




// Execute the given function in the given migration(s). Migrations is meant to
// be an array of migrations to be performed in order. NOTE that means for reversing
// migrations, you need to pass them in reverse order.
exports.apply_migrations = function(options, func, migrations, conn, register, callback)
{
  var assert = require('assert');
  assert.strictEqual('object', typeof(options));
  assert.strictEqual('string', typeof(func));
  assert(Array.isArray(migrations));
  assert.strictEqual('object', typeof(conn));
  assert.strictEqual('function', typeof(register));
  assert.strictEqual('function', typeof(callback));

  // All of this function must be wrapped in a transaction.
  var tx = conn.begin();
  tx.on('error', function (err) {
      if (options.verbose) {
        console.log('Errors occurred, transaction cancelled.');
      }

      tx.rollback(function() {
        callback(err);
      });
  });

  // Process migrations
  var async = require('async');
  async.eachSeries(migrations,
      // Process each migration separately. Man, callback spaghetti sucks.
      function(item, cb) {
        if (options.verbose) {
          console.log('Applying "' + func + '" operation on migration "' + item.name + '"...');
        }

        try {
          item[func](tx, function(err, result) {
            if (null !== err) {
              // If the function returns an error, pass it on.
              tx.rollback(function() {
                cb(err, undefined);
              });
            }

            // Seems all went well, let's continue.
            cb(null, result);
          });
        } catch (inner) {
          if (options.verbose) {
            console.log('Exception caught, cancelling:', inner.stack);
          }
          tx.rollback(function() {
            cb(inner, undefined);
          });
          return;
        }
      },

      // Commit or roll back.
      function(err) {
        // Are there errors? Roll back.
        if (err) {
          if (options.verbose) {
            console.log('Errors occurred, transaction cancelled.');
          }
          tx.rollback(function() {
            callback(err);
          });
          return;
        }

        // Success? Register migrations and commit.
        if (options.verbose) {
          console.log('Registering changes...');
        }
        try {
          register(tx, migrations, function(err) {
            if (null !== err) {
              if (options.verbose) {
                console.log('Cannot register changes, aborting.');
              }
              tx.rollback(function() {
                callback(err);
              });
              return;
            }

            if (options.verbose) {
              console.log('Committing transaction.');
            }
            tx.commit(function() {
              callback(null);
            });
          });
        } catch (regerr) {
          if (options.verbose) {
            console.log('Cannot register changes, aborting.');
          }
          tx.rollback(function() {
            callback(regerr);
          });
        }
      }
  );
};




// Command for applying a single migration
exports.cmd_apply = function(options, callback)
{
  migration_command(options, 'up', handler_apply, exports.register_migrations, callback);
};
exports.cmd_apply.__doc__ = here_doc(function() {/*
apply migration -- applies the specified migration.

migration   Name, file name or full path of the migration to apply.

Calls the migration's up() method and registers the migration in the database.
*/});




// Command for reverting a single migration
exports.cmd_revert = function(options, callback)
{
  migration_command(options, 'down', handler_revert, exports.deregister_migrations, callback);
};
exports.cmd_revert.__doc__ = here_doc(function() {/*
revert migration -- reverts the specified migration.

migration   Name, file name or full path of the migration to revert.

Calls the migration's down() method and deregisters the migration in the database.
*/});




// Command for displaying command documentation
exports.cmd_help = function(options, callback)
{
  // Process available commands
  var commands = {};

  for (var symbol in exports) {
    if (0 === symbol.indexOf('cmd_') && 'function' === typeof(exports[symbol])) {
      var name = symbol.slice(4);

      var doc = exports[symbol].__doc__.trim();
      var summary;
      if (undefined !== doc) {
        summary = doc.split('\n')[0];
        summary = summary.split('--');
        for (var i = 0 ; i < summary.length ; ++i) {
          summary[i] = summary[i].trim();
        }
      }

      commands[name] = {
        symbol: symbol,
        doc: doc,
        summary: summary,
      };
    }
  }

  // Figure out whether the caller wants help on a single command, or a list of
  // available commands.
  if (options.arguments.length > 0) {
    // Single command!
    var command = options.arguments[0];
    if (!(command in commands)) {
      callback(new Error('Command "' + command + '" is unknown.'));
      return;
    }

    console.log(commands[command].doc);
    callback(null);
    return;
  }

  // List of commands - sort by command names.
  var names = Object.keys(commands).sort();
  var longest = 0;
  var j;
  for (j = 0 ; j < names.length ; ++j) {
    var l = commands[names[j]].summary[0].length;
    if (l > longest) {
      longest = l;
    }
  }
  console.log('List of available commands:');
  for (j = 0 ; j < names.length ; ++j) {
    var summary = commands[names[j]].summary;
    var line = '    ' + summary[0];
    for (var k = 0 ; k < longest  - summary[0].length ; ++k) {
      line += ' ';
    }
    line += '        ' + summary[1];
    console.log(line);
  }

  callback(null);
};
exports.cmd_help.__doc__ = here_doc(function() {/*
help [name] -- lists available commands or help on a specified command.

help              Lists available commands with a summary of what they do.
help name         Shows help for the named command, like this help.
*/});




// Implements the CLI
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
    command_func(options, function(err) {
      if (null !== err) {
        console.log(err.toString());
        process.exit(-2);
      }
      process.exit(0);
    });
  } catch (err) {
    console.log('FATAL:', err.stack);
  }
};
