/**
 * IF-AT App
 * - Teachers see only their own quizzes (admin sees all).
 * - Teachers can sign up, log in, create quizzes, get a QR code.
 * - Students can join by code or QR.
 * - Using Express, Session, SQLite.
 */

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
app.set('view engine', 'ejs');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

app.use(session({
  secret: 'some-random-secret-here',
  resave: false,
  saveUninitialized: false
}));

// Initialize DB
const db = new sqlite3.Database('database.db');

// Create/Upgrade Tables
db.run(`
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    questionCount INTEGER,
    optionCount INTEGER,
    correctAnswers TEXT,
    createdBy TEXT,
    quizTitle TEXT
  )
`);

// Seed admin if none exist
db.get('SELECT COUNT(*) AS count FROM teachers', (err, row) => {
  if (!err && row.count === 0) {
    db.run('INSERT INTO teachers (email, password) VALUES (?, ?)', [
      'admin@ri.edu.sg', 
      'Password1'
    ]);
    console.log('Seeded admin@ri.edu.sg / Password1');
  }
});

// --------------------------------------
// 1) Teacher Login & Sign-up
// --------------------------------------

// GET /console -> Login
app.get('/console', (req, res) => {
  if (req.session.teacherId) {
    return res.redirect('/console/dashboard');
  }
  res.render('login', { error: null });
});

// POST /console -> Authenticate
app.post('/console', (req, res) => {
  const { email, password } = req.body;
  db.get(
    'SELECT * FROM teachers WHERE email = ? AND password = ?',
    [email, password],
    (err, teacher) => {
      if (err) return res.send('DB error: ' + err.message);
      if (!teacher) {
        return res.render('login', {
          error: 'Invalid email or password. Please try again.'
        });
      }
      req.session.teacherId = teacher.id;
      req.session.teacherEmail = teacher.email;
      return res.redirect('/console/dashboard');
    }
  );
});

// GET /console/signup -> Show sign-up
app.get('/console/signup', (req, res) => {
  if (req.session.teacherId) {
    return res.redirect('/console/dashboard');
  }
  res.render('signup', { error: null });
});

// POST /console/signup -> Create teacher
app.post('/console/signup', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM teachers WHERE email = ?', [email], (err, existing) => {
    if (existing) {
      return res.render('signup', {
        error: 'This email is already registered. Try logging in.'
      });
    }
    db.run('INSERT INTO teachers (email, password) VALUES (?, ?)', [email, password], function(err2) {
      if (err2) {
        return res.send('Error creating account: ' + err2.message);
      }
      // Auto-login after signup
      db.get('SELECT * FROM teachers WHERE email = ?', [email], (err3, newTeacher) => {
        if (newTeacher) {
          req.session.teacherId = newTeacher.id;
          req.session.teacherEmail = newTeacher.email;
        }
        return res.redirect('/console/dashboard');
      });
    });
  });
});

// --------------------------------------
// 2) Teacher Dashboard
// --------------------------------------
app.get('/console/dashboard', (req, res) => {
  if (!req.session.teacherId) {
    return res.redirect('/console');
  }

  if (req.session.teacherEmail === 'admin@ri.edu.sg') {
    // Admin sees all
    db.all('SELECT * FROM forms', (err, rows) => {
      if (err) {
        return res.send('Error retrieving forms: ' + err.message);
      }
      res.render('dashboard', {
        forms: rows,
        teacherEmail: req.session.teacherEmail
      });
    });
  } else {
    // Non-admin sees only their own forms
    db.all(
      'SELECT * FROM forms WHERE createdBy = ?',
      [req.session.teacherEmail],
      (err, rows) => {
        if (err) {
          return res.send('Error retrieving forms: ' + err.message);
        }
        res.render('dashboard', {
          forms: rows,
          teacherEmail: req.session.teacherEmail
        });
      }
    );
  }
});

// --------------------------------------
// 3) Manage Teachers (Admin Only)
// --------------------------------------
app.get('/console/teachers', (req, res) => {
  if (!req.session.teacherId || req.session.teacherEmail !== 'admin@ri.edu.sg') {
    return res.redirect('/console/dashboard');
  }
  db.all('SELECT id, email FROM teachers', (err, teachers) => {
    if (err) return res.send('Error retrieving teachers: ' + err.message);
    res.render('teachers', { teachers });
  });
});

app.post('/console/teachers', (req, res) => {
  if (!req.session.teacherId || req.session.teacherEmail !== 'admin@ri.edu.sg') {
    return res.redirect('/console/dashboard');
  }
  const { email, password } = req.body;
  db.run('INSERT INTO teachers (email, password) VALUES (?, ?)', [email, password], function(err) {
    if (err) {
      return res.send('Error creating teacher: ' + err.message);
    }
    return res.redirect('/console/teachers');
  });
});

app.get('/console/deleteTeacher/:id', (req, res) => {
  if (!req.session.teacherId || req.session.teacherEmail !== 'admin@ri.edu.sg') {
    return res.redirect('/console/dashboard');
  }
  db.run('DELETE FROM teachers WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.send('Error deleting teacher: ' + err.message);
    }
    return res.redirect('/console/teachers');
  });
});

// --------------------------------------
// 4) Create / Delete Quizzes
// --------------------------------------
app.get('/console/new', (req, res) => {
  if (!req.session.teacherId) {
    return res.redirect('/console');
  }
  res.render('newForm');
});

app.post('/console/new', (req, res) => {
  if (!req.session.teacherId) {
    return res.redirect('/console');
  }
  const { quizTitle, questionCount, optionCount, correctAnswers } = req.body;
  const code = uuidv4().split('-')[0];

  db.run(`
    INSERT INTO forms (code, questionCount, optionCount, correctAnswers, createdBy, quizTitle)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  [code, questionCount, optionCount, correctAnswers, req.session.teacherEmail, quizTitle],
  function(err) {
    if (err) {
      return res.send('Error saving form: ' + err.message);
    }
    return res.redirect('/console/dashboard');
  });
});

// Only admin or quiz creator can delete
app.get('/console/delete/:id', (req, res) => {
  if (!req.session.teacherId) {
    return res.redirect('/console');
  }
  const quizId = req.params.id;
  const currentEmail = req.session.teacherEmail;

  db.get('SELECT createdBy FROM forms WHERE id = ?', [quizId], (err, form) => {
    if (err) return res.send('Error checking form ownership: ' + err.message);
    if (!form) {
      return res.send('Quiz not found!');
    }

    if (currentEmail === 'admin@ri.edu.sg' || form.createdBy === currentEmail) {
      db.run('DELETE FROM forms WHERE id = ?', [quizId], function(err2) {
        if (err2) {
          return res.send('Error deleting form: ' + err2.message);
        }
        return res.redirect('/console/dashboard');
      });
    } else {
      return res.send(`
        <h3>Access Denied</h3>
        <p>You are not allowed to delete this quiz.</p>
        <p><a href="/console/dashboard">Back to Dashboard</a></p>
      `);
    }
  });
});

// --------------------------------------
// 5) QR Code Route
// --------------------------------------
app.get('/console/qr/:id', (req, res) => {
  if (!req.session.teacherId) {
    return res.redirect('/console');
  }
  const quizId = req.params.id;
  const currentEmail = req.session.teacherEmail;

  // Check ownership or admin
  db.get('SELECT * FROM forms WHERE id = ?', [quizId], (err, form) => {
    if (err) return res.send('DB error: ' + err.message);
    if (!form) return res.send('Quiz not found!');

    if (currentEmail !== 'admin@ri.edu.sg' && form.createdBy !== currentEmail) {
      return res.send(`
        <h3>Access Denied</h3>
        <p>You are not allowed to see this quiz.</p>
        <p><a href="/console/dashboard">Back to Dashboard</a></p>
      `);
    }

    // Form is valid and user is authorized
    res.render('showQR', { form });
  });
});

// --------------------------------------
// 6) Logout
// --------------------------------------
app.get('/console/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/console');
  });
});

// --------------------------------------
// 7) Student Console (With ?code param for auto-join + manual entry)
// --------------------------------------
app.get('/', (req, res) => {
  // If there's a code param => auto-join
  const code = req.query.code;
  if (code) {
    db.get('SELECT * FROM forms WHERE code = ?', [code], (err, row) => {
      if (err) return res.send('Error fetching code: ' + err.message);
      if (!row) return res.send('<h3>Invalid code!</h3><p><a href="/">Go back</a></p>');

      // Render quiz
      return res.render('studentQuiz', {
        code: row.code,
        questionCount: row.questionCount,
        optionCount: row.optionCount,
        correctAnswers: row.correctAnswers.split(','),
        quizTitle: row.quizTitle
      });
    });
  } else {
    // Otherwise show the home page
    res.render('studentHome');
  }
});

// POST /join -> Student enters code manually
app.post('/join', (req, res) => {
  const { code } = req.body;
  db.get('SELECT * FROM forms WHERE code = ?', [code], (err, row) => {
    if (err) return res.send('Error fetching code: ' + err.message);
    if (!row) {
      return res.send('<h3>Invalid code!</h3><p><a href="/">Go back</a></p>');
    }
    return res.render('studentQuiz', {
      code: row.code,
      questionCount: row.questionCount,
      optionCount: row.optionCount,
      correctAnswers: row.correctAnswers.split(','),
      quizTitle: row.quizTitle
    });
  });
});

// --------------------------------------
// 8) Start Server
// --------------------------------------
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('IF-AT app running on port ' + listener.address().port);
});
