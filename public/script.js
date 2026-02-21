const API_BASE = '/api';
const editModal = new bootstrap.Modal(document.getElementById('editModal'));
let currentEdit = { endpoint: '', id: null, data: {} };

// Theme toggle
document.getElementById('theme-toggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});
if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

// Show toast
function showToast(message, type = 'danger') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
  toast.style.top = '20px';
  toast.style.right = '20px';
  toast.style.zIndex = '9999';
  toast.innerHTML = `${message} <button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// Refresh all data
async function refreshAll() {
  fetchData('courses', 'course-list', renderCourseItem, 'course-search');
  fetchData('instructors', 'instructor-list', renderInstructorItem, 'instructor-search');
  fetchData('course-instructors', 'course-instructor-list', renderAssignmentItem);
  fetchData('availabilities', 'availability-list', renderAvailabilityItem);
  fetchData('timetables', 'timetable-history', renderTimetableHistory);

  // Populate dropdowns
  await populateSelect('courses', 'assignment-course', item => item.name);
  await populateSelect('instructors', 'assignment-instructor', item => item.name);
  await populateSelect('instructors', 'availability-instructor', item => item.name);
}

// Render functions
function renderCourseItem(item) {
  return `${item.name} (${item.credits} credits) ${item.prerequisites ? '- Prereq: ' + item.prerequisites : ''}`;
}

function renderInstructorItem(item) {
  return `${item.name} - ${item.email}`;
}

function renderAssignmentItem(item) {
  return `${item.course_name} → ${item.instructor_name}`;
}

function renderAvailabilityItem(item) {
  return `${item.instructor_name}: ${item.day} ${item.start_time} - ${item.end_time}`;
}

function renderTimetableHistory(item) {
  return `<strong>${new Date(item.created_at).toLocaleString()}</strong><pre>${JSON.stringify(item.generated_data, null, 2)}</pre>`;
}

// Fetch and display with search
async function fetchData(endpoint, listId, renderFn, searchId = null) {
  try {
    const res = await fetch(`${API_BASE}/${endpoint}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'API error');
    }
    const data = await res.json();
    const list = document.getElementById(listId);
    list.innerHTML = '';
    data.forEach(item => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `
        ${renderFn(item)}
        <div>
          <button class="btn btn-sm btn-warning me-2" onclick="openEdit('${endpoint}', ${item.id}, ${JSON.stringify(item).replace(/"/g, '&quot;')})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteItem('${endpoint}', ${item.id})">Delete</button>
        </div>
      `;
      list.appendChild(li);
    });

    // Search functionality
    if (searchId) {
      const searchInput = document.getElementById(searchId);
      searchInput.oninput = () => {
        const term = searchInput.value.toLowerCase();
        Array.from(list.children).forEach(li => {
          li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
      };
    }
  } catch (err) {
    console.error(err);
    showToast('Error loading ' + endpoint + ': ' + err.message);
  }
}

// Populate select
async function populateSelect(endpoint, selectId, renderOption) {
  try {
    const res = await fetch(`${API_BASE}/${endpoint}`);
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Select...</option>';
    data.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = renderOption(item);
      select.appendChild(opt);
    });
  } catch (err) {
    showToast('Error loading ' + endpoint);
  }
}

// Delete item
async function deleteItem(endpoint, id) {
  if (!confirm('Delete this item?')) return;
  try {
    const res = await fetch(`${API_BASE}/${endpoint}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    showToast('Deleted successfully', 'success');
    refreshAll();
  } catch (err) {
    showToast('Delete error: ' + err.message);
  }
}

// Form handlers
document.getElementById('course-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('course-name').value.trim();
  const credits = document.getElementById('course-credits').value;
  const prereq = document.getElementById('course-prereq').value.trim() || null;

  try {
    const res = await fetch(`${API_BASE}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, credits, prerequisites: prereq })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    e.target.reset();
    refreshAll();
    showToast('Course added successfully!', 'success');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
});

document.getElementById('instructor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('instructor-name').value.trim();
  const email = document.getElementById('instructor-email').value.trim();

  try {
    const res = await fetch(`${API_BASE}/instructors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    e.target.reset();
    refreshAll();
    showToast('Instructor added!', 'success');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
});

document.getElementById('course-instructor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const course_id = document.getElementById('assignment-course').value;
  const instructor_id = document.getElementById('assignment-instructor').value;

  try {
    const res = await fetch(`${API_BASE}/course-instructors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id, instructor_id })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    e.target.reset();
    refreshAll();
    showToast('Assigned successfully!', 'success');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
});

document.getElementById('availability-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const instructor_id = document.getElementById('availability-instructor').value;
  const day = document.getElementById('availability-day').value.trim();
  const start_time = document.getElementById('availability-start').value;
  const end_time = document.getElementById('availability-end').value;

  try {
    const res = await fetch(`${API_BASE}/availabilities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructor_id, day, start_time, end_time })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    e.target.reset();
    refreshAll();
    showToast('Availability added!', 'success');
  } catch (err) {
  console.error(err);  // For debugging
  showToast('Error: ' + (err.message || 'Unknown error'));
}
});

document.getElementById('generate-btn').addEventListener('click', async () => {
  const loading = document.getElementById('loading');
  loading.style.display = 'block';
  try {
    const res = await fetch(`${API_BASE}/generate-timetable`, { method: 'POST' });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    const { timetable } = await res.json();
    const output = document.getElementById('timetable-output');
    let html = '<table class="table table-striped"><thead><tr><th>Day</th><th>Schedule</th></tr></thead><tbody>';
    for (const day in timetable.days) {
      html += `<tr><td><strong>${day}</strong></td><td><ul class="list-unstyled mb-0">`;
      timetable.days[day].forEach(slot => {
        html += `<li class="badge bg-primary me-2 mb-1">${slot.time}: ${slot.course} by ${slot.instructor}</li>`;
      });
      html += '</ul></td></tr>';
    }
    html += '</tbody></table>';
    output.innerHTML = html;
    refreshAll();
    showToast('Timetable generated successfully!', 'success');
  } catch (err) {
    showToast('Generate error: ' + err.message);
  } finally {
    loading.style.display = 'none';
  }
});

// Initial load
refreshAll();