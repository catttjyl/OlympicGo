var express = require('express');
var bodyParser = require('body-parser');
var mysql = require('mysql2');
var path = require('path');
var connection = mysql.createConnection({
                host: '34.44.103.18',
                user: 'root',
                port: 3306,
                password: 'olympics011',
                database: 'paris2024'
});

connection.connect;


var app = express();

var userID = '';

// set up ejs view engine 
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
 
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '/public')));

/* GET home page, respond by rendering index.ejs */
app.get('/', function(req, res) {
  res.render('index', { title: 'homepage' });
});

app.get('/profile', function(req, res) {
  res.render('profile', { title: 'Users profile' });
});

app.get('/map', function(req, res) {
  res.render('map', { title: 'Show map with filter' });
});

app.get('/filter', function(req, res) {
  res.render('filter', { title: 'Show map with filter' });
});

app.get('/plannar', function(req, res) {
  res.render('plannar', { title: 'Show map with filter' });
});

app.post('/login', function(req, res) {
  const { username, password } = req.body;
  console.log("current user+pass", username, password);
  var sql = `
  SELECT * FROM Users 
  WHERE AccountName = '${username}' AND Password = '${password}'`;

  connection.query(sql, function(err, results) {
    if (err || results.length === 0) {
      console.log(results);
      console.log("Invalid username or password");
      res.status(401).send({ message: 'Invalid username or password' });
      return;
    } else {
      console.log("log in successfully!");
      userID = results[0].UserID;
      res.redirect('/profile');
    }
  });
});

app.post('/logup', function(req, res) {
  const { username, password } = req.body;
  console.log("new user+pass", username, password);

  connection.query(`CALL AddUser(?, ?, @user_id);`, [username, password], function(err, results) {
    if (err) {
      console.log("create user failed", err);
      res.status(401).send({ message: 'create user failed' });
      return;
    } else {
      console.log("create user successfully!");
      connection.query(`SELECT @user_id AS user_id;`, function(err, results) {
        if (err) {
          console.log("Error fetching user ID", err);
          res.status(500).send({ message: 'Error fetching user ID' });
          return;
        }
        userID = results[0].user_id;  // Ensure that this line correctly navigates the results structure
        res.redirect('/profile');
      });
    }
  });
});

app.get('/api/check-login', function(req, res) {
  console.log('current user:', userID);
  if (userID) {
      res.json({ isLoggedIn: true });
  } else {
      res.json({ isLoggedIn: false });
  }
});

app.post('/api/login/password', function(req, res) {
  const { oldpass, newpass } = req.body;
  var sql_check = `
  SELECT * FROM Users 
  WHERE UserID = '${userID}' AND Password = '${oldpass}'`;

  var sql_uodate = `UPDATE Users SET Password = '${newpass}' WHERE UserID = '${userID}'`;
  
  connection.query(sql_check, function(err, results) {
    if (err || results.length === 0) {
      res.status(401).send({ message: 'Wrong password' });
      return;
    } else {
      connection.query(sql_uodate, function(err, results) {
        if (err) {
          console.error('Error setting password:', err);
          res.status(500).send({ message: 'Error setting password', error: err });
          return;
        }
        console.log(`password change to: ${newpass}`);
        res.redirect('/profile');
      });
    }
  });
});

app.get('/api/login/events', function(req, res) {
  var sql = `
  SELECT EventName, GROUP_CONCAT(DISTINCT VenueName ORDER BY VenueName SEPARATOR ',\n') AS VenueList
  FROM Events NATURAL JOIN Favorites NATURAL JOIN Users NATURAL JOIN Locations
  WHERE UserID = '${userID}'
  GROUP BY EventName
  ORDER BY EventName`;

  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching attendance data:', err);
      res.status(500).send({ message: 'Error fetching attendance data', error: err });
      return;
    }
    res.json(results);
  });
});

app.get('/api/login/events/delete', function(req, res) {
  var eventname = req.query.event || '';
  console.log(`try to delete ${eventname}`);
  var sql = `UPDATE Favorites SET EventName = '' WHERE UserID = '${userID}' AND EventName = '${eventname}'`;

  connection.query(sql, function(err, result) {
    if (err) {
      console.error('Error deleting event:', err);
      res.status(500).send({ message: 'Error deleting event', error: err });
      return;
    }
    if(result.affectedRows === 0) {
      // No rows were affected, meaning no record was found with that ID
      res.status(404).send({ message: 'Record not found' });
    } else {
      res.send({ message: 'Event deleted successfully' });
    }
  });
});

app.get('/api/login/athletes', function(req, res) {
  var sql = `
  SELECT CONCAT(FirstName, ' ', LastName) AS FullName,
    GROUP_CONCAT(DISTINCT EventName ORDER BY EventName SEPARATOR ', ') AS EventList, 
    Nationality
  FROM Athletes NATURAL JOIN Favorites NATURAL JOIN Users 
  WHERE UserID = '${userID}'
  GROUP BY FirstName, LastName, Nationality
  ORDER BY LastName`;

  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching attendance data:', err);
      res.status(500).send({ message: 'Error fetching attendance data', error: err });
      return;
    }
    res.json(results);
  });
});

app.get('/api/login/athletes/delete', function(req, res) {
  var athname = req.query.athlete || '';
  console.log(`try to delete ${athname}`);

  connection.query(`SELECT AthleteID FROM Athletes WHERE CONCAT(FirstName, ' ', LastName) = ?`, [athname], function(err, result) {
    if (err) {
      console.error('Error retrieving athlete IDs:', err);
      res.status(500).send({ message: 'Error retrieving athlete IDs', error: err });
      return;
    }
    const athleteIDs = result.map(row => row.AthleteID);
    if (athleteIDs.length === 0) {
      console.log('No athletes found for the provided name.');
      return;
    }

    var sql = `UPDATE Favorites SET AthleteID = '' WHERE UserID = ? AND AthleteID in (?)`;
    connection.query(sql, [userID, athleteIDs], (updateErr, updateResults) => {
      if (updateErr) {
        console.error('Error updating Favorites:', updateErr);
        return;
      }
      if(updateResults.affectedRows === 0) {
        // No rows were affected, meaning no record was found with that ID
        res.status(404).send({ message: 'Record not found' });
      } else {
        res.send({ message: 'Event athlete successfully' });
        console.log('Favorites updated successfully:', updateResults.affectedRows);
      }
    });
  });
});

app.post('/api/logout', function(req, res) {
  userID = '';
  res.redirect('/');
});

app.get('/api/profile', function(req, res) {
  var sql = `
  SELECT * FROM Users
  WHERE UserID = '${userID}'`;

  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching attendance data:', err);
      res.status(500).send({ message: 'Error fetching attendance data', error: err });
      return;
    }
    res.json(results);
  });
});

app.get('/api/venues', function(req, res) {
  const searchTerm = req.query.search || '';
  var sql = `
  SELECT SiteCode, VenueName, Latitude, Longitude, 
    GROUP_CONCAT(DISTINCT EventName ORDER BY EventName SEPARATOR ', ') AS EventList
  FROM Locations NATURAL JOIN Events
  WHERE SiteCode LIKE '%${searchTerm}%' OR VenueName LIKE '%${searchTerm}%'
  GROUP BY SiteCode`;

  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching attendance data:', err);
      res.status(500).send({ message: 'Error fetching attendance data', error: err });
      return;
    }
    res.json(results);
  });
});

app.get('/api/sports', function(req, res) {
  const searchTerm = req.query.search || '';
  var sql = `
  SELECT DISTINCT EventName
  FROM Events
  WHERE EventName LIKE '%${searchTerm}%'
  ORDER BY EventName`;

  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching attendance data:', err);
      res.status(500).send({ message: 'Error fetching attendance data', error: err });
      return;
    }
    res.json(results);
  });
});

app.get('/api/athletes', function(req, res) {
  const searchTerm = req.query.search || '';
  var sql = `
  SELECT CONCAT(FirstName, ' ', LastName) AS FullName,
    GROUP_CONCAT(DISTINCT EventName ORDER BY EventName SEPARATOR ', ') AS EventList, 
    Nationality
  FROM Athletes NATURAL JOIN Participate NATURAL JOIN Events 
  WHERE (FirstName LIKE '%${searchTerm}%' OR LastName LIKE '%${searchTerm}%')
      AND FirstName != 'Team Australia'
  GROUP BY FirstName, LastName, Nationality
  ORDER BY LastName`;

  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching attendance data:', err);
      res.status(500).send({ message: 'Error fetching attendance data', error: err });
      return;
    }
    res.json(results);
  });
});

app.get('/api/coordinates', function(req, res) {
  const searchTerm = req.query.search || '';
  var sql = `
  SELECT DISTINCT Latitude, Longitude
  FROM Locations NATURAL JOIN Athletes NATURAL JOIN Participate NATURAL JOIN Events
  WHERE EventName = '${searchTerm}' OR CONCAT(FirstName, ' ', LastName) = '${searchTerm}'`;

  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching attendance data:', err);
      res.status(500).send({ message: 'Error fetching attendance data', error: err });
      return;
    }
    res.json(results);
  });
});

app.get('/api/events', function(req, res) {
  var sql = 'SELECT * FROM Events NATURAL JOIN Locations';

  connection.query(sql, function(err, results) {
    if (err) {
      console.error('Error fetching events data:', err);
      res.status(500).send({ message: 'Error fetching events data', error: err });
      return;
    }
    res.json(results);
  });
});

app.listen(80, function () {
    console.log('Node app is running on port 80');
});