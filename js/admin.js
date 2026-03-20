/* ===========================================================
   admin.js – Wedding RSVP Admin Panel Logic
   Văn Cường & Hải Lý
=========================================================== */

// Khởi tạo trang admin khi load xong
window.addEventListener('load', function() {
  initAdmin();
});


// 🔧 Dán URL Google Apps Script vào đây (cùng URL với main.js)
// Xem file google-apps-script.js để biết cách tạo
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbySEb6Gza8VaFXvlBvNccAVOzy84h0ZOtIbM76s2DN1LZ0CWRsSrop0q2Se8h5WpSfgxg/exec';

const KEY = 'wedding_rsvp';
let appData = []; // Dữ liệu cache trên bộ nhớ

function loadData()    { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
function saveData(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }

// Đọc dữ liệu: ưu tiên từ Google Sheets, fallback về localStorage nếu chưa cấu hình
function loadAllData(callback) {
  if (SCRIPT_URL) {
    // Hiển thị trạng thái đang tải
    const wrap = document.getElementById('table-body-wrap');
    if (wrap && !wrap.querySelector('table')) {
      wrap.innerHTML = '<div class="empty-state"><span class="empty-icon">⏳</span><div class="empty-title">Đang tải dữ liệu...</div></div>';
    }
    fetch(SCRIPT_URL + (SCRIPT_URL.includes('?') ? '&' : '?') + 'source=nhatrai&_t=' + Date.now())
      .then(function(r) { return r.json(); })
      .then(function(json) {
        callback(json.ok ? json.data : loadData());
      })
      .catch(function() {
        callback(loadData()); // Fallback localStorage khi mất mạng
      });
  } else {
    callback(loadData());
  }
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let _snackTimer = null;
function showSnack(msg, ms = 2800) {
  const el = document.getElementById('snack');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_snackTimer);
  _snackTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function updateStats(data) {
  const yes    = data.filter(r => r.attend === 'yes').length;
  const no     = data.filter(r => r.attend === 'no').length;
  const guests = data.reduce((s, r) => s + (r.attend === 'yes' ? (r.guests || 0) + 1 : 0), 0);
  document.getElementById('stat-total').textContent  = data.length;
  document.getElementById('stat-yes').textContent    = yes;
  document.getElementById('stat-no').textContent     = no;
  document.getElementById('stat-guests').textContent = guests;
}

function renderTable() {
  const search  = document.getElementById('search-input').value.toLowerCase();
  const filterA = document.getElementById('filter-attend').value;
  const sortBy  = document.getElementById('filter-sort').value;

  updateStats(appData);

  let data = [...appData];
    if (filterA) data = data.filter(r => r.attend === filterA);
    if (search)  data = data.filter(r =>
      (r.name    || '').toLowerCase().includes(search) ||
      (r.phone   || '').toLowerCase().includes(search) ||
      (r.message || '').toLowerCase().includes(search)
    );
    if (sortBy === 'newest') data.sort((a, b) => (b.id || 0) - (a.id || 0));
    else if (sortBy === 'oldest') data.sort((a, b) => (a.id || 0) - (b.id || 0));
    else if (sortBy === 'name')   data.sort((a, b) => (a.name||'').localeCompare(b.name||'', 'vi'));

    document.getElementById('result-count').textContent = `${data.length} kết quả`;
    const wrap = document.getElementById('table-body-wrap');

    if (data.length === 0) {
      wrap.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">💌</span>
          <div class="empty-title">Chưa có xác nhận nào</div>
          <div class="empty-sub">Khi khách gửi form, danh sách sẽ hiển thị tại đây.</div>
        </div>`;
      return;
    }

    const rows = data.map(r => {
      const bc = r.attend === 'yes' ? 'badge-yes' : r.attend === 'no' ? 'badge-no' : 'badge-pending';
      const bt = r.attend === 'yes' ? '✅ Tham dự' : r.attend === 'no' ? '❌ Không đến' : '⏳ Chưa chọn';
      const g  = r.attend === 'yes' ? `+${r.guests || 0} người` : '—';
      return `
        <tr>
          <td data-label="Họ và tên"     class="td-name">${esc(r.name   || '—')}</td>
          <td data-label="Điện thoại"    class="td-phone">${esc(r.phone || '—')}</td>
          <td data-label="Trạng thái"><span class="badge ${bc}">${bt}</span></td>
          <td data-label="Người đi cùng">${g}</td>
          <td data-label="Lời nhắn"      class="td-msg" title="${esc(r.message || '')}">${esc(r.message || '—')}</td>
          <td data-label="Thời gian"     class="td-time">${formatTime(r.time)}</td>
          <td><button class="btn-del" data-id="${r.id}" aria-label="Xóa xác nhận của ${esc(r.name || 'khách')}">🗑</button></td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Họ và tên</th><th>Điện thoại</th><th>Trạng thái</th>
            <th>Người đi cùng</th><th>Lời nhắn</th><th>Thời gian</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

    // Gắn sự kiện xóa qua event delegation
    wrap.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', () => confirmDelete(Number(btn.dataset.id)));
    });
}

// Hàm tải mới dữ liệu từ server rồi render
function fetchAndRender() {
  loadAllData(function(data) {
    appData = data;
    renderTable();
  });
}

/* ── Confirm Dialog ──────────────────────────────── */
let _confirmCb = null;

function openConfirm(icon, title, sub, cb) {
  document.getElementById('confirm-icon').textContent  = icon;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-sub').textContent   = sub;
  _confirmCb = cb;
  document.getElementById('confirm-ok').onclick = () => { closeConfirm(); cb(); };
  document.getElementById('confirm-overlay').classList.add('show');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('show');
  _confirmCb = null;
}

function confirmDelete(id) {
  if (SCRIPT_URL) {
    alert('⚠️ Bạn đang dùng Google Sheets. Vui lòng mở trang tính của bạn để xóa, thao tác xóa ở đây chỉ áp dụng cho bộ nhớ tạm.');
    return;
  }
  openConfirm('🗑️', 'Xóa xác nhận này?', 'Hành động này không thể hoàn tác.', () => {
    appData = appData.filter(r => r.id !== id);
    saveData(appData);
    renderTable();
    showSnack('✅ Đã xóa xác nhận');
  });
}

function confirmClearAll() {
  if (SCRIPT_URL) {
    alert('⚠️ Bạn đang dùng Google Sheets. Vui lòng mở trang tính của bạn để xóa dữ liệu.');
    return;
  }
  if (!appData.length) { showSnack('Danh sách đang trống!'); return; }
  openConfirm('⚠️', `Xóa tất cả ${appData.length} xác nhận?`, 'Toàn bộ dữ liệu sẽ bị xóa vĩnh viễn.', () => {
    localStorage.removeItem(KEY);
    appData = [];
    renderTable();
    showSnack('🗑 Đã xóa toàn bộ danh sách');
  });
}

/* ── Xuất CSV ────────────────────────────────────────────── */
function exportCSV() {
  const data = appData;
  if (!data.length) { showSnack('Không có dữ liệu để xuất!'); return; }
  const header = ['ID', 'Họ tên', 'Điện thoại', 'Tham dự', 'Người đi cùng', 'Lời nhắn', 'Thời gian'];
  const rows = data.map(r => [
    r.id,
    `"${(r.name    || '').replace(/"/g, '""')}"`,
    `"${(r.phone   || '').replace(/"/g, '""')}"`,
    r.attend === 'yes' ? 'Có' : r.attend === 'no' ? 'Không' : 'Chưa chọn',
    r.attend === 'yes' ? (r.guests || 0) : 0,
    `"${(r.message || '').replace(/"/g, '""')}"`,
    formatTime(r.time),
  ]);
  const csv  = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `rsvp_${new Date().toISOString().slice(0, 10)}.csv`
  });
  a.click();
  URL.revokeObjectURL(url);
  showSnack(`✅ Đã xuất ${data.length} bản ghi`);
}

/* ── Khởi tạo ────────────────────────────────────────────── */
function initAdmin() {
  // Controls
  document.getElementById('search-input').addEventListener('input', renderTable);
  document.getElementById('filter-attend').addEventListener('change', renderTable);
  document.getElementById('filter-sort').addEventListener('change', renderTable);

  // Buttons
  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) btnRefresh.addEventListener('click', fetchAndRender);
  document.getElementById('btn-export').addEventListener('click', exportCSV);
  document.getElementById('btn-clear').addEventListener('click', confirmClearAll);
  document.getElementById('btn-cancel').addEventListener('click', closeConfirm);

  // Đóng confirm khi click overlay
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('confirm-overlay')) closeConfirm();
  });

  // Thay setInterval bằng storage event để sync nhiều tab (chỉ khi dùng localStorage)
  window.addEventListener('storage', e => {
    if (e.key === KEY && !SCRIPT_URL) fetchAndRender();
  });

  fetchAndRender();
}
