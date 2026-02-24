/* ============================================================
   post.js — Single post view + reply logic
   ============================================================ */

let postUuid = '';
let reportTarget = null;

async function loadPost() {
  const container = document.getElementById('postView');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  postUuid = params.get('id');

  if (!postUuid) {
    container.innerHTML = `
      <div class="empty-state" style="padding:4rem 2rem;">
        <div class="empty-state-icon">❓</div>
        <h3>Post not found</h3>
        <p><a href="/">Go home</a></p>
      </div>
    `;
    return;
  }

  try {
    const res = await fetch(`/api/posts/${encodeURIComponent(postUuid)}`);
    if (!res.ok) {
      container.innerHTML = `
        <div class="empty-state" style="padding:4rem 2rem;">
          <div class="empty-state-icon">🚫</div>
          <h3>Post not found or removed</h3>
          <p><a href="/">Go home</a></p>
        </div>
      `;
      return;
    }

    const data = await res.json();
    const { post, replies } = data;

    document.title = `${post.title} — Winnfield Talks`;

    // Build breadcrumb
    const board_link = `/pages/board.html?b=${encodeURIComponent(post.board_slug)}`;

    // Sidebar
    const sbName = document.getElementById('sidebarBoardName');
    const sbDesc = document.getElementById('sidebarBoardDesc');
    const sbLink = document.getElementById('sidebarBoardLink');
    if (sbName) sbName.textContent = post.board_name;
    if (sbLink) sbLink.href = board_link;

    const user = getUser();
    const replySection = isLoggedIn() ? `
      <div class="reply-composer">
        <div class="reply-composer-inner">
          <h3>Reply as ${escHtml(user?.username || 'Anonymous')}</h3>
          <div class="post-disclaimer">
            ⚖️ Your reply is your legal responsibility. No threats, no doxxing, no false facts presented as truth.
          </div>
          <div class="form-group">
            <label class="form-label">Your Reply <span class="char-count" id="replyCount">0/5,000</span></label>
            <textarea id="replyBody" class="form-textarea" placeholder="Type your reply..." maxlength="5000" rows="5"
              oninput="updateCount('replyBody','replyCount',5000)"></textarea>
          </div>
          <div id="replyError" class="form-error hidden"></div>
          <div class="reply-actions">
            <button class="btn btn-primary" onclick="submitReply()">Post Reply</button>
          </div>
        </div>
      </div>
    ` : `
      <div class="anon-notice" style="margin-bottom:1.5rem;">
        <span class="anon-icon">🔒</span>
        <div>
          <strong>Sign in to reply</strong>
          <p>Create a free anonymous account to join the conversation. No real name needed.</p>
          <a href="/pages/register.html" class="btn btn-primary" style="margin-top:.6rem;display:inline-flex;">Join Free</a>
        </div>
      </div>
    `;

    const repliesHtml = replies.length === 0
      ? `<div class="empty-state" style="padding:2rem;"><div class="empty-state-icon">💬</div><h3>No replies yet</h3><p>Be the first to respond.</p></div>`
      : replies.map((r, i) => `
          <div class="reply-card ${r.is_op ? 'op-reply' : ''}">
            <div class="reply-meta">
              <span class="post-author">
                ${escHtml(r.author)}
                ${r.is_op ? '<span class="author-badge op">OP</span>' : ''}
              </span>
              <span class="post-time">${relTime(r.created_at)}</span>
              <span style="margin-left:auto;font-size:.72rem;color:var(--text-muted);">#${i + 1}</span>
            </div>
            <div class="reply-body">${escHtml(r.body)}</div>
          </div>
        `).join('');

    container.innerHTML = `
      <nav class="breadcrumb" style="margin-bottom:1rem;">
        <a href="/">Home</a> <span>›</span>
        <a href="${board_link}">${escHtml(post.board_name)}</a>
        <span>›</span> <span>Thread</span>
      </nav>

      <div class="post-article">
        <div class="post-article-header">
          <h1 class="post-article-title">${escHtml(post.title)}</h1>
          <div class="post-article-meta">
            <span class="post-author">
              <span>🎭</span> ${escHtml(post.author)}
              <span class="author-badge">OP</span>
            </span>
            <span class="post-time">${relTime(post.created_at)}</span>
            <span class="stat-badge">💬 ${(post.reply_count || 0).toLocaleString()} replies</span>
            <span class="stat-badge">👁 ${(post.view_count || 0).toLocaleString()} views</span>
          </div>
        </div>

        <div class="post-article-body">${escHtml(post.body)}</div>

        <div class="post-article-footer">
          <button class="post-action-btn report" onclick="openReport('post', '${escHtml(post.uuid)}')">
            🚩 Report
          </button>
          <span style="margin-left:auto;font-size:.75rem;color:var(--text-muted);">
            Posted in <a href="${board_link}">${escHtml(post.board_name)}</a>
          </span>
        </div>
      </div>

      ${replySection}

      <div class="replies-section">
        <div class="replies-header">
          💬 Replies
          <span class="reply-count-badge">${replies.length.toLocaleString()}</span>
        </div>
        <div id="repliesList">${repliesHtml}</div>
      </div>
    `;
  } catch (e) {
    console.error(e);
    container.innerHTML = '<p style="color:var(--text-muted);padding:2rem;">Failed to load post.</p>';
  }
}

async function submitReply() {
  const body = document.getElementById('replyBody')?.value.trim();
  const errEl = document.getElementById('replyError');

  if (errEl) errEl.classList.add('hidden');

  if (!body || body.length < 2) {
    if (errEl) { errEl.textContent = 'Reply is too short.'; errEl.classList.remove('hidden'); }
    return;
  }

  const btn = document.querySelector('.reply-actions .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Posting...'; }

  try {
    const res = await apiFetch(`/api/posts/${encodeURIComponent(postUuid)}/replies`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
    const data = await res.json();

    if (!res.ok) {
      if (errEl) { errEl.textContent = data.error || 'Failed to post reply.'; errEl.classList.remove('hidden'); }
      if (btn) { btn.disabled = false; btn.textContent = 'Post Reply'; }
      return;
    }

    showToast('Reply posted!', 'success');
    document.getElementById('replyBody').value = '';
    document.getElementById('replyCount').textContent = '0/5,000';

    // Reload post to show new reply
    await loadPost();
    // Scroll to replies
    document.querySelector('.replies-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    if (errEl) { errEl.textContent = 'Network error.'; errEl.classList.remove('hidden'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Post Reply'; }
  }
}

function openReport(type, id) {
  reportTarget = { type, id };
  document.getElementById('reportModal')?.classList.remove('hidden');
}

function closeReport() {
  document.getElementById('reportModal')?.classList.add('hidden');
  reportTarget = null;
}

async function submitReport() {
  if (!reportTarget) return;
  const reason = document.getElementById('reportReason')?.value || 'other';

  try {
    await apiFetch(`/api/posts/${encodeURIComponent(reportTarget.id)}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    closeReport();
    showToast('Report submitted. Thank you.', 'success');
  } catch (e) {
    showToast('Failed to submit report.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadPost();
});
