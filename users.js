(() => {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

  let usersData = [];

  document.addEventListener("DOMContentLoaded", initializePage);

  function initializePage() {
    const currentLoginUser = readLoginUser();

    if (
      !currentLoginUser ||
      String(currentLoginUser.role || "").trim().toUpperCase() !== "MASTER"
    ) {
      alert("Akses ditolak. Halaman ini hanya untuk MASTER.");
      window.location.href = "index.html";
      return;
    }

    const userForm = document.getElementById("userForm");
    const resetForm = document.getElementById("resetForm");

    if (userForm) {
      userForm.addEventListener("submit", submitUserForm);
    }

    if (resetForm) {
      resetForm.addEventListener("submit", submitResetPassword);
    }

    loadUsers();
  }

  function readLoginUser() {
    try {
      return JSON.parse(localStorage.getItem("loginUser"));
    } catch (error) {
      console.error("Data login tidak valid:", error);
      return null;
    }
  }

  async function requestApi(params) {
    const query = new URLSearchParams(params);

    const response = await fetch(`${API_URL}?${query.toString()}`, {
      method: "GET",
      cache: "no-store",
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch (error) {
      console.error("Respons Apps Script:", text);
      throw new Error(
        "Respons Apps Script bukan JSON. Pastikan Web App sudah di-deploy ulang."
      );
    }
  }

  async function loadUsers() {
    const tbody = document.getElementById("userTable");

    if (!tbody) {
      return;
    }

    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;">
          Memuat data user...
        </td>
      </tr>
    `;

    try {
      const result = await requestApi({
        type: "users",
        timestamp: Date.now()
      });

      if (result && result.success === false) {
        throw new Error(
          result.message || "Gagal memuat data user."
        );
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
            ${escapeHtml(error.message || "Gagal memuat data user.")}
          </td>
        </tr>
      `;

      showMessage(
        error.message || "Gagal memuat data user.",
        "error"
      );
    }
  }

  function renderUsers(data) {
    const tbody = document.getElementById("userTable");

    if (!tbody) {
      return;
    }

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;">
            Data user kosong.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.map((user) => {
      const username = clean(user.username);
      const role = clean(user.role).toUpperCase();
      const status = clean(user.status).toUpperCase();

      const statusClass =
        status === "AKTIF"
          ? "status-aktif"
          : "status-nonaktif";

      const nextStatus =
        status === "AKTIF"
          ? "NONAKTIF"
          : "AKTIF";

      const statusLabel =
        status === "AKTIF"
          ? "Nonaktifkan"
          : "Aktifkan";

      const isMainMaster =
        username.toLowerCase() === "master";

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
                type="button"
                class="btn-small btn-edit"
                data-action="edit"
                data-username="${escapeAttribute(username)}">
                Edit
              </button>

              <button
                type="button"
                class="btn-small btn-reset"
                data-action="reset"
                data-username="${escapeAttribute(username)}">
                Reset Password
              </button>

              <button
                type="button"
                class="btn-small btn-status"
                data-action="status"
                data-username="${escapeAttribute(username)}"
                data-status="${escapeAttribute(nextStatus)}"
                ${isMainMaster ? "disabled" : ""}>
                ${statusLabel}
              </button>

              <button
                type="button"
                class="btn-small btn-danger"
                data-action="delete"
                data-username="${escapeAttribute(username)}"
                ${isMainMaster ? "disabled" : ""}>
                Hapus
              </button>

            </div>
          </td>
        </tr>
      `;
    }).join("");

    bindActionButtons();
  }

  function bindActionButtons() {
    document
      .querySelectorAll("[data-action]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const action = button.dataset.action;
          const username = button.dataset.username;

          if (action === "edit") {
            openEditModal(username);
          }

          if (action === "reset") {
            openResetModal(username);
          }

          if (action === "status") {
            changeUserStatus(
              username,
              button.dataset.status
            );
          }

          if (action === "delete") {
            deleteUser(username);
          }
        });
      });
  }

  function filterUsers() {
    const search = document.getElementById("searchUser");

    const keyword = clean(
      search ? search.value : ""
    ).toLowerCase();

    if (!keyword) {
      renderUsers(usersData);
      return;
    }

    const filtered = usersData.filter((user) => {
      return [
        user.username,
        user.role,
        user.status
      ].some((value) =>
        clean(value)
          .toLowerCase()
          .includes(keyword)
      );
    });

    renderUsers(filtered);
  }

  function openAddModal() {
    document.getElementById("modalTitle").textContent =
      "Tambah User";

    document.getElementById("formMode").value =
      "add";

    document.getElementById("oldUsername").value =
      "";

    document.getElementById("username").value =
      "";

    document.getElementById("password").value =
      "";

    document.getElementById("role").value =
      "";

    document.getElementById("status").value =
      "AKTIF";

    document
      .getElementById("userModal")
      .classList.add("show");

    document
      .getElementById("username")
      .focus();
  }

  function openEditModal(username) {
    const user = usersData.find((item) =>
      clean(item.username).toLowerCase() ===
      clean(username).toLowerCase()
    );

    if (!user) {
      showMessage(
        "Data user tidak ditemukan.",
        "error"
      );
      return;
    }

    document.getElementById("modalTitle").textContent =
      "Edit User";

    document.getElementById("formMode").value =
      "edit";

    document.getElementById("oldUsername").value =
      clean(user.username);

    document.getElementById("username").value =
      clean(user.username);

    document.getElementById("password").value =
      clean(user.password);

    document.getElementById("role").value =
      clean(user.role).toUpperCase();

    document.getElementById("status").value =
      clean(user.status).toUpperCase();

    document
      .getElementById("userModal")
      .classList.add("show");

    document
      .getElementById("username")
      .focus();
  }

  function closeUserModal() {
    const modal = document.getElementById("userModal");
    const form = document.getElementById("userForm");

    modal.classList.remove("show");
    form.reset();
  }

  function closeModalFromBackdrop(event) {
    if (event.target.id === "userModal") {
      closeUserModal();
    }
  }

  async function submitUserForm(event) {
    event.preventDefault();

    const button =
      document.getElementById("saveUserButton");

    const mode =
      document.getElementById("formMode").value;

    const username = clean(
      document.getElementById("username").value
    );

    const password = clean(
      document.getElementById("password").value
    );

    const role = clean(
      document.getElementById("role").value
    ).toUpperCase();

    const status = clean(
      document.getElementById("status").value
    ).toUpperCase();

    const oldUsername = clean(
      document.getElementById("oldUsername").value
    );

    if (username.length < 3) {
      showMessage(
        "Username minimal 3 karakter.",
        "error"
      );
      return;
    }

    if (password.length < 6) {
      showMessage(
        "Password minimal 6 karakter.",
        "error"
      );
      return;
    }

    setButtonLoading(
      button,
      true,
      "Menyimpan..."
    );

    try {
      const params = {
        type:
          mode === "edit"
            ? "editUser"
            : "addUser",
        username,
        password,
        role,
        status,
        timestamp: Date.now()
      };

      if (mode === "edit") {
        params.oldUsername = oldUsername;
      }

      const result =
        await requestApi(params);

      if (!result.success) {
        throw new Error(
          result.message || "Proses gagal."
        );
      }

      closeUserModal();

      showMessage(
        result.message ||
          "Data user berhasil disimpan.",
        "success"
      );

      await loadUsers();
    } catch (error) {
      console.error(error);

      showMessage(
        error.message ||
          "Gagal menyimpan user.",
        "error"
      );
    } finally {
      setButtonLoading(
        button,
        false,
        "Simpan"
      );
    }
  }

  function openResetModal(username) {
    document.getElementById("resetUsername").value =
      clean(username);

    document.getElementById("newPassword").value =
      "";

    document
      .getElementById("resetModal")
      .classList.add("show");

    document
      .getElementById("newPassword")
      .focus();
  }

  function closeResetModal() {
    const modal =
      document.getElementById("resetModal");

    const form =
      document.getElementById("resetForm");

    modal.classList.remove("show");
    form.reset();
  }

  function closeResetFromBackdrop(event) {
    if (event.target.id === "resetModal") {
      closeResetModal();
    }
  }

  async function submitResetPassword(event) {
    event.preventDefault();

    const button =
      document.getElementById(
        "resetPasswordButton"
      );

    const username = clean(
      document.getElementById(
        "resetUsername"
      ).value
    );

    const newPassword = clean(
      document.getElementById(
        "newPassword"
      ).value
    );

    if (newPassword.length < 6) {
      showMessage(
        "Password minimal 6 karakter.",
        "error"
      );
      return;
    }

    setButtonLoading(
      button,
      true,
      "Memproses..."
    );

    try {
      const result = await requestApi({
        type: "resetPassword",
        username,
        newPassword,
        timestamp: Date.now()
      });

      if (!result.success) {
        throw new Error(
          result.message ||
            "Reset password gagal."
        );
      }

      closeResetModal();

      showMessage(
        result.message ||
          "Password berhasil direset.",
        "success"
      );

      await loadUsers();
    } catch (error) {
      console.error(error);

      showMessage(
        error.message ||
          "Reset password gagal.",
        "error"
      );
    } finally {
      setButtonLoading(
        button,
        false,
        "Reset Password"
      );
    }
  }

  async function changeUserStatus(
    username,
    status
  ) {
    const action =
      status === "AKTIF"
        ? "mengaktifkan"
        : "menonaktifkan";

    const confirmed = confirm(
      `Yakin ingin ${action} user "${username}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await requestApi({
        type: "updateUserStatus",
        username,
        status,
        timestamp: Date.now()
      });

      if (!result.success) {
        throw new Error(
          result.message ||
            "Perubahan status gagal."
        );
      }

      showMessage(
        result.message ||
          "Status user berhasil diperbarui.",
        "success"
      );

      await loadUsers();
    } catch (error) {
      console.error(error);

      showMessage(
        error.message ||
          "Perubahan status gagal.",
        "error"
      );
    }
  }

  async function deleteUser(username) {
    const confirmed = confirm(
      `Yakin ingin menghapus user "${username}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await requestApi({
        type: "deleteUser",
        username,
        timestamp: Date.now()
      });

      if (!result.success) {
        throw new Error(
          result.message ||
            "Hapus user gagal."
        );
      }

      showMessage(
        result.message ||
          "User berhasil dihapus.",
        "success"
      );

      await loadUsers();
    } catch (error) {
      console.error(error);

      showMessage(
        error.message ||
          "Hapus user gagal.",
        "error"
      );
    }
  }

  function showMessage(message, type) {
    const box =
      document.getElementById("pageMessage");

    if (!box) {
      alert(message);
      return;
    }

    box.textContent = message;

    box.className =
      `message-box show ${
        type === "success"
          ? "message-success"
          : "message-error"
      }`;

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
      box.classList.remove("show");
    }, 5000);
  }

  function setButtonLoading(
    button,
    loading,
    loadingText
  ) {
    if (!button) {
      return;
    }

    if (loading) {
      button.dataset.originalText =
        button.textContent;

      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;

      button.textContent =
        button.dataset.originalText ||
        loadingText;
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

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  window.loadUsers = loadUsers;
  window.filterUsers = filterUsers;
  window.openAddModal = openAddModal;
  window.openEditModal = openEditModal;
  window.closeUserModal = closeUserModal;
  window.closeModalFromBackdrop =
    closeModalFromBackdrop;
  window.openResetModal = openResetModal;
  window.closeResetModal = closeResetModal;
  window.closeResetFromBackdrop =
    closeResetFromBackdrop;
  window.changeUserStatus =
    changeUserStatus;
  window.deleteUser = deleteUser;
})();
