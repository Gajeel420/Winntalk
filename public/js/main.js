/* ============================================================
   main.js — Shared utilities loaded on every page
   ============================================================ */

// ---- Auth helpers ----
function getToken() { return localStorage.getItem('wt_token'); }
function getUser()  {
  try { return JSON.parse(localStorage.getItem('wt_user')); }
  catch { return null; }
}
function isLoggedIn() { return !!getToken(); }

function logout() {
  localStorage.removeItem('wt_token');
  localStorage.removeItem('wt_user');
  window.location.href = '/';
}

// ---- Render navbar auth state ----
function renderNav() {
  const actionsEl = document.getElementById('navActions');
  if (!actionsEl) return;

  const user = getUser();
  if (user && getToken()) {
    actionsEl.innerHTML = `
      <div class="nav-user">
        <span class="nav-username" title="Your anonymous username">🎭 ${escHtml(user.username)}</span>
        <button class="btn btn-ghost" onclick="logout()">Sign Out</button>
      </div>
    `;
    // Update mobile menu too
    const mm = document.getElementById('mobileMenu');
    if (mm) {
      mm.innerHTML = `
        <span class="nav-username">🎭 ${escHtml(user.username)}</span>
        <button class="btn btn-ghost w-full" onclick="logout()">Sign Out</button>
      `;
    }
    // Update sidebar CTA if present
    const cta = document.getElementById('sidebarCta');
    if (cta) {
      cta.innerHTML = `
        <h3>Ready to Post?</h3>
        <p>You're signed in as <strong>${escHtml(user.username)}</strong>. Completely anonymous.</p>
        <a href="/pages/board.html?b=gossip" class="btn btn-primary w-full">Go to Tea & Shade ☕</a>
      `;
    }
  }
}

// ---- Toggle mobile menu ----
function toggleMobileMenu() {
  const mm = document.getElementById('mobileMenu');
  if (mm) mm.style.display = mm.style.display === 'flex' ? 'none' : 'flex';
}

// ---- Escape HTML ----
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- Format relative time ----
function relTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = (now - date) / 1000;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- Fetch with auth ----
async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  return res;
}

// ---- Toast notifications ----
function showToast(message, type = 'success', duration = 3500) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ---- Search ----
async function doSearch() {
  const q = (document.getElementById('searchInput')?.value || '').trim();
  if (!q) return;

  const modal = document.getElementById('searchModal');
  const results = document.getElementById('searchResults');
  const title = document.getElementById('searchModalTitle');

  if (!modal) {
    window.location.href = `/?q=${encodeURIComponent(q)}`;
    return;
  }

  modal.classList.remove('hidden');
  if (title) title.textContent = `Results for "${q}"`;
  if (results) results.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Searching...</p>';

  try {
    const res = await fetch(`/api/posts/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      results.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3>No results found</h3>
          <p>Try a different search term</p>
        </div>
      `;
      return;
    }

    results.innerHTML = data.results.map(p => `
      <a href="/pages/post.html?id=${escHtml(p.uuid)}" class="post-row" onclick="closeSearch()">
        <div>
          <div class="post-row-title">${escHtml(p.title)}</div>
          <div class="post-row-meta">
            <span class="post-board-tag">${escHtml(p.board_name)}</span>
            <span>by ${escHtml(p.author)}</span>
            <span>${relTime(p.created_at)}</span>
          </div>
        </div>
        <div class="stat-badge">💬 ${p.reply_count}</div>
      </a>
    `).join('');
  } catch (e) {
    if (results) results.innerHTML = '<p style="color:var(--text-muted);padding:1rem;">Search failed. Try again.</p>';
  }
}

function closeSearch() {
  const modal = document.getElementById('searchModal');
  if (modal) modal.classList.add('hidden');
}

// Search on Enter key
document.addEventListener('DOMContentLoaded', () => {
  renderNav();

  const si = document.getElementById('searchInput');
  if (si) {
    si.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  }

  // Show welcome banner if just registered
  const params = new URLSearchParams(window.location.search);
  if (params.get('registered') === '1') {
    const username = params.get('username');
    const main = document.querySelector('.main-container');
    if (main && username) {
      const banner = document.createElement('div');
      banner.className = 'welcome-banner';
      banner.innerHTML = `
        <div class="welcome-banner-text">
          <strong>Welcome to Winnfield Talks, ${escHtml(username)}! 🎉</strong>
          <span>Your anonymous identity is set. Start posting below — your real name is never shown.</span>
        </div>
        <button class="banner-close" onclick="this.parentElement.remove()">✕</button>
      `;
      main.insertBefore(banner, main.firstChild);
    }
    // Clean URL
    window.history.replaceState({}, '', '/');
  }
});

// Character counter helper
function updateCount(inputId, countId, max) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(countId);
  if (input && counter) {
    const len = input.value.length;
    counter.textContent = `${len.toLocaleString()}/${max.toLocaleString()}`;
    counter.style.color = len > max * 0.9 ? 'var(--red)' : 'var(--text-muted)';
  }
}
