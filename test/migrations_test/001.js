exports.up = function(db, callback)
{
  db.query('CREATE TABLE IF NOT EXISTS users (id integer, name text);', function(err, res) {
      callback(err);
  });
};


exports.down = function(db, callback)
{
  db.query('DROP TABLE users;', function(err, res) {
      callback(err);
  });
};
