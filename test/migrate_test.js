/*
 * migrate
 * https://github.com/spriteCloud/node-any-db-migrate
 *
 * Copyright (c) 2013,2014 spriteCloud B.V. and other node-any-db-migrate contributors.
 * All rights reserved.
 */

'use strict';

var migrate = require('../lib/migrate.js');


/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

exports['migrate'] = {
  setUp: function(done)
  {
    // setup here
    done();
  },



  'get_database_config': function(test)
  {
    // Missing databases_file option must throw.
    test.throws(function() { migrate.get_database_config(); }, Error, 'Missing options must throw.');
    test.throws(function() { migrate.get_database_config({}); }, Error, 'Missing options must throw.');

    // Missing test config - must not throw but return undefined.
    var options = {
      databases_file: './test/configs/db_missing.json',
      environment: 'default',
      verbose: false,
    };
    test.doesNotThrow(function() { migrate.get_database_config(options); }, Error, 'Missing database config must not cause an excpetion.');
    var db = migrate.get_database_config(options);
    test.strictEqual(undefined, db, 'Return of malformed call must be undefined.');

    // Broken test config - must not throw but return undefined.
    options = {
      databases_file: './test/configs/db_broken.json',
      environment: 'default',
      verbose: false,
    };
    test.doesNotThrow(function() { migrate.get_database_config(options); }, Error, 'Broken database config must not cause an excpetion.');
    db = migrate.get_database_config(options);
    test.strictEqual(undefined, db, 'Return of malformed call must be undefined.');

    // Working test config - must not throw, and must return something.
    options = {
      databases_file: './test/configs/db_working.json',
      environment: 'test',
      verbose: true,
    };
    test.doesNotThrow(function() { migrate.get_database_config(options); }, Error, 'Working database config must not cause an exception.');
    db = migrate.get_database_config(options);
    test.notStrictEqual(undefined, db, 'Return of well formed call must not be undefined.');

    // Working test config - can return undefined if the requested environment was not found.
    options = {
      databases_file: './test/configs/db_working.json',
      environment: 'not found',
      verbose: false,
    };
    db = migrate.get_database_config(options);
    test.strictEqual(undefined, db, 'Return of well formed call must be undefined if the environment is not found.');

    test.done();
  },




  'collect_migrations': function(test)
  {
    // Missing migrations dir option must throw.
    test.throws(function() { migrate.collect_migrations(); }, Error, 'Missing options must throw.');
    test.throws(function() { migrate.collect_migrations({}); }, Error, 'Missing options must throw.');

    // Missing test config - must not throw but return undefined.
    var options = {
      migrations_dir: './test/migrations/missing',
      verbose: false,
    };
    test.doesNotThrow(function() { migrate.collect_migrations(options); }, Error, 'Missing migrations must not cause an excpetion.');
    var db = migrate.collect_migrations(options);
    test.strictEqual(undefined, db, 'Return of malformed call must be undefined.');

    // Empty migrations - must not throw but return an empty list.
    var options = {
      migrations_dir: './test/migrations/empty',
      verbose: false,
    };
    test.doesNotThrow(function() { migrate.collect_migrations(options); }, Error, 'Missing migrations must not cause an excpetion.');
    var db = migrate.collect_migrations(options);
    test.deepEqual([], db, 'Return of malformed call must be undefined.');

    // Working migrations - must not throw (even if some are malformed) and must not return an empty list
    var options = {
      migrations_dir: './test/migrations/test',
      verbose: false,
    };
    test.doesNotThrow(function() { migrate.collect_migrations(options); }, Error, 'Missing migrations must not cause an excpetion.');
    var db = migrate.collect_migrations(options);
    test.strictEqual('object', typeof(db), 'Return of valid call must be an array.');
    test.ok(Object.keys(db).length > 0, 'Must have migrations.');
    test.strictEqual(4, Object.keys(db).length, 'Only four valid migrations to be found.');

    test.done();
  },



  'filter_migrations': function(test)
  {
    // Bad parameters must throw
    test.throws(function() { migrate.filter_migrations(); }, Error, 'Bad parameters must throw.');
    test.throws(function() { migrate.filter_migrations([]); }, Error, 'Bad parameters must throw.');
    test.throws(function() { migrate.filter_migrations(1); }, Error, 'Bad parameters must throw.');
    test.throws(function() { migrate.filter_migrations('foo'); }, Error, 'Bad parameters must throw.');
    test.throws(function() { migrate.filter_migrations({}); }, Error, 'Bad parameters must throw.');
    test.throws(function() { migrate.filter_migrations({}, 1); }, Error, 'Bad parameters must throw.');
    test.doesNotThrow(function() { migrate.filter_migrations({}, ''); }, Error, 'Good parameters must not throw.');
    test.doesNotThrow(function() { migrate.filter_migrations({}, ''); }, Error, 'Good parameters must not throw.');

    // First, get our test migrations.
    var options = {
      migrations_dir: './test/migrations/test',
      verbose: false,
    };
    var db = migrate.collect_migrations(options);

    // Filtering by a non-existing name must return an empty array.
    var filtered = migrate.filter_migrations(db, 'foo');
    test.ok(Array.isArray(filtered), 'Must be an array.');
    test.strictEqual(0, filtered.length, 'Must be empty.');

    // Filtering by an existing name must return an array of length 1
    filtered = migrate.filter_migrations(db, '003.js');
    test.ok(Array.isArray(filtered), 'Must be an array.');
    test.strictEqual(1, filtered.length, 'Must be length 1.');

    // Filtering by a list of names must return any migration except for the
    // ones in the name list.
    var names = [
      '004.js', // exists
      'foo',    // does not exist
    ];
    filtered = migrate.filter_migrations(db, names);
    test.ok(Array.isArray(filtered), 'Must be an array.');
    test.strictEqual(3, filtered.length, 'Must be length 3.');

    // Ensure that none of the names above are in the migrations.
    for (var i = 0 ; i < filtered.length ; ++i) {
      test.strictEqual(-1, names.indexOf(filtered[i].name), 'Bad entry, should be filtered out.');
    }

    // Lastly, ensure we can filter multiple times, i.e.  filter the filtered
    test.doesNotThrow(function() { migrate.filter_migrations(filtered, '003.js'); }, Error, 'Must not throw.');
    var second = migrate.filter_migrations(filtered, '003.js');
    test.ok(Array.isArray(second), 'Must be an array.');
    test.strictEqual(1, second.length, 'Must be length 1.');

    test.done();
  },



  'database access': function(test)
  {
    // Options to use
    var options = {
      databases_file: './test/configs/db_working.json',
      environment: 'test',
      verbose: false,
    };

    var config = migrate.get_database_config(options);
    test.ok(config);

    var dbm = require('any-db');
    test.ok(dbm);

    // Open database
    var conn = dbm.createConnection(config);
    test.ok(conn);

    var async = require('async');
    async.series([
      // Clear database
      function(cb) {
        conn.query('DROP TABLE IF EXISTS foo;', function(error, result) {
            test.strictEqual(null, error, 'Should not throw.');
            cb(error);
        });
      },

      // Try to create a table.
      function(cb) {
        conn.query('CREATE TABLE foo (id integer primary key, name varchar(20));', function(error, result) {
            test.strictEqual(null, error, 'Should not throw.');
            cb(error);
        });
      },

      // Insert
      function(cb) {
        conn.query('INSERT INTO foo (id, name) VALUES (1, "lala");', function(error, result) {
            test.strictEqual(null, error, 'Should not throw.');
            cb(error);
        });
      },

      // Select
      function(cb) {
        conn.query('SELECT name FROM foo WHERE id = 1;', function(error, result) {
            test.strictEqual(null, error, 'Should not throw.');
            test.strictEqual(1, result.rowCount, 'Must only have one result.');
            cb(error);
        });
      },

    ], function(error, results) {
      test.done();
    });
  },



  'applied migrations': function(test)
  {
    // Bad parameters must throw
    test.throws(function() { migrate.retrieve_applied(); }, Error, 'Bad parameters must throw.');
    test.throws(function() { migrate.retrieve_applied([]); }, Error, 'Bad parameters must throw.');
    test.throws(function() { migrate.retrieve_applied({}); }, Error, 'Bad parameters must throw.');
    test.doesNotThrow(function() { migrate.retrieve_applied({}, function() {}); }, Error, 'Good parameters must not throw.');

    var options = {
      databases_file: './test/configs/db_working.json',
      migrations_dir: './test/migrations/test',
      environment: 'test',
      verbose: false,
    };

    var migrations = migrate.collect_migrations(options);
    var filtered = migrate.filter_migrations(migrations, []);

    var config = migrate.get_database_config(options);
    test.ok(config);

    var dbm = require('any-db');
    test.ok(dbm);

    // Open database
    var conn = dbm.createConnection(config);
    test.ok(conn);

    // Test for existing migrations. Should not work, because migrations table
    // does not yet exist.
    var async = require('async');
    async.series([
      // Clear database
      function(cb) {
        conn.query('DROP TABLE IF EXISTS migrations;', function(error, result) {
            test.strictEqual(null, error, 'Should not throw.');
            cb(error);
        });
      },

      // Get migrations - must fail
      function(cb) {
          migrate.retrieve_applied(conn, function(err, result) {
            test.strictEqual('object', typeof(err), 'Must throw error.');
            cb(null); // Ignore error
          });
      },

      // Register a migration - must fail
      function(cb) {
          migrate.register_migrations(conn, [filtered[0]], function(err, result) {
            test.strictEqual('object', typeof(err), 'Must throw error.');
            cb(null); // Ignore error
          });
      },

      // Initialize database - must succeed
      function(cb) {
          migrate.initialize_database(conn, function(err, result) {
            test.strictEqual(null, err, 'Must not throw.');
            cb(err);
          });
      },

      // Get migrations - must succeed
      function(cb) {
          migrate.retrieve_applied(conn, function(err, result) {
            test.ok(Array.isArray(result), 'Must return array result.');
            test.strictEqual(0, result.length, 'Must return empty array.');
            cb(err);
          });
      },

      // Register a migration - must succeed
      function(cb) {
          migrate.register_migrations(conn, [filtered[0]], function(err, result) {
            test.strictEqual(null, err, 'Must not throw.');
            cb(err);
          });
      },

      // Get migrations - must succeed
      function(cb) {
          migrate.retrieve_applied(conn, function(err, result) {
            test.ok(Array.isArray(result), 'Must return array result.');
            test.strictEqual(1, result.length, 'Must return non-empty array.');
            test.strictEqual(filtered[0].name, result[0], 'Must equal the registered migration.');
            cb(err);
          });
      },

      // Deregister migration again - must succeed
      function(cb) {
          migrate.deregister_migrations(conn, [filtered[0]], function(err, result) {
            test.strictEqual(null, err, 'Must not throw.');
            cb(err);
          });
      },

      // Get migrations - must succeed
      function(cb) {
          migrate.retrieve_applied(conn, function(err, result) {
            test.ok(Array.isArray(result), 'Must return array result.');
            test.strictEqual(0, result.length, 'Must return empty array.');
            cb(err);
          });
      },


    ], function(error, results) {
      test.done();
    });
  },



  'execute migrations': function(test)
  {
    var options = {
      databases_file: './test/configs/db_working.json',
      migrations_dir: './test/migrations/test',
      environment: 'test',
      verbose: false,
    };

    var migrations = migrate.collect_migrations(options);
    var filtered = migrate.filter_migrations(migrations, []);

    var config = migrate.get_database_config(options);
    test.ok(config);

    var dbm = require('any-db');
    test.ok(dbm);

    // Open database
    var conn = dbm.createConnection(config);
    test.ok(conn);

    // Test for existing migrations. Should not work, because migrations table
    // does not yet exist.
    var async = require('async');
    async.series([
      // Clear database
      function(cb) {
        conn.query('DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS migrations;', function(error, result) {
            test.strictEqual(null, error, 'Should not throw.');
            cb(error);
        });
      },

      // Initialize database - must succeed
      function(cb) {
          migrate.initialize_database(conn, function(err, result) {
            test.strictEqual(null, err, 'Must not throw.');
            cb(err);
          });
      },

      // Execute migrations - must fail, undefined function
      function(cb) {
        migrate.apply_migrations(options, 'foo', filtered, conn, migrate.register_migrations, function(err, result) {
          test.notStrictEqual(null, err, 'Must throw, function does not exist.');
          cb(null); // ignore error
        });
      },

      // Execute migrations - must fail, duplicate table
      function(cb) {
        migrate.apply_migrations(options, 'up', filtered, conn, migrate.register_migrations, function(err, result) {
          test.notStrictEqual(null, err, 'Must throw, cannot create same table twice.');
          cb(null); // ignore error
        });
      },

      // Execute migrations - must succeed
      function(cb) {
        // Filter out reason for failure above
        filtered = migrate.filter_migrations(migrations, ['004.js']);
        migrate.apply_migrations(options, 'up', filtered, conn, migrate.register_migrations, function(err, result) {
          test.strictEqual(null, err, 'Must not throw.');
          cb(err);
        });
      },

      // Get migrations - must succeed
      function(cb) {
          migrate.retrieve_applied(conn, function(err, result) {
            test.ok(Array.isArray(result), 'Must return array result.');
            test.strictEqual(3, result.length, 'Must return non-empty array.');
            cb(err);
          });
      },

      // Now reverse and downgrade.
      function(cb) {
        var reversed = filtered.reverse();
        migrate.apply_migrations(options, 'down', reversed, conn, migrate.deregister_migrations, function(err, result) {
          test.strictEqual(null, err, 'Must not throw.');
          cb(err);
        });
      },

      // Get migrations - must succeed
      function(cb) {
          migrate.retrieve_applied(conn, function(err, result) {
            test.ok(Array.isArray(result), 'Must return array result.');
            test.strictEqual(0, result.length, 'Must return empty array.');
            cb(err);
          });
      },

    ], function(error, results) {
      test.done();
    });
  },



  'apply command': function(test)
  {
    var options = migrate.get_default_options();
    options.databases_file = './test/configs/db_working.json';
    options.migrations_dir = './test/migrations/test';
    options.environment = 'test';
    options.verbose = false;

    var async = require('async');

    // Setup step
    var setup_database = function(cb) {
      var config = migrate.get_database_config(options);
      test.ok(config);

      var dbm = require('any-db');
      test.ok(dbm);

      // Open database
      var conn = dbm.createConnection(config);
      test.ok(conn);

      async.series([
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS users2;', function(err) {
            cb2(err);
          })
        },
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS users;', function(err) {
            cb2(err);
          })
        },
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS migrations;', function(err) {
            cb2(err);
          })
        },
      ],
      function(err, res) {
        test.strictEqual(null, err, 'Must not throw.');
        cb(err);
      });
    };

    // Tests
    async.series([
      // *** Without arguments - must not succeed
      setup_database,
      function(cb) {
        migrate.cmd_apply(options, function(err) {
            test.notStrictEqual(null, err, 'Must throw.');
            cb(null); // Ignore error
        });
      },


      // *** With incorrect argument - must fail
      setup_database,
      function(cb) {
        options.arguments = ['does-not-exist'];
        migrate.cmd_apply(options, function(err) {
            test.notStrictEqual(null, err, 'Must throw.');
            cb(null); // Ignore error
        });
      },


      // *** With correct argument - must succeed
      setup_database,
      function(cb) {
        options.arguments = ['001.js'];
        migrate.cmd_apply(options, function(err) {
            test.strictEqual(null, err, 'Must not throw.');
            cb(err);
        });
      },


    ], function(error, results) {
      test.done();
    });
  },



  'revert command': function(test)
  {
    var options = migrate.get_default_options();
    options.databases_file = './test/configs/db_working.json';
    options.migrations_dir = './test/migrations/test';
    options.environment = 'test';
    options.verbose = false;

    var async = require('async');

    // Setup step
    var setup_database = function(cb) {
      var config = migrate.get_database_config(options);
      test.ok(config);

      var dbm = require('any-db');
      test.ok(dbm);

      // Open database
      var conn = dbm.createConnection(config);
      test.ok(conn);

      async.series([
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS users2;', function(err) {
            cb2(err);
          })
        },
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS users;', function(err) {
            cb2(err);
          })
        },
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS migrations;', function(err) {
            cb2(err);
          })
        },
        function(cb2) {
          var opts = JSON.parse(JSON.stringify(options));
          opts.verbose = false;
          opts.arguments = ['001.js'];
          migrate.cmd_apply(opts, function(err) {
            cb2(err);
          });
        },
      ],
      function(err, res) {
        test.strictEqual(null, err, 'Must not throw.');
        cb(err);
      });
    };

    // Tests
    async.series([
      // *** Without arguments - must not succeed
      setup_database,
      function(cb) {
        migrate.cmd_revert(options, function(err) {
            test.notStrictEqual(null, err, 'Must throw.');
            cb(null); // Ignore error
        });
      },


      // *** With incorrect argument - must fail
      setup_database,
      function(cb) {
        options.arguments = ['does-not-exist'];
        migrate.cmd_revert(options, function(err) {
            test.notStrictEqual(null, err, 'Must throw.');
            cb(null); // Ignore error
        });
      },


      // *** With correct argument that's not applied - must throw
      setup_database,
      function(cb) {
        options.arguments = ['003.js'];
        migrate.cmd_revert(options, function(err) {
            test.notStrictEqual(null, err, 'Must throw.');
            cb(null); // Ignore error
        });
      },

      // *** With correct argument that is applied - must succeed
      setup_database,
      function(cb) {
        options.arguments = ['001'];
        migrate.cmd_revert(options, function(err) {
            test.strictEqual(null, err, 'Must not throw.');
            cb(err);
        });
      },


    ], function(error, results) {
      test.done();
    });
  },



  'up command': function(test)
  {
    var options = migrate.get_default_options();
    options.databases_file = './test/configs/db_working.json';
    options.migrations_dir = './test/migrations/test';
    options.environment = 'test';
    options.verbose = false;

    var async = require('async');

    // Setup step
    var setup_database = function(cb) {
      var config = migrate.get_database_config(options);
      test.ok(config);

      var dbm = require('any-db');
      test.ok(dbm);

      // Open database
      var conn = dbm.createConnection(config);
      test.ok(conn);

      async.series([
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS users2;', function(err) {
            cb2(err);
          })
        },
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS users;', function(err) {
            cb2(err);
          })
        },
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS migrations;', function(err) {
            cb2(err);
          })
        },
      ],
      function(err, res) {
        test.strictEqual(null, err, 'Must not throw.');
        cb(err);
      });
    };

    // Tests
    async.series([
      // *** With argument - must succeed.
      setup_database,
      function(cb) {
        options.arguments = ['003'];
        migrate.cmd_up(options, function(err) {
            test.strictEqual(null, err, 'Must not throw.');
            cb(err);
        });
      },

      // *** Without argument, next increment - throw, malformed migration
      // XXX Do not clear database
      function(cb) {
        options.arguments = [];
        migrate.cmd_up(options, function(err) {
            test.notStrictEqual(null, err, 'Must throw.');
            cb(null); // Ignore error
        });
      },

      // *** Without argument, complete - throw, malformed migration
      setup_database,
      function(cb) {
        options.arguments = [];
        migrate.cmd_up(options, function(err) {
            test.notStrictEqual(null, err, 'Must throw.');
            cb(null); // Ignore error
        });
      },

    ], function(error, results) {
      test.done();
    });
  },



  'down command': function(test)
  {
    var options = migrate.get_default_options();
    options.databases_file = './test/configs/db_working.json';
    options.migrations_dir = './test/migrations/test';
    options.environment = 'test';
    options.verbose = false;

    var async = require('async');

    // Setup step
    var setup_database = function(cb) {
      var config = migrate.get_database_config(options);
      test.ok(config);

      var dbm = require('any-db');
      test.ok(dbm);

      // Open database
      var conn = dbm.createConnection(config);
      test.ok(conn);

      async.series([
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS users2;', function(err) {
            cb2(err);
          })
        },
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS users;', function(err) {
            cb2(err);
          })
        },
        function(cb2) {
          conn.query('DROP TABLE IF EXISTS migrations;', function(err) {
            cb2(err);
          })
        },
        function(cb2) {
          var opts = JSON.parse(JSON.stringify(options));
          opts.verbose = false;
          opts.arguments = ['001.js'];
          async.eachSeries(['001', '003', '005'], function(item, cb3) {
            opts.arguments = [item];
            migrate.cmd_apply(opts, function(err) {
              cb3(err);
            });
          },
          function(err) {
            cb2(err);
          });
        },

      ],
      function(err, res) {
        test.strictEqual(null, err, 'Must not throw.');
        cb(err);
      });
    };

    // Tests
    async.series([
      // *** With argument - must succeed.
      setup_database,
      function(cb) {
        options.arguments = ['003'];
        migrate.cmd_down(options, function(err) {
            test.strictEqual(null, err, 'Must not throw.');
            cb(err);
        });
      },

      // *** Without argument, next increment - must succeed, migration only malformed for up()
      // XXX Do not clear database
      function(cb) {
        options.arguments = [];
        migrate.cmd_down(options, function(err) {
            test.strictEqual(null, err, 'Must not throw.');
            cb(err);
        });
      },

      // *** Without argument, complete - must succeed, migration only malformed for up()
      setup_database,
      function(cb) {
        options.arguments = [];
        migrate.cmd_down(options, function(err) {
            test.strictEqual(null, err, 'Must not throw.');
            cb(err);
        });
      },

    ], function(error, results) {
      test.done();
    });
  },




  'create command': function(test)
  {
    var options = migrate.get_default_options();
    options.databases_file = './test/configs/db_working.json';
    options.migrations_dir = './test/migrations/test';
    options.environment = 'test';
    options.verbose = false;

    var cleanup = function(cb) {
      var fs = require('fs');
      var path = require('path');

      var base = path.resolve(options.migrations_dir);
      var files = fs.readdirSync(base);
      for (var i = 0 ; i < files.length ; ++i) {
        if (/.*-transmogrifier.*/.test(files[i])) {
          var full = base + path.sep + files[i];
          fs.unlinkSync(full);
        }
      }

      cb(null);
    };


    var async = require('async');

    var migrations;
    var keys;
    var name;

    // Tests
    async.series([
        // In preparation, clean the migrations directory.
        cleanup,

        // First, collect current migrations
        function(cb) {
          migrations = migrate.collect_migrations(options);
          test.notStrictEqual(undefined, migrations, 'Must find some migrations');
          keys = Object.keys(migrations);
          test.strictEqual(4, keys.length, 'Must be of given size.');
          cb(null);
        },

        // Second, create a migration
        function(cb) {
          options.arguments = [ 'transmogrifier' ];
          migrate.cmd_create(options, function(err) {
            cb(err);
          });
        },

        // Third, one migration more must exist.
        function(cb) {
          var mig2 = migrate.collect_migrations(options);
          test.notStrictEqual(undefined, mig2, 'Must find some mig2');
          var keys2 = Object.keys(mig2).sort();
          test.strictEqual(5, keys2.length, 'Must be of given size.');

          // Ensure that the first few migrations are identical.
          for (var i = 0 ; i < keys.length ; ++i) {
            test.strictEqual(keys[i], keys2[i], 'Must have same key.');
            test.deepEqual(migrations[keys[i]], mig2[keys2[i]], 'Must be same migration.');
          }

          // The last migration in mig2 needs to contain the 'transmogrifier' name.
          var last = mig2[keys2[keys2.length - 1]];
          name = last.name;
          test.ok(/.*-transmogrifier/.test(name), 'Must match "transmogrifier".');

          cb(null);
        },

        // Try to apply the migration. Should always work.
        function(cb) {
          options.arguments = [ name ];
          migrate.cmd_apply(options, function(err) {
              test.strictEqual(null, err, 'Must not throw.');
              cb(err);
          });
        },

        // Cleanup afterwards
        cleanup,

    ], function(error, results) {
      test.done();
    });
  },



};
