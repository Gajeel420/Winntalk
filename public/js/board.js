/* ============================================================
   board.js — Board page logic
   ============================================================ */

let boardSlug = '';
let currentPage = 1;
let currentSort = 'recent';

async function loadBoard(sort) {
  if (sort) {
    currentSort = sort;
    currentPage = 1;
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === sort);
    });
  }

  const container = document.getElementById('boardPosts');
  if (!container) return;

  container.innerHTML = Array(5).fill('<div class="skeleton-post"></div>').join('');

  try {
    const res = await fetch(`/api/boards/${encodeURIComponent(boardSlug)}?page=${currentPage}&sort=${currentSort}`);
    if (!res.ok) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><h3>Board not found</h3></div>`;
      return;
    }

    const data = await res.json();

    // Populate header
    document.getElementById('boardName').textContent = data.board.name;
    document.getElementById('boardTitle').textContent = data.board.name;
    document.getElementById('boardIcon').textContent = data.board.icon || '📋';
    document.getElementById('boardDesc').textContent = data.board.description || '';
    document.getElementById('boardPostCount').textContent = `${(data.total || 0).toLocaleString()} posts`;
    document.title = `${data.board.name} — Winnfield Talks`;

    // Update sidebar
    const sbName = document.getElementById('sidebarBoardName');
    const sbDesc = document.getElementById('sidebarBoardDesc');
    const sbLink = document.getElementById('sidebarBoardLink');
    if (sbName) sbName.textContent = data.board.name;
    if (sbDesc) sbDesc.textContent = data.board.description || '';
    if (sbLink) sbLink.href = `/pages/board.html?b=${encodeURIComponent(boardSlug)}`;

    if (!data.posts || data.posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:3rem 2rem;">
          <div class="empty-state-icon">📭</div>
          <h3>No posts yet</h3>
          <p>Be the first to post on this board.</p>
        </div>
      `;
      renderPagination(data.pages || 0);
      return;
    }

    container.innerHTML = data.posts.map(p => `
      <a href="/pages/post.html?id=${escHtml(p.uuid)}" class="post-row ${p.is_pinned ? 'post-row-pinned' : ''}">
        <div>
          <div class="post-row-title">${p.is_pinned ? '📌 ' : ''}${escHtml(p.title)}${p.is_locked ? ' 🔒' : ''}</div>
          <div class="post-row-meta">
            <span>by ${escHtml(p.author)}</span>
            <span>Last reply ${relTime(p.last_reply_at || p.created_at)}</span>
          </div>
        </div>
        <div class="post-row-stats">
          <span class="stat-badge">💬 ${(p.reply_count || 0).toLocaleString()}</span>
          <span class="stat-badge">👁 ${(p.view_count || 0).toLocaleString()}</span>
        </div>
      </a>
    `).join('');

    renderPagination(data.pages || 0);
  } catch (e) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:1rem;">Failed to load posts.</p>';
  }
}

function renderPagination(pages) {
  const pg = document.getElementById('pagination');
  if (!pg) return;

  if (pages <= 1) { pg.innerHTML = ''; return; }

  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }
  pg.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  loadBoard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openNewPost() {
  if (!isLoggedIn()) {
    document.getElementById('authModal')?.classList.remove('hidden');
    return;
  }
  document.getElementById('newPostModal')?.classList.remove('hidden');
}

function closeNewPost() {
  document.getElementById('newPostModal')?.classList.add('hidden');
}

async function submitPost(e) {
  e.preventDefault();
  const title = document.getElementById('postTitle').value.trim();
  const body = document.getElementById('postBody').value.trim();
  const errEl = document.getElementById('postError');
  const btn = document.getElementById('submitPostBtn');

  errEl.classList.add('hidden');

  if (!title || !body) {
    errEl.textContent = 'Title and body are required.';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Posting...';

  try {
    const res = await apiFetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ board_slug: boardSlug, title, body })
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Failed to post.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Post It';
      return;
    }

    closeNewPost();
    document.getElementById('newPostForm').reset();
    document.getElementById('titleCount').textContent = '0/200';
    document.getElementById('bodyCount').textContent = '0/10,000';
    showToast('Post created! Redirecting...', 'success');

    setTimeout(() => {
      window.location.href = `/pages/post.html?id=${data.uuid}`;
    }, 800);
  } catch (err) {
    errEl.textContent = 'Network error. Try again.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Post It';
  }
}

// Close modal on overlay click
document.getElementById('newPostModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeNewPost();
});

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  boardSlug = params.get('b') || 'general';
  loadBoard();
});
