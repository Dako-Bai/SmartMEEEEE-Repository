// Lightweight admin interactions (demo data)
(function () {
  const users = [
    { id: 1, name: 'Әлихан Ж.', email: 'ali@example.kz', role: 'Админ', status: 'active', lastSeen: '2026-06-14' },
    { id: 2, name: 'Айдана С.', email: 'aidana@example.kz', role: 'Модератор', status: 'active', lastSeen: '2026-06-13' },
    { id: 3, name: 'Бек Н.', email: 'bek@example.kz', role: 'Қолданушы', status: 'inactive', lastSeen: '2026-05-30' },
    { id: 4, name: 'Гүлнар Т.', email: 'gulnar@example.kz', role: 'Қолданушы', status: 'active', lastSeen: '2026-06-12' }
  ];

  let currentPage = 1;
  const pageSize = 8;

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

  function renderStats() {
    $('#totalUsers').textContent = users.length;
    $('#active7').textContent = users.filter(u => u.status === 'active').length;
    $('#rolesCount').textContent = new Set(users.map(u => u.role)).size;
    $('#lastUpdated').textContent = new Date().toLocaleString();
  }

  function renderTable() {
    const tbody = $('#usersTableBody');
    tbody.innerHTML = '';
    const start = (currentPage - 1) * pageSize;
    const pageItems = users.slice(start, start + pageSize);
    pageItems.forEach((u, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-white/5';
      tr.innerHTML = `
        <td class="p-3">${start + idx + 1}</td>
        <td class="p-3">${u.name}</td>
        <td class="p-3">${u.email}</td>
        <td class="p-3">${u.role}</td>
        <td class="p-3">${u.status === 'active' ? '<span class="text-green-400">активті</span>' : '<span class="text-red-400">өшірулі</span>'}</td>
        <td class="p-3">
          <button class="editBtn px-2 py-1 mr-2 bg-white/3 rounded" data-id="${u.id}">Өңдеу</button>
          <button class="deleteBtn px-2 py-1 bg-red-600 rounded" data-id="${u.id}">Жою</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    $('#paginationInfo').textContent = `${users.length} нәтижелер — бет ${currentPage}`;
  }

  function openModal(title, bodyHtml) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    $('#modal').classList.remove('hidden');
  }

  function closeModal() { $('#modal').classList.add('hidden'); }

  // Events
  document.addEventListener('click', (e) => {
    if (e.target.matches('#addUserBtn')) {
      openModal('Жаңа пайдаланушы қосу', `
        <form id="addUserForm" class="grid gap-3">
          <input id="newName" placeholder="Аты-жөні" class="w-full rounded bg-transparent border border-white/5 px-3 py-2" />
          <input id="newEmail" placeholder="Email" class="w-full rounded bg-transparent border border-white/5 px-3 py-2" />
          <select id="newRole" class="w-full rounded bg-transparent border border-white/5 px-3 py-2">
            <option>Қолданушы</option>
            <option>Модератор</option>
            <option>Админ</option>
          </select>
          <div class="flex justify-end gap-2">
            <button type="button" id="cancelAdd" class="px-3 py-2 bg-white/3 rounded">Бас тарту</button>
            <button type="submit" class="px-3 py-2 bg-green-600 rounded">Қосу</button>
          </div>
        </form>
      `);
    }

    if (e.target.matches('#closeModal') || e.target.matches('#cancelAdd')) {
      closeModal();
    }

    if (e.target.matches('.editBtn')) {
      const id = Number(e.target.dataset.id);
      const u = users.find(x => x.id === id);
      if (!u) return;
      openModal('Пайдаланушыны өңдеу', `
        <form id="editUserForm" class="grid gap-3">
          <input id="editName" value="${u.name}" class="w-full rounded bg-transparent border border-white/5 px-3 py-2" />
          <input id="editEmail" value="${u.email}" class="w-full rounded bg-transparent border border-white/5 px-3 py-2" />
          <select id="editRole" class="w-full rounded bg-transparent border border-white/5 px-3 py-2">
            <option ${u.role === 'Қолданушы' ? 'selected' : ''}>Қолданушы</option>
            <option ${u.role === 'Модератор' ? 'selected' : ''}>Модератор</option>
            <option ${u.role === 'Админ' ? 'selected' : ''}>Админ</option>
          </select>
          <div class="flex justify-end gap-2">
            <button type="button" id="cancelEdit" class="px-3 py-2 bg-white/3 rounded">Бас тарту</button>
            <button type="submit" class="px-3 py-2 bg-accentBlue rounded">Сақтау</button>
          </div>
        </form>
      `);
    }

    if (e.target.matches('.deleteBtn')) {
      const id = Number(e.target.dataset.id);
      if (!confirm('Бұл пайдаланушыны жоюға сенімдісіз бе?')) return;
      const idx = users.findIndex(x => x.id === id);
      if (idx !== -1) { users.splice(idx, 1); renderStats(); renderTable(); }
    }

    if (e.target.matches('#exportCsv')) {
      const csv = [ ['id','name','email','role','status'].join(','), ...users.map(u => [u.id, u.name, u.email, u.role, u.status].join(',')) ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; a.click();
      URL.revokeObjectURL(url);
    }

    if (e.target.matches('#prevPage')) {
      if (currentPage > 1) currentPage--, renderTable();
    }
    if (e.target.matches('#nextPage')) {
      const max = Math.ceil(users.length / pageSize);
      if (currentPage < max) currentPage++, renderTable();
    }

    if (e.target.matches('#userBtn')) {
      $('#userMenu').classList.toggle('hidden');
    }

    if (e.target.matches('#themeToggle')) {
      document.body.classList.toggle('light-mode');
      alert('Тақырып ауыстырылды (демо)');
    }
  });

  // Form submissions
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.id === 'addUserForm') {
      const name = $('#newName').value.trim();
      const email = $('#newEmail').value.trim();
      const role = $('#newRole').value;
      if (!name || !email) { alert('Барлық өрістерді толтырыңыз'); return; }
      const newId = users.length ? Math.max(...users.map(u=>u.id)) + 1 : 1;
      users.push({ id: newId, name, email, role, status: 'active', lastSeen: new Date().toISOString().slice(0,10) });
      closeModal(); renderStats(); renderTable();
    }
    if (e.target.id === 'editUserForm') {
      const name = $('#editName').value.trim();
      const email = $('#editEmail').value.trim();
      const role = $('#editRole').value;
      const idx = users.findIndex(u => u.email === ($('#editEmail').dataset.original ?? email));
      // We will find by name/email combination in a safer implementation; here demo: find by name
      const u = users.find(x => x.email === email) || users.find(x => x.name === name);
      // For demo, update first matching by name
      const target = users.find(x => x.name === name) || users[0];
      target.name = name; target.email = email; target.role = role;
      closeModal(); renderStats(); renderTable();
    }

    if (e.target.id === 'settingsForm') {
      const appName = $('#appName').value;
      const appUrl = $('#appUrl').value;
      $('#appVersion').textContent = $('#appVersion').textContent + ' (saved)';
      alert('Баптаулар сақталды (демо)');
    }
  });

  // Modal close when clicking outside
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  // initial
  renderStats(); renderTable();
})();
