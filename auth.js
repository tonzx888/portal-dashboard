function getLoginUser() {
    const user = localStorage.getItem("loginUser");

    if (!user) return null;

    try {
        return JSON.parse(user);
    } catch (error) {
        localStorage.removeItem("loginUser");
        return null;
    }
}

/**
 * Mengambil token sesi yang didapat dari backend saat login.
 * Dipakai di setiap request API yang butuh identitas terverifikasi
 * (bukan lagi mengirim role/username mentah).
 */
function getLoginToken() {
    const user = getLoginUser();
    return user && user.token ? String(user.token) : "";
}

function requireLogin() {
    const user = getLoginUser();

    if (!user) {
        window.location.href = "login.html";
        return null;
    }

    return user;
}

function logout() {
    const token = getLoginToken();

    // Beri tahu server untuk menghapus sesi ini juga (best-effort,
    // tidak menunggu responsnya supaya logout tetap terasa instan).
    if (token) {
        fetch(`https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec?type=logout&token=${encodeURIComponent(token)}`)
            .catch(() => {});
    }

    localStorage.removeItem("loginUser");
    window.location.href = "login.html";
}

const authenticatedUser = requireLogin();

const AUTH_API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

document.addEventListener("DOMContentLoaded", () => {
    const userInfo = document.getElementById("userInfo");

    if (userInfo && authenticatedUser) {
        userInfo.textContent = `${authenticatedUser.username} · ${authenticatedUser.role}`;
    }

    setupAccountMenu_();
});

/**
 * Membuat dropdown "Ganti Password" di user chip (pojok kanan atas)
 * dan modal ganti password sendiri. Disuntikkan lewat JS supaya
 * otomatis muncul di SEMUA halaman tanpa perlu edit tiap file HTML
 * satu-satu, karena auth.js dimuat di mana-mana.
 */
function setupAccountMenu_() {
    const chip = document.querySelector(".oc-user-chip");
    if (!chip || document.getElementById("accountDropdownMenu")) return;

    chip.style.cursor = "pointer";
    chip.style.position = "relative";
    chip.setAttribute("role", "button");
    chip.setAttribute("aria-haspopup", "true");

    const dropdown = document.createElement("div");
    dropdown.id = "accountDropdownMenu";
    dropdown.className = "oc-account-dropdown";
    dropdown.innerHTML = `
        <button type="button" class="oc-account-dropdown-item" id="btnOpenChangePassword">
            <span aria-hidden="true">🔑</span> Ganti Password
        </button>
    `;
    chip.appendChild(dropdown);

    chip.addEventListener("click", event => {
        event.stopPropagation();
        dropdown.classList.toggle("open");
    });

    document.addEventListener("click", () => {
        dropdown.classList.remove("open");
    });

    document.getElementById("btnOpenChangePassword").addEventListener("click", event => {
        event.stopPropagation();
        dropdown.classList.remove("open");
        openChangePasswordModal_();
    });

    injectChangePasswordModal_();
}

function injectChangePasswordModal_() {
    if (document.getElementById("changePasswordModal")) return;

    const modal = document.createElement("div");
    modal.id = "changePasswordModal";
    modal.className = "oc-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="oc-modal-panel" style="width:min(420px,100%)" role="dialog" aria-modal="true">
            <div class="oc-modal-head">
                <div><span class="oc-section-kicker">AKUN SAYA</span><h2>Ganti Password</h2></div>
                <button type="button" class="oc-btn oc-btn-ghost" onclick="closeChangePasswordModal_()" aria-label="Tutup">&times;</button>
            </div>
            <div class="oc-modal-body">
                <label class="oc-account-field">
                    <span>Password Lama</span>
                    <input type="password" id="oldPasswordInput" autocomplete="current-password">
                </label>
                <label class="oc-account-field">
                    <span>Password Baru</span>
                    <input type="password" id="newPasswordInput" autocomplete="new-password">
                </label>
                <label class="oc-account-field">
                    <span>Konfirmasi Password Baru</span>
                    <input type="password" id="confirmPasswordInput" autocomplete="new-password">
                </label>
                <p class="oc-account-hint">Minimal 6 karakter. Setelah berhasil, gunakan password baru untuk login berikutnya.</p>
            </div>
            <div class="oc-modal-foot">
                <button type="button" class="oc-btn oc-btn-secondary" onclick="closeChangePasswordModal_()">Batal</button>
                <button type="button" class="oc-btn oc-btn-primary" id="btnSubmitChangePassword">Simpan Password</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
        if (event.target === modal) closeChangePasswordModal_();
    });

    document.getElementById("btnSubmitChangePassword")
        .addEventListener("click", submitChangePassword_);
}

function openChangePasswordModal_() {
    const modal = document.getElementById("changePasswordModal");
    if (!modal) return;

    document.getElementById("oldPasswordInput").value = "";
    document.getElementById("newPasswordInput").value = "";
    document.getElementById("confirmPasswordInput").value = "";

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
}

function closeChangePasswordModal_() {
    const modal = document.getElementById("changePasswordModal");
    if (!modal) return;

    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
}

function authToast_(message, type) {
    if (typeof ocToast === "function") {
        ocToast(type === "error" ? "Gagal" : "Berhasil", message || "Proses selesai.", { duration: 3500 });
    } else {
        alert(message || "");
    }
}

async function submitChangePassword_() {
    const button = document.getElementById("btnSubmitChangePassword");
    const oldPassword = document.getElementById("oldPasswordInput")?.value || "";
    const newPassword = document.getElementById("newPasswordInput")?.value || "";
    const confirmPassword = document.getElementById("confirmPasswordInput")?.value || "";

    if (!oldPassword || !newPassword || !confirmPassword) {
        authToast_("Semua field wajib diisi.", "error");
        return;
    }

    if (newPassword.length < 6) {
        authToast_("Password baru minimal 6 karakter.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        authToast_("Konfirmasi password baru tidak sama.", "error");
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Menyimpan...";
    }

    try {
        const params = new URLSearchParams({
            type: "changeOwnPassword",
            token: getLoginToken(),
            oldPassword,
            newPassword
        });

        const response = await fetch(`${AUTH_API_BASE}?${params.toString()}`);
        const result = await response.json();

        authToast_(result.message, result.success ? "success" : "error");

        if (result.success) {
            closeChangePasswordModal_();
        }
    } catch (error) {
        console.error("Gagal mengganti password:", error);
        authToast_("Gagal mengganti password.", "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Simpan Password";
        }
    }
}
