/* ============================================================
   app.js — Homepage logic
   ============================================================ */

let currentFeedSort = 'recent';

async function loadBoards() {
  const grid = document.getElementById('boardsGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/boards');
    const data = await res.json();

    if (!data.boards || data.boards.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted);">No boards yet.</p>';
      return;
    }

    grid.innerHTML = data.boards.map(b => `
      <a href="/pages/board.html?b=${encodeURIComponent(b.slug)}" class="board-card">
        <span class="board-card-icon">${escHtml(b.icon)}</span>
        <div class="board-card-name">${escHtml(b.name)}</div>
        <div class="board-card-desc">${escHtml(b.description || '')}</div>
        <div class="board-card-meta">
          <span>📝 ${(b.post_count || 0).toLocaleString()} posts</span>
        </div>
      </a>
    `).join('');

    // Update stats
    const total = data.boards.reduce((s, b) => s + (b.post_count || 0), 0);
    const statPosts = document.getElementById('statPosts');
    const statBoards = document.getElementById('statBoards');
    if (statPosts) statPosts.textContent = total.toLocaleString();
    if (statBoards) statBoards.textContent = data.boards.length;
  } catch (e) {
    if (grid) grid.innerHTML = '<p style="color:var(--text-muted);">Could not load boards.</p>';
  }
}

async function loadRecentPosts(sort = 'recent') {
  const container = document.getElementById('recentPosts');
  if (!container) return;

  // Update sort buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === sort);
  });

  container.innerHTML = Array(5).fill('<div class="skeleton-post"></div>').join('');

  try {
    const endpoint = sort === 'trending' ? '/api/posts/trending' : '/api/posts/recent?limit=30';
    const res = await fetch(endpoint);
    const data = await res.json();

    const posts = data.posts || [];

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:3rem 2rem;">
          <div class="empty-state-icon">📭</div>
          <h3>No posts yet</h3>
          <p>Be the first to start a conversation.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(p => `
      <a href="/pages/post.html?id=${escHtml(p.uuid)}" class="post-row">
        <div>
          <div class="post-row-title">${escHtml(p.title)}</div>
          <div class="post-row-meta">
            <span class="post-board-tag">${escHtml(p.board_name)}</span>
            <span>by ${escHtml(p.author)}</span>
            <span>${relTime(p.last_reply_at || p.created_at)}</span>
          </div>
        </div>
        <div class="post-row-stats">
          <span class="stat-badge">💬 ${(p.reply_count || 0).toLocaleString()}</span>
          <span class="stat-badge">👁 ${(p.view_count || 0).toLocaleString()}</span>
        </div>
      </a>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:1rem;">Could not load posts.</p>';
  }
}

async function loadTicker() {
  const track = document.getElementById('tickerTrack');
  if (!track) return;
  try {
    const res = await fetch('/api/posts/trending');
    const data = await res.json();
    if (data.posts && data.posts.length > 0) {
      const items = data.posts.slice(0, 5).map(p =>
        `<a href="/pages/post.html?id=${encodeURIComponent(p.uuid)}" style="color:var(--text-secondary);margin-right:2rem;">${escHtml(p.title)}</a>`
      ).join(' ·&nbsp; ');
      track.innerHTML = items || 'Be the first to post something spicy.';
    } else {
      track.textContent = 'Welcome to Winnfield Talks — start the conversation.';
    }
  } catch (e) {
    track.textContent = 'Winnfield\'s anonymous voice — join the conversation.';
  }
}

// Sort button handlers
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFeedSort = btn.dataset.sort;
      loadRecentPosts(currentFeedSort);
    });
  });

  loadBoards();
  loadRecentPosts();
  loadTicker();
});
