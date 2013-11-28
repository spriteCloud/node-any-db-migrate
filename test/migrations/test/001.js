exports.up = function(db, callback)
{
  db.query('CREATE TABLE IF NOT EXISTS users (id integer, name text);', function(err, res) {
      if (err) {
        callback(err);
        return;
      }

      db.query('INSERT INTO users (id, name) VALUES (123, "foobar");', function(err2, res) {
        callback(err2);
      });
  });
};


exports.down = function(db, callback)
{
  db.query('DROP TABLE users;', function(err, res) {
      callback(err);
  });
};
