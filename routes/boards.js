const express = require('express');
const router = express.Router();
const db = require('../database');
const { optionalAuth } = require('../middleware/auth');

// GET /api/boards - list all boards
router.get('/', (req, res) => {
  const boards = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM posts WHERE board_id = b.id AND is_removed = 0) as post_count
    FROM boards b
    WHERE b.is_active = 1
    ORDER BY b.sort_order ASC
  `).all();
  res.json({ boards });
});

// GET /api/boards/:slug - board details + recent posts
router.get('/:slug', optionalAuth, (req, res) => {
  const { slug } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const sort = req.query.sort || 'recent'; // recent | hot

  const board = db.prepare('SELECT * FROM boards WHERE slug = ? AND is_active = 1').get(slug);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  let orderBy = 'p.is_pinned DESC, p.last_reply_at DESC';
  if (sort === 'hot') {
    orderBy = 'p.is_pinned DESC, (p.reply_count + p.view_count) DESC, p.created_at DESC';
  }

  const posts = db.prepare(`
    SELECT p.id, p.uuid, p.title, p.reply_count, p.view_count, p.is_pinned, p.is_locked,
      p.last_reply_at, p.created_at,
      u.username as author
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.board_id = ? AND p.is_removed = 0
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(board.id, limit, offset);

  const total = db.prepare('SELECT COUNT(*) as cnt FROM posts WHERE board_id = ? AND is_removed = 0').get(board.id).cnt;

  res.json({ board, posts, total, page, pages: Math.ceil(total / limit) });
});

module.exports = router;
