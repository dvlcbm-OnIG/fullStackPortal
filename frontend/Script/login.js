const loginForm = document.getElementById('loginForm');
const password = document.getElementById('password');
const email = document.getElementById('email');

//../Main/environment.html
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const credentials = {
        email: email.value,
        password: password.value
    };

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });

        if (res.ok) {
            const userData = await res.json();
            // Save to localStorage just for the environment rendering, since you rely on it
            localStorage.setItem('username', userData.username);
            localStorage.setItem('email', userData.email);
            localStorage.setItem('password', userData.password);

            alert("Login successful!");
            window.location.href = "../Main/environment.html";
        } else {
            alert("Invalid email or password. Please try again!");
            email.value = "";
            password.value = "";
        }
    } catch (err) {
        console.error("Login failed:", err);
        alert("Login system error");
    }
});