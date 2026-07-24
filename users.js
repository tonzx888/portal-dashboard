const USERS_API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

let usersData = [];
let usersToastTimer = null;

const loggedInUser = getLoginUser();
const loggedInUsername = String(loggedInUser?.username || "").trim();
const loggedInRole = String(loggedInUser?.role || "").trim().toUpperCase();

if (loggedInRole !== "MASTER") {
    alert("Akses ditolak. Halaman ini hanya untuk MASTER.");
    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
    loadUsers();

    document.getElementById("searchUser")
        ?.addEventListener("input", applyUserFilters);

    document.getElementById("filterRole")
        ?.addEventListener("change", applyUserFilters);

    document.getElementById("filterStatus")
        ?.addEventListener("change", applyUserFilters);

    document.getElementById("btnRefreshUsers")
        ?.addEventListener("click", loadUsers);

    document.getElementById("btnSaveUser")
        ?.addEventListener("click", saveUser);

    document.getElementById("btnResetPassword")
        ?.addEventListener("click", submitResetPassword);

    document.getElementById("toggleUserPassword")
        ?.addEventListener("click", toggleUserPassword);

    window.addEventListener("click", event => {
        if (event.target === document.getElementById("userModal")) {
            closeUserModal();
        }

        if (event.target === document.getElementById("resetPasswordModal")) {
            closeResetPasswordModal();
        }
    });
});

function showUsersToast(message, type = "success") {
    const toast = document.getElementById("toast");

    if (!toast) {
        console.log(message);
        return;
    }

    clearTimeout(usersToastTimer);

    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.display = "block";

    usersToastTimer = setTimeout(() => {
        toast.style.display = "none";
    }, 3300);
}

function showUsersAlert(message = "") {
    const alertBox = document.getElementById("usersAlert");

    if (!alertBox) return;

    alertBox.hidden = !message;
    alertBox.textContent = message;
}

function escapeUsersHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function callUsersApi(params) {
    params.set("_", String(Date.now()));

    const response = await fetch(
        `${USERS_API_BASE}?${params.toString()}`,
        {
            method: "GET",
            cache: "no-store",
            redirect: "follow"
        }
    );

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    let result;

    try {
        result = JSON.parse(text);
    } catch {
        throw new Error("Response server bukan JSON yang valid.");
    }

    return result;
}

async function loadUsers() {
    const tbody = document.getElementById("userTable");

    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="users-loading">Memuat data user...</td>
        </tr>
    `;

    showUsersAlert("");

    try {
        const result = await callUsersApi(
            new URLSearchParams({ type: "users" })
        );

        if (!Array.isArray(result)) {
            throw new Error(result.message || "Format data user tidak valid.");
        }

        usersData = result.map((user, index) => ({
            row: Number(user.row || index + 2),
            username: String(user.username || "").trim(),
            role: String(user.role || "").trim().toUpperCase(),
            status: normalizeUserStatus(user.status)
        }));

        updateUsersSummary();
        applyUserFilters();
    } catch (error) {
        console.error("Gagal memuat user:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="users-loading">Gagal memuat data user.</td>
            </tr>
        `;

        showUsersAlert(
            `Gagal mengambil data: ${error.message}. Pastikan User.gs sudah di-deploy ulang.`
        );
    }
}

function normalizeUserStatus(value) {
    const status = String(value || "").trim().toUpperCase();

    if (["NON AKTIF", "NON-AKTIF", "INACTIVE", "DISABLED"].includes(status)) {
        return "NONAKTIF";
    }

    return status === "AKTIF" ? "AKTIF" : "NONAKTIF";
}

function updateUsersSummary() {
    setUserText("summaryUsers", usersData.length);
    setUserText(
        "summaryActive",
        usersData.filter(user => user.status === "AKTIF").length
    );
    setUserText(
        "summaryInactive",
        usersData.filter(user => user.status === "NONAKTIF").length
    );
    setUserText(
        "summaryMaster",
        usersData.filter(user => user.role === "MASTER").length
    );
}

function applyUserFilters() {
    const keyword = String(
        document.getElementById("searchUser")?.value || ""
    ).trim().toLowerCase();

    const role = String(
        document.getElementById("filterRole")?.value || ""
    ).toUpperCase();

    const status = String(
        document.getElementById("filterStatus")?.value || ""
    ).toUpperCase();

    const filtered = usersData.filter(user => {
        const searchable = [
            user.username,
            user.role,
            user.status
        ].join(" ").toLowerCase();

        return (
            searchable.includes(keyword) &&
            (!role || user.role === role) &&
            (!status || user.status === status)
        );
    });

    renderUsers(filtered);
}

function renderUsers(data) {
    const tbody = document.getElementById("userTable");

    if (!data.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="users-loading">Tidak ada data yang sesuai.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map(user => {
        const encodedUsername = encodeURIComponent(user.username);
        const isCurrentUser =
            user.username.toLowerCase() === loggedInUsername.toLowerCase();

        const isActive = user.status === "AKTIF";
        const initials = user.username
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join("") || "?";

        return `
            <tr>
                <td>
                    <div class="users-user-cell">
                        <div class="users-avatar">${escapeUsersHtml(initials)}</div>

                        <div>
                            <strong>${escapeUsersHtml(user.username)}</strong>
                            <small>${isCurrentUser ? "Akun yang sedang digunakan" : "Dashboard account"}</small>
                        </div>
                    </div>
                </td>

                <td>
                    <span class="users-role-badge ${user.role.toLowerCase()}">
                        ${escapeUsersHtml(user.role)}
                    </span>
                </td>

                <td>
                    <span class="users-status-badge ${isActive ? "active" : "inactive"}">
                        ${escapeUsersHtml(user.status)}
                    </span>
                </td>

                <td>
                    <div class="users-actions">
                        <button
                            type="button"
                            class="users-action-btn edit"
                            onclick="openEditUserModal('${encodedUsername}')"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="users-action-btn password"
                            onclick="openResetPasswordModal('${encodedUsername}')"
                        >
                            Reset Password
                        </button>

                        <button
                            type="button"
                            class="users-action-btn ${isActive ? "deactivate" : "activate"}"
                            onclick="changeUserStatus('${encodedUsername}', '${isActive ? "NONAKTIF" : "AKTIF"}')"
                            ${isCurrentUser && isActive ? "disabled" : ""}
                            title="${isCurrentUser && isActive ? "Akun yang sedang login tidak dapat dinonaktifkan." : ""}"
                        >
                            ${isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>

                        <button
                            type="button"
                            class="users-action-btn delete"
                            onclick="deleteUserAccount('${encodedUsername}')"
                            ${isCurrentUser ? "disabled" : ""}
                        >
                            Hapus
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function openAddUserModal() {
    document.getElementById("userModalTitle").textContent = "Tambah User";
    document.getElementById("originalUsername").value = "";
    document.getElementById("modalUsername").value = "";
    document.getElementById("modalUsername").disabled = false;
    document.getElementById("modalPassword").value = "";
    document.getElementById("modalRole").value = "";
    document.getElementById("modalStatus").value = "AKTIF";
    document.getElementById("passwordHelp").textContent =
        "Password wajib untuk user baru.";

    document.getElementById("userModal").style.display = "flex";
    document.getElementById("modalUsername").focus();
}

function openEditUserModal(encodedUsername) {
    const username = decodeURIComponent(encodedUsername);
    const user = usersData.find(item => item.username === username);

    if (!user) {
        showUsersToast("Data user tidak ditemukan.", "error");
        return;
    }

    document.getElementById("userModalTitle").textContent = "Edit User";
    document.getElementById("originalUsername").value = user.username;
    document.getElementById("modalUsername").value = user.username;
    document.getElementById("modalUsername").disabled = false;
    document.getElementById("modalPassword").value = "";
    document.getElementById("modalRole").value = user.role;
    document.getElementById("modalStatus").value = user.status;
    document.getElementById("passwordHelp").textContent =
        "Kosongkan password agar password lama tetap digunakan.";

    document.getElementById("userModal").style.display = "flex";
}

function closeUserModal() {
    document.getElementById("userModal").style.display = "none";
}

function toggleUserPassword() {
    const input = document.getElementById("modalPassword");
    const button = document.getElementById("toggleUserPassword");
    const show = input.type === "password";

    input.type = show ? "text" : "password";
    button.textContent = show ? "🙈" : "👁";
}

async function saveUser() {
    const button = document.getElementById("btnSaveUser");

    const originalUsername =
        document.getElementById("originalUsername").value.trim();
    const username =
        document.getElementById("modalUsername").value.trim();
    const password =
        document.getElementById("modalPassword").value.trim();
    const role =
        document.getElementById("modalRole").value.trim().toUpperCase();
    const status =
        document.getElementById("modalStatus").value.trim().toUpperCase();

    if (!username || !role) {
        showUsersToast("Username dan role wajib diisi.", "error");
        return;
    }

    if (!originalUsername && !password) {
        showUsersToast("Password wajib untuk user baru.", "error");
        return;
    }

    button.disabled = true;
    button.textContent = "Menyimpan...";

    try {
        const type = originalUsername ? "editUser" : "addUser";

        const params = new URLSearchParams({
            type,
            username,
            role,
            status
        });

        if (password) params.set("password", password);

        if (originalUsername) {
            params.set("originalUsername", originalUsername);
        }

        const result = await callUsersApi(params);

        showUsersToast(
            result.message || "Proses selesai.",
            result.success ? "success" : "error"
        );

        if (result.success) {
            closeUserModal();
            await loadUsers();
        }
    } catch (error) {
        console.error("Gagal menyimpan user:", error);
        showUsersToast(`Gagal menyimpan: ${error.message}`, "error");
    } finally {
        button.disabled = false;
        button.textContent = "Simpan";
    }
}

function openResetPasswordModal(encodedUsername) {
    const username = decodeURIComponent(encodedUsername);

    document.getElementById("resetUsername").value = username;
    document.getElementById("resetUsernameLabel").textContent = username;
    document.getElementById("newPassword").value = "";
    document.getElementById("resetPasswordModal").style.display = "flex";
    document.getElementById("newPassword").focus();
}

function closeResetPasswordModal() {
    document.getElementById("resetPasswordModal").style.display = "none";
}

async function submitResetPassword() {
    const button = document.getElementById("btnResetPassword");
    const username =
        document.getElementById("resetUsername").value.trim();
    const password =
        document.getElementById("newPassword").value.trim();

    if (!password) {
        showUsersToast("Password baru wajib diisi.", "error");
        return;
    }

    button.disabled = true;
    button.textContent = "Memproses...";

    try {
        const result = await callUsersApi(
            new URLSearchParams({
                type: "resetPassword",
                username,
                password
            })
        );

        showUsersToast(
            result.message || "Proses selesai.",
            result.success ? "success" : "error"
        );

        if (result.success) {
            closeResetPasswordModal();
        }
    } catch (error) {
        showUsersToast(`Reset password gagal: ${error.message}`, "error");
    } finally {
        button.disabled = false;
        button.textContent = "Reset Password";
    }
}

async function changeUserStatus(encodedUsername, newStatus) {
    const username = decodeURIComponent(encodedUsername);
    const normalizedStatus = normalizeUserStatus(newStatus);

    if (
        username.toLowerCase() === loggedInUsername.toLowerCase() &&
        normalizedStatus === "NONAKTIF"
    ) {
        showUsersToast(
            "Akun yang sedang login tidak dapat dinonaktifkan.",
            "error"
        );
        return;
    }

    const actionText =
        normalizedStatus === "AKTIF" ? "mengaktifkan" : "menonaktifkan";

    if (!confirm(`Yakin ingin ${actionText} user ${username}?`)) {
        return;
    }

    try {
        const result = await callUsersApi(
            new URLSearchParams({
                type: "updateUserStatus",
                username,
                status: normalizedStatus
            })
        );

        showUsersToast(
            result.message || "Status user diperbarui.",
            result.success ? "success" : "error"
        );

        if (result.success) {
            await loadUsers();
        }
    } catch (error) {
        console.error("Update status gagal:", error);
        showUsersToast(`Update status gagal: ${error.message}`, "error");
    }
}

async function deleteUserAccount(encodedUsername) {
    const username = decodeURIComponent(encodedUsername);

    if (username.toLowerCase() === loggedInUsername.toLowerCase()) {
        showUsersToast("Akun yang sedang login tidak dapat dihapus.", "error");
        return;
    }

    if (!confirm(`Hapus user ${username}?`)) return;

    try {
        const result = await callUsersApi(
            new URLSearchParams({
                type: "deleteUser",
                username
            })
        );

        showUsersToast(
            result.message || "Proses selesai.",
            result.success ? "success" : "error"
        );

        if (result.success) {
            await loadUsers();
        }
    } catch (error) {
        showUsersToast(`Hapus user gagal: ${error.message}`, "error");
    }
}

function setUserText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}
