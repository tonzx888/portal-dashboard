const DASHBOARD_API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

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

    const welcomeTitle = document.getElementById("welcomeTitle");
    const dashboardDate = document.getElementById("dashboardDate");
    const userInfo = document.getElementById("userInfo");

    if (welcomeTitle) {
        welcomeTitle.textContent = username
            ? `Selamat Datang, ${username}`
            : "Selamat Datang";
    }

    if (userInfo) {
        userInfo.textContent = [username, role]
            .filter(Boolean)
            .join(" · ");
    }

    if (dashboardDate) {
        dashboardDate.textContent = new Intl.DateTimeFormat("id-ID", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        }).format(new Date());
    }
}

async function loadDashboard() {
    const refreshButton = document.getElementById("btnRefreshDashboard");
    const errorBox = document.getElementById("dashboardError");

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Memuat...";
    }

    if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = "";
    }

    try {
        const response = await fetch(`${DASHBOARD_API_BASE}?type=dashboard`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data?.success === false) {
            throw new Error(data.message || "Dashboard gagal dimuat.");
        }

        renderDashboard(data);
    } catch (error) {
        console.error("Gagal mengambil data dashboard:", error);

        if (errorBox) {
            errorBox.hidden = false;
            errorBox.textContent =
                "Gagal memuat dashboard. Pastikan Dashboard.gs sudah dipasang dan Web App sudah di-deploy ulang.";
        }
    } finally {
        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "↻ Perbarui Data";
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

    setText("totalStaff", data.totalStaff || 0);
    setText("staffCuti", data.staffCuti || 0);
    setText("offdayHariIni", data.offdayHariIni || 0);

    setText(
        "roleSummary",
        `CS ${roles.cs || 0} · Kapten ${roles.kapten || 0} · Kasir ${roles.kasir || 0}`
    );

    const passportCount =
        Number(data.passportWarning ?? passportWarnings.length ?? 0);
    const visaCount =
        Number(data.visaWarning ?? visaWarnings.length ?? 0);

    setText("documentWarning", passportCount + visaCount);
    setText(
        "documentWarningText",
        `Passport ${passportCount} · Visa ${visaCount}`
    );

    setText("passportWarningBadge", passportCount);
    setText("visaWarningBadge", visaCount);

    setText("averageAge", `${data.averageAge || 0} Tahun`);
    setText("activeToday", data.activeToday || 0);
    setText("topDomicile", data.topDomicile || "-");
    setText("longestServing", data.longestServing || "-");

    renderRoleChart(roles, data.totalStaff || 0);
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
                    <div
                        class="role-fill"
                        style="width:${Math.min(percent, 100)}%"
                    ></div>
                </div>

                <strong class="role-value">${item.value}</strong>
            </div>
        `;
    }).join("");
}

function renderActivity(data) {
    const container = document.getElementById("todayActivity");

    if (!container) return;

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
            subtitle: data.birthdayNames?.length
                ? data.birthdayNames.join(", ")
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

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `
            <div class="dashboard-empty">
                Tidak ada dokumen dalam periode warning.
            </div>
        `;
        return;
    }

    container.innerHTML = items.slice(0, 8).map(item => {
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

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `
            <div class="dashboard-empty">
                Belum ada data tanggal join.
            </div>
        `;
        return;
    }

    container.innerHTML = items.slice(0, 6).map(item => `
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
