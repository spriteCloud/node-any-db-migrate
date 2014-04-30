node-any-db-migrate
===================

Database migration on top of [node-any-db](https://github.com/grncdr/node-any-db).

[![Build Status](https://travis-ci.org/spriteCloud/node-any-db-migrate.svg)](https://travis-ci.org/spriteCloud/node-any-db-migrate)

For now, there's no documentation, but a sample session should tell you all you
need.

```bash
$ bin/migrate

Usage: any-db-migrate [OPTIONS] api-package [api-package ...]


Available options:
  -h, --help              Show help screen (this).
      --version           Show version.
  -v, --verbose           Turn on verbose logging.
  -m, --migrations PATH   Directory for database migration files. Defaults to "./migrations".
  -d, --databases PATH    File with database environment definitions. Defaults to "./database.json".
  -e, --environment ENV   Environment to use. Defaults to "default".

List of available commands:
    apply migration         applies the specified migration.
    create name             create a migration with the given name.
    down [migration]        reverts all migrations, optionally only up to the specified one.
    help [name]             lists available commands or help on a specified command.
    revert migration        reverts the specified migration.
    up [migration]          apply all migrations, optionally only up to the specified one.

$ cat test/configs/db_working.json
{
  "test": "sqlite3://test/test.sqlite3",
  "manual": "sqlite3://manual.sqlite3"
}

$ bin/migrate -d test/configs/db_working.json -e manual create "new migration"
Migration "1385715876749-new migration" created.

$ cat "./migrations/1385715876749-new migration.js"

// Migration '1385715876749-new migration' created at '2013-11-29T09:04:36.749Z'
// Automatically created. Don't forget your up()/down() functions must call the
// callback parameter with any errors.
exports.up = function(db, callback)
{
  // db.query('CREATE TABLE IF NOT EXISTS users (id integer, name text);', function(err, res) {
  //    callback(err);
  // });

  callback(null);
};


exports.down = function(db, callback)
{
  // db.query('DROP TABLE users;', function(err, res) {
  //     callback(err);
  // });

  callback(null);
};

$ bin/migrate -d test/configs/db_working.json -e manual apply "1385715876749-new migration"

$ sqlite3 manual.sqlite3
SQLite version 3.7.11 2012-03-20 11:35:50
Enter ".help" for instructions
Enter SQL statements terminated with a ";"
sqlite> .schema
CREATE TABLE migrations (name TEXT PRIMARY KEY NOT NULL, date TEXT);
sqlite> select * from migrations;
1385715876749-new migration|2013-11-29 09:05:17
```
There is also a different [tutorial on the spriteCloud website](http://www.spritecloud.com/2014/04/node-js-database-migration/).

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## License
Copyright (c) 2013,2014 spriteCloud B.V. and other `node-any-db-migrate` contributors. All rights reserved.

See `LICENSE` for licensing details.
