const signinForm = document.getElementById('signinForm');
const userName = document.getElementById('username');
const password = document.getElementById('password');
const email = document.getElementById('email');

signinForm.addEventListener('submit', async function(e) {
    e.preventDefault(); // Stop normal form submission

    const userData = {
        username: userName.value,
        email: email.value,
        password: password.value
    };

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (res.ok) {
            // Save to localStorage just for the environment rendering
            localStorage.setItem('username', userName.value);
            localStorage.setItem('email', email.value);
            localStorage.setItem('password', password.value);
            alert("Registration successful!");
            window.location.href = "../SetupAccount/Login.html"; // Optional redirect if you want
        } else {
            const data = await res.json();
            alert("Error: " + (data.error || 'Registration failed'));
        }
    } catch (err) {
        console.error("Fetch error:", err);
        alert("Registration failed");
    }
});