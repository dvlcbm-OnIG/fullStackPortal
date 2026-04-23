const adminWelcome = document.getElementById('adminWelcome');
const teacherCount = document.getElementById('teacherCount');
const studentCount = document.getElementById('studentCount');
const teachersTableBody = document.getElementById('teachersTableBody');
const studentsTableBody = document.getElementById('studentsTableBody');

const connectionStatus = document.getElementById('connectionStatus');

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

refreshBtn.addEventListener('click', () => {
    loadAccounts();
});

async function loadAccounts() {
    try {
        // Update connection status
        connectionStatus.innerHTML = '<i class="fa-solid fa-circle" style="color: #3b82f6;"></i> Loading data...';

        // Show loading state
        teachersTableBody.innerHTML = '<tr><td colspan="2" class="loading-state">Loading teachers...</td></tr>';
        studentsTableBody.innerHTML = '<tr><td colspan="4" class="loading-state">Loading students...</td></tr>';

        // Add delay between requests to avoid overwhelming MongoDB Atlas free tier
        const teachersRes = await fetch('/api/users?role=teacher');
        if (!teachersRes.ok) {
            if (teachersRes.status === 503) {
                throw new Error('Database unavailable');
            }
            throw new Error(`Failed to load teachers: ${teachersRes.status}`);
        }
        const teachers = await teachersRes.json();

        // Small delay before next request
        await new Promise(resolve => setTimeout(resolve, 500));

        const studentsRes = await fetch('/api/users?role=student');
        if (!studentsRes.ok) {
            if (studentsRes.status === 503) {
                throw new Error('Database unavailable');
            }
            throw new Error(`Failed to load students: ${studentsRes.status}`);
        }
        const students = await studentsRes.json();

        teacherCount.textContent = teachers.length;
        studentCount.textContent = students.length;

        // Update connection status on success
        connectionStatus.innerHTML = '<i class="fa-solid fa-circle" style="color: #059669;"></i> Connected';

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

        // Update connection status on error
        connectionStatus.innerHTML = '<i class="fa-solid fa-circle" style="color: #dc2626;"></i> Connection failed';

        // Check if it's a database unavailability issue
        if (err.message.includes('Database unavailable')) {
            teachersTableBody.innerHTML = '<tr><td colspan="2" class="error-state">🔄 Database is connecting... <button onclick="loadAccounts()" style="background: #059669; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Try Again</button></td></tr>';
            studentsTableBody.innerHTML = '<tr><td colspan="4" class="error-state">🔄 Database is connecting... <button onclick="loadAccounts()" style="background: #059669; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Try Again</button></td></tr>';
        } else if (err.message.includes('Failed to load') || err.message.includes('fetch')) {
            teachersTableBody.innerHTML = '<tr><td colspan="2" class="error-state">⚠️ Database connection issue. <button onclick="loadAccounts()" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Retry</button></td></tr>';
            studentsTableBody.innerHTML = '<tr><td colspan="4" class="error-state">⚠️ Database connection issue. <button onclick="loadAccounts()" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Retry</button></td></tr>';
        } else {
            teachersTableBody.innerHTML = '<tr><td colspan="2" class="error-state">Unable to load teacher accounts.</td></tr>';
            studentsTableBody.innerHTML = '<tr><td colspan="4" class="error-state">Unable to load student accounts.</td></tr>';
        }
    }
}

loadAccounts();
