const loginUser = JSON.parse(localStorage.getItem("loginUser"));

if (!loginUser || String(loginUser.role || "").trim().toUpperCase() !== "MASTER") {
  alert("Akses ditolak. Halaman ini hanya untuk MASTER.");
  window.location.href = "index.html";
}

const API_URL =
  "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

let usersData = [];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("userForm").addEventListener("submit", submitUserForm);
  document.getElementById("resetForm").addEventListener("submit", submitResetPassword);
  loadUsers();
});

async function requestApi(params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${API_URL}?${query.toString()}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function loadUsers() {
  const tbody = document.getElementById("userTable");

  tbody.innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center;">Memuat data user...</td>
    </tr>
  `;

  try {
    const result = await requestApi({ type: "users" });

    if (result && result.success === false) {
      throw new Error(result.message || "Gagal memuat data user.");
    }

    usersData = Array.isArray(result)
      ? result
      : Array.isArray(result.data)
        ? result.data
        : [];

    renderUsers(usersData);
  } catch (error) {
    console.error("Gagal load users:", error);

    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;">
          Gagal memuat data user.
        </td>
      </tr>
    `;

    showMessage(error.message || "Gagal memuat data user.", "error");
  }
}

function renderUsers(data) {
  const tbody = document.getElementById("userTable");

  if (!data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;">Data user kosong.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map((user) => {
    const username = clean(user.username);
    const role = clean(user.role).toUpperCase();
    const status = clean(user.status).toUpperCase();
    const statusClass = status === "AKTIF" ? "status-aktif" : "status-nonaktif";
    const nextStatus = status === "AKTIF" ? "NONAKTIF" : "AKTIF";
    const statusLabel = status === "AKTIF" ? "Nonaktifkan" : "Aktifkan";
    const isMasterMain = username.toLowerCase() === "master";

    return `
      <tr>
        <td>${escapeHtml(username)}</td>
        <td>${escapeHtml(role)}</td>
        <td>
          <span class="status-badge ${statusClass}">
            ${escapeHtml(status)}
          </span>
        </td>
        <td>
          <div class="action-group">
            <button
              class="btn-small btn-edit"
              onclick='openEditModal(${JSON.stringify(username)})'>
              Edit
            </button>

            <button
              class="btn-small btn-reset"
              onclick='openResetModal(${JSON.stringify(username)})'>
              Reset Password
            </button>

            <button
              class="btn-small btn-status"
              ${isMasterMain ? "disabled" : ""}
              onclick='changeUserStatus(${JSON.stringify(username)}, ${JSON.stringify(nextStatus)})'>
              ${statusLabel}
            </button>

            <button
              class="btn-small btn-danger"
              ${isMasterMain ? "disabled" : ""}
              onclick='deleteUser(${JSON.stringify(username)})'>
              Hapus
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function filterUsers() {
  const keyword = clean(document.getElementById("searchUser").value).toLowerCase();

  if (!keyword) {
    renderUsers(usersData);
    return;
  }

  const filtered = usersData.filter((user) => {
    return [
      user.username,
      user.role,
      user.status
    ].some((value) => clean(value).toLowerCase().includes(keyword));
  });

  renderUsers(filtered);
}

function openAddModal() {
  document.getElementById("modalTitle").textContent = "Tambah User";
  document.getElementById("formMode").value = "add";
  document.getElementById("oldUsername").value = "";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("role").value = "";
  document.getElementById("status").value = "AKTIF";
  document.getElementById("password").required = true;
  document.getElementById("userModal").classList.add("show");
  document.getElementById("username").focus();
}

function openEditModal(username) {
  const user = usersData.find(
    (item) => clean(item.username).toLowerCase() === clean(username).toLowerCase()
  );

  if (!user) {
    showMessage("Data user tidak ditemukan.", "error");
    return;
  }

  document.getElementById("modalTitle").textContent = "Edit User";
  document.getElementById("formMode").value = "edit";
  document.getElementById("oldUsername").value = clean(user.username);
  document.getElementById("username").value = clean(user.username);
  document.getElementById("password").value = clean(user.password);
  document.getElementById("role").value = clean(user.role).toUpperCase();
  document.getElementById("status").value = clean(user.status).toUpperCase();
  document.getElementById("password").required = true;
  document.getElementById("userModal").classList.add("show");
  document.getElementById("username").focus();
}

function closeUserModal() {
  document.getElementById("userModal").classList.remove("show");
  document.getElementById("userForm").reset();
}

function closeModalFromBackdrop(event) {
  if (event.target.id === "userModal") {
    closeUserModal();
  }
}

async function submitUserForm(event) {
  event.preventDefault();

  const button = document.getElementById("saveUserButton");
  const mode = document.getElementById("formMode").value;

  const username = clean(document.getElementById("username").value);
  const password = clean(document.getElementById("password").value);
  const role = clean(document.getElementById("role").value).toUpperCase();
  const status = clean(document.getElementById("status").value).toUpperCase();
  const oldUsername = clean(document.getElementById("oldUsername").value);

  if (username.length < 3) {
    showMessage("Username minimal 3 karakter.", "error");
    return;
  }

  if (password.length < 6) {
    showMessage("Password minimal 6 karakter.", "error");
    return;
  }

  setButtonLoading(button, true, "Menyimpan...");

  try {
    const params = {
      type: mode === "edit" ? "editUser" : "addUser",
      username,
      password,
      role,
      status
    };

    if (mode === "edit") {
      params.oldUsername = oldUsername;
    }

    const result = await requestApi(params);

    if (!result.success) {
      throw new Error(result.message || "Proses gagal.");
    }

    closeUserModal();
    showMessage(result.message || "Data user berhasil disimpan.", "success");
    await loadUsers();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Gagal menyimpan user.", "error");
  } finally {
    setButtonLoading(button, false, "Simpan");
  }
}

function openResetModal(username) {
  document.getElementById("resetUsername").value = clean(username);
  document.getElementById("newPassword").value = "";
  document.getElementById("resetModal").classList.add("show");
  document.getElementById("newPassword").focus();
}

function closeResetModal() {
  document.getElementById("resetModal").classList.remove("show");
  document.getElementById("resetForm").reset();
}

function closeResetFromBackdrop(event) {
  if (event.target.id === "resetModal") {
    closeResetModal();
  }
}

async function submitResetPassword(event) {
  event.preventDefault();

  const button = document.getElementById("resetPasswordButton");
  const username = clean(document.getElementById("resetUsername").value);
  const newPassword = clean(document.getElementById("newPassword").value);

  if (newPassword.length < 6) {
    showMessage("Password minimal 6 karakter.", "error");
    return;
  }

  setButtonLoading(button, true, "Memproses...");

  try {
    const result = await requestApi({
      type: "resetPassword",
      username,
      newPassword
    });

    if (!result.success) {
      throw new Error(result.message || "Reset password gagal.");
    }

    closeResetModal();
    showMessage(result.message || "Password berhasil direset.", "success");
    await loadUsers();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Reset password gagal.", "error");
  } finally {
    setButtonLoading(button, false, "Reset Password");
  }
}

async function changeUserStatus(username, status) {
  const action = status === "AKTIF" ? "mengaktifkan" : "menonaktifkan";

  if (!confirm(`Yakin ingin ${action} user "${username}"?`)) {
    return;
  }

  try {
    const result = await requestApi({
      type: "updateUserStatus",
      username,
      status
    });

    if (!result.success) {
      throw new Error(result.message || "Perubahan status gagal.");
    }

    showMessage(result.message || "Status user berhasil diperbarui.", "success");
    await loadUsers();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Perubahan status gagal.", "error");
  }
}

async function deleteUser(username) {
  if (!confirm(`Yakin ingin menghapus user "${username}"?`)) {
    return;
  }

  try {
    const result = await requestApi({
      type: "deleteUser",
      username
    });

    if (!result.success) {
      throw new Error(result.message || "Hapus user gagal.");
    }

    showMessage(result.message || "User berhasil dihapus.", "success");
    await loadUsers();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Hapus user gagal.", "error");
  }
}

function showMessage(message, type) {
  const box = document.getElementById("pageMessage");
  box.textContent = message;
  box.className = `message-box show ${
    type === "success" ? "message-success" : "message-error"
  }`;

  window.scrollTo({ top: 0, behavior: "smooth" });

  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => {
    box.classList.remove("show");
  }, 5000);
}

function setButtonLoading(button, loading, loadingText) {
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || loadingText;
  }
}

function clean(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
