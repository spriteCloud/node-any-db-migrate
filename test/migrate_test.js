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
      databases_file: './test/db_missing.json',
      environment: 'default',
      verbose: false,
    };
    test.doesNotThrow(function() { migrate.get_database_config(options); }, Error, 'Missing database config must not cause an excpetion.');
    var db = migrate.get_database_config(options);
    test.strictEqual(undefined, db, 'Return of malformed call must be undefined.');

    // Broken test config - must not throw but return undefined.
    options = {
      databases_file: './test/db_broken.json',
      environment: 'default',
      verbose: false,
    };
    test.doesNotThrow(function() { migrate.get_database_config(options); }, Error, 'Broken database config must not cause an excpetion.');
    db = migrate.get_database_config(options);
    test.strictEqual(undefined, db, 'Return of malformed call must be undefined.');

    // Working test config - must not throw, and must return something.
    options = {
      databases_file: './test/db_working.json',
      environment: 'test',
      verbose: true,
    };
    test.doesNotThrow(function() { migrate.get_database_config(options); }, Error, 'Working database config must not cause an exception.');
    db = migrate.get_database_config(options);
    test.notStrictEqual(undefined, db, 'Return of well formed call must not be undefined.');

    // Working test config - can return undefined if the requested environment was not found.
    options = {
      databases_file: './test/db_working.json',
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
      migrations_dir: './test/migrations_missing',
      verbose: false,
    };
    test.doesNotThrow(function() { migrate.collect_migrations(options); }, Error, 'Missing migrations must not cause an excpetion.');
    var db = migrate.collect_migrations(options);
    test.strictEqual(undefined, db, 'Return of malformed call must be undefined.');

    // Empty migrations - must not throw but return an empty list.
    var options = {
      migrations_dir: './test/migrations_empty',
      verbose: false,
    };
    test.doesNotThrow(function() { migrate.collect_migrations(options); }, Error, 'Missing migrations must not cause an excpetion.');
    var db = migrate.collect_migrations(options);
    test.deepEqual([], db, 'Return of malformed call must be undefined.');

    // Working migrations - must not throw (even if some are malformed) and must not return an empty list
    var options = {
      migrations_dir: './test/migrations_test',
      verbose: false,
    };
    test.doesNotThrow(function() { migrate.collect_migrations(options); }, Error, 'Missing migrations must not cause an excpetion.');
    var db = migrate.collect_migrations(options);
    test.strictEqual('object', typeof(db), 'Return of valid call must be an array.');
    test.ok(Object.keys(db).length > 0, 'Must have migrations.');
    test.ok(Object.keys(db).length === 3, 'Only three valid migrations to be found.');

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
      migrations_dir: './test/migrations_test',
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
    test.strictEqual(2, filtered.length, 'Must be length 2.');

    // Ensure that none of the names above are in the migrations.
    for (var i = 0 ; i < filtered.length ; ++i) {
      test.strictEqual(-1, names.indexOf(filtered[i].name), 'Bad entry, should be filtered out.');
    }

    test.done();
  },



  'database access': function(test)
  {
    // Options to use
    var options = {
      databases_file: './test/db_working.json',
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
      databases_file: './test/db_working.json',
      migrations_dir: './test/migrations_test',
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
      databases_file: './test/db_working.json',
      migrations_dir: './test/migrations_test',
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
      // Clear database TODO
      function(cb) {
        conn.query('DROP TABLE IF EXISTS migrations;', function(error, result) {
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
            test.strictEqual(2, result.length, 'Must return non-empty array.');
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

};
