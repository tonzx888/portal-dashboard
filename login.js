const API_LOGIN = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const pesan = document.getElementById("pesanLogin");

    pesan.innerText = "Memproses login...";

    if (!username || !password) {
        pesan.innerText = "Username dan password wajib diisi.";
        return;
    }

    const url = `${API_LOGIN}?type=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    fetch(url)
        .then(response => response.json())
        .then(result => {
            if (result.success === true) {
                localStorage.setItem("loginUser", JSON.stringify({
                    username: result.username,
                    role: result.role
                }));

                window.location.href = "index.html";
            } else {
                pesan.innerText = result.message || "Username atau password salah.";
            }
        })
        .catch(error => {
            console.error(error);
            pesan.innerText = "Gagal menghubungkan ke server login.";
        });
}

document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("loginForm");

    form.addEventListener("submit", function (e) {

        e.preventDefault();

        login();

    });

});