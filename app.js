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
  ['variance.html', 'Scheduling Request', 'alt'],
];
// Planner A/B usability test: only the course page differs between the two variants.
// Stored separately from the teacher's A/B setting ('abVersion'); switching never touches any data.
const PLANNER_AB = {
  A: { page: 'planner-requests.html', label: 'My Courses', name: 'Version A – Original Design' },
  B: { page: 'planner-queue.html', label: 'Course Queue', name: 'Version B – Course Queue Design' },
};
const plannerVersion = () => (store.get('plannerAbVersion', 'A') === 'B' ? 'B' : 'A');
// Timetable Planner navigation (separate from the teacher navigation)
const PLANNER_NAV = () => [
  ['planner-dashboard.html', 'Dashboard'],
  [PLANNER_AB[plannerVersion()].page, PLANNER_AB[plannerVersion()].label, 'ab-link'],
  ['planner-scheduling.html', 'Scheduling'],
  ['planner-rooms.html', 'Rooms'],
  ['planner-priorities.html', 'Priorities'],
  ['planner-conflicts.html', 'Conflicts'],
  ['planner-approvals.html', 'Approvals'],
];

// Simulated role-based login (usability-testing prototype, not real authentication)
const ROLES = {
  teacher: { home: 'dashboard.html', name: 'Teacher', nav: NAV },
  planner: { home: 'planner-dashboard.html', name: 'Timetable Planner', nav: PLANNER_NAV },
};
function logout() {
  sessionStorage.clear();
  location.replace('index.html');
}

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};
// A/B testing (pilot evaluation): scheduling request page per version.
// Version A = original Submit Request form, Version B = Scheduling Request (variance) form.
// File names are URL-encoded when used, so names containing spaces also work.
const AB_PAGES = { A: 'request.html', B: 'variance.html' };
const abVersion = () => (store.get('abVersion', 'A') === 'B' ? 'B' : 'A');
const abUrl = code => encodeURI(AB_PAGES[abVersion()]) + (code ? '?course=' + encodeURIComponent(code) : '');

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2000);
}

function renderSidebar(role) {
  const { name } = ROLES[role];
  const nav = typeof ROLES[role].nav === 'function' ? ROLES[role].nav() : ROLES[role].nav;
  let el = document.getElementById('sidebar');
  if (el) {
    const page = location.pathname.split('/').pop();
    el.className = 'sidebar';
    el.innerHTML = '<div class="brand">SDU TIMETABLE<br>MANAGEMENT SYSTEM</div><nav class="nav">' +
      nav.map(([h, l, cls = '']) => `<a href="${h}" class="${cls} ${h === page ? 'active' : ''}">${l}</a>`).join('') + '</nav>';
  } else {
    el = document.querySelector('.sidebar'); // pages with a static sidebar (teacher dashboard)
  }
  if (!el) return;
  const session = document.createElement('div');
  session.className = 'session';
  session.innerHTML = `<span>Logged in as <b>${esc(name)}</b></span><button type="button" class="btn logout">Logout</button>`;
  session.querySelector('button').onclick = logout;
  if (role === 'planner') el.appendChild(plannerAbSwitch());
  el.appendChild(session);
}

// A/B variant switch, shown only in the Planner sidebar
function plannerAbSwitch() {
  const box = document.createElement('fieldset');
  box.className = 'ab-switch';
  box.innerHTML = '<legend>A/B Testing</legend>' + Object.entries(PLANNER_AB).map(([v, x]) =>
    `<label><input type="radio" name="plannerAb" value="${v}"${v === plannerVersion() ? ' checked' : ''}> ${esc(x.name)}</label>`).join('');
  box.addEventListener('change', e => {
    store.set('plannerAbVersion', e.target.value);
    const { page, label, name } = PLANNER_AB[plannerVersion()];
    // On a variant page: go to the matching page of the chosen variant
    if (document.body.dataset.variant) { location.href = page; return; }
    const link = document.querySelector('.nav a.ab-link');
    if (link) { link.href = page; link.textContent = label; }
    if (document.body.dataset.page === 'plannerDashboard') planner.plannerDashboard();
    toast(name + ' active');
  });
  return box;
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
function availGrid(wrap, offKeys, { cls = 'off', label = 'Unavailable' } = {}) {
  const off = new Set(offKeys);
  wrap.innerHTML = `<table class="avail">${headerRow()}${SLOTS.map(s => `<tr><th>${s}</th>${DAYS.map(d => {
    const k = `${s}|${d}`;
    return `<td class="slot${off.has(k) ? ' ' + cls : ''}" data-k="${k}">${off.has(k) ? label : ''}</td>`;
  }).join('')}</tr>`).join('')}</table>`;
  if (!wrap._bound) {
    wrap._bound = true;
    wrap.addEventListener('click', e => {
      const td = e.target.closest('td.slot');
      if (!td) return;
      td.classList.toggle(cls);
      td.textContent = td.classList.contains(cls) ? label : '';
    });
  }
  return () => [...wrap.querySelectorAll('td.' + cls)].map(td => td.dataset.k);
}

const pages = {
  login() {
    sessionStorage.clear(); // visiting the login page always ends the previous session
    const err = document.querySelector('.error');
    const input = document.getElementById('username');
    input.addEventListener('input', () => { err.textContent = ''; });
    document.getElementById('loginForm').addEventListener('submit', e => {
      e.preventDefault();
      const role = input.value.trim().toLowerCase();
      if (!Object.hasOwn(ROLES, role)) {
        err.textContent = 'Invalid role. Please enter teacher or planner.';
        input.select();
        return;
      }
      sessionStorage.setItem('role', role);
      sessionStorage.setItem('user', role);
      location.href = ROLES[role].home;
    });
  },

  courses() {
    const tbl = document.getElementById('courses');
    const ab = document.getElementById('abToggle');
    const send = document.getElementById('sendRequest');
    tbl.classList.add('clickable');
    tbl.innerHTML =
      '<tr><th>Course Code</th><th>Title</th><th>Section</th><th>Requirement</th></tr>' +
      COURSES.map(c => `<tr data-code="${c[0]}" tabindex="0" title="Click to send a scheduling request for ${esc(c[1])}">${c.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('');

    // Course rows open the scheduling request page of the active A/B version
    const open = tr => { if (tr?.dataset.code) location.href = abUrl(tr.dataset.code); };
    tbl.addEventListener('click', e => open(e.target.closest('tr')));
    tbl.addEventListener('keydown', e => { if (e.key === 'Enter') open(e.target.closest('tr')); });

    // A/B toggle: switches version in place (no navigation)
    const render = () => {
      const v = abVersion();
      ab.textContent = v === 'A' ? 'Switch to Version B' : 'Switch to Version A';
      ab.setAttribute('aria-pressed', v === 'B');
      send.href = abUrl();
    };
    ab.onclick = () => {
      store.set('abVersion', abVersion() === 'A' ? 'B' : 'A');
      render();
      toast(`Version ${abVersion()} is now active`);
    };
    render();
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

  variance() {
    const f = setupRequestForm();
    const preferred = availGrid(document.getElementById('prefGrid'), [], { cls: 'pref', label: 'Preferred' });
    document.getElementById('cancel').onclick = () => { location.href = 'dashboard.html'; };
    f.addEventListener('submit', e => {
      e.preventDefault();
      const data = readRequestForm(f);
      if (!data) return;
      const reqs = getRequests();
      const no = nextNo(reqs);
      reqs.push({ no, status: 'Pending', date: today(), ...data, preferred: preferred() });
      store.set('requests', reqs);
      location.href = 'status.html?new=' + no;
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
// Returns the logged-in role if it may see this page, otherwise redirects
function guard() {
  const role = sessionStorage.getItem('role');
  const needed = document.body.dataset.role || 'teacher';
  if (!Object.hasOwn(ROLES, role || '')) { location.replace('index.html'); return null; }
  // Never show a page that belongs to the other role
  if (role !== needed) { location.replace(ROLES[role].home); return null; }
  // Planner variant pages are only shown for the active A/B version (no mixing of the two designs)
  const variant = document.body.dataset.variant;
  if (variant && variant !== plannerVersion()) { location.replace(PLANNER_AB[plannerVersion()].page); return null; }
  return role;
}
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page !== 'login') {
    const role = guard();
    if (!role) return;
    renderSidebar(role);
  }
  (pages[page] || planner[page])?.();
});
// Pages restored from the back/forward cache skip DOMContentLoaded: re-check after logout / role switch
window.addEventListener('pageshow', e => {
  if (!e.persisted) return;
  if (document.body.dataset.page === 'login') sessionStorage.clear();
  else guard();
});

/* ===================== Timetable Planner ===================== */
const WORK_SLOTS = SLOTS.slice(0, 5); // 8-18: slots the planner may place lectures in
const COURSE_SIZE = { 'C-101': 45, 'C-102': 70, 'C-103': 120, 'K-101': 60, 'K-102': 35, 'K-103': 80, 'W-101': 40, 'M-105': 25 };
// [room, capacity, equipment, free slot]
const ROOMS = [
  ['CS-Lab1', 30, ['PC', 'Projector'], 'Mon 10-12'],
  ['CS-Lab2', 40, ['PC', 'Whiteboard'], 'Tue 14-16'],
  ['CS-Lab3', 80, ['PC', 'Projector', 'Whiteboard'], 'Thu 8-10'],
  ['U170', 30, ['Whiteboard'], 'Mon 10-12'],
  ['U180', 50, ['Projector', 'Whiteboard'], 'Wed 8-10'],
  ['U45', 80, ['Projector', 'Whiteboard'], 'Thu 12-14'],
  ['O100', 150, ['Projector'], 'Fri 10-12'],
];
const PRIORITY_RULES = [
  'Core Compulsory Courses (Highest)',
  'Larger Classes (>/ 60 students)',
  'Teacher Preferred Timeslots',
  'Lab / Equipment Requirements',
  'Teacher Unavailability',
  'Elective Courses (Lowest)',
];
const CONFLICTS = [
  { id: 1, type: 'Time', lecturer: 'JCS', course: 'C-101', time: 'Mon 10-12', issue: 'Mon 10-12 (C-101) overlaps M-105', fix: 'Mon 14-16, U170' },
  { id: 2, type: 'Lecturer', lecturer: 'AIU', course: 'C-102', time: 'Tue 12-14', issue: 'Tue 12-14 (C-102) lecturer double-booked', fix: 'Tue 14-16, CS-Lab2' },
  { id: 3, type: 'Capacity', lecturer: 'TW', course: 'K-103', time: 'Wed 12-14', issue: 'U170 (Cap 30 < 80)', fix: 'U45 (Cap 80)' },
  { id: 4, type: 'Capacity', lecturer: 'MIAL', course: 'C-102', time: 'Thu 14-16', issue: 'U180 (Cap 50 < 70)', fix: 'CS-Lab3 (Cap 80)' },
];
// Planner mock dataset: seeded into localStorage once, then only ever updated (never regenerated)
const PLANNER_SEED = [
  { no: 'R-001', course: 'C-101', type: 'Equipment', equip: ['Projector'], details: 'Needed for in-class presentation, demonstrations, and multimedia materials.', status: 'Pending', date: 'Nov 10', preferred: ['8-10|Monday', '10-12|Tuesday', '10-12|Wednesday', '8-10|Thursday', '12-14|Friday'] },
  { no: 'R-002', course: 'C-102', type: 'Special Teaching Constraint', details: 'Lab sessions must be one consecutive 4-hour block.', status: 'Pending', date: 'Nov 11' },
  { no: 'R-003', course: 'K-101', type: 'Unavailable', details: 'Department meeting every Wednesday morning.', status: 'Pending', date: 'Nov 11', slots: ['8-10|Wednesday', '10-12|Wednesday'] },
  { no: 'R-004', course: 'K-103', type: 'Equipment', equip: ['Projector', 'Whiteboard'], details: 'Live coding demos plus whiteboard derivations.', status: 'Approved', date: 'Nov 12' },
  { no: 'R-005', course: 'W-101', type: 'Change Request', details: 'Move the Friday lecture to Thursday.', status: 'Declined', date: 'Nov 12' },
  { no: 'R-006', course: 'C-103', type: 'Special Teaching Constraint', details: 'Needs a lecture hall for 120 students.', status: 'Pending', date: 'Nov 13' },
  { no: 'R-007', course: 'M-105', type: 'Unavailable', details: 'Teaching at another campus on Monday mornings.', status: 'Approved', date: 'Nov 13', slots: ['8-10|Monday', '10-12|Monday'] },
  { no: 'R-008', course: 'K-102', type: 'Equipment', equip: ['Whiteboard', 'Table'], details: 'Group work tables for the project workshop.', status: 'Pending', date: 'Nov 14' },
  { no: 'R-009', course: 'C-101', type: 'Change Request', details: 'Swap the Tuesday and Thursday sessions.', status: 'Pending', date: 'Nov 15', preferred: ['10-12|Thursday'] },
  { no: 'R-010', course: 'K-101', type: 'Equipment', equip: ['Projector'], details: 'Projector for algorithm visualisations.', status: 'Pending', date: 'Nov 16' },
  { no: 'R-011', course: 'W-101', type: 'Other', other: 'Hybrid streaming setup', details: 'Some students attend online; camera and microphone needed.', status: 'Pending', date: 'Nov 17' },
  { no: 'R-012', course: 'K-103', type: 'Unavailable', details: 'Research seminar on Friday afternoons.', status: 'Pending', date: 'Nov 18', slots: ['12-14|Friday', '14-16|Friday'], preferred: ['8-10|Tuesday', '10-12|Thursday'] },
].map(r => ({ equip: [], ...r, summary: r.type === 'Equipment' ? 'Equipment: ' + r.equip.join(', ') : r.type === 'Other' ? r.other : r.type }));

function plannerMock() {
  let list = store.get('plannerRequests', null);
  if (!Array.isArray(list)) { list = PLANNER_SEED; store.set('plannerRequests', list); }
  return list;
}

// Per-page view state (selected row, scroll position) for the planner session
const view = {
  get(p) { try { return JSON.parse(sessionStorage.getItem('view:' + p)) || {}; } catch { return {}; } },
  set(p, patch) { sessionStorage.setItem('view:' + p, JSON.stringify({ ...view.get(p), ...patch })); },
};
// Saves the page + table scroll position while scrolling; restores it now and whenever the returned function is called
function keepScroll(p, box, active = () => true) {
  const main = document.querySelector('.main');
  // On small screens the whole document scrolls instead of .main, so the window position is kept too
  const save = () => { if (active()) view.set(p, { scroll: [main.scrollTop, box ? box.scrollTop : 0, window.scrollY] }); };
  const restore = () => {
    const [m = 0, b = 0, w = 0] = view.get(p).scroll || [];
    main.scrollTop = m; if (box) box.scrollTop = b; window.scrollTo(0, w);
  };
  main.addEventListener('scroll', save, { passive: true });
  box?.addEventListener('scroll', save, { passive: true });
  window.addEventListener('scroll', save, { passive: true });
  restore();
  return restore;
}
function markSelected(tbl, attr, key) {
  tbl.querySelectorAll('tr.selected').forEach(tr => tr.classList.remove('selected'));
  const tr = key ? [...tbl.querySelectorAll(`tr[${attr}]`)].find(x => x.getAttribute(attr) === key) : null;
  tr?.classList.add('selected');
  return tr;
}

const courseOf = code => COURSES.find(c => c[0] === code);
const needsOf = req => {
  const r = req.toLowerCase(), n = [];
  if (r.includes('pc')) n.push('PC');
  if (r.includes('projector')) n.push('Projector');
  if (r.includes('whiteboard')) n.push('Whiteboard');
  return n;
};
const badge = (st, text = st) => `<span class="badge-${esc(st).replace(/ /g, '-')}">${esc(text)}</span>`;
const param = k => new URLSearchParams(location.search).get(k);

// Planner request list: mock dataset + requests submitted in the Teacher UI.
// `key` is unique even if a teacher request reuses a mock number.
function allRequests() {
  return [
    ...plannerMock().map(r => ({ ...r, key: r.no })),
    ...getRequests().map(r => ({ ...r, key: 'T-' + r.no, fromTeacher: true })),
  ];
}
function setRequestStatus(r, status) {
  const date = today();
  // Teacher requests live in the teacher's storage, so the Teacher UI shows the decision too
  const k = r.fromTeacher ? 'requests' : 'plannerRequests';
  const list = r.fromTeacher ? getRequests() : plannerMock();
  const t = list.find(x => x.no === r.no);
  if (t) { t.status = status; t.date = date; store.set(k, list); }
  Object.assign(r, { status, date });
}
const reqTag = r => r.fromTeacher ? ' <small>(new)</small>' : '';
const detailsUrl = (r, from, extra = '') => `planner-approvals.html?no=${encodeURIComponent(r.key)}&from=${from}${extra}`;

function courseSelect(sel, value) {
  sel.innerHTML = '<option value="">-- choose --</option>' +
    COURSES.map(c => `<option value="${c[0]}">${c[0]} - ${esc(c[1])}</option>`).join('');
  if (value && courseOf(value)) sel.value = value;
}
const cellLabel = code => { const room = store.get('roomAlloc', {})[code]; return room ? `${code} (${room})` : code; };
const codeOfCell = v => String(v).split(' ')[0];

const planner = {
  plannerDashboard() {
    const pending = allRequests().filter(r => r.status === 'Pending').length;
    const open = CONFLICTS.length - store.get('resolvedConflicts', []).length;
    const tiles = [
      [PLANNER_AB[plannerVersion()].page, PLANNER_AB[plannerVersion()].label],
      ['planner-scheduling.html', 'Scheduling'],
      ['planner-rooms.html', 'Room Allocation'],
      ['planner-priorities.html', 'Priorities &amp; Constraints'],
      ['planner-conflicts.html', `Conflicts<small>${open} open</small>`],
      ['planner-approvals.html', `Approvals<small>${pending} pending</small>`],
    ];
    document.getElementById('plannerTiles').innerHTML = tiles.map(([h, l]) => `<a href="${h}" class="planner-tile">${l}</a>`).join('');
  },

  plannerRequests() {
    const tbl = document.getElementById('courses');
    const reqs = allRequests();
    let selected = param('course') || view.get('plannerRequests').selected || '';
    tbl.classList.add('selectable');
    const render = () => {
      tbl.innerHTML = '<tr><th>Course Code</th><th>Title</th><th>Section</th><th>Requirement</th><th>Requests</th></tr>' +
        COURSES.map(c => {
          const mine = reqs.filter(r => r.course === c[0]);
          const p = mine.filter(r => r.status === 'Pending').length;
          return `<tr data-code="${c[0]}" tabindex="0" class="${c[0] === selected ? 'selected' : ''}">${c.map(x => `<td>${esc(x)}</td>`).join('')}<td>${mine.length ? `${mine.length}${p ? ` (${p} pending)` : ''}` : '-'}</td></tr>`;
        }).join('');
    };
    const pick = tr => {
      if (!tr?.dataset.code) return;
      selected = tr.dataset.code;
      view.set('plannerRequests', { selected });
      markSelected(tbl, 'data-code', selected)?.focus();
    };
    tbl.addEventListener('click', e => pick(e.target.closest('tr')));
    tbl.addEventListener('keydown', e => { if (e.key === 'Enter') pick(e.target.closest('tr')); });
    document.getElementById('showSuggested').onclick = () => {
      if (!selected) return toast('Select a course first');
      location.href = 'planner-scheduling.html?suggest=1&course=' + encodeURIComponent(selected);
    };
    document.getElementById('viewDetails').onclick = () => {
      if (!selected) return toast('Select a course first');
      // Latest request for the course; stay on this page if there is none
      const r = [...reqs].reverse().find(x => x.course === selected);
      if (!r) return toast(`No requests for ${selected} yet`);
      location.href = detailsUrl(r, 'courses');
    };
    render();
    if (selected) view.set('plannerRequests', { selected });
    keepScroll('plannerRequests', tbl.parentElement);
  },

  plannerScheduling() {
    const sel = document.getElementById('course');
    courseSelect(sel, param('course'));
    const wrap = document.getElementById('plan');
    const off = new Set(store.get('unavailable', []));
    let tt = structuredClone(store.get('timetable', DEFAULT_TT));
    const set = (s, d, v) => {
      if (v) (tt[s] ||= {})[d] = v;
      else if (tt[s]) { delete tt[s][d]; if (!Object.keys(tt[s]).length) delete tt[s]; }
    };
    const render = () => {
      wrap.innerHTML = `<table class="plan">${headerRow()}${SLOTS.map(s => `<tr><th>${s}</th>${DAYS.map(d => {
        const v = tt[s]?.[d], at = `data-s="${s}" data-d="${d}"`;
        if (v) return `<td ${at} class="booked${sel.value && codeOfCell(v) === sel.value ? ' mine' : ''}">${esc(v)}</td>`;
        if (off.has(`${s}|${d}`)) return '<td class="blocked">Unavailable</td>';
        return WORK_SLOTS.includes(s) ? `<td ${at} class="open">OPEN</td>` : '<td></td>';
      }).join('')}</tr>`).join('')}</table>`;
    };
    wrap.addEventListener('click', e => {
      const td = e.target.closest('td[data-s]');
      if (!td) return;
      const { s, d } = td.dataset;
      if (td.classList.contains('open')) {
        if (!sel.value) return toast('Choose a course first');
        set(s, d, cellLabel(sel.value));
      } else if (td.classList.contains('mine')) {
        set(s, d, null);
      } else {
        return toast(`Slot already used by ${tt[s][d]}`);
      }
      render();
    });
    const suggest = () => {
      if (!sel.value) return toast('Choose a course first');
      // Two lectures per week on different days, earliest OPEN slot each day
      const used = new Set(DAYS.filter(d => SLOTS.some(s => codeOfCell(tt[s]?.[d] || '') === sel.value)));
      let added = 0;
      for (const d of DAYS) {
        if (used.size + added >= 2) break;
        if (used.has(d)) continue;
        const s = WORK_SLOTS.find(x => !tt[x]?.[d] && !off.has(`${x}|${d}`));
        if (s) { set(s, d, cellLabel(sel.value)); added++; }
      }
      render();
      toast(added ? `Suggested ${added} slot(s) for ${sel.value}. Review, then Save To Schedule.` : `${sel.value} already has its weekly slots`);
    };
    sel.addEventListener('change', render);
    document.getElementById('suggest').onclick = suggest;
    document.getElementById('reset').onclick = () => { tt = structuredClone(store.get('timetable', DEFAULT_TT)); render(); toast('Unsaved changes discarded'); };
    document.getElementById('save').onclick = () => { store.set('timetable', tt); toast('Schedule saved'); };
    render();
    if (param('suggest') && sel.value) suggest();
  },

  plannerRooms() {
    const sel = document.getElementById('course');
    const est = document.getElementById('est');
    const box = document.getElementById('suggestions');
    const reqBox = document.getElementById('teacherReq');
    courseSelect(sel, param('course') || 'C-102');
    const render = () => {
      const c = courseOf(sel.value);
      const n = +est.value || 0;
      const needs = c ? needsOf(c[3]) : [];
      const fit = r => r[1] >= n && needs.every(x => r[2].includes(x));
      document.getElementById('rooms').innerHTML = '<tr><th>Room</th><th>Capacity</th><th>Equipment</th><th>Free Slot</th></tr>' +
        ROOMS.map(r => `<tr class="${c && fit(r) ? 'fits' : ''}"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2].join(', ')}</td><td>${r[3]}</td></tr>`).join('');
      if (!c) { box.innerHTML = '<p class="hint">Choose a course to see suggestions.</p>'; return; }
      const current = store.get('roomAlloc', {})[c[0]];
      const ranked = [...ROOMS].sort((a, b) => (fit(b) - fit(a)) || (Math.abs(a[1] - n) - Math.abs(b[1] - n))).slice(0, 3);
      const checked = ranked.some(r => r[0] === current) ? current : ranked[0][0];
      box.innerHTML = ranked.map(r => {
        const why = r[1] < n ? `too small for ${n}` : needs.filter(x => !r[2].includes(x)).map(x => 'no ' + x).join(', ');
        return `<label class="suggest"><input type="radio" name="room" value="${r[0]}"${r[0] === checked ? ' checked' : ''}>` +
          `<span class="dot ${fit(r) ? 'ok' : 'bad'}"></span><b>${r[0]}</b> (${r[3]}, Cap: ${r[1]})${why ? ` <em>${why}</em>` : ''}</label>`;
      }).join('');
    };
    sel.addEventListener('change', () => { est.value = COURSE_SIZE[sel.value] || ''; reqBox.hidden = true; render(); });
    est.addEventListener('input', render);
    document.getElementById('seeRequest').onclick = () => {
      if (!sel.value) return toast('Choose a course first');
      const r = [...allRequests()].reverse().find(x => x.course === sel.value);
      reqBox.hidden = false;
      reqBox.innerHTML = r
        ? `<b>${esc(r.no)} – ${esc(r.summary)}</b><span>Status: ${badge(r.status)}</span>${r.details ? `<span>Remarks: ${esc(r.details)}</span>` : ''}<a href="${detailsUrl(r, 'rooms', '&course=' + encodeURIComponent(sel.value))}">Open request</a>`
        : `<b>No teacher request for ${esc(sel.value)}</b><span>Requirement: ${esc(courseOf(sel.value)[3])}</span>`;
    };
    document.getElementById('save').onclick = () => {
      const room = box.querySelector('[name=room]:checked')?.value;
      if (!sel.value || !room) return toast('Choose a course and a room');
      const alloc = store.get('roomAlloc', {});
      alloc[sel.value] = room;
      store.set('roomAlloc', alloc);
      // Show the room on this course's lectures in the timetable
      const tt = store.get('timetable', DEFAULT_TT);
      Object.values(tt).forEach(row => Object.keys(row).forEach(d => { if (codeOfCell(row[d]) === sel.value) row[d] = `${sel.value} (${room})`; }));
      store.set('timetable', tt);
      toast(`${sel.value} allocated to ${room}`);
    };
    est.value = COURSE_SIZE[sel.value] || '';
    render();
  },

  plannerPriorities() {
    const list = document.getElementById('prioList');
    const DEFAULT = PRIORITY_RULES.slice(0, 3);
    const render = vals => {
      list.innerHTML = vals.map((v, i) => `<label class="prio"><span>${i + 1}.</span><select aria-label="Priority ${i + 1}">${PRIORITY_RULES.map(p => `<option${p === v ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select></label>`).join('');
    };
    document.getElementById('save').onclick = () => {
      const vals = [...list.querySelectorAll('select')].map(s => s.value);
      if (new Set(vals).size !== vals.length) return toast('Each rank needs a different rule');
      store.set('priorities', vals);
      toast('Priorities saved');
    };
    document.getElementById('reset').onclick = () => { render(DEFAULT); toast('Reset to default order (press Save to keep it)'); };
    render(store.get('priorities', DEFAULT));
  },

  plannerConflicts() {
    const resolved = new Set(store.get('resolvedConflicts', []));
    const review = document.getElementById('review');
    const render = () => {
      document.getElementById('conflicts').innerHTML = '<tr><th>ID</th><th>Type</th><th>Lecturer</th><th>Course</th><th>Time</th><th>Status</th></tr>' +
        CONFLICTS.map(c => `<tr><td>${c.id}</td><td>${c.type}</td><td>${c.lecturer}</td><td>${c.course}</td><td>${c.time}</td><td>${resolved.has(c.id) ? badge('Approved', 'Resolved') : badge('Declined', 'Open')}</td></tr>`).join('');
      document.getElementById('resolutions').innerHTML = '<tr><th>Apply</th><th>ID</th><th>Issue</th><th>Sugg. Allocation</th></tr>' +
        CONFLICTS.map(c => `<tr><td><input type="checkbox" class="apply" value="${c.id}" aria-label="Apply resolution ${c.id}" checked${resolved.has(c.id) ? ' disabled' : ''}></td><td>${c.id}</td><td>${c.issue}</td><td>${c.fix}</td></tr>`).join('');
    };
    const chosen = () => [...document.querySelectorAll('.apply:checked:not(:disabled)')].map(x => +x.value);
    document.getElementById('reviewBtn').onclick = () => {
      const ids = chosen();
      review.hidden = false;
      review.innerHTML = ids.length
        ? '<b>Changes to apply:</b>' + ids.map(id => { const c = CONFLICTS.find(x => x.id === id); return `<span>#${id} ${c.course}: ${c.issue} → ${c.fix}</span>`; }).join('')
        : '<b>No open conflicts selected.</b>';
    };
    document.getElementById('confirm').onclick = () => {
      const ids = chosen();
      if (!ids.length) return toast('Nothing selected to confirm');
      ids.forEach(id => resolved.add(id));
      store.set('resolvedConflicts', [...resolved]);
      review.hidden = true;
      render();
      toast(`${ids.length} conflict(s) resolved`);
    };
    render();
  },

  // Version B – Course Queue design (same requests dataset as Version A / Approvals)
  plannerQueue() {
    const Q_SLOTS = ['08-10', '10-12', '12-14', '14-16'];
    const Q_DAYS = [...DAYS, 'Saturday'];
    const reqs = allRequests();
    const scheduled = reqs.filter(r => r.status !== 'Declined'); // declined requests are not placed
    const tbl = document.getElementById('queue');
    const modal = document.getElementById('ttModal');
    // Selection survives the popup and a visit to the details page (cleared on logout)
    let selected = view.get('plannerQueue').selected || '';
    if (!reqs.some(r => r.key === selected)) selected = '';
    const selReq = () => reqs.find(r => r.key === selected);
    tbl.classList.add('selectable');

    const render = () => {
      tbl.innerHTML = '<tr><th>No.</th><th>Course</th><th>Estimated Students</th><th>Type</th><th>Status</th></tr>' +
        (reqs.length ? '' : '<tr><td colspan="5" class="empty">No requests in the queue.</td></tr>') +
        reqs.map(r => `<tr data-key="${esc(r.key)}" tabindex="0" class="${r.key === selected ? 'selected' : ''}"><td>${esc(r.no)}${reqTag(r)}</td><td>${esc(r.course)}${courseOf(r.course) ? ' – ' + esc(courseOf(r.course)[1]) : ''}</td><td>${COURSE_SIZE[r.course] ?? '-'}</td><td>${esc(r.type)}</td><td>${badge(r.status)}</td></tr>`).join('');
    };
    const pick = tr => {
      if (!tr?.dataset.key) return;
      selected = tr.dataset.key;
      view.set('plannerQueue', { selected });
      markSelected(tbl, 'data-key', selected)?.focus();
    };
    tbl.addEventListener('click', e => pick(e.target.closest('tr')));
    tbl.addEventListener('keydown', e => { if (e.key === 'Enter') pick(e.target.closest('tr')); });

    // System suggestion: two sessions per request on different days (one if the week is too full),
    // preferred slots first, never in a slot the teacher marked unavailable.
    const suggestion = () => {
      const grid = {}, toKey = (s, d) => `${s.replace(/^0/, '')}|${d}`;
      const per = scheduled.length * 2 <= Q_SLOTS.length * Q_DAYS.length ? 2 : 1;
      scheduled.forEach((r, i) => {
        const off = new Set(r.slots || []), days = new Set();
        const cells = [];
        (r.preferred || []).forEach(k => { const [s, d] = k.split('|'); const qs = Q_SLOTS.find(x => toKey(x, d) === k); if (qs) cells.push([qs, d]); });
        for (let n = 0; n < Q_DAYS.length; n++) {
          const d = Q_DAYS[(i * 2 + n) % Q_DAYS.length];
          Q_SLOTS.forEach(s => cells.push([s, d]));
        }
        for (const [s, d] of cells) {
          if (days.size >= per) break;
          if (days.has(d) || grid[`${s}|${d}`] || off.has(toKey(s, d))) continue;
          grid[`${s}|${d}`] = r; days.add(d);
        }
      });
      return grid;
    };
    // Distinct colour per request, readable with white text (golden-angle hues)
    const color = r => `hsl(${Math.round((scheduled.indexOf(r) * 137.508) % 360)} 60% 36%)`;
    let lastFocus = null;
    const openModal = () => {
      if (!scheduled.length) return toast('No requests to schedule');
      const grid = suggestion();
      const placed = new Set(Object.values(grid));
      document.getElementById('modalNote').textContent =
        `Suggested by the system for ${scheduled.length} queued requests (declined requests are left out).` +
        (selReq() ? ` ${selReq().no} is highlighted.` : '');
      document.getElementById('suggestedGrid').innerHTML =
        `<table class="plan suggested"><tr><th>Time</th>${Q_DAYS.map(d => `<th>${d}</th>`).join('')}</tr>` +
        Q_SLOTS.map(s => `<tr><th>${s}</th>${Q_DAYS.map(d => {
          const r = grid[`${s}|${d}`];
          return r ? `<td class="req-cell${r.key === selected ? ' sel' : ''}" data-key="${esc(r.key)}" style="background:${color(r)}" title="${esc(r.no)} – ${esc(r.course)}">${esc(r.no)}${r.fromTeacher ? " (new)" : ""}<small>${esc(r.course)}</small></td>` : '<td></td>';
        }).join('')}</tr>`).join('') + '</table>';
      document.getElementById('suggestedLegend').innerHTML = scheduled.map(r =>
        `<span class="${r.key === selected ? 'sel' : ''}"><i style="background:${color(r)}"></i>${esc(r.no)}${reqTag(r)} · ${esc(r.course)} · ${esc(r.type)}${placed.has(r) ? '' : ' (no free slot)'}</span>`).join('');
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.getElementById('closeModal').focus();
    };
    const closeModal = () => { modal.hidden = true; lastFocus?.focus(); };
    document.getElementById('showSuggested').onclick = openModal;
    document.getElementById('closeModal').onclick = closeModal;
    document.getElementById('closeModal2').onclick = closeModal;
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
    document.getElementById('viewDetails').onclick = () => {
      if (!selected) return toast('Select a request first');
      location.href = detailsUrl(selReq(), 'queue');
    };
    render();
    keepScroll('plannerQueue', tbl.parentElement);
  },

  plannerApprovals() {
    const reqs = allRequests(); // loaded once; status changes update these objects and storage
    const listView = document.getElementById('listView');
    const detailView = document.getElementById('detailView');
    const list = document.getElementById('approvalList');
    const box = list.parentElement;
    list.classList.add('selectable');
    let restoreScroll = null;
    const showList = () => {
      listView.hidden = false; detailView.hidden = true;
      list.innerHTML =
        '<tr><th>NO</th><th>Course</th><th>Request Summary</th><th>Status</th><th>Last Updated</th></tr>' +
        reqs.map(r => `<tr class="link" tabindex="0" data-key="${esc(r.key)}"><td>${esc(r.no)}${reqTag(r)}</td><td>${esc(r.course)}</td><td>${esc(r.summary)}</td><td>${badge(r.status)}</td><td>${esc(r.date)}</td></tr>`).join('');
      markSelected(list, 'data-key', view.get('plannerApprovals').selected);
      // Restore the list's scroll position once it is visible again
      if (restoreScroll) restoreScroll(); else restoreScroll = keepScroll('plannerApprovals', box, () => !listView.hidden);
    };
    const showDetail = r => {
      listView.hidden = true; detailView.hidden = false;
      const c = courseOf(r.course) || [r.course, '', '', '-'];
      const item = (r.equip?.length ? r.equip.join(', ') : (r.type === 'Other' ? r.other : '')) || '-';
      document.getElementById('detailMeta').innerHTML =
        [['Request No.', esc(r.no)], ['Course', esc(r.course)], ['Type', esc(r.type)], ['Item', esc(item)], ['Status', badge(r.status)]]
          .map(([k, v]) => `<label>${k}: <span>${v}</span></label>`).join('');
      document.getElementById('detailText').innerHTML =
        `<p>${esc(r.type)} request for ${esc(c[0])} – ${esc(c[1])}.</p>` +
        `<p><b>Course requirement:</b><br>${esc(c[3])}</p>` +
        (r.equip?.length ? `<p><b>Equipment Needs:</b></p><ul>${r.equip.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '') +
        `<p><b>Notes:</b><br>${esc(r.details || 'No remarks given.')}</p>`;
      const pref = new Set(r.preferred || []), off = new Set(r.slots || []);
      const tt = store.get('timetable', DEFAULT_TT);
      document.getElementById('detailSlots').innerHTML = `<table class="plan small">${headerRow()}${WORK_SLOTS.map(s => `<tr><th>${s}</th>${DAYS.map(d => {
        const k = `${s}|${d}`;
        if (off.has(k)) return '<td class="blocked">UNAVAILABLE</td>';
        if (tt[s]?.[d]) return `<td class="booked">${esc(tt[s][d])}${pref.has(k) ? '<br><small>preferred (taken)</small>' : ''}</td>`;
        if (pref.has(k)) return '<td class="open">PREFERRED</td>';
        return '<td class="open faint">OPEN</td>';
      }).join('')}</tr>`).join('')}</table>`;
      const decided = r.status === 'Approved' || r.status === 'Declined';
      const approve = document.getElementById('approve'), decline = document.getElementById('decline');
      approve.disabled = decline.disabled = decided;
      approve.onclick = () => { setRequestStatus(r, 'Approved'); toast(`${r.no} approved`); showDetail(r); };
      decline.onclick = () => { setRequestStatus(r, 'Declined'); toast(`${r.no} declined`); showDetail(r); };
    };
    const route = () => {
      const key = param('no'), course = param('course');
      const r = key ? reqs.find(x => x.key === key) || reqs.find(x => x.no === key)
        : (!param('from') && course) ? [...reqs].reverse().find(x => x.course === course) : null;
      if (r) { view.set('plannerApprovals', { selected: r.key }); return showDetail(r); }
      if (key) toast(`Request ${key} not found`);
      showList();
    };
    const open = tr => {
      if (!tr?.dataset.key) return;
      view.set('plannerApprovals', { selected: tr.dataset.key });
      history.pushState(null, '', detailsUrl({ key: tr.dataset.key }, 'approvals'));
      route();
    };
    list.addEventListener('click', e => open(e.target.closest('tr')));
    list.addEventListener('keydown', e => { if (e.key === 'Enter') open(e.target.closest('tr')); });
    // Back returns to the page the details were opened from; that page restores its selection and scroll
    const BACK = {
      courses: () => 'planner-requests.html',
      queue: () => 'planner-queue.html',
      rooms: () => 'planner-rooms.html?course=' + encodeURIComponent(param('course') || ''),
    };
    document.getElementById('back').onclick = () => {
      const from = BACK[param('from')];
      if (from) { location.href = from(); return; }
      history.pushState(null, '', location.pathname);
      route();
      list.querySelector('tr.selected')?.focus({ preventScroll: true });
    };
    window.addEventListener('popstate', route);
    route();
  },
};
