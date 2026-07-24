const DASHBOARD_API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";
const EXPECTED_DASHBOARD_API_VERSION = "dashboard-v2.1";

const dashboardUser = getLoginUser();

document.addEventListener("DOMContentLoaded", () => {
    setupDashboardHeader();
    loadDashboard();

    document.getElementById("btnRefreshDashboard")
        ?.addEventListener("click", loadDashboard);
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
        button.disabled = true;
        button.textContent = "Memuat...";
    }

    if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = "";
    }

    try {
        const cacheBuster = Date.now();

        const response = await fetch(
            `${DASHBOARD_API_BASE}?type=dashboard&_=${cacheBuster}`,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data?.success === false) {
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
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "↻ Perbarui Data";
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
    renderWarningList("passportWarningList", passportWarnings);
    renderWarningList("visaWarningList", visaWarnings);
    renderNewStaff(data.newStaff || []);
}

function renderRoleChart(roles, totalStaff) {
    const container = document.getElementById("roleChart");
    if (!container) return;

    const items = [
        { label: "CS", value: Number(roles.cs || 0) },
        { label: "Kapten", value: Number(roles.kapten || 0) },
        { label: "Kasir", value: Number(roles.kasir || 0) }
    ];

    container.innerHTML = items.map(item => {
        const percent = totalStaff > 0
            ? Math.max((item.value / totalStaff) * 100, item.value > 0 ? 3 : 0)
            : 0;

        return `
            <div class="role-row">
                <span class="role-label">${escapeDashboardHtml(item.label)}</span>
                <div class="role-track">
                    <div class="role-fill" style="width:${Math.min(percent, 100)}%"></div>
                </div>
                <strong class="role-value">${item.value}</strong>
            </div>
        `;
    }).join("");
}

function renderActivity(data) {
    const container = document.getElementById("todayActivity");
    if (!container) return;

    const birthdayNames = Array.isArray(data.birthdayNames)
        ? data.birthdayNames
        : [];

    const activities = [
        {
            title: "Staff Cuti",
            subtitle: "Sedang cuti hari ini",
            value: Number(data.staffCuti || 0)
        },
        {
            title: "Staff Offday",
            subtitle: "Offday disetujui hari ini",
            value: Number(data.offdayHariIni || 0)
        },
        {
            title: "Staff Aktif",
            subtitle: "Tidak cuti dan tidak offday",
            value: Number(data.activeToday || 0)
        },
        {
            title: "Ulang Tahun",
            subtitle: birthdayNames.length
                ? birthdayNames.join(", ")
                : "Tidak ada ulang tahun hari ini",
            value: Number(data.birthdayCount || 0)
        }
    ];

    container.innerHTML = activities.map(item => `
        <div class="activity-item">
            <div class="activity-left">
                <strong>${escapeDashboardHtml(item.title)}</strong>
                <small>${escapeDashboardHtml(item.subtitle)}</small>
            </div>
            <span class="activity-count">${item.value}</span>
        </div>
    `).join("");
}

function renderWarningList(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items.length) {
        container.innerHTML = `
            <div class="dashboard-empty">
                Tidak ada dokumen dalam periode warning.
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => {
        const days = Number(item.daysLeft);
        const expired = days < 0;

        const daysText = expired
            ? `Lewat ${Math.abs(days)} hari`
            : days === 0
                ? "Habis hari ini"
                : `${days} hari`;

        return `
            <div class="warning-item">
                <div class="warning-left">
                    <strong>${escapeDashboardHtml(item.nama || "-")}</strong>
                    <small>${escapeDashboardHtml(item.expiryDate || "-")}</small>
                </div>
                <span class="warning-days ${expired ? "expired" : ""}">
                    ${escapeDashboardHtml(daysText)}
                </span>
            </div>
        `;
    }).join("");
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

    container.innerHTML = items.map(item => `
        <div class="new-staff-item">
            <div class="new-staff-left">
                <strong>${escapeDashboardHtml(item.nama || "-")}</strong>
                <small>Join ${escapeDashboardHtml(item.tanggalJoin || "-")}</small>
            </div>
            <span class="new-staff-role">
                ${escapeDashboardHtml(item.jabatan || "-")}
            </span>
        </div>
    `).join("");
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
