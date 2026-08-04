const DASHBOARD_API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";
const EXPECTED_DASHBOARD_API_VERSION = "dashboard-v2.1";

const dashboardUser = getLoginUser();

document.addEventListener("DOMContentLoaded", () => {
    setupDashboardHeader();
    loadDashboard(true); // load awal: boleh pakai cache 15 detik biar cepat

    document.getElementById("btnRefreshDashboard")
        ?.addEventListener("click", () => loadDashboard(false)); // tombol manual: selalu fresh

    document.getElementById("btnLogout")
        ?.addEventListener("click", logout);
});

function setupDashboardHeader() {
    const username = String(dashboardUser?.username || "").trim();
    const role = String(dashboardUser?.role || "").trim();

    setText("heroName", username || "Pengguna");

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
        "heroEyebrow",
        `STATUS OPERASIONAL · ${new Intl.DateTimeFormat("id-ID", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        }).format(new Date())}`
    );
}

async function loadDashboard(useCache = false) {
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
        let payload;

        if (useCache && typeof window.ocFetchDashboardCached === "function") {
            payload = await window.ocFetchDashboardCached();
        } else {
            const cacheBuster = Date.now();

            const response = await fetch(
                `${DASHBOARD_API_BASE}?type=dashboard&token=${encodeURIComponent(getLoginToken())}&_=${cacheBuster}`,
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            payload = await response.json();

            // Refresh manual: buang cache lama supaya halaman lain
            // (badge sidebar, lonceng notif) juga ikut lihat data baru
            // di navigasi berikutnya, bukan sisa cache 15 detik tadi.
            try { sessionStorage.removeItem("ocDashboardCache"); } catch (err) { /* abaikan */ }
        }

        const data = payload;

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

/* ==========================================================
   RENDER UTAMA
========================================================== */

function renderDashboard(data) {
    const roles = data.roles || {};
    const totalStaff = Number(data.totalStaff || 0);
    const staffCuti = Number(data.staffCuti || 0);
    const offdayHariIni = Number(data.offdayHariIni || 0);
    const activeToday = Number(data.activeToday || 0);

    const passportWarnings = Array.isArray(data.passportWarnings) ? data.passportWarnings : [];
    const visaWarnings = Array.isArray(data.visaWarnings) ? data.visaWarnings : [];
    const passportCount = Number(data.passportWarning ?? passportWarnings.length);
    const visaCount = Number(data.visaWarning ?? visaWarnings.length);

    renderHeroSummary({ totalStaff, staffCuti, offdayHariIni, activeToday, docCount: passportCount + visaCount });
    renderHeroApproval(data);
    renderKpi({ totalStaff, staffCuti, offdayHariIni, roles, docCount: passportCount + visaCount, passportCount, visaCount });
    renderTimeline(data);
    renderComposition(roles, totalStaff);
    renderStaffOverview(data.newStaff || []);
    renderWarningCenter(passportWarnings, visaWarnings);
    renderInsights(data);
}

/* ---------- 1. HERO ---------- */

function renderHeroSummary({ totalStaff, staffCuti, offdayHariIni, activeToday, docCount }) {
    setText("heroActive", activeToday);
    setText("heroCuti", staffCuti);
    setText("heroOffday", offdayHariIni);

    const subEl = document.getElementById("heroSub");
    if (!subEl) return;

    if (docCount > 0) {
        subEl.innerHTML = `Dari <strong>${totalStaff} staff</strong>, <strong>${activeToday} aktif</strong> hari ini. Ada <strong>${docCount} dokumen</strong> yang butuh perhatian.`;
    } else {
        subEl.innerHTML = `Dari <strong>${totalStaff} staff</strong>, <strong>${activeToday} aktif</strong> hari ini. Semua dokumen dalam kondisi aman.`;
    }
}

function renderHeroApproval(data) {
    const card = document.getElementById("heroApprovalCard");
    if (!card) return;

    const role = String(dashboardUser?.role || "").toUpperCase();
    const pending = data.pending || {};

    const categories = role === "MASTER"
        ? [
            { key: "cuti", label: "Pengajuan Cuti", href: "cuti-pengajuan.html" },
            { key: "offday", label: "Pengajuan Offday", href: "offday.html" },
            { key: "rekening", label: "Req Ganti Rekening", href: "rekening.html" },
            { key: "banding", label: "Banding Kesalahan", href: "banding.html" }
          ]
        : role === "ADMIN"
            ? [{ key: "banding", label: "Banding Kesalahan", href: "banding.html" }]
            : [];

    const items = categories
        .map(cat => ({ ...cat, count: Number(pending[cat.key] || 0) }))
        .filter(cat => cat.count > 0);

    const total = items.reduce((sum, item) => sum + item.count, 0);

    if (role !== "MASTER" && role !== "ADMIN") {
        card.innerHTML = `
            <span class="hub-approval-kicker">STATUS SAYA</span>
            <div class="hub-approval-clear">
                <span>👋</span>
                <span>Cek status pengajuan cuti/offday kamu di menu masing-masing.</span>
            </div>
        `;
        return;
    }

    if (!items.length) {
        card.innerHTML = `
            <span class="hub-approval-kicker">PERLU DIPROSES</span>
            <div class="hub-approval-clear">
                <span>✓</span>
                <span>Semua pengajuan sudah diproses. Kerja bagus!</span>
            </div>
        `;
        return;
    }

    card.innerHTML = `
        <span class="hub-approval-kicker">PERLU DIPROSES</span>
        <div class="hub-approval-count"><strong>${total}</strong><span>pengajuan menunggu</span></div>
        <p class="hub-approval-desc">Ringkasan dari semua modul yang butuh persetujuanmu.</p>
        <div class="hub-approval-list">
            ${items.map(item => `
                <a class="hub-approval-row" href="${item.href}">
                    <span>${escapeDashboardHtml(item.label)}</span>
                    <b>${item.count}</b>
                </a>
            `).join("")}
        </div>
    `;
}

/* ---------- 2. KPI ---------- */

function renderKpi({ totalStaff, staffCuti, offdayHariIni, roles, docCount, passportCount, visaCount }) {
    setText("kpiStaffValue", totalStaff);
    setText("kpiCutiValue", staffCuti);
    setText("kpiOffdayValue", offdayHariIni);
    setText("kpiDocsValue", docCount);

    const percent = totalStaff > 0 ? Math.round((staffCuti / totalStaff) * 100) : 0;
    setText("kpiCutiTrend", staffCuti > 0 ? `${percent}% dari total staff sedang cuti` : "Tidak ada staff cuti hari ini");

    const bars = document.getElementById("kpiStaffBars");
    if (bars) {
        const roleData = [
            { label: "CS", value: Number(roles.cs || 0), color: "var(--oc-blue)" },
            { label: "Kapten", value: Number(roles.kapten || 0), color: "var(--oc-purple)" },
            { label: "Kasir", value: Number(roles.kasir || 0), color: "var(--oc-warning)" }
        ];
        const max = Math.max(...roleData.map(r => r.value), 1);

        bars.innerHTML = roleData.map(r => {
            const heightPct = Math.max((r.value / max) * 100, 8);
            return `
                <div class="hub-kpi-mini-bar" style="height:${heightPct}%;background:${r.color}">
                    <span>${r.value}</span>
                </div>
            `;
        }).join("");
    }

    setText("kpiDocsValue", docCount);
    const docsCard = document.getElementById("kpiDocsCard");
    if (docsCard) {
        const label = docsCard.querySelector(".hub-kpi-label");
        if (label) label.textContent = `Passport ${passportCount} · Visa ${visaCount}`;
    }
}

/* ---------- 3. TIMELINE AKTIVITAS ---------- */

function renderTimeline(data) {
    const container = document.getElementById("activityTimeline");
    if (!container) return;

    const staffCuti = Number(data.staffCuti || 0);
    const offdayHariIni = Number(data.offdayHariIni || 0);
    const activeToday = Number(data.activeToday || 0);
    const birthdayNames = Array.isArray(data.birthdayNames) ? data.birthdayNames : [];
    const passportWarning = Number(data.passportWarning || 0);
    const visaWarning = Number(data.visaWarning || 0);

    const iconLeave = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`;
    const iconOffday = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    const iconActive = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;
    const iconAlert = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>`;
    const iconBirthday = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2 1 3.5 1 2-1 3.5-1 2 1 3.5 1 2-1 2-1"/><path d="M12 4v3"/></svg>`;

    const items = [
        {
            variant: "active",
            icon: iconActive,
            title: "Staff Aktif Bekerja",
            sub: `${activeToday} staff tidak cuti maupun offday hari ini`,
            badge: `${activeToday} orang`,
            time: "Real-time"
        },
        {
            variant: "leave",
            icon: iconLeave,
            title: "Staff Sedang Cuti",
            sub: staffCuti > 0 ? `${staffCuti} staff sedang menjalani cuti` : "Tidak ada staff yang cuti hari ini",
            badge: `${staffCuti} orang`,
            time: "Hari ini"
        },
        {
            variant: "offday",
            icon: iconOffday,
            title: "Staff Offday",
            sub: offdayHariIni > 0 ? `${offdayHariIni} staff mengambil offday hari ini` : "Tidak ada offday hari ini",
            badge: `${offdayHariIni} orang`,
            time: "Hari ini"
        }
    ];

    if (birthdayNames.length) {
        items.push({
            variant: "active",
            icon: iconBirthday,
            title: "Ulang Tahun Hari Ini",
            sub: birthdayNames.slice(0, 3).join(", ") + (birthdayNames.length > 3 ? ` +${birthdayNames.length - 3} lagi` : ""),
            badge: `${birthdayNames.length} staff`,
            time: "Hari ini"
        });
    }

    if (passportWarning + visaWarning > 0) {
        items.push({
            variant: "alert",
            icon: iconAlert,
            title: "Dokumen Perlu Perhatian",
            sub: `Passport ${passportWarning} · Visa ${visaWarning} mendekati kedaluwarsa`,
            badge: "Perlu tindakan",
            time: "Berkelanjutan"
        });
    }

    container.innerHTML = items.map(item => `
        <div class="hub-timeline-item ${item.variant}">
            <div class="hub-timeline-node">${item.icon}</div>
            <div class="hub-timeline-body">
                <div class="hub-timeline-top">
                    <strong>${escapeDashboardHtml(item.title)}</strong>
                    <span class="hub-timeline-time">${escapeDashboardHtml(item.time)}</span>
                </div>
                <p class="hub-timeline-sub">${escapeDashboardHtml(item.sub)}</p>
                <span class="hub-timeline-badge">${escapeDashboardHtml(item.badge)}</span>
            </div>
        </div>
    `).join("");
}

/* ---------- 4. KOMPOSISI TIM ---------- */

function calculateRoundedPercentages_(values, total) {
    if (!total) return values.map(() => 0);

    const exact = values.map(value => (value / total) * 100);
    const floors = exact.map(Math.floor);
    let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);

    const order = exact
        .map((value, index) => ({ index, frac: value - Math.floor(value) }))
        .sort((a, b) => b.frac - a.frac);

    const result = [...floors];
    for (let i = 0; i < order.length && remainder > 0; i++) {
        result[order[i].index] += 1;
        remainder--;
    }

    return result;
}

function renderComposition(roles, totalStaff) {
    const container = document.getElementById("compositionBody");
    if (!container) return;

    const items = [
        { label: "CS", value: Number(roles.cs || 0), color: "var(--oc-blue)" },
        { label: "Kapten", value: Number(roles.kapten || 0), color: "var(--oc-purple)" },
        { label: "Kasir", value: Number(roles.kasir || 0), color: "var(--oc-warning)" }
    ];

    const total = Math.max(totalStaff, 1);
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const percentages = calculateRoundedPercentages_(items.map(i => i.value), totalStaff);

    let offset = 0;
    const circles = items.map(item => {
        const fraction = item.value / total;
        const dash = Math.max(fraction * circumference, item.value > 0 ? 3 : 0);
        const circle = `
            <circle cx="52" cy="52" r="${radius}" fill="none" stroke="${item.color}" stroke-width="13"
                stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}"
                stroke-linecap="round" transform="rotate(-90 52 52)" />
        `;
        offset += dash;
        return circle;
    }).join("");

    const legend = items.map((item, i) => `
        <div class="hub-composition-legend-item">
            <span class="hub-composition-dot" style="background:${item.color}"></span>
            <span>${escapeDashboardHtml(item.label)}</span>
            <strong>${item.value} &middot; ${percentages[i]}%</strong>
        </div>
    `).join("");

    const bars = items.map((item, i) => `
        <div class="hub-composition-bar-row">
            <div class="hub-composition-bar-label"><span>${escapeDashboardHtml(item.label)}</span><span>${percentages[i]}%</span></div>
            <div class="hub-composition-bar-track"><div class="hub-composition-bar-fill" style="width:${percentages[i]}%;background:${item.color}"></div></div>
        </div>
    `).join("");

    container.innerHTML = `
        <div class="hub-composition-top">
            <div class="hub-composition-donut">
                <svg viewBox="0 0 104 104" width="104" height="104">
                    <circle cx="52" cy="52" r="${radius}" fill="none" stroke="var(--oc-line)" stroke-width="13"/>
                    ${circles}
                </svg>
                <div class="hub-composition-donut-center"><strong>${totalStaff}</strong><small>Staff</small></div>
            </div>
            <div class="hub-composition-legend">${legend}</div>
        </div>
        <div class="hub-composition-bars">${bars}</div>
    `;
}

/* ---------- 5. STAFF OVERVIEW ---------- */

function renderStaffOverview(items) {
    const container = document.getElementById("staffOverviewCards");
    if (!container) return;

    if (!Array.isArray(items) || !items.length) {
        container.innerHTML = `<div class="hub-warning-empty">Belum ada data tanggal join.</div>`;
        return;
    }

    const roleColors = {
        CS: ["var(--oc-blue)", "var(--oc-blue-soft)"],
        KAPTEN: ["var(--oc-purple)", "var(--oc-purple-soft)"],
        KASIR: ["var(--oc-warning)", "var(--oc-warning-soft)"]
    };

    const iconPin = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    const iconClock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
    const iconCalendar = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/></svg>`;

    container.innerHTML = items.map(item => {
        const nama = String(item.nama || "-");
        const jabatan = String(item.jabatan || "-").toUpperCase();
        const [roleColor, roleSoft] = roleColors[jabatan] || roleColors.CS;
        const initials = nama.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("") || "?";

        return `
            <div class="hub-staff-card">
                <div class="hub-staff-card-top">
                    <span class="hub-staff-avatar" style="background:${roleColor}">${escapeDashboardHtml(initials)}</span>
                    <span class="hub-staff-status">Aktif</span>
                </div>
                <strong>${escapeDashboardHtml(nama)}</strong>
                <span class="hub-staff-role-badge" style="background:${roleSoft};color:${roleColor}">${escapeDashboardHtml(item.jabatan || "-")}</span>
                <div class="hub-staff-meta">
                    <div class="hub-staff-meta-row">${iconCalendar} Join ${escapeDashboardHtml(item.tanggalJoin || "-")}</div>
                    <div class="hub-staff-meta-row">${iconClock} ${escapeDashboardHtml(item.masaKerja || "-")}</div>
                    ${item.domisili ? `<div class="hub-staff-meta-row">${iconPin} ${escapeDashboardHtml(item.domisili)}</div>` : ""}
                </div>
            </div>
        `;
    }).join("");
}

/* ---------- 6. WARNING CENTER ---------- */

let dashboardWarningData = { passport: [], visa: [] };

function renderWarningCenter(passportWarnings, visaWarnings) {
    dashboardWarningData = { passport: passportWarnings, visa: visaWarnings };

    const container = document.getElementById("warningCenterBody");
    if (!container) return;

    const groups = [
        { type: "passport", label: "Passport", items: passportWarnings },
        { type: "visa", label: "Visa", items: visaWarnings }
    ];

    const allEmpty = passportWarnings.length === 0 && visaWarnings.length === 0;

    if (allEmpty) {
        container.innerHTML = `<div class="hub-warning-empty">✓ Tidak ada dokumen dalam periode warning. Semua aman.</div>`;
        return;
    }

    container.innerHTML = groups.map(group => {
        if (!group.items.length) return "";

        const sorted = [...group.items].sort((a, b) => Number(a.daysLeft) - Number(b.daysLeft));

        return `
            <div class="hub-warning-group">
                <div class="hub-warning-group-label">${escapeDashboardHtml(group.label)} <span class="count">${group.items.length}</span></div>
                ${sorted.slice(0, 5).map((item, i) => {
                    const days = Number(item.daysLeft);
                    const expired = days < 0;
                    const critical = expired || days <= 14;
                    const priority = critical ? "critical" : "upcoming";
                    const daysText = expired ? `Lewat ${Math.abs(days)}h` : `${days} hari`;
                    const originalIndex = group.items.indexOf(item);

                    return `
                        <div class="hub-warning-row ${priority}" onclick="openDashboardWarningDetail('${group.type}', ${originalIndex})" style="cursor:pointer">
                            <span class="hub-warning-dot"></span>
                            <div class="hub-warning-row-body">
                                <strong>${escapeDashboardHtml(item.nama)}</strong>
                                <small>${escapeDashboardHtml(item.expiryDate || "-")}</small>
                            </div>
                            <span class="hub-warning-row-days">${escapeDashboardHtml(daysText)}</span>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }).join("");
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

/* ---------- 7. QUICK INSIGHTS ---------- */

function renderInsights(data) {
    const container = document.getElementById("insightsBody");
    if (!container) return;

    const staffCuti = Number(data.staffCuti || 0);
    const totalStaff = Number(data.totalStaff || 0);
    const cutiTrendPct = totalStaff > 0 ? Math.round((staffCuti / totalStaff) * 100) : 0;
    const birthdayNames = Array.isArray(data.birthdayNames) ? data.birthdayNames : [];

    const icons = {
        age: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
        city: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>`,
        longest: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
        birthday: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M12 4v3"/></svg>`,
        trend: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`
    };

    const insights = [
        { icon: icons.age, value: `${data.averageAge || 0} Tahun`, label: "Rata-rata Usia Staff" },
        { icon: icons.city, value: data.topDomicile || "-", label: "Domisili Terbanyak" },
        { icon: icons.longest, value: data.longestServing || "-", label: "Masa Kerja Terlama" },
        { icon: icons.birthday, value: birthdayNames.length ? `${birthdayNames.length} Staff` : "Tidak ada", label: "Ulang Tahun Hari Ini" },
        { icon: icons.trend, value: `${cutiTrendPct}%`, label: "Proporsi Staff Cuti Hari Ini" }
    ];

    container.innerHTML = insights.map(item => `
        <div class="hub-insight-card">
            <span class="hub-insight-icon">${item.icon}</span>
            <strong>${escapeDashboardHtml(item.value)}</strong>
            <span>${escapeDashboardHtml(item.label)}</span>
        </div>
    `).join("");
}

/* ---------- Util ---------- */

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function escapeDashboardHtml(value) {
    return String(value ?? "-")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
