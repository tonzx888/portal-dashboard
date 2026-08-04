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

/**
 * Ambil data endpoint `type=dashboard` dengan cache 15 detik di
 * sessionStorage. Endpoint ini dipanggil dari BEBERAPA tempat di
 * setiap halaman (badge sidebar, lonceng notifikasi, halaman Home),
 * padahal isinya berat (baca banyak sheet). Dengan cache ini, dalam
 * jendela 15 detik semua pemanggil cukup pakai hasil yang sama,
 * tidak perlu request baru ke server tiap kali -- inilah yang bikin
 * halaman terasa lama "Memuat...".
 */
window.ocFetchDashboardCached = async function () {
    const CACHE_KEY = "ocDashboardCache";
    const CACHE_TTL_MS = 15000;

    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
            const cached = JSON.parse(raw);
            if (Date.now() - cached.savedAt < CACHE_TTL_MS) {
                return cached.data;
            }
        }
    } catch (error) { /* cache rusak/tidak ada, lanjut fetch normal */ }

    const params = new URLSearchParams({ type: "dashboard", token: getLoginToken() });
    const response = await fetch(`${AUTH_API_BASE}?${params.toString()}`);
    const data = await response.json();

    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (error) { /* penuh/private mode, tidak masalah */ }

    return data;
};

document.addEventListener("DOMContentLoaded", () => {
    const userInfo = document.getElementById("userInfo");

    if (userInfo && authenticatedUser) {
        userInfo.textContent = `${authenticatedUser.username} · ${authenticatedUser.role}`;
    }

    setupAccountMenu_();
    setupNotificationBell_();
    setupLiveClock_();
    setupQuickCreate_();
});

/**
 * Tombol lonceng notifikasi di topbar (kiri dari user chip).
 * Isinya beda per role:
 * - MASTER: jumlah pending semua modul (Cuti/Offday/Rekening/Banding)
 * - ADMIN: jumlah pending Banding saja (satu-satunya modul yang
 *   memang jadi tanggung jawab ADMIN untuk audit)
 * - STAFF: daftar pengajuan MEREKA SENDIRI yang baru saja diproses
 *   (disetujui/ditolak), supaya tahu tanpa perlu buka satu-satu.
 */
function setupNotificationBell_() {
    const userChip = document.querySelector(".oc-user-chip");
    if (!userChip || document.getElementById("notifBellButton")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "oc-notif-wrapper";
    wrapper.innerHTML = `
        <button type="button" id="notifBellButton" class="oc-notif-bell" aria-haspopup="true" aria-expanded="false">
            <span aria-hidden="true">🔔</span>
            <span id="notifBellBadge" class="oc-notif-badge" hidden>0</span>
        </button>
        <div id="notifDropdown" class="oc-notif-dropdown">
            <div class="oc-notif-dropdown-head">
                <strong id="notifDropdownTitle">Notifikasi</strong>
            </div>
            <div id="notifDropdownBody" class="oc-notif-dropdown-body">
                <p class="oc-notif-empty">Memuat notifikasi...</p>
            </div>
        </div>
    `;

    userChip.insertAdjacentElement("beforebegin", wrapper);

    const bellButton = document.getElementById("notifBellButton");
    const dropdown = document.getElementById("notifDropdown");

    bellButton.addEventListener("click", event => {
        event.stopPropagation();
        const willOpen = !dropdown.classList.contains("open");
        dropdown.classList.toggle("open", willOpen);
        bellButton.setAttribute("aria-expanded", String(willOpen));

        if (willOpen) markNotificationsSeen_();
    });

    document.addEventListener("click", () => {
        dropdown.classList.remove("open");
        bellButton.setAttribute("aria-expanded", "false");
    });

    loadNotifications_();
}

let notifCurrentRole_ = "";
let notifCurrentItems_ = [];

async function loadNotifications_() {
    const role = String(authenticatedUser?.role || "").toUpperCase();
    notifCurrentRole_ = role;

    const titleEl = document.getElementById("notifDropdownTitle");
    const bodyEl = document.getElementById("notifDropdownBody");
    const badgeEl = document.getElementById("notifBellBadge");
    if (!bodyEl) return;

    try {
        if (role === "MASTER" || role === "ADMIN") {
            titleEl.textContent = "Perlu Diproses";

            const result = await window.ocFetchDashboardCached();
            const pending = result?.pending || {};

            const categories = role === "MASTER"
                ? [
                    { key: "cuti", label: "Pengajuan Cuti", href: "cuti-pengajuan.html", icon: "🌴" },
                    { key: "offday", label: "Pengajuan Offday", href: "offday.html", icon: "📅" },
                    { key: "rekening", label: "Req Ganti Rekening", href: "rekening.html", icon: "🏦" },
                    { key: "banding", label: "Banding Kesalahan", href: "banding.html", icon: "🛡️" }
                  ]
                : [
                    { key: "banding", label: "Banding Kesalahan", href: "banding.html", icon: "🛡️" }
                  ];

            const items = categories
                .map(cat => ({ ...cat, count: Number(pending[cat.key] || 0) }))
                .filter(cat => cat.count > 0);

            const totalCount = items.reduce((sum, item) => sum + item.count, 0);
            setNotifBadge_(badgeEl, totalCount);

            bodyEl.innerHTML = items.length
                ? items.map(item => `
                    <a class="oc-notif-item" href="${item.href}">
                        <span class="oc-notif-icon" aria-hidden="true">${item.icon}</span>
                        <span class="oc-notif-text">${item.label}</span>
                        <span class="oc-notif-count">${item.count}</span>
                    </a>
                `).join("")
                : `<p class="oc-notif-empty">✓ Tidak ada yang perlu diproses.</p>`;

            return;
        }

        // STAFF: tampilkan pengajuan MEREKA SENDIRI yang baru diproses.
        titleEl.textContent = "Status Pengajuan Saya";

        // Perlu nama lengkap staff (bukan username login) untuk
        // menyaring modul Cuti & Banding, karena kedua endpoint itu
        // sekarang menampilkan data SEMUA staff (bisa dilihat siapa
        // saja), bukan cuma milik sendiri seperti Offday/Rekening.
        let ownNama = "";
        try {
            const staffParams = new URLSearchParams({ type: "staff", token: getLoginToken() });
            const staffResponse = await fetch(`${AUTH_API_BASE}?${staffParams.toString()}`);
            const staffResult = await staffResponse.json();
            const own = Array.isArray(staffResult)
                ? staffResult.find(item => String(item.username || "").trim().toUpperCase() === String(authenticatedUser?.username || "").trim().toUpperCase())
                : null;
            ownNama = own ? String(own.nama || "").trim().toUpperCase() : "";
        } catch (err) { /* biarkan kosong, banding tidak difilter kalau gagal */ }

        const modules = [
            { key: "cuti", type: "cuti", href: "cuti-pengajuan.html", icon: "🌴", pendingStatus: "MENUNGGU", label: item => `Cuti (${item.jenisCuti || "-"})` },
            { key: "offday", type: "offday", href: "offday.html", icon: "📅", pendingStatus: "MENUNGGU", label: item => `Offday (${item.tanggal || "-"})` },
            { key: "rekening", type: "rekening", href: "rekening.html", icon: "🏦", pendingStatus: "MENUNGGU", label: () => "Req Ganti Rekening" },
            { key: "banding", type: "banding", href: "banding.html", icon: "🛡️", pendingStatus: "PENDING", label: item => `Banding (${item.kodeLivechat || "-"})` }
        ];

        const results = await Promise.all(modules.map(async module => {
            try {
                const params = new URLSearchParams({ type: module.type, token: getLoginToken() });
                const response = await fetch(`${AUTH_API_BASE}?${params.toString()}`);
                const data = await response.json();
                if (!Array.isArray(data)) return [];

                return data
                    .filter(item => item.status && item.status !== module.pendingStatus)
                    .filter(item => !["banding", "cuti"].includes(module.key) || String(item.nama || "").trim().toUpperCase() === ownNama)
                    .map(item => ({
                        module: module.key,
                        row: item.row,
                        status: item.status,
                        href: module.href,
                        icon: module.icon,
                        text: module.label(item),
                        processedAt: item.approvedDate || item.processedDate || item.timestamp || ""
                    }));
            } catch (err) {
                return [];
            }
        }));

        const allItems = results.flat().slice(0, 15);
        notifCurrentItems_ = allItems;

        const seenKeys = getSeenNotifKeys_();
        const unseenCount = allItems.filter(item => !seenKeys.has(`${item.module}-${item.row}-${item.status}`)).length;
        setNotifBadge_(badgeEl, unseenCount);

        bodyEl.innerHTML = allItems.length
            ? allItems.map(item => {
                const key = `${item.module}-${item.row}-${item.status}`;
                const isNew = !seenKeys.has(key);
                const statusClass = item.status === "DISETUJUI" || item.status === "DONE" ? "approved" : "rejected";

                return `
                    <a class="oc-notif-item ${isNew ? "unread" : ""}" href="${item.href}">
                        <span class="oc-notif-icon" aria-hidden="true">${item.icon}</span>
                        <span class="oc-notif-text">
                            ${item.text}
                            <small class="oc-notif-status ${statusClass}">${item.status}</small>
                        </span>
                    </a>
                `;
            }).join("")
            : `<p class="oc-notif-empty">Belum ada pengajuan yang diproses.</p>`;

        // Kalau user sempat klik bell SEBELUM data ini selesai dimuat
        // (dropdown sudah kepencet duluan), tandai langsung terlihat
        // sekarang -- supaya badge tidak nyangkut nyala walau sudah
        // benar-benar dibuka.
        const dropdownEl = document.getElementById("notifDropdown");
        if (dropdownEl?.classList.contains("open")) {
            markNotificationsSeen_();
        }
    } catch (error) {
        console.error("Gagal memuat notifikasi:", error);
        bodyEl.innerHTML = `<p class="oc-notif-empty">Gagal memuat notifikasi.</p>`;
    }
}

function setNotifBadge_(badgeEl, count) {
    if (!badgeEl) return;

    if (count > 0) {
        badgeEl.textContent = count > 99 ? "99+" : String(count);
        badgeEl.removeAttribute("hidden");
    } else {
        badgeEl.setAttribute("hidden", "true");
    }
}

function getSeenNotifKeys_() {
    try {
        const raw = localStorage.getItem(`ocSeenNotif_${authenticatedUser?.username || "guest"}`);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch (error) {
        return new Set();
    }
}

function markNotificationsSeen_() {
    // Cuma relevan untuk STAFF (pending-based badge MASTER/ADMIN
    // memang seharusnya tetap nyala sampai benar-benar diproses).
    if (notifCurrentRole_ !== "STAFF" || !notifCurrentItems_.length) return;

    const keys = notifCurrentItems_.map(item => `${item.module}-${item.row}-${item.status}`);
    localStorage.setItem(`ocSeenNotif_${authenticatedUser?.username || "guest"}`, JSON.stringify(keys));

    const badgeEl = document.getElementById("notifBellBadge");
    if (badgeEl) badgeEl.setAttribute("hidden", "true");

    document.querySelectorAll(".oc-notif-item.unread").forEach(el => el.classList.remove("unread"));
}

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

/**
 * Jam & tanggal real-time di topbar. Disuntikkan lewat JS (bukan
 * ditulis di tiap HTML) supaya otomatis muncul di semua halaman,
 * sama seperti bell notifikasi & dropdown akun.
 */
function setupLiveClock_() {
    const actions = document.querySelector(".oc-topbar-actions");
    if (!actions || document.getElementById("ocLiveClock")) return;

    const clock = document.createElement("div");
    clock.id = "ocLiveClock";
    clock.className = "oc-live-clock";
    clock.innerHTML = `
        <span class="oc-live-clock-dot"></span>
        <div class="oc-live-clock-copy">
            <strong id="ocLiveClockTime">--:--</strong>
            <small id="ocLiveClockDate">-</small>
        </div>
    `;

    actions.insertBefore(clock, actions.firstChild);

    const tick = () => {
        const now = new Date();
        const timeEl = document.getElementById("ocLiveClockTime");
        const dateEl = document.getElementById("ocLiveClockDate");

        if (timeEl) {
            timeEl.textContent = now.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit"
            });
        }

        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString("id-ID", {
                weekday: "short",
                day: "2-digit",
                month: "short"
            });
        }
    };

    tick();
    setInterval(tick, 15000);
}

/**
 * Tombol "Quick Create" di topbar -- akses cepat ke aksi yang
 * paling sering dilakukan, tanpa perlu buka menu sidebar dulu.
 */
function setupQuickCreate_() {
    const actions = document.querySelector(".oc-topbar-actions");
    if (!actions || document.getElementById("ocQuickCreate")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "ocQuickCreate";
    wrapper.className = "oc-quick-create";
    wrapper.innerHTML = `
        <button type="button" class="oc-quick-create-btn" aria-haspopup="true">
            <span aria-hidden="true">+</span> Buat Baru
        </button>
        <div class="oc-quick-create-menu">
            <a href="cuti-pengajuan.html">🌴 Ajukan Cuti</a>
            <a href="offday.html">📅 Ajukan Offday</a>
            <a href="rekening.html">🏦 Req Ganti Rekening</a>
            <a href="banding.html">🛡️ Ajukan Banding</a>
        </div>
    `;

    actions.insertBefore(wrapper, actions.firstChild);

    const button = wrapper.querySelector(".oc-quick-create-btn");
    const menu = wrapper.querySelector(".oc-quick-create-menu");

    button.addEventListener("click", event => {
        event.stopPropagation();
        menu.classList.toggle("open");
    });

    document.addEventListener("click", () => {
        menu.classList.remove("open");
    });
}
