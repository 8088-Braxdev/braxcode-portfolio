/* Nexus AI - client logic */
let sbOrders = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    sbOrders = supabase.createClient(
      'https://lopjjyxeypggctwxgrjo.supabase.co',
      'sb_publishable_bGkDJCOyiE1srtMaxr1RRg_DAAHjxCf'
    );
  } else {
    console.warn('Supabase library unavailable - order saving disabled');
  }
} catch (err) {
  console.error('Supabase init failed - order saving disabled', err);
}

const userProfile = { name: '', avatar: '' };

let pendingOrders = {};
let currentChatId = null;
let chats = {};
let isPending = false;
let isNearBottom = true;
let chipTitle = null;

function isTouchDevice() {
  return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

/* ---------- DROPDOWN ---------- */
function toggleDropdown() {
  document.getElementById('profileDropdown').classList.toggle('show');
}

document.addEventListener('click', function (e) {
  const drop = document.getElementById('profileDropdown');
  const prof = document.getElementById('topbarProfile');
  if (!drop || !prof) return;
  if (!drop.contains(e.target) && !prof.contains(e.target)) {
    drop.classList.remove('show');
  }
});

function clearHistory() {
  if (confirm('Clear all chat history?')) {
    chats = {};
    saveChats();
    currentChatId = null;
    renderChatList();
    showWelcome();
    document.getElementById('profileDropdown').classList.remove('show');
  }
}

/* ---------- HAPTIC ---------- */
function hapticFeedback(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern || [10]);
}

/* ---------- STORAGE ---------- */
function saveChats() {
  try {
    localStorage.setItem('brx_chats', JSON.stringify(chats));
  } catch (err) {
    console.warn('Could not save conversations', err);
  }
}

function isValidChat(chat) {
  return !!chat && typeof chat === 'object' && Array.isArray(chat.messages);
}

function loadChats() {
  try {
    const raw = localStorage.getItem('brx_chats');
    if (!raw) { chats = {}; return; }
    const parsed = JSON.parse(raw);
    const clean = {};
    if (parsed && typeof parsed === 'object') {
      Object.keys(parsed).forEach(function (key) {
        const chat = parsed[key];
        if (!isValidChat(chat)) return;
        const id = typeof chat.id === 'string' && chat.id ? chat.id : key;
        const messages = chat.messages
          .filter(function (m) {
            return m && typeof m.content === 'string' && m.content.length > 0 &&
              (m.role === 'user' || m.role === 'assistant');
          })
          .map(function (m) { return { role: m.role, content: m.content }; });
        clean[id] = {
          id: id,
          title: typeof chat.title === 'string' && chat.title ? chat.title : 'Conversation',
          messages: messages,
          createdAt: Number(chat.createdAt) || Date.now()
        };
      });
    }
    chats = clean;
  } catch (err) {
    console.warn('Saved conversations were unreadable - starting fresh', err);
    try { localStorage.removeItem('brx_chats'); } catch (e) { /* ignore */ }
    chats = {};
  }
}

/* ---------- SIDEBAR ---------- */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open', isOpen);
  const toggle = document.querySelector('.hamburger');
  if (toggle) toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if (!isOpen && toggle) {
    try { toggle.focus(); } catch (e) { /* ignore */ }
  }
}

function newChat() {
  const id = 'chat_' + Date.now();
  chats[id] = { id: id, title: 'New conversation', messages: [], createdAt: Date.now() };
  saveChats();
  currentChatId = id;
  renderChatList();
  updateTopbarTitle();
  showEmptyChat();
  if (window.innerWidth <= 768) toggleSidebar();
}

function showEmptyChat() {
  toggleQuickBar(true);
  const inner = document.getElementById('messagesInner');
  if (!inner) return;
  inner.innerHTML = `
    <div class="welcome">
      <svg class="welcome-logo" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="88" fill="none" stroke="#ff4c4c" stroke-width="5"/>
        <path d="M118 18 L68 105 L98 105 L82 182 L148 82 L112 82 Z" fill="#ff4c4c"/>
      </svg>
      <h1>New conversation</h1>
      <p>Ask Nexus anything to get started.</p>
    </div>
  `;
  const wrap2 = document.getElementById('messagesWrap');
  if (wrap2) requestAnimationFrame(function () { wrap2.scrollTop = 0; });
}

function switchChat(id) {
  currentChatId = id;
  renderChatList();
  updateTopbarTitle();
  renderMessages();
  if (window.innerWidth <= 768) toggleSidebar();
}

function deleteChat(id, e) {
  if (e) e.stopPropagation();
  hapticFeedback([5, 5, 5]);
  delete chats[id];
  saveChats();
  if (currentChatId === id) {
    const rem = Object.keys(chats);
    if (rem.length > 0) switchChat(rem[rem.length - 1]);
    else { currentChatId = null; showWelcome(); updateTopbarTitle(); }
  }
  renderChatList();
  updateTopbarTitle();
}

function updateChatTitle(id, firstMsg, titleOverride) {
  if (chats[id]) {
    const base = (titleOverride && String(titleOverride).trim()) ? String(titleOverride).trim() : firstMsg;
    chats[id].title = base.slice(0, 40) + (base.length > 40 ? '...' : '');
    saveChats();
    renderChatList();
    updateTopbarTitle();
  }
}

function toggleQuickBar(show) {
  const bar = document.getElementById('quickBar');
  if (bar) bar.classList.toggle('show', !!show);
}

function updateTopbarTitle() {
  const el = document.getElementById('topbarConvoTitle');
  if (!el) return;
  let title = 'New conversation';
  if (currentChatId && chats[currentChatId]) {
    title = chats[currentChatId].title || 'New conversation';
  }
  el.textContent = title;
}

/* ---------- RENDER CHAT LIST ---------- */
function renderChatList() {
  const list = document.getElementById('chatList');
  if (!list) return;
  const sorted = Object.values(chats).sort(function (a, b) { return b.createdAt - a.createdAt; });
  if (sorted.length === 0) {
    list.innerHTML = '<div style="padding:12px 14px;font-size:14px;color:var(--text3);">No conversations yet</div>';
    return;
  }
  list.innerHTML = sorted.map(function (chat) {
    return `
      <div class="chat-item ${chat.id === currentChatId ? 'active' : ''}" onclick="switchChat('${chat.id}')" tabindex="0">
        <span class="chat-item-text">${escapeHtml(chat.title)}</span>
        <button class="chat-delete" onclick="deleteChat('${chat.id}', event)" aria-label="Delete conversation">
          <svg class="icon" viewBox="0 0 384 512"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>
        </button>
      </div>
    `;
  }).join('');
}

/* ---------- LOGO ---------- */
const LOGO_SVG = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;"><circle cx="100" cy="100" r="88" fill="none" stroke="#ff4c4c" stroke-width="7"/><path d="M118 18 L68 105 L98 105 L82 182 L148 82 L112 82 Z" fill="#ff4c4c"/></svg>';
const SPARK_SVG = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2l1.75 5.15a3 3 0 001.9 1.9L20.8 11l-5.15 1.75a3 3 0 00-1.9 1.9L12 19.8l-1.75-5.15a3 3 0 00-1.9-1.9L3.2 11l5.15-1.75a3 3 0 001.9-1.9L12 2.2zM18.6 15.2l.7 2.05 2.05.7-2.05.7-.7 2.05-.7-2.05-2.05-.7 2.05-.7.7-2.05z"/></svg>';

/* ---------- WELCOME ---------- */
function showWelcome() {
  const inner = document.getElementById('messagesInner');
  if (!inner) return;
  toggleQuickBar(false);
  inner.innerHTML = `
    <div class="welcome">
      <svg class="welcome-logo" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="88" fill="none" stroke="#ff4c4c" stroke-width="5"/>
        <path d="M118 18 L68 105 L98 105 L82 182 L148 82 L112 82 Z" fill="#ff4c4c"/>
      </svg>
      <h1>Welcome to <span>BraxCode</span> Digitals Foundation</h1>
      <p>We build AI systems, custom web apps &amp; digital solutions from Mwanza, Tanzania. Ask Nexus anything about our work - or explore below.</p>
  `;
  const wrap = document.getElementById('messagesWrap');
  if (wrap) requestAnimationFrame(function () { wrap.scrollTop = 0; });
}

/* ---------- RENDER MESSAGES ---------- */
function renderMessages() {
  const inner = document.getElementById('messagesInner');
  if (!inner) return;
  if (!currentChatId || !chats[currentChatId] || chats[currentChatId].messages.length === 0) {
    showWelcome();
    return;
  }
  toggleQuickBar(true);
  inner.innerHTML = chats[currentChatId].messages.map(function (m) {
    return buildMsgHTML(m.role, m.content);
  }).join('');
  scrollToBottom();
}

function parseOrderSummary(text) {
  const match = text.match(/\[PROJECT_BRIEF\]([\s\S]*?)\[\/PROJECT_BRIEF\]/);
  if (!match) return null;
  const body = match[1];
  const get = function (label) {
    const m = body.match(new RegExp(label + ':\\s*(.+)'));
    return m ? m[1].trim() : '-';
  };
  return {
    project: get('Project'),
    scope: get('Scope'),
    budget: get('Budget'),
    timeline: get('Timeline'),
    contact: get('Contact'),
  };
}

function buildOrderCardHTML(order) {
  const id = 'order_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  pendingOrders[id] = order;
  return `
    <div class="message-row">
      <div class="msg-av bot">${LOGO_SVG}</div>
      <div class="msg-content">
        <div class="msg-name">Nexus ${SPARK_SVG}</div>
        <div class="msg-bubble bot" style="max-width:100%;">
          <div class="brief-card">
            <div class="brief-title">PROJECT BRIEF</div>
            <div class="brief-row"><strong>Project:</strong> ${escapeHtml(order.project)}</div>
            <div class="brief-row"><strong>Scope:</strong> ${escapeHtml(order.scope)}</div>
            <div class="brief-row"><strong>Budget:</strong> ${escapeHtml(order.budget)}</div>
            <div class="brief-row"><strong>Timeline:</strong> ${escapeHtml(order.timeline)}</div>
            <div class="brief-row"><strong>Contact:</strong> ${escapeHtml(order.contact)}</div>
            <div class="brief-actions">
              <button class="brief-btn" onclick="confirmOrder('${id}')">Confirm &amp; Send via WhatsApp</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function confirmOrder(id) {
  const order = pendingOrders[id];
  if (!order) return;
  if (sbOrders) {
    try {
      await sbOrders.from('orders').insert([order]);
    } catch (err) {
      console.error('Order save failed', err);
    }
  }
  const msg = 'Hi BraxCode! I spoke with Nexus AI and here is my project brief:\n\nProject: ' + order.project + '\nScope: ' + order.scope + '\nBudget: ' + order.budget + '\nTimeline: ' + order.timeline + '\nContact: ' + order.contact;
  window.open('https://wa.me/255618811359?text=' + encodeURIComponent(msg), '_blank');
}

function buildMsgHTML(role, content, options) {
  options = options || {};
  const isBot = role === 'assistant';
  if (isBot) {
    const order = parseOrderSummary(content);
    if (order) return buildOrderCardHTML(order);
  }
  const avatar = userProfile.avatar;
  const name = userProfile.name || 'You';
  const showActions = isBot && options.actions !== false;

  const avHTML = isBot
    ? `<div class="msg-av bot">${LOGO_SVG}</div>`
    : `<div class="msg-av usr">${avatar ? `<img src="${escapeAttr(avatar)}" alt=""/>` : '<svg class="icon" style="font-size:0.65rem" viewBox="0 0 448 512"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>'}</div>`;

  const copyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
  const actions = showActions ? `
      <div class="msg-actions">
        <button class="action-btn" type="button" aria-label="Copy response" onclick="copyMessage(this)">
          ${copyIcon}
        </button>
        <span class="copy-status" aria-live="polite"></span>
      </div>` : '';

  return `
    <div class="message-row ${isBot ? '' : 'user'}">
      ${avHTML}
      <div class="msg-content">
        <div class="msg-name">${isBot ? 'Nexus ' + SPARK_SVG : escapeHtml(name)}</div>
        <div class="msg-bubble ${isBot ? 'bot' : 'usr'}">${formatMsg(content)}</div>
        ${actions}
      </div>
    </div>
  `;
}

const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#ff4c4c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

function copyMessage(btn) {
  const row = btn.closest('.message-row');
  const bubble = row ? row.querySelector('.msg-bubble') : null;
  const text = bubble ? bubble.innerText : '';
  const status = row ? row.querySelector('.copy-status') : null;
  const original = btn.innerHTML;
  const done = function () {
    btn.innerHTML = CHECK_ICON;
    if (status) status.textContent = 'Copied';
    setTimeout(function () {
      btn.innerHTML = original || COPY_ICON;
      if (status) status.textContent = '';
    }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () {
      fallbackCopy(text);
      done();
    });
  } else {
    fallbackCopy(text);
    done();
  }
}

function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) { /* ignore */ }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

/* ---------- FORMAT MESSAGE ---------- */
function formatMsg(text) {
  // Split out fenced code blocks first.
  const parts = [];
  const fenceRegex = /```([\s\S]*?)```/g;
  let last = 0;
  let m;
  while ((m = fenceRegex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    parts.push({ type: 'code', value: m[1] });
    last = fenceRegex.lastIndex;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });

  const html = parts.map(function (part) {
    if (part.type === 'code') {
      return '<pre><code>' + escapeHtml(part.value.replace(/^\n/, '').replace(/\n$/, '')) + '</code></pre>';
    }
    return formatTextBlock(part.value);
  }).join('');
  return html.replace(/\[OPEN_GALLERY\]/g,
    '<span onclick="openGallery()" style="color:var(--coral);cursor:pointer;text-decoration:underline;text-underline-offset:3px;">Open Gallery</span>'
  );
}

function formatTextBlock(text) {
  const escaped = escapeHtml(text);
  // auto-link urls
  let html = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  // bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Build paragraphs/lists by blank lines.
  const blocks = html.split(/\n{2,}/);
  return blocks.map(function (block) {
    const lines = block.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
    if (lines.length === 0) return '';
    const allUl = lines.every(function (l) { return /^[-*]\s+/.test(l); });
    const allOl = lines.every(function (l) { return /^\d+\.\s+/.test(l); });
    if (allUl) {
      return '<ul>' + lines.map(function (l) {
        return '<li>' + l.replace(/^[-*]\s+/, '') + '</li>';
      }).join('') + '</ul>';
    }
    if (allOl) {
      return '<ol>' + lines.map(function (l) {
        return '<li>' + l.replace(/^\d+\.\s+/, '') + '</li>';
      }).join('') + '</ol>';
    }
    return '<p>' + lines.join('<br>') + '</p>';
  }).join('');
}

/* ---------- SEND ---------- */
async function sendMessage() {
  if (isPending) return;
  const input = document.getElementById('messageInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  hapticFeedback([8]);
  isPending = true;
  updateSendState();

  if (!currentChatId) {
    const id = 'chat_' + Date.now();
    chats[id] = { id: id, title: text.slice(0, 40), messages: [], createdAt: Date.now() };
    currentChatId = id;
    saveChats();
    renderChatList();
  }

  if (chats[currentChatId].messages.length === 0) updateChatTitle(currentChatId, text, chipTitle);
  chipTitle = null;

  chats[currentChatId].messages.push({ role: 'user', content: text });
  saveChats();
  updateTopbarTitle();

  input.value = '';
  input.style.height = 'auto';
  input.style.overflowY = 'hidden';
  applyComposerMaxHeight();
  if (isTouchDevice()) {
    try { input.blur(); } catch (e) { /* ignore */ }
  } else {
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
  }

  const inner = document.getElementById('messagesInner');
  if (inner && inner.querySelector('.welcome')) inner.innerHTML = '';
  toggleQuickBar(true);
  const userMsgId = 'msg_' + Date.now();
  if (inner) inner.innerHTML += buildMsgHTML('user', text);

  const typingId = 'typing_' + Date.now();
  if (inner) {
    inner.innerHTML += `
      <div class="message-row" id="${typingId}">
        <div class="msg-av bot">${LOGO_SVG}</div>
        <div class="msg-content">
          <div class="msg-name">Nexus ${SPARK_SVG}</div>
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      </div>
    `;
  }

  if (isNearBottom) scrollToBottom();

  try {
    const msgs = chats[currentChatId].messages.map(function (m) { return { role: m.role, content: m.content }; });

    const controller = new AbortController();
    const timeoutId = setTimeout(function () { controller.abort(); }, 25000);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ messages: msgs })
    });

    clearTimeout(timeoutId);

    const data = await res.json();
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    if (data.error) throw new Error((data.error && data.error.message) || 'API error');

    const reply = data.choices[0].message.content;
    chats[currentChatId].messages.push({ role: 'assistant', content: reply });
    saveChats();

    if (inner) inner.innerHTML += buildMsgHTML('assistant', reply);
    if (isNearBottom) scrollToBottom();

    hapticFeedback([5]);
  } catch (err) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    const msg = err && err.name === 'AbortError'
      ? 'Network is slow - please try again with a better connection.'
      : 'Connection issue - please check your network and try again.';
    if (inner) inner.innerHTML += buildMsgHTML('assistant', msg, { actions: false });
    if (isNearBottom) scrollToBottom();
  } finally {
    isPending = false;
    updateSendState();
  }
}

function quickSend(text, title) {
  chipTitle = title || null;
  const input = document.getElementById('messageInput');
  if (input) input.value = text;
  updateSendState();
  sendMessage();
  if (isTouchDevice()) {
    try {
      if (document.activeElement && (document.activeElement === input || document.activeElement.classList.contains('chip'))) {
        document.activeElement.blur();
      }
    } catch (e) { /* ignore */ }
  }
}

/* ---------- INPUT ---------- */
function applyComposerMaxHeight() {
  const el = document.getElementById('messageInput');
  if (!el) return;
  let max = 200;
  if (window.innerWidth < 900 && window.visualViewport) {
    const vv = window.visualViewport;
    max = Math.min(160, Math.max(88, 0.30 * vv.height));
    if (document.body.classList.contains('kb-open')) {
      max = Math.min(max, 0.35 * vv.height);
    }
  }
  el.style.maxHeight = Math.round(max) + 'px';
  return max;
}

function handleInput(el) {
  applyComposerMaxHeight();
  el.style.height = 'auto';
  const max = parseFloat(el.style.maxHeight) || 200;
  const h = Math.min(el.scrollHeight, max);
  el.style.height = h + 'px';
  if (el.scrollHeight > max) el.style.overflowY = 'auto';
  else el.style.overflowY = 'hidden';

  const counter = document.getElementById('charCounter');
  if (counter) {
    if (el.value.length > 1700) {
      counter.hidden = false;
      counter.textContent = el.value.length + '/2000';
    } else {
      counter.hidden = true;
    }
  }
  updateSendState();
  const inner = document.getElementById('messagesInner');
  const wrap = document.getElementById('messagesWrap');
  if (wrap && inner && !inner.querySelector('.welcome') && isNearBottom) {
    scrollToBottom();
  }
}

function updateKeyboardState() {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  const focused = document.activeElement === document.getElementById('messageInput');
  let kbOpen = (window.innerHeight - vv.height > 120) || (vv.height < 480);
  if (isTouchDevice()) {
    if (focused || vv.height < (0.75 * (window.screen && window.screen.availHeight ? window.screen.availHeight : window.innerHeight))) {
      kbOpen = true;
    } else if (vv.height >= 480 && window.innerHeight - vv.height <= 120) {
      kbOpen = false;
    }
    document.body.classList.toggle('kb-open', kbOpen);
  } else {
    document.body.classList.toggle('kb-open', false);
  }
  applyComposerMaxHeight();
  updateChipsState();
  const inner = document.getElementById('messagesInner');
  const wrap = document.getElementById('messagesWrap');
  if (wrap && inner && !inner.querySelector('.welcome') && isNearBottom) {
    scrollToBottom();
  }
}

function updateChipsState() {
  const chips = document.querySelectorAll('.chip');
  chips.forEach(function (c) { c.disabled = isPending; });
  // hide chips when mobile keyboard open
  const wrap = document.getElementById('quickChips');
  if (wrap && window.visualViewport) {
    wrap.style.display = window.visualViewport.height < 480 ? 'none' : '';
  }
}

function handleKeydown(e) {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (e.key === 'Enter' && !e.shiftKey && !coarse) {
    e.preventDefault();
    sendMessage();
  }
}

function updateSendState() {
  const btn = document.getElementById('sendBtn');
  const input = document.getElementById('messageInput');
  if (!btn || !input) return;
  const empty = input.value.trim().length === 0;
  btn.disabled = empty || isPending;
  updateChipsState();
}

/* ---------- SCROLL ---------- */
function scrollToBottom() {
  const wrap = document.getElementById('messagesWrap');
  const inner = document.getElementById('messagesInner');
  if (!wrap) return;
  if (inner && inner.querySelector('.welcome')) return;
  const behavior = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'auto' : 'smooth';
  setTimeout(function () {
    wrap.scrollTo({ top: wrap.scrollHeight, behavior: behavior });
  }, 50);
}

function setupScrollTracking() {
  const wrap = document.getElementById('messagesWrap');
  if (!wrap) return;
  wrap.addEventListener('scroll', function () {
    const distance = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight;
    isNearBottom = distance < 120;
  });
}

/* ---------- GALLERY / MISSION ---------- */
function openGallery() {
  const panel = document.getElementById('galleryPanel');
  const frame = document.getElementById('galleryFrame');
  if (panel) panel.classList.add('show');
  if (frame && (!frame.src || frame.src === window.location.href)) {
    frame.src = 'gallery.html';
  }
}

function closeGallery() {
  const panel = document.getElementById('galleryPanel');
  if (panel) panel.classList.remove('show');
}

function showMission() {
  const panel = document.getElementById('missionPanel');
  if (panel) panel.classList.add('show');
}

function closeMission() {
  const panel = document.getElementById('missionPanel');
  if (panel) panel.classList.remove('show');
}

/* ---------- VISUAL VIEWPORT ---------- */
function syncAppViewport() {
  try {
    if (window.visualViewport) {
      const vv = window.visualViewport;
      document.documentElement.style.setProperty('--app-h', vv.height + 'px');
      document.documentElement.style.setProperty('--app-top', vv.offsetTop + 'px');
      if (document.scrollingElement && document.scrollingElement.scrollTop !== 0) {
        window.scrollTo(0, 0);
      }
    } else {
      document.documentElement.style.removeProperty('--app-h');
      document.documentElement.style.removeProperty('--app-top');
    }
  } catch (e) { /* ignore */ }
  updateKeyboardState();
}

function onAppViewportChange() {
  syncAppViewport();
}

/* ---------- INIT ---------- */
function renderInitialView() {
  if (currentChatId && chats[currentChatId]) renderMessages();
  else showWelcome();
  updateTopbarTitle();
}

function ensureMessageArea() {
  const inner = document.getElementById('messagesInner');
  if (inner && inner.children.length === 0) showWelcome();
}

function startApp() {
  try { loadChats(); } catch (err) { console.error('load conversations', err); }
  try { renderChatList(); } catch (err) { console.error('render recent list', err); }
  try { renderInitialView(); } catch (err) { console.error('render welcome or active chat', err); }
  try { ensureMessageArea(); } catch (err) { console.error('welcome fallback', err); }
  setupScrollTracking();
  syncAppViewport();
  applyComposerMaxHeight();
  updateKeyboardState();
  window.addEventListener('resize', onAppViewportChange);
  window.addEventListener('orientationchange', onAppViewportChange);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onAppViewportChange);
    window.visualViewport.addEventListener('scroll', onAppViewportChange);
  }
  const input = document.getElementById('messageInput');
  if (input) {
    input.addEventListener('focus', function () {
      setTimeout(function () {
        if (isNearBottom) scrollToBottom();
      }, 200);
    });
    input.addEventListener('focusin', function () {
      if (isTouchDevice()) document.body.classList.add('kb-open');
      syncAppViewport();
      setTimeout(syncAppViewport, 120);
      setTimeout(syncAppViewport, 350);
    });
    input.addEventListener('focusout', function () {
      if (isTouchDevice()) {
        setTimeout(function () {
          if (document.activeElement !== input) document.body.classList.remove('kb-open');
        }, 100);
      }
      setTimeout(syncAppViewport, 120);
      setTimeout(syncAppViewport, 350);
    });
  }
  updateSendState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

/* ---------- KEYBOARD ---------- */
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  closeGallery();
  closeMission();
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('open')) toggleSidebar();
  const drop = document.getElementById('profileDropdown');
  if (drop) drop.classList.remove('show');
  const input = document.getElementById('messageInput');
  if (input && document.activeElement === input) {
    try { input.blur(); } catch (err) { /* ignore */ }
    document.body.classList.remove('kb-open');
    setTimeout(syncAppViewport, 120);
  }
});
