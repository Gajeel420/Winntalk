const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken, optionalAuth, requireAdmin } = require('../middleware/auth');

// GET /api/posts/recent - homepage feed
router.get('/recent', optionalAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const posts = db.prepare(`
    SELECT p.id, p.uuid, p.title, p.reply_count, p.view_count, p.last_reply_at, p.created_at,
      u.username as author,
      b.name as board_name, b.slug as board_slug
    FROM posts p
    JOIN users u ON p.user_id = u.id
    JOIN boards b ON p.board_id = b.id
    WHERE p.is_removed = 0 AND b.is_active = 1
    ORDER BY p.last_reply_at DESC
    LIMIT ?
  `).all(limit);
  res.json({ posts });
});

// GET /api/posts/trending
router.get('/trending', (req, res) => {
  const posts = db.prepare(`
    SELECT p.id, p.uuid, p.title, p.reply_count, p.view_count, p.last_reply_at, p.created_at,
      u.username as author,
      b.name as board_name, b.slug as board_slug,
      (p.reply_count * 3 + p.view_count) as heat_score
    FROM posts p
    JOIN users u ON p.user_id = u.id
    JOIN boards b ON p.board_id = b.id
    WHERE p.is_removed = 0 AND b.is_active = 1
      AND p.created_at > datetime('now', '-7 days')
    ORDER BY heat_score DESC, p.created_at DESC
    LIMIT 10
  `).all();
  res.json({ posts });
});

// GET /api/posts/:uuid - single post with replies
router.get('/:uuid', optionalAuth, (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.username as author, b.name as board_name, b.slug as board_slug
    FROM posts p
    JOIN users u ON p.user_id = u.id
    JOIN boards b ON p.board_id = b.id
    WHERE p.uuid = ? AND p.is_removed = 0
  `).get(req.params.uuid);

  if (!post) return res.status(404).json({ error: 'Post not found' });

  // Increment view count
  db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE uuid = ?').run(req.params.uuid);

  const replies = db.prepare(`
    SELECT r.id, r.uuid, r.body, r.created_at, u.username as author,
      CASE WHEN r.user_id = p.user_id THEN 1 ELSE 0 END as is_op
    FROM replies r
    JOIN users u ON r.user_id = u.id
    JOIN posts p ON r.post_id = p.id
    WHERE r.post_id = ? AND r.is_removed = 0
    ORDER BY r.created_at ASC
  `).all(post.id);

  res.json({ post, replies });
});

// POST /api/posts - create new post
router.post('/', authenticateToken, (req, res) => {
  const { board_slug, title, body } = req.body;

  if (!board_slug || !title || !body) {
    return res.status(400).json({ error: 'Board, title, and body are required' });
  }
  if (title.length < 5 || title.length > 200) {
    return res.status(400).json({ error: 'Title must be between 5 and 200 characters' });
  }
  if (body.length < 10 || body.length > 10000) {
    return res.status(400).json({ error: 'Post body must be between 10 and 10,000 characters' });
  }

  const board = db.prepare('SELECT id FROM boards WHERE slug = ? AND is_active = 1').get(board_slug);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const postUuid = uuidv4();
  const insert = db.prepare(`
    INSERT INTO posts (uuid, board_id, user_id, title, body)
    VALUES (?, ?, ?, ?, ?)
  `);
  insert.run(postUuid, board.id, req.user.id, title.trim(), body.trim());

  res.status(201).json({ uuid: postUuid, message: 'Post created successfully' });
});

// POST /api/posts/:uuid/replies - add reply
router.post('/:uuid/replies', authenticateToken, (req, res) => {
  const { body } = req.body;

  if (!body || body.length < 2 || body.length > 5000) {
    return res.status(400).json({ error: 'Reply must be between 2 and 5,000 characters' });
  }

  const post = db.prepare('SELECT id, is_locked FROM posts WHERE uuid = ? AND is_removed = 0').get(req.params.uuid);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.is_locked) return res.status(403).json({ error: 'This thread is locked' });

  const replyUuid = uuidv4();
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO replies (uuid, post_id, user_id, body) VALUES (?, ?, ?, ?)').run(
      replyUuid, post.id, req.user.id, body.trim()
    );
    db.prepare(`
      UPDATE posts SET reply_count = reply_count + 1, last_reply_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(post.id);
  });
  tx();

  res.status(201).json({ uuid: replyUuid, message: 'Reply posted' });
});

// POST /api/posts/:uuid/report
router.post('/:uuid/report', optionalAuth, (req, res) => {
  const { reason } = req.body;
  const post = db.prepare('SELECT id FROM posts WHERE uuid = ? AND is_removed = 0').get(req.params.uuid);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  db.prepare('INSERT INTO reports (reporter_id, content_type, content_id, reason) VALUES (?, ?, ?, ?)').run(
    req.user ? req.user.id : null, 'post', post.id, reason || 'No reason given'
  );
  res.json({ message: 'Report submitted' });
});

// DELETE /api/posts/:uuid - admin remove
router.delete('/:uuid', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('UPDATE posts SET is_removed = 1 WHERE uuid = ?').run(req.params.uuid);
  res.json({ message: 'Post removed' });
});

// GET /api/posts/search?q=
router.get('/search', optionalAuth, (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) return res.status(400).json({ error: 'Search query too short' });

  const results = db.prepare(`
    SELECT p.uuid, p.title, p.reply_count, p.created_at,
      u.username as author, b.name as board_name, b.slug as board_slug
    FROM posts p
    JOIN users u ON p.user_id = u.id
    JOIN boards b ON p.board_id = b.id
    WHERE p.is_removed = 0 AND (p.title LIKE ? OR p.body LIKE ?)
    ORDER BY p.created_at DESC
    LIMIT 30
  `).all(`%${q}%`, `%${q}%`);

  res.json({ results, query: q });
});

module.exports = router;
