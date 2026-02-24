const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { JWT_SECRET } = require('../middleware/auth');

// Generate a random anonymous username
function generateUsername() {
  const adjectives = [
    'Bayou', 'Piney', 'Winn', 'Parish', 'Creole', 'Swamp', 'Cypress', 'Magnolia',
    'Pelican', 'Cane', 'Moss', 'Pecan', 'Longleaf', 'Hwy84', 'RedDirt', 'Delta'
  ];
  const nouns = [
    'Ghost', 'Watcher', 'Whisperer', 'Scout', 'Lurker', 'Voice', 'Shadow',
    'Insider', 'Caller', 'Witness', 'Source', 'Neighbor', 'Local', 'Native'
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}${noun}${num}`;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, tos_agreed, disclaimer_agreed, age_confirmed } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!tos_agreed || !disclaimer_agreed || !age_confirmed) {
      return res.status(400).json({ error: 'You must agree to all terms to register' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userUuid = uuidv4();

    // Generate unique username
    let username = generateUsername();
    let attempts = 0;
    while (db.prepare('SELECT id FROM users WHERE username = ?').get(username) && attempts < 20) {
      username = generateUsername();
      attempts++;
    }

    const insert = db.prepare(`
      INSERT INTO users (uuid, email, password_hash, username, tos_agreed, tos_agreed_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `);
    const result = insert.run(userUuid, email.toLowerCase(), passwordHash, username);

    const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      token,
      user: { username, uuid: userUuid }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'This account has been suspended' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: { username: user.username, uuid: user.uuid }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth').authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
