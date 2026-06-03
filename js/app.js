/**
 * App Module — Logic utama Notes App
 * Mengelola navigasi, CRUD catatan, pencarian, filter, dan UI interactions.
 */

;(async function() {
  'use strict';

  // ====== Kategori config ======
  const CATEGORIES = {
    umum:      { emoji: '📋', label: 'Umum' },
    pekerjaan: { emoji: '💼', label: 'Pekerjaan' },
    belajar:   { emoji: '📚', label: 'Belajar' },
    belanja:   { emoji: '🛒', label: 'Belanja' },
    ide:       { emoji: '💡', label: 'Ide' },
    pribadi:   { emoji: '❤️', label: 'Pribadi' }
  };

  // ====== DOM Elements ======
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const landingPage     = $('#landing-page');
  const dashboard       = $('#dashboard');
  const startBtn        = $('#start-btn');
  const backBtn         = $('#back-to-landing');
  const newNoteBtn      = $('#new-note-btn');
  const searchInput     = $('#search-input');
  const categoryFilter  = $('#category-filter');
  const sortFilter      = $('#sort-filter');
  const notesGrid       = $('#notes-grid');
  const noteCount       = $('#note-count');

  // Modal
  const modalOverlay    = $('#modal-overlay');
  const modalTitle      = $('#modal-title');
  const modalMeta       = $('#modal-meta');
  const modalMetaText   = $('#modal-meta-text');
  const modalCloseBtn   = $('#modal-close-btn');
  const titleInput      = $('#note-title-input');
  const contentInput    = $('#note-content-input');
  const categorySelect  = $('#note-category-select');
  const saveBtn         = $('#save-note-btn');
  const cancelBtn       = $('#cancel-note-btn');
  const deleteBtn       = $('#delete-note-btn');

  const toastContainer  = $('#toast-container');

  // ====== State ======
  let allNotes = [];
  let editingId = null;
  let debounceTimer = null;

  // ====== Database Init ======
  const db = new NotesDB();
  try {
    await db.init();
  } catch (err) {
    console.error('Database error:', err);
    showToast('Gagal membuka database. Pastikan browser mendukung IndexedDB.', 'error');
  }

  // ====== Cek apakah user sudah pernah masuk dashboard ======
  const hasVisited = localStorage.getItem('catatanku_visited');
  if (hasVisited) {
    showDashboard(false);
  }

  // ====== Navigation ======

  function showDashboard(animate = true) {
    landingPage.classList.add('hidden');
    dashboard.classList.remove('hidden');
    if (animate) dashboard.classList.add('page-enter');
    localStorage.setItem('catatanku_visited', '1');
    loadNotes();
  }

  function showLanding() {
    dashboard.classList.add('hidden');
    dashboard.classList.remove('page-enter');
    landingPage.classList.remove('hidden');
    localStorage.removeItem('catatanku_visited');
  }

  startBtn.addEventListener('click', () => showDashboard(true));
  backBtn.addEventListener('click', showLanding);

  // ====== Load & Render Notes ======

  async function loadNotes() {
    try {
      allNotes = await db.getAll();
      applyFiltersAndRender();
    } catch (err) {
      console.error('Load error:', err);
      showToast('Gagal memuat catatan.', 'error');
    }
  }

  function applyFiltersAndRender() {
    let notes = [...allNotes];

    // Filter kategori
    const cat = categoryFilter.value;
    if (cat && cat !== 'semua') {
      notes = notes.filter(n => n.category === cat);
    }

    // Search
    const query = searchInput.value.trim().toLowerCase();
    if (query) {
      notes = notes.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
      );
    }

    // Sort
    const sort = sortFilter.value;
    switch (sort) {
      case 'newest':
        notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'oldest':
        notes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'az':
        notes.sort((a, b) => a.title.localeCompare(b.title, 'id'));
        break;
      case 'za':
        notes.sort((a, b) => b.title.localeCompare(a.title, 'id'));
        break;
    }

    renderNotes(notes);
    noteCount.textContent = allNotes.length;
  }

  function renderNotes(notes) {
    if (notes.length === 0) {
      const isSearching = searchInput.value.trim() || categoryFilter.value !== 'semua';
      notesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${isSearching ? '🔍' : '📝'}</div>
          <h3>${isSearching ? 'Tidak ditemukan' : 'Belum ada catatan'}</h3>
          <p>${isSearching
            ? 'Coba ubah kata kunci atau filter kategori.'
            : 'Klik tombol "Buat Catatan" untuk memulai mencatat kegiatanmu!'
          }</p>
        </div>
      `;
      return;
    }

    notesGrid.innerHTML = notes.map((note, i) => {
      const cat = CATEGORIES[note.category] || CATEGORIES.umum;
      const created = formatDate(note.createdAt);
      const previewText = Security.preview(note.content, 120);
      const titleText = Security.sanitize(note.title);

      return `
        <article class="note-card" data-id="${note.id}" style="animation-delay: ${Math.min(i * 0.04, 0.36)}s" tabindex="0" role="button" aria-label="Buka catatan: ${titleText}">
          <div class="note-card-header">
            <h3>${titleText}</h3>
          </div>
          <div class="note-card-content">${previewText}</div>
          <div class="note-card-footer">
            <div class="note-timestamp">
              <span>${created.date}</span>
              <span class="time">${created.time}</span>
            </div>
            <span class="category-tag cat-${note.category}">${cat.emoji} ${cat.label}</span>
          </div>
        </article>
      `;
    }).join('');

    // Attach click listeners
    notesGrid.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', () => openEditModal(card.dataset.id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEditModal(card.dataset.id);
        }
      });
    });
  }

  // ====== Date Formatting ======

  function formatDate(isoString) {
    const d = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const day = d.getDate().toString().padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    const secs = d.getSeconds().toString().padStart(2, '0');

    return {
      date: `${day} ${month} ${year}`,
      time: `${hours}:${mins}:${secs}`,
      full: `${day} ${month} ${year}, ${hours}:${mins}:${secs}`
    };
  }

  // ====== Modal ======

  function openNewModal() {
    editingId = null;
    modalTitle.textContent = 'Catatan Baru';
    titleInput.value = '';
    contentInput.value = '';
    categorySelect.value = 'umum';
    deleteBtn.classList.add('hidden');
    modalMeta.classList.add('hidden');
    openModal();
    titleInput.focus();
  }

  function openEditModal(id) {
    const note = allNotes.find(n => n.id === id);
    if (!note) return;

    editingId = id;
    modalTitle.textContent = 'Edit Catatan';
    titleInput.value = note.title;
    contentInput.value = note.content;
    categorySelect.value = note.category;
    deleteBtn.classList.remove('hidden');

    // Show metadata
    const created = formatDate(note.createdAt);
    const updated = formatDate(note.updatedAt);
    let metaHtml = `Dibuat: ${created.full}`;
    if (note.updatedAt !== note.createdAt) {
      metaHtml += ` · Diubah: ${updated.full}`;
    }
    modalMetaText.textContent = metaHtml;
    modalMeta.classList.remove('hidden');

    openModal();
  }

  function openModal() {
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    editingId = null;
  }

  // ====== Save Note ======

  async function saveNote() {
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const category = categorySelect.value;

    // Validate title
    const titleCheck = Security.validateLength(title, 200);
    if (!titleCheck.valid) {
      showToast('Judul: ' + titleCheck.message, 'error');
      titleInput.focus();
      return;
    }

    // Validate content
    const contentCheck = Security.validateLength(content, 50000);
    if (!contentCheck.valid) {
      showToast('Isi: ' + contentCheck.message, 'error');
      contentInput.focus();
      return;
    }

    try {
      if (editingId) {
        await db.update(editingId, { title, content, category });
        showToast('Catatan berhasil diperbarui! ✅', 'success');
      } else {
        await db.add({ title, content, category });
        showToast('Catatan berhasil disimpan! ✨', 'success');
      }
      closeModal();
      await loadNotes();
    } catch (err) {
      console.error('Save error:', err);
      showToast('Gagal menyimpan catatan.', 'error');
    }
  }

  // ====== Delete Note ======

  async function deleteNote() {
    if (!editingId) return;

    // Konfirmasi menggunakan custom inline approach (no confirm() for cleaner UX)
    // Simplified: use native confirm for now
    const confirmed = confirm('Yakin ingin menghapus catatan ini? Tindakan ini tidak bisa dibatalkan.');
    if (!confirmed) return;

    try {
      await db.delete(editingId);
      showToast('Catatan dihapus. 🗑️', 'info');
      closeModal();
      await loadNotes();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Gagal menghapus catatan.', 'error');
    }
  }

  // ====== Toast Notifications ======

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const safeMessage = Security.sanitize(message);

    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${safeMessage}</span>`;
    toastContainer.appendChild(toast);

    // Auto-remove after 3.5s
    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
  }

  // ====== Search & Filter ======

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFiltersAndRender(), 200);
  });

  categoryFilter.addEventListener('change', applyFiltersAndRender);
  sortFilter.addEventListener('change', applyFiltersAndRender);

  // ====== Event Listeners ======

  newNoteBtn.addEventListener('click', openNewModal);
  saveBtn.addEventListener('click', saveNote);
  cancelBtn.addEventListener('click', closeModal);
  deleteBtn.addEventListener('click', deleteNote);
  modalCloseBtn.addEventListener('click', closeModal);

  // Close modal on overlay click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape = close modal
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeModal();
    }
    // Ctrl+N = new note (only on dashboard)
    if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !dashboard.classList.contains('hidden')) {
      e.preventDefault();
      openNewModal();
    }
    // Ctrl+S = save note (when modal is open)
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && modalOverlay.classList.contains('active')) {
      e.preventDefault();
      saveNote();
    }
  });

  // Smooth scroll for "Cara Kerja" link
  document.querySelector('a[href="#cara-kerja"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('cara-kerja')?.scrollIntoView({ behavior: 'smooth' });
  });

})();
