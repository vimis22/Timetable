const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SLOTS = ['8-10', '10-12', '12-14', '14-16', '16-18', '18-20', '20-22', '22-24'];
const DEFAULT_TT = {
  '8-10': { Monday: 'M-105', Friday: 'C-101' },
  '10-12': { Monday: 'M-105', Tuesday: 'K-101', Wednesday: 'C-102', Friday: 'C-101' },
  '12-14': { Tuesday: 'K-101', Wednesday: 'C-102', Friday: 'C-101' },
  '14-16': { Tuesday: 'K-101' },
};
const COURSES = [
  ['C-101', 'OOP', 1, 'Lab (PC)'],
  ['C-102', 'DBMS', 1, 'Lab (PC)'],
  ['C-103', 'Discrete Math', 1, '-'],
  ['K-101', 'Algorithms', 2, 'Projector Lab'],
  ['K-102', 'Software Project', 2, 'Whiteboard'],
  ['K-103', 'Artificial Intelligence', 3, 'Projector & Whiteboard'],
  ['W-101', 'Webtechnologies', 3, 'Projector & Whiteboard'],
  ['M-105', 'Model Based', 4, 'Whiteboard, Projector'],
];
const NAV = [
  ['dashboard.html', 'Dashboard'],
  ['courses.html', 'My Courses'],
  ['timetable.html', 'My Timetable'],
  ['request.html', 'Submit Request'],
  ['availability.html', 'Availability'],
  ['status.html', 'Request Status'],
];

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2000);
}

function renderSidebar() {
  const el = document.getElementById('sidebar');
  if (!el) return;
  const page = location.pathname.split('/').pop();
  el.className = 'sidebar';
  el.innerHTML = '<div class="brand">SDU TIMETABLE<br>MANAGEMENT SYSTEM</div><nav class="nav">' +
    NAV.map(([h, l]) => `<a href="${h}" class="${h === page ? 'active' : ''}">${l}</a>`).join('') + '</nav>';
}

const headerRow = () => `<tr><th>Time</th>${DAYS.map(d => `<th>${d}</th>`).join('')}</tr>`;

function timetableHTML(tt, { editable = false, cls = '' } = {}) {
  return `<table class="${cls}">${headerRow()}${SLOTS.map(s => `<tr><th>${s}</th>${DAYS.map(d =>
    `<td data-slot="${s}" data-day="${d}"${editable ? ' contenteditable="true"' : ''}>${esc(tt[s]?.[d] || '')}</td>`
  ).join('')}</tr>`).join('')}</table>`;
}

function readTable(table) {
  const tt = {};
  table.querySelectorAll('td[data-slot]').forEach(td => {
    const v = td.textContent.trim();
    if (v) (tt[td.dataset.slot] ||= {})[td.dataset.day] = v;
  });
  return tt;
}

function editableTimetable(wrapId, cls) {
  const wrap = document.getElementById(wrapId);
  wrap.innerHTML = timetableHTML(store.get('timetable', DEFAULT_TT), { editable: true, cls });
  document.getElementById('save').onclick = () => {
    store.set('timetable', readTable(wrap.querySelector('table')));
    toast('Timetable saved');
  };
}

// Requests start empty; old mock entries (no course attached) are dropped
function getRequests() {
  const all = store.get('requests', []);
  const clean = all.filter(r => r && r.course);
  if (clean.length !== all.length) store.set('requests', clean);
  return clean;
}
const nextNo = reqs => 'R-' + String(reqs.reduce((m, r) => Math.max(m, parseInt(r.no.slice(2), 10) || 0), 0) + 1).padStart(3, '0');

const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

// Shared by Submit Request and Request Preview
function setupRequestForm() {
  const f = document.getElementById('reqForm');
  const info = document.getElementById('courseInfo');
  f.course.innerHTML = '<option value="">-- choose --</option>' +
    COURSES.map(c => `<option value="${c[0]}">${c[0]} - ${esc(c[1])}</option>`).join('');
  const showInfo = () => {
    const c = COURSES.find(x => x[0] === f.course.value);
    info.hidden = !c;
    if (c) info.innerHTML = `<b>${esc(c[0])} – ${esc(c[1])}</b><span>Section ${c[2]}</span><span>Requirement: ${esc(c[3])}</span>`;
  };
  const pre = new URLSearchParams(location.search).get('course');
  if (pre && COURSES.some(c => c[0] === pre)) f.course.value = pre;
  f.course.addEventListener('change', showInfo);
  showInfo();
  document.getElementById('cancel').onclick = () => history.length > 1 ? history.back() : (location.href = 'dashboard.html');
  return f;
}

function readRequestForm(f) {
  const type = f.type.value;
  if (!f.course.value || !type) { toast('Select a course and request type'); return null; }
  const equip = [...f.querySelectorAll('[name=equip]:checked')].map(x => x.value);
  const other = f.other.value.trim();
  let summary = type;
  if (type === 'Equipment' && equip.length) summary += ': ' + equip.join(', ');
  if (type === 'Other') summary = other || 'Other';
  return { course: f.course.value, type, equip, other, summary, details: f.details.value.trim() };
}

// Clickable availability grid (used by Availability and Request Preview)
function availGrid(wrap, offKeys) {
  const off = new Set(offKeys);
  wrap.innerHTML = `<table class="avail">${headerRow()}${SLOTS.map(s => `<tr><th>${s}</th>${DAYS.map(d => {
    const k = `${s}|${d}`;
    return `<td class="slot${off.has(k) ? ' off' : ''}" data-k="${k}">${off.has(k) ? 'Unavailable' : ''}</td>`;
  }).join('')}</tr>`).join('')}</table>`;
  if (!wrap._bound) {
    wrap._bound = true;
    wrap.addEventListener('click', e => {
      const td = e.target.closest('td.slot');
      if (!td) return;
      td.classList.toggle('off');
      td.textContent = td.classList.contains('off') ? 'Unavailable' : '';
    });
  }
  return () => [...wrap.querySelectorAll('td.off')].map(td => td.dataset.k);
}

const pages = {
  login() {
    document.getElementById('loginForm').addEventListener('submit', e => {
      e.preventDefault();
      const u = e.target.username.value.trim();
      const p = e.target.password.value;
      if (!u || !p) {
        document.querySelector('.error').textContent = 'Please enter username and password.';
        return;
      }
      sessionStorage.setItem('user', u);
      location.href = 'dashboard.html';
    });
  },

  courses() {
    const tbl = document.getElementById('courses');
    tbl.classList.add('clickable');
    tbl.innerHTML =
      '<tr><th>Course Code</th><th>Title</th><th>Section</th><th>Requirement</th></tr>' +
      COURSES.map(c => `<tr data-code="${c[0]}" tabindex="0" title="Click to preview your request for ${esc(c[1])}">${c.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('');
    const open = tr => { if (tr?.dataset.code) location.href = 'preview.html?course=' + encodeURIComponent(tr.dataset.code); };
    tbl.addEventListener('click', e => open(e.target.closest('tr')));
    tbl.addEventListener('keydown', e => { if (e.key === 'Enter') open(e.target.closest('tr')); });
  },

  timetable() { editableTimetable('tt'); },

  availability() {
    const wrap = document.getElementById('avail');
    const selected = availGrid(wrap, store.get('unavailable', []));
    document.getElementById('save').onclick = () => {
      store.set('unavailable', selected());
      toast('Availability saved');
    };

    // Step 2 of Submit Request: a draft is waiting
    const draft = JSON.parse(sessionStorage.getItem('draftRequest') || 'null');
    if (!draft || !new URLSearchParams(location.search).get('draft')) return;
    const c = COURSES.find(x => x[0] === draft.course);
    const info = document.getElementById('draftInfo');
    info.innerHTML = `<b>Request for ${esc(c[0])} – ${esc(c[1])}</b><span>Type: ${esc(draft.summary)}</span>` +
      (draft.details ? `<span>Remarks: ${esc(draft.details)}</span>` : '') +
      `<span class="draft-note">Mark the time slots where you are unavailable, then press Submit Request.</span>`;
    info.hidden = false;
    document.getElementById('normalActions').hidden = true;
    document.getElementById('draftActions').hidden = false;
    document.getElementById('cancelDraft').onclick = () => { location.href = 'request.html'; };
    document.getElementById('submitDraft').onclick = () => {
      const slots = selected();
      store.set('unavailable', slots);
      const reqs = getRequests();
      const no = nextNo(reqs);
      reqs.push({ no, status: 'Pending', date: today(), ...draft, slots });
      store.set('requests', reqs);
      sessionStorage.removeItem('draftRequest');
      location.href = 'status.html?new=' + no;
    };
  },

  request() {
    const f = setupRequestForm();
    // Coming back from Availability via Cancel: refill the form from the draft
    const draft = JSON.parse(sessionStorage.getItem('draftRequest') || 'null');
    if (draft && !new URLSearchParams(location.search).get('course')) {
      f.course.value = draft.course; f.course.dispatchEvent(new Event('change'));
      f.querySelector(`[name=type][value="${CSS.escape(draft.type)}"]`)?.click();
      draft.equip.forEach(v => { const cb = f.querySelector(`[name=equip][value="${CSS.escape(v)}"]`); if (cb) cb.checked = true; });
      f.other.value = draft.other; f.details.value = draft.details;
    }
    document.getElementById('cancel').onclick = () => { sessionStorage.removeItem('draftRequest'); location.href = 'dashboard.html'; };
    f.addEventListener('submit', e => {
      e.preventDefault();
      const data = readRequestForm(f);
      if (!data) return;
      sessionStorage.setItem('draftRequest', JSON.stringify(data));
      location.href = 'availability.html?draft=1';
    });
  },

  preview() {
    const f = setupRequestForm();
    const meta = document.getElementById('previewMeta');
    const reqs = getRequests();
    // Latest request sent for the chosen course
    const findLatest = code => [...reqs].reverse().find(r => r.course === code);
    let current = null;
    const availWrap = document.getElementById('previewAvail');
    let selectedSlots = availGrid(availWrap, []);

    const load = () => {
      current = findLatest(f.course.value);
      selectedSlots = availGrid(availWrap, current?.slots || []);
      f.querySelectorAll('[name=type], [name=equip]').forEach(x => { x.checked = false; });
      f.other.value = ''; f.details.value = '';
      if (current) {
        const type = current.type || (current.summary || '').split(':')[0];
        if (type) f.querySelector(`[name=type][value="${CSS.escape(type)}"]`)?.click();
        (current.equip || []).forEach(v => { const cb = f.querySelector(`[name=equip][value="${CSS.escape(v)}"]`); if (cb) cb.checked = true; });
        f.other.value = current.other || '';
        f.details.value = current.details || '';
        meta.innerHTML = `Snapshot of <b>${esc(current.no)}</b> &middot; Status: <b class="badge-${esc(current.status).replace(/ /g, '-')}">${esc(current.status)}</b> &middot; Last updated: ${esc(current.date)}`;
        document.getElementById('submitBtn').textContent = 'Update Preview Request';
      } else {
        meta.textContent = f.course.value ? 'No request has been sent for this course yet.' : 'Choose a course to see your request.';
        document.getElementById('submitBtn').textContent = 'Submit Request';
      }
    };
    f.course.addEventListener('change', load);
    load();

    f.addEventListener('submit', e => {
      e.preventDefault();
      const data = readRequestForm(f);
      if (!data) return;
      let no;
      if (current) {
        Object.assign(current, data, { slots: selectedSlots(), status: 'Pending', date: today() });
        no = current.no;
      } else {
        no = nextNo(reqs);
        reqs.push({ no, status: 'Pending', date: today(), ...data, slots: selectedSlots() });
      }
      store.set('requests', reqs);
      location.href = 'status.html?new=' + no;
    });
  },

  status() {
    const reqs = getRequests();
    const fresh = new URLSearchParams(location.search).get('new');
    document.getElementById('reqs').innerHTML =
      '<tr><th>NO</th><th>Course</th><th>Request Summary</th><th>Status</th><th>Last Updated</th></tr>' +
      (reqs.length ? '' : '<tr><td colspan="5" class="empty">You have not sent any requests yet. Use <a href="request.html">Submit Request</a> to send one.</td></tr>') +
      reqs.map(r => `<tr class="${r.no === fresh ? 'new' : ''}"${r.course ? ` data-course="${esc(r.course)}" title="Click to preview"` : ''}><td>${esc(r.no)}</td><td>${esc(r.course || '-')}</td><td>${esc(r.summary)}</td><td class="badge-${esc(r.status).replace(/ /g, '-')}">${esc(r.status)}</td><td>${esc(r.date)}</td></tr>`).join('');
    if (fresh) toast(`Request ${fresh} saved`);
    const tbl = document.getElementById('reqs');
    tbl.querySelectorAll('tr[data-course]').forEach(tr => { tr.classList.add('link'); });
    tbl.addEventListener('click', e => {
      const tr = e.target.closest('tr[data-course]');
      if (tr) location.href = 'preview.html?course=' + encodeURIComponent(tr.dataset.course);
    });
    editableTimetable('tt');
  },
};
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page !== 'login') {
    if (!sessionStorage.getItem('user')) { location.href = 'index.html'; return; }
    renderSidebar();
  }
  pages[page]?.();
});
