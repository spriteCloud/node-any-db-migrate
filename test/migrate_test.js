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
};
