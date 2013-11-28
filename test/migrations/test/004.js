exports.up = function(db, callback)
{
  // Already covered by 001.js
  db.query('CREATE TABLE users (id integer, name text);', function(err, res) {
      callback(err);
  });
};


exports.down = function(db, callback)
{
  // Already covered by 001.js
  db.query('DROP TABLE users;', function(err, res) {
      callback(err);
  });
};
