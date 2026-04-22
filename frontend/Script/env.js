// On environment.html: display the stored username

const navName = document.querySelector('.main-nav-name')
const envPass = document.getElementById('envPass')
const signOutBtn = document.getElementById('signOutBtn')

    const storedUsername = localStorage.getItem('username');
    const storedPassword = localStorage.getItem('password');
    const storedEmail = localStorage.getItem('email');
    if (storedUsername || storedPassword) {
      
        navName.innerHTML = `| Welcome, <b>${storedUsername}</b>`;
        envPass.innerHTML = `Email: <br><b>${storedEmail}</b><br><br>Password: <br><b>${storedPassword}</b>`;
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            window.location.href = '../SetupAccount/TeacherSignIn.html';
        });
    }
