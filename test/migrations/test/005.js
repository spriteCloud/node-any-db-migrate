exports.up = function(db, callback)
{
  db.query('CREATE TABLE IF NOT EXISTS users2 (id integer, name text);', function(err, res) {
      callback(err);
  });
};


exports.down = function(db, callback)
{
  db.query('DROP TABLE users2;', function(err, res) {
      callback(err);
  });
};
