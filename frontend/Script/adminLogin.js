document.getElementById('adminLoginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const adminId = document.getElementById('admin-id').value.trim();
    const password = document.getElementById('password').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ identifier: adminId, password: password, role: 'admin' })
        });

        if (res.ok) {
            const admin = await res.json();
            localStorage.setItem('adminId', admin.adminId || adminId);
            localStorage.setItem('adminEmail', admin.email || '');
            window.location.href = '../Main/AdminDashboard.html';
        } else {
            alert('Invalid admin ID or password. Please check your credentials.');
        }
    } catch (err) {
        console.error('Admin login failed:', err);
        alert('Unable to connect to backend. Make sure the server is running.');
    }
});
