const API_LOGIN = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const pesan = document.getElementById("pesanLogin");

  if (!username || !password) {
    pesan.innerText = "Username dan password wajib diisi.";
    return;
  }

  const url = `${API_LOGIN}?type=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  fetch(url)
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        localStorage.setItem("loginUser", JSON.stringify({
          username: result.username,
          role: result.role
        }));

        window.location.href = "index.html";
      } else {
        pesan.innerText = result.message;
      }
    })
    .catch(error => {
      console.error(error);
      pesan.innerText = "Gagal login. Cek koneksi atau Apps Script.";
    });
}