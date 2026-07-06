const loginUser = JSON.parse(localStorage.getItem("loginUser"));

if (!loginUser || loginUser.role !== "MASTER") {
    alert("Akses ditolak. Halaman ini hanya untuk MASTER.");
    window.location.href = "index.html";
}

const API_URL = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

async function loadUsers() {
    const tbody = document.getElementById("userTable");

    tbody.innerHTML = `
        <tr>
            <td colspan="4" style="text-align:center;">Memuat data user...</td>
        </tr>
    `;

    try {
        const res = await fetch(API_URL + "?type=users");
        const data = await res.json();

        let html = "";

        data.forEach((user, index) => {
            html += `
                <tr>
                    <td>${String(user.username || "").trim()}</td>
                    <td>${String(user.role || "").trim()}</td>
                    <td>${String(user.status || "").trim()}</td>
                    <td>
                        <button class="btn-small" onclick="editUser(${index})">Edit</button>
                        <button class="btn-small danger" onclick="deleteUser(${index})">Hapus</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html || `
            <tr>
                <td colspan="4" style="text-align:center;">Data user kosong.</td>
            </tr>
        `;

    } catch (error) {
        console.error("Gagal load users:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center;">Gagal memuat data user.</td>
            </tr>
        `;
    }
}

function editUser(index) {
    alert("Fitur edit user dibuat di step berikutnya.");
}

function deleteUser(index) {
    alert("Fitur hapus user dibuat di step berikutnya.");
}

loadUsers();