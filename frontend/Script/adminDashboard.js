const adminWelcome = document.getElementById('adminWelcome');
const teacherCount = document.getElementById('teacherCount');
const studentCount = document.getElementById('studentCount');
const teachersTableBody = document.getElementById('teachersTableBody');
const studentsTableBody = document.getElementById('studentsTableBody');

const signOutBtn = document.getElementById('signOutBtn');

const adminId = localStorage.getItem('adminId');
const adminEmail = localStorage.getItem('adminEmail');

if (!adminId) {
    window.location.href = '../SetupAccount/AdminLogin.html';
}

adminWelcome.textContent = adminEmail ? `| ${adminEmail}` : `| ${adminId}`;

signOutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminId');
    localStorage.removeItem('adminEmail');
    window.location.href = '../SetupAccount/AdminLogin.html';
});

async function loadAccounts() {
    try {
        const [teachersRes, studentsRes] = await Promise.all([
            fetch('/api/users?role=teacher'),
            fetch('/api/users?role=student')
        ]);

        if (!teachersRes.ok || !studentsRes.ok) {
            throw new Error('Failed to load account lists');
        }

        const teachers = await teachersRes.json();
        const students = await studentsRes.json();

        teacherCount.textContent = teachers.length;
        studentCount.textContent = students.length;

        teachersTableBody.innerHTML = teachers.length ? teachers.map(teacher => `
            <tr>
                <td>${teacher.email || ''}</td>
                <td>${teacher.role || 'teacher'}</td>
            </tr>
        `).join('') : '<tr><td colspan="2" class="empty-state">No teachers found.</td></tr>';

        studentsTableBody.innerHTML = students.length ? students.map(student => `
            <tr>
                <td>${student.studentId || ''}</td>
                <td>${student.firstName || ''}</td>
                <td>${student.lastName || ''}</td>
                <td>${student.email || ''}</td>
            </tr>
        `).join('') : '<tr><td colspan="4" class="empty-state">No students found.</td></tr>';
    } catch (err) {
        console.error('Failed to load accounts:', err);
        teachersTableBody.innerHTML = '<tr><td colspan="2" class="empty-state">Unable to load teacher accounts.</td></tr>';
        studentsTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">Unable to load student accounts.</td></tr>';
    }
}

loadAccounts();
