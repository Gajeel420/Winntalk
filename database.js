const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'winnfield_talks.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'user',
      is_banned INTEGER DEFAULT 0,
      tos_agreed INTEGER DEFAULT 1,
      tos_agreed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT '📋',
      post_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      board_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      reply_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      is_removed INTEGER DEFAULT 0,
      last_reply_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (board_id) REFERENCES boards(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      is_removed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS post_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      vote INTEGER NOT NULL CHECK(vote IN (-1, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER,
      content_type TEXT NOT NULL,
      content_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      resolved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_posts_board ON posts(board_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_replies_post ON replies(post_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);

  // Seed boards if empty
  const boardCount = db.prepare('SELECT COUNT(*) as cnt FROM boards').get().cnt;
  if (boardCount === 0) {
    const insertBoard = db.prepare(
      'INSERT INTO boards (slug, name, description, icon, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    const seedBoards = db.transaction(() => {
      insertBoard.run('general', 'The Town Square', 'General chatter about Winnfield and the surrounding area', '🏛️', 1);
      insertBoard.run('gossip', 'Tea & Shade', 'Spill it. Who\'s doing what and with who.', '☕', 2);
      insertBoard.run('callouts', 'Put Em On Blast', 'Exposing the fools, frauds, and phonies of Winnfield', '🔦', 3);
      insertBoard.run('politics', 'City Hall Drama', 'Local government, elections, and the people running this town', '🏛️', 4);
      insertBoard.run('classifieds', 'Buy, Sell & Trade', 'Local marketplace for Winnfield residents', '🛒', 5);
      insertBoard.run('jobs', 'Jobs & Hustles', 'Employment, gigs, and side hustles around Winn Parish', '💼', 6);
    });
    seedBoards();
  }
}

initializeDatabase();
module.exports = db;
