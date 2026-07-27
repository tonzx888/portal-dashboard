const DASHBOARD_API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";
const EXPECTED_DASHBOARD_API_VERSION = "dashboard-v2.1";

const dashboardUser = getLoginUser();

document.addEventListener("DOMContentLoaded", () => {
    setupDashboardHeader();
    loadDashboard();

    document.getElementById("btnRefreshDashboard")
        ?.addEventListener("click", loadDashboard);

    document.getElementById("btnLogout")
        ?.addEventListener("click", logout);
});

function setupDashboardHeader() {
    const username = String(dashboardUser?.username || "").trim();
    const role = String(dashboardUser?.role || "").trim();

    setText(
        "welcomeTitle",
        username ? `Selamat Datang, ${username}` : "Selamat Datang"
    );

    setText(
        "userInfo",
        [username, role].filter(Boolean).join(" · ")
    );

    const initials = username
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");

    setText("userInitial", initials || "OC");

    setText(
        "dashboardDate",
        new Intl.DateTimeFormat("id-ID", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        }).format(new Date())
    );
}

async function loadDashboard() {
    const button = document.getElementById("btnRefreshDashboard");
    const errorBox = document.getElementById("dashboardError");

    if (button) {
        if (typeof ocSetLoading === "function") {
            ocSetLoading(button, true, "Memuat...");
        } else {
            button.disabled = true;
            button.textContent = "Memuat...";
        }
    }

    if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = "";
    }

    try {
        const cacheBuster = Date.now();

        const response = await fetch(
            `${DASHBOARD_API_BASE}?type=dashboard&token=${encodeURIComponent(getLoginToken())}&_=${cacheBuster}`,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data?.success === false) {
            const message = String(data.message || "").toLowerCase();

            if (message.includes("sesi tidak valid") || message.includes("login ulang")) {
                alert("Sesi Anda sudah berakhir. Silakan login ulang.");
                localStorage.removeItem("loginUser");
                window.location.href = "login.html";
                return;
            }

            throw new Error(data.message || "Dashboard gagal dimuat.");
        }

        if (data.apiVersion !== EXPECTED_DASHBOARD_API_VERSION) {
            throw new Error(
                `Backend dashboard belum versi terbaru. Versi terbaca: ${data.apiVersion || "lama/tidak ada"}.`
            );
        }

        renderDashboard(data);
    } catch (error) {
        console.error("Gagal mengambil data dashboard:", error);

        if (errorBox) {
            errorBox.hidden = false;
            errorBox.textContent = error.message;
        }

        if (typeof ocToast === "function") {
            ocToast("Dashboard gagal dimuat", error.message, { duration: 4200 });
        }
    } finally {
        if (button) {
            if (typeof ocSetLoading === "function") {
                ocSetLoading(button, false);
            } else {
                button.disabled = false;
                button.textContent = "Perbarui Data";
            }
        }
    }
}

function renderDashboard(data) {
    const roles = data.roles || {};
    const passportWarnings = Array.isArray(data.passportWarnings)
        ? data.passportWarnings
        : [];
    const visaWarnings = Array.isArray(data.visaWarnings)
        ? data.visaWarnings
        : [];

    const totalStaff = Number(data.totalStaff || 0);
    const staffCuti = Number(data.staffCuti || 0);
    const offdayHariIni = Number(data.offdayHariIni || 0);
    const activeToday = Number(data.activeToday || 0);

    const passportCount = Number(
        data.passportWarning ?? passportWarnings.length
    );

    const visaCount = Number(
        data.visaWarning ?? visaWarnings.length
    );

    setText("totalStaff", totalStaff);
    setText("staffCuti", staffCuti);
    setText("offdayHariIni", offdayHariIni);
    setText("documentWarning", passportCount + visaCount);

    setText(
        "roleSummary",
        `CS ${roles.cs || 0} · Kapten ${roles.kapten || 0} · Kasir ${roles.kasir || 0}`
    );

    setText(
        "documentWarningText",
        `Passport ${passportCount} · Visa ${visaCount}`
    );

    setText("passportWarningBadge", passportCount);
    setText("visaWarningBadge", visaCount);
    setText("averageAge", `${data.averageAge || 0} Tahun`);
    setText("activeToday", activeToday);
    setText("topDomicile", data.topDomicile || "-");
    setText("longestServing", data.longestServing || "-");

    renderRoleChart(roles, totalStaff);
    renderActivity(data);
    renderActivityDonut({ activeToday, staffCuti, offdayHariIni, totalStaff });
    renderWarningList("passportWarningList", passportWarnings);
    renderWarningList("visaWarningList", visaWarnings);
    renderNewStaff(data.newStaff || []);
    renderAttentionSection(data);
}

/**
 * Section "Perlu Diproses" & "Belum Ada Username" -- cuma untuk
 * MASTER (yang memang bertanggung jawab approve & lengkapi Data
 * Staff). Section ini tersembunyi total buat ADMIN/STAFF supaya
 * tidak membingungkan (bukan urusan mereka).
 */
function renderAttentionSection(data) {
    const section = document.getElementById("attentionSection");
    if (!section) return;

    const currentRole = String(loginUser?.role || "").toUpperCase();
    if (currentRole !== "MASTER") {
        section.hidden = true;
        return;
    }

    const pending = data.pending || {};
    const pendingItems = [
        { key: "cuti", label: "Pengajuan Cuti", href: "cuti-pengajuan.html", icon: "🌴" },
        { key: "offday", label: "Pengajuan Offday", href: "offday.html", icon: "📅" },
        { key: "rekening", label: "Req Ganti Rekening", href: "rekening.html", icon: "🏦" },
        { key: "banding", label: "Banding Kesalahan", href: "banding.html", icon: "🛡️" }
    ].filter(item => Number(pending[item.key] || 0) > 0);

    const totalPending = pendingItems.reduce((sum, item) => sum + Number(pending[item.key] || 0), 0);

    setText("attentionPendingBadge", totalPending);

    const pendingListEl = document.getElementById("attentionPendingList");
    if (pendingListEl) {
        pendingListEl.innerHTML = pendingItems.length
            ? pendingItems.map(item => `
                <a class="oc-attention-item" href="${item.href}">
                    <span class="oc-attention-icon" aria-hidden="true">${item.icon}</span>
                    <span class="oc-attention-text">${item.label}</span>
                    <span class="oc-attention-count">${pending[item.key]}</span>
                </a>
            `).join("")
            : `<p class="oc-attention-empty">✓ Tidak ada pengajuan yang menunggu. Semua sudah diproses.</p>`;
    }

    const usernamePanel = document.getElementById("attentionUsernamePanel");
    const missingUsernameNames = Array.isArray(data.missingUsernameNames) ? data.missingUsernameNames : [];
    const missingUsernameCount = Number(data.missingUsernameCount || missingUsernameNames.length || 0);

    if (usernamePanel) {
        usernamePanel.hidden = missingUsernameCount === 0;
    }

    setText("attentionUsernameBadge", missingUsernameCount);

    const usernameListEl = document.getElementById("attentionUsernameList");
    if (usernameListEl) {
        usernameListEl.innerHTML = missingUsernameNames.map(nama => `
            <a class="oc-attention-item" href="staff.html">
                <span class="oc-attention-icon" aria-hidden="true">⚠️</span>
                <span class="oc-attention-text">${escapeDashboardHtml_(nama)}</span>
            </a>
        `).join("");
    }

    section.hidden = pendingItems.length === 0 && missingUsernameCount === 0;
}

function escapeDashboardHtml_(value) {
    return String(value ?? "-")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/**
 * Grafik donat kecil di header "Aktivitas Operasional": proporsi
 * staff Aktif vs Cuti vs Offday hari ini, sebagai ringkasan visual
 * cepat tanpa perlu baca angka satu-satu.
 */
function renderActivityDonut({ activeToday, staffCuti, offdayHariIni, totalStaff }) {
    const container = document.getElementById("activityDonut");
    if (!container) return;

    const total = Math.max(totalStaff, 1);
    const radius = 30;
    const circumference = 2 * Math.PI * radius;

    const segments = [
        { value: activeToday, color: "var(--oc-primary)" },
        { value: staffCuti, color: "var(--oc-blue)" },
        { value: offdayHariIni, color: "var(--oc-purple)" }
    ];

    let offset = 0;
    const circles = segments.map(segment => {
        const fraction = segment.value / total;
        const dash = Math.max(fraction * circumference, segment.value > 0 ? 3 : 0);
        const circle = `
            <circle
                cx="36" cy="36" r="${radius}"
                fill="none" stroke="${segment.color}" stroke-width="8"
                stroke-dasharray="${dash} ${circumference - dash}"
                stroke-dashoffset="${-offset}"
                stroke-linecap="round"
                transform="rotate(-90 36 36)"
            />
        `;
        offset += dash;
        return circle;
    }).join("");

    container.innerHTML = `
        <svg viewBox="0 0 72 72" width="72" height="72">
            <circle cx="36" cy="36" r="${radius}" fill="none" stroke="var(--oc-line)" stroke-width="8"/>
            ${circles}
        </svg>
        <div class="activity-donut-center">
            <strong>${activeToday}</strong>
            <small>Aktif</small>
        </div>
    `;
}

function renderRoleChart(roles, totalStaff) {
    const container = document.getElementById("roleChart");
    if (!container) return;

    const items = [
        { label: "CS", value: Number(roles.cs || 0), color: "var(--oc-blue, #2269dd)" },
        { label: "Kapten", value: Number(roles.kapten || 0), color: "var(--oc-purple, #8f4ce8)" },
        { label: "Kasir", value: Number(roles.kasir || 0), color: "#e99800" }
    ];

    const total = Math.max(totalStaff, 1);
    const radius = 52;
    const circumference = 2 * Math.PI * radius;

    let offset = 0;
    const circles = items.map(item => {
        const fraction = item.value / total;
        const dash = Math.max(fraction * circumference, item.value > 0 ? 3 : 0);
        const circle = `
            <circle
                cx="60" cy="60" r="${radius}"
                fill="none" stroke="${item.color}" stroke-width="16"
                stroke-dasharray="${dash} ${circumference - dash}"
                stroke-dashoffset="${-offset}"
                stroke-linecap="round"
                transform="rotate(-90 60 60)"
            />
        `;
        offset += dash;
        return circle;
    }).join("");

    const legend = items.map(item => {
        const percent = totalStaff > 0 ? Math.round((item.value / totalStaff) * 100) : 0;
        return `
            <div class="role-legend-item">
                <span class="role-legend-dot" style="background:${item.color}"></span>
                <span class="role-legend-label">${escapeDashboardHtml(item.label)}</span>
                <strong class="role-legend-value">${item.value}</strong>
                <small class="role-legend-percent">${percent}%</small>
            </div>
        `;
    }).join("");

    container.innerHTML = `
        <div class="role-donut-wrap">
            <svg viewBox="0 0 120 120" width="120" height="120">
                <circle cx="60" cy="60" r="${radius}" fill="none" stroke="var(--oc-line)" stroke-width="16"/>
                ${circles}
            </svg>
            <div class="role-donut-center">
                <strong>${totalStaff}</strong>
                <small>Staff</small>
            </div>
        </div>
        <div class="role-legend">${legend}</div>
    `;
}

const dashboardIcons = {
  leave: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M8 15l2 2 4-4"/></svg>`,
  offday: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  active: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  birthday: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 21h16"/><path d="M12 11V7"/><path d="M12 7c-1 0-1.5-.7-1.5-1.5S11 3 12 3s1.5.8 1.5 1.5S13 7 12 7Z"/><path d="M4 15.5h16"/></svg>`,
  passport: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17h8"/></svg>`,
  visa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11Z"/></svg>`
};

function renderActivity(data) {
    const container = document.getElementById("todayActivity");
    if (!container) return;

    const birthdayNames = Array.isArray(data.birthdayNames)
        ? data.birthdayNames
        : [];

    const activities = [
        {
            icon: dashboardIcons.leave,
            variant: "leave",
            title: "Staff Cuti",
            subtitle: "Sedang cuti hari ini",
            value: Number(data.staffCuti || 0)
        },
        {
            icon: dashboardIcons.offday,
            variant: "offday",
            title: "Staff Offday",
            subtitle: "Offday disetujui hari ini",
            value: Number(data.offdayHariIni || 0)
        },
        {
            icon: dashboardIcons.active,
            variant: "active",
            title: "Staff Aktif",
            subtitle: "Tidak cuti dan tidak offday",
            value: Number(data.activeToday || 0)
        },
        {
            icon: dashboardIcons.birthday,
            variant: "birthday",
            title: "Ulang Tahun",
            subtitle: birthdayNames.length
                ? birthdayNames.join(", ")
                : "Tidak ada ulang tahun hari ini",
            value: Number(data.birthdayCount || 0)
        }
    ];

    container.innerHTML = activities.map(item => `
        <div class="activity-item">
            <span class="activity-icon activity-icon-${item.variant}">${item.icon}</span>
            <div class="activity-left">
                <strong>${escapeDashboardHtml(item.title)}</strong>
                <small>${escapeDashboardHtml(item.subtitle)}</small>
            </div>
            <span class="activity-count">${item.value}</span>
        </div>
    `).join("");
}

let dashboardWarningData = { passport: [], visa: [] };

function renderWarningList(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const type = containerId === "visaWarningList" ? "visa" : "passport";
    dashboardWarningData[type] = items;

    if (!items.length) {
        container.innerHTML = `
            <div class="dashboard-empty">
                Tidak ada dokumen dalam periode warning.
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="warning-chip-row">
            ${items.map((item, index) => {
                const days = Number(item.daysLeft);
                const expired = days < 0;
                const urgent = !expired && days <= 30;
                const urgencyClass = expired ? "expired" : urgent ? "urgent" : "";

                return `
                    <button type="button" class="warning-chip ${urgencyClass}" onclick="openDashboardWarningDetail('${type}', ${index})">
                        <span class="warning-chip-dot ${urgencyClass}"></span>
                        ${escapeDashboardHtml(item.nama || "-")}
                    </button>
                `;
            }).join("")}
        </div>
    `;
}

function openDashboardWarningDetail(type, index) {
    const item = dashboardWarningData[type]?.[index];
    if (!item) return;

    const days = Number(item.daysLeft);
    const expired = days < 0;
    const daysText = expired
        ? `Sudah lewat ${Math.abs(days)} hari`
        : days === 0
            ? "Habis hari ini"
            : `${days} hari lagi`;

    const modal = document.getElementById("dashboardWarningModal") || createDashboardWarningModal_();
    document.getElementById("dashboardWarningModalIcon").textContent = type === "visa" ? "🛂" : "📔";
    document.getElementById("dashboardWarningModalTitle").textContent = item.nama || "-";
    document.getElementById("dashboardWarningModalKicker").textContent = type === "visa" ? "VISA" : "PASSPORT";
    document.getElementById("dashboardWarningModalDate").textContent = item.expiryDate || "-";
    document.getElementById("dashboardWarningModalDays").textContent = daysText;
    document.getElementById("dashboardWarningModalDays").className = expired ? "dashboard-warning-days expired" : days <= 30 ? "dashboard-warning-days urgent" : "dashboard-warning-days";

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
}

function closeDashboardWarningModal() {
    const modal = document.getElementById("dashboardWarningModal");
    if (modal) {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }
}

function createDashboardWarningModal_() {
    const modal = document.createElement("div");
    modal.id = "dashboardWarningModal";
    modal.className = "oc-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="oc-modal-panel" style="width:min(380px,100%)" role="dialog" aria-modal="true">
            <div class="oc-modal-head">
                <div><span class="oc-section-kicker" id="dashboardWarningModalKicker">-</span><h2 id="dashboardWarningModalTitle">-</h2></div>
                <button type="button" class="oc-btn oc-btn-ghost" onclick="closeDashboardWarningModal()" aria-label="Tutup">&times;</button>
            </div>
            <div class="oc-modal-body">
                <div class="dashboard-warning-modal-body">
                    <span id="dashboardWarningModalIcon" class="dashboard-warning-modal-icon">📔</span>
                    <div>
                        <p>Tanggal expired: <strong id="dashboardWarningModalDate">-</strong></p>
                        <p id="dashboardWarningModalDays" class="dashboard-warning-days">-</p>
                    </div>
                </div>
            </div>
            <div class="oc-modal-foot">
                <button type="button" class="oc-btn oc-btn-secondary" onclick="closeDashboardWarningModal()">Tutup</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
        if (event.target === modal) closeDashboardWarningModal();
    });

    return modal;
}

function renderNewStaff(items) {
    const container = document.getElementById("newStaffList");
    if (!container) return;

    if (!Array.isArray(items) || !items.length) {
        container.innerHTML = `
            <div class="dashboard-empty">
                Belum ada data tanggal join.
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => {
        const nama = String(item.nama || "-");
        const jabatan = String(item.jabatan || "-").toUpperCase();
        const initials = nama
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join("") || "?";

        const roleVariant = jabatan === "KAPTEN"
            ? "kapten"
            : jabatan === "KASIR"
                ? "kasir"
                : "cs";

        return `
            <div class="new-staff-item">
                <span class="new-staff-avatar role-${roleVariant}">${escapeDashboardHtml(initials)}</span>
                <div class="new-staff-left">
                    <strong>${escapeDashboardHtml(nama)}</strong>
                    <small>Join ${escapeDashboardHtml(item.tanggalJoin || "-")}</small>
                </div>
                <span class="new-staff-role role-${roleVariant}">
                    ${escapeDashboardHtml(item.jabatan || "-")}
                </span>
            </div>
        `;
    }).join("");
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function escapeDashboardHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
