const API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

let offdayData = [];
let calendarData = [];
let toastTimer = null;
let calendarViewDate = new Date();

const currentUser = getLoginUser();
const currentSystemRole = String(currentUser?.role || "").toUpperCase();
const currentUsername = String(currentUser?.username || "").trim();

/**
 * Mengecek apakah suatu pesan dari backend menandakan sesi/token
 * sudah tidak valid (kedaluwarsa, dihapus, atau memang belum login).
 * Kalau iya, paksa logout & arahkan ke halaman login supaya user
 * tidak bingung melihat data kosong/gagal terus-menerus.
 */
function handleExpiredSession_(message) {
    const text = String(message || "").toLowerCase();
    const isExpired = text.includes("sesi tidak valid") || text.includes("login ulang");

    if (isExpired) {
        alert("Sesi Anda sudah berakhir. Silakan login ulang.");
        localStorage.removeItem("loginUser");
        window.location.href = "login.html";
    }

    return isExpired;
}

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    if (!toast) return;

    clearTimeout(toastTimer);
    toast.className = `toast ${type}`;
    toast.textContent = message || "Proses selesai.";
    toast.style.display = "block";

    toastTimer = setTimeout(() => {
        toast.style.display = "none";
    }, 3500);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function statusBadge(status) {
    const normalized = String(status || "MENUNGGU").toUpperCase();
    const className = normalized === "DISETUJUI"
        ? "approved"
        : normalized === "DITOLAK"
            ? "rejected"
            : "pending";

    return `<span class="offday-status ${className}">${escapeHtml(normalized)}</span>`;
}

function getMinimumSubmitDate() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3);
    return formatDateForInput(date);
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseOffdayDate(value) {
    if (!value) return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    const text = String(value).trim();
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (slashMatch) {
        const [, day, month, year] = slashMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const fallbackDate = new Date(text);

    if (!Number.isNaN(fallbackDate.getTime())) {
        return new Date(
            fallbackDate.getFullYear(),
            fallbackDate.getMonth(),
            fallbackDate.getDate()
        );
    }

    return null;
}

function formatDisplayDate(date) {
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(date);
}

function formatMonthYear(date) {
    return new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric"
    }).format(date);
}

document.addEventListener("DOMContentLoaded", () => {
    createCalendarDetailModal();
    createOffdayBlockedModal();
    setupOffdayPage();
    loadOffday();
    loadCalendarData();
    loadSummary();

    if (typeof ocInitCustomSelect === "function") {
        ocInitCustomSelect(document.getElementById("role"));
        ocInitCustomSelect(document.getElementById("shift"));
        ocInitCustomSelect(document.getElementById("filterRole"));
        ocInitCustomSelect(document.getElementById("filterShift"));
        ocInitCustomSelect(document.getElementById("filterStatus"));
    }

    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
        await Promise.all([loadOffday(), loadCalendarData(), loadSummary()]);
        showToast("Data berhasil diperbarui.");
    });

    document.getElementById("btnSubmitOffday")?.addEventListener("click", submitOffday);
    document.getElementById("searchOffday")?.addEventListener("input", applyOffdayFilters);
    document.getElementById("filterStatus")?.addEventListener("change", applyOffdayFilters);
    document.getElementById("filterRole")?.addEventListener("change", applyOffdayFilters);
    document.getElementById("filterShift")?.addEventListener("change", applyOffdayFilters);
    document.getElementById("calendarPrev")?.addEventListener("click", () => changeCalendarMonth(-1));
    document.getElementById("calendarNext")?.addEventListener("click", () => changeCalendarMonth(1));
});

function setupOffdayPage() {
    const namaInput = document.getElementById("nama");
    const tanggalInput = document.getElementById("tanggal");
    const submissionCard = document.getElementById("submissionCard");
    const actionHeader = document.getElementById("actionHeader");
    const tableTitle = document.getElementById("tableTitle");
    const tableSubtitle = document.getElementById("tableSubtitle");

    if (namaInput) namaInput.value = currentUsername;
    if (tanggalInput) tanggalInput.min = getMinimumSubmitDate();

    if (currentSystemRole === "MASTER") {
        if (submissionCard) submissionCard.style.display = "none";
        if (tableTitle) tableTitle.textContent = "Approval Pengajuan Offday";
        if (tableSubtitle) tableSubtitle.textContent = "MASTER dapat menyetujui atau menolak pengajuan yang masih menunggu.";
    } else if (currentSystemRole === "ADMIN") {
        if (submissionCard) submissionCard.style.display = "none";
        if (actionHeader) actionHeader.style.display = "none";
        if (tableTitle) tableTitle.textContent = "Monitoring Offday";
        if (tableSubtitle) tableSubtitle.textContent = "ADMIN memiliki akses baca tanpa hak approval.";
    } else {
        if (actionHeader) actionHeader.style.display = "none";
        if (tableTitle) tableTitle.textContent = "Riwayat Offday Saya";
        if (tableSubtitle) tableSubtitle.textContent = "Riwayat pengajuan ditampilkan berdasarkan username akun login.";
    }
}

async function loadOffday() {
    const tbody = document.getElementById("dataOffday");
    if (tbody) tbody.innerHTML = ocSkeletonRows(10);

    try {
        const params = new URLSearchParams({
            type: "offday",
            token: getLoginToken()
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        if (!Array.isArray(result)) {
            if (handleExpiredSession_(result.message)) return;
            throw new Error(result.message || "Format data tidak valid.");
        }

        offdayData = result;
        applyOffdayFilters();
    } catch (error) {
        console.error("Gagal mengambil data offday:", error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="10">Gagal memuat data offday.</td></tr>`;
        showToast("Gagal memuat data offday.", "error");
    }
}

/**
 * Mengambil data offday khusus untuk kalender visual, lewat
 * endpoint "offdayCalendar" di backend.
 *
 * Endpoint ini memang sengaja TIDAK memfilter berdasarkan role
 * (semua staff yang sudah login boleh lihat jadwal semua orang),
 * tapi tetap wajib mengirim token sesi yang valid -- backend akan
 * menolak kalau token kosong/salah/kedaluwarsa.
 */
async function loadCalendarData() {
    try {
        const params = new URLSearchParams({
            type: "offdayCalendar",
            token: getLoginToken()
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        if (!Array.isArray(result)) {
            if (handleExpiredSession_(result.message)) return;
            throw new Error(result.message || "Format data tidak valid.");
        }

        calendarData = result;
        renderCalendar(calendarData);
    } catch (error) {
        console.error("Gagal mengambil data kalender offday:", error);
        showToast("Gagal memuat kalender offday.", "error");
    }
}

async function loadSummary() {
    try {
        const params = new URLSearchParams({
            type: "offdaySummary",
            token: getLoginToken()
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const summary = await response.json();
        const pendingCount = Number(summary.menunggu || 0);

        document.getElementById("summaryTotal").textContent = summary.total || 0;
        document.getElementById("summaryPending").textContent = pendingCount;
        document.getElementById("summaryApproved").textContent = summary.disetujui || 0;
        document.getElementById("summaryRejected").textContent = summary.ditolak || 0;

        document.querySelector(".summary-pending")
            ?.classList.toggle("has-pending", pendingCount > 0);
    } catch (error) {
        console.error("Gagal mengambil ringkasan offday:", error);
    }
}

function applyOffdayFilters() {
    const keyword = String(document.getElementById("searchOffday")?.value || "").trim().toLowerCase();
    const status = String(document.getElementById("filterStatus")?.value || "").toUpperCase();
    const role = String(document.getElementById("filterRole")?.value || "").toUpperCase();
    const shift = String(document.getElementById("filterShift")?.value || "").toUpperCase();

    const filtered = offdayData.filter(item => {
        const searchable = [item.nama, item.role, item.shift, item.status, item.alasan, item.catatan]
            .join(" ")
            .toLowerCase();

        const itemStatus = String(item.status || "").toUpperCase();
        const itemRole = String(item.role || "").toUpperCase();
        const itemShift = String(item.shift || "").toUpperCase();

        return searchable.includes(keyword)
            && (!status || itemStatus === status)
            && (!role || itemRole === role)
            && (!shift || itemShift === shift);
    });

    renderOffday(filtered);
}

function renderOffday(data) {
    const tbody = document.getElementById("dataOffday");
    if (!tbody) return;

    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10">Belum ada data yang sesuai.</td></tr>`;
        return;
    }

    let html = "";

    data.forEach((item, index) => {
        const normalizedStatus = String(item.status || "").toUpperCase();
        const canApprove = currentSystemRole === "MASTER" && normalizedStatus === "MENUNGGU";

        const actionCell = currentSystemRole === "MASTER"
            ? `<td class="offday-action-cell">
                ${canApprove ? `
                    <button type="button" class="offday-action-btn approve" onclick="approveOffday(${Number(item.row)})">Setujui</button>
                    <button type="button" class="offday-action-btn reject" onclick="rejectOffday(${Number(item.row)})">Tolak</button>
                ` : `<span class="offday-muted">Selesai</span>`}
               </td>`
            : "";

        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(item.nama || "-")}</td>
                <td>${escapeHtml(item.role || "-")}</td>
                <td>${escapeHtml(item.shift || "-")}</td>
                <td>${escapeHtml(item.tanggal || "-")}</td>
                <td class="offday-wrap">${escapeHtml(item.alasan || "-")}</td>
                <td>${statusBadge(item.status)}</td>
                <td>
                    ${escapeHtml(item.approvedBy || "-")}
                    ${item.approvedDate ? `<small>${escapeHtml(item.approvedDate)}</small>` : ""}
                </td>
                <td class="offday-wrap">${escapeHtml(item.catatan || "-")}</td>
                ${actionCell}
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

async function submitOffday() {
    const button = document.getElementById("btnSubmitOffday");
    const nama = currentUsername;
    const role = document.getElementById("role")?.value || "";
    const shift = document.getElementById("shift")?.value || "";
    const tanggal = document.getElementById("tanggal")?.value || "";
    const alasan = document.getElementById("alasan")?.value.trim() || "";

    if (!nama || !role || !shift || !tanggal || !alasan) {
        showOffdayBlockedModal(
            "Data Belum Lengkap",
            "Role, shift, tanggal, dan alasan wajib diisi sebelum mengajukan offday."
        );
        return;
    }

    if (tanggal < getMinimumSubmitDate()) {
        showOffdayBlockedModal(
            "Pengajuan Terlalu Mepet",
            "Pengajuan offday minimal H-3 sebelum tanggal offday. Silakan pilih tanggal lain."
        );
        return;
    }

    const blockReason = getOffdaySubmitBlockReason(role, tanggal);

    if (blockReason) {
        showOffdayBlockedModal("Pengajuan Tidak Dapat Diajukan", blockReason);
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Mengirim...";
    }

    try {
        const params = new URLSearchParams({
            type: "submitOffday",
            token: getLoginToken(),
            role,
            shift,
            tanggal,
            alasan
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        if (!result.success) {
            if (handleExpiredSession_(result.message)) return;

            showOffdayBlockedModal(
                "Pengajuan Tidak Dapat Diajukan",
                result.message || "Pengajuan offday ditolak oleh sistem."
            );
            return;
        }

        showToast(result.message || "Pengajuan offday berhasil dikirim.");

        document.getElementById("role").value = "";
        document.getElementById("shift").value = "";
        document.getElementById("tanggal").value = "";
        document.getElementById("alasan").value = "";

        if (typeof ocRefreshCustomSelect === "function") {
            ocRefreshCustomSelect(document.getElementById("role"));
            ocRefreshCustomSelect(document.getElementById("shift"));
        }

        await Promise.all([loadOffday(), loadCalendarData(), loadSummary()]);
    } catch (error) {
        console.error("Gagal submit offday:", error);
        showToast("Gagal mengirim pengajuan offday.", "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Ajukan Offday";
        }
    }
}

/**
 * Mengecek dari calendarData (data lengkap semua staff) apakah
 * pengajuan pada role & tanggal tersebut bisa dilakukan.
 *
 * Mengembalikan string alasan penolakan jika TIDAK bisa diajukan,
 * atau null jika boleh dilanjutkan ke server.
 */
function getOffdaySubmitBlockReason(role, tanggal) {
    const normalizedRole = normalizeRole(role);
    const targetDate = parseDate(tanggal);

    if (!targetDate) return null;

    const sameDayItems = (Array.isArray(calendarData) ? calendarData : []).filter(item => {
        const itemDate = parseDate(item.tanggal);
        return itemDate && isSameDate(itemDate, targetDate);
    });

    const activeSameRoleItems = sameDayItems.filter(item => {
        const itemRole = normalizeRole(item.role);
        const status = normalizeStatus(item.status);
        return itemRole === normalizedRole && !isRejectedOffdayStatus(status);
    });

    const alreadySubmittedByMe = sameDayItems.some(item => {
        const status = normalizeStatus(item.status);
        return (
            cleanText(item.nama).toLowerCase() === currentUsername.toLowerCase() &&
            !isRejectedOffdayStatus(status)
        );
    });

    if (alreadySubmittedByMe) {
        return `Anda sudah memiliki pengajuan offday pada tanggal ${formatDisplayDate(targetDate)}. Satu staff hanya dapat mengajukan satu offday per tanggal.`;
    }

    const quota = getRoleQuota(normalizedRole);

    if (activeSameRoleItems.length >= quota) {
        return `Kuota offday untuk role ${normalizedRole} pada tanggal ${formatDisplayDate(targetDate)} sudah penuh (${activeSameRoleItems.length}/${quota}). Silakan pilih tanggal lain.`;
    }

    return null;
}

/**
 * Menampilkan popup alasan mengapa pengajuan offday tidak dapat dilakukan.
 */
function showOffdayBlockedModal(title, reason) {
    const modal = document.getElementById("offdayBlockedModal");
    if (!modal) return;

    const titleEl = document.getElementById("offdayBlockedTitle");
    const reasonEl = document.getElementById("offdayBlockedReason");

    if (titleEl) titleEl.textContent = title || "Pengajuan Tidak Dapat Diajukan";
    if (reasonEl) reasonEl.textContent = reason || "Pengajuan offday tidak dapat diproses saat ini.";

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
}

/**
 * Menutup popup alasan offday tidak dapat diajukan.
 */
function closeOffdayBlockedModal() {
    const modal = document.getElementById("offdayBlockedModal");
    if (!modal) return;

    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
}

/**
 * Membuat popup alasan offday secara otomatis (sekali saja).
 */
function createOffdayBlockedModal() {
    if (document.getElementById("offdayBlockedModal")) return;

    const modal = document.createElement("div");
    modal.id = "offdayBlockedModal";
    modal.className = "calendar-detail-modal";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
        <div
            class="calendar-detail-panel offday-blocked-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="offdayBlockedTitle"
        >
            <div class="offday-blocked-icon">!</div>
            <h3 id="offdayBlockedTitle" class="offday-blocked-title">
                Pengajuan Tidak Dapat Diajukan
            </h3>
            <p id="offdayBlockedReason" class="offday-blocked-reason"></p>
            <button
                type="button"
                class="btn-primary offday-blocked-ok"
                onclick="closeOffdayBlockedModal()"
            >
                Mengerti
            </button>
        </div>
    `;

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeOffdayBlockedModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modal.style.display === "flex") {
            closeOffdayBlockedModal();
        }
    });

    document.body.appendChild(modal);
}

async function approveOffday(row) {
    if (!confirm("Setujui pengajuan offday ini?")) return;
    await processApproval("approveOffday", row, "");
}

async function rejectOffday(row) {
    const reason = prompt("Masukkan alasan penolakan:");
    if (reason === null) return;

    if (!reason.trim()) {
        showToast("Alasan penolakan wajib diisi.", "error");
        return;
    }

    await processApproval("rejectOffday", row, reason.trim());
}

async function processApproval(type, row, catatan) {
    try {
        const params = new URLSearchParams({
            type,
            row: String(row),
            token: getLoginToken(),
            catatan
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            await Promise.all([loadOffday(), loadCalendarData(), loadSummary()]);
        }
    } catch (error) {
        console.error("Gagal memproses approval:", error);
        showToast("Gagal memproses pengajuan.", "error");
    }
}

/* ==========================================================
   OFFDAY CALENDAR
========================================================== */

/**
 * Kuota maksimal staff per role yang boleh offday
 * di tanggal yang sama sebelum dianggap "Penuh".
 *
 * CATATAN: nilai default = 2 (mengikuti label legenda
 * "Lebih dari 1" pada kalender). Sesuaikan angka ini
 * dengan aturan operasional toko yang sebenarnya.
 */
const ROLE_QUOTA_MAP = {
    CS: 2,
    KAPTEN: 2,
    KASIR: 2
};

/**
 * Menyamakan penulisan role (CS / KAPTEN / KASIR)
 * agar konsisten saat dibandingkan atau dipakai sebagai key.
 */
function normalizeRole(role) {
    return String(role || "").trim().toUpperCase();
}

/**
 * Menyamakan penulisan status (MENUNGGU / DISETUJUI / DITOLAK).
 */
function normalizeStatus(status) {
    return String(status || "MENUNGGU").trim().toUpperCase();
}

/**
 * Mengambil kuota untuk suatu role. Fallback ke 2 jika role
 * tidak dikenali di ROLE_QUOTA_MAP.
 */
function getRoleQuota(role) {
    const normalizedRole = normalizeRole(role);
    return ROLE_QUOTA_MAP[normalizedRole] || 2;
}

/**
 * Parse tanggal offday menjadi objek Date.
 * Memakai ulang logika parseOffdayDate yang sudah ada
 * (mendukung format ISO "YYYY-MM-DD" dan "DD/MM/YYYY").
 */
function parseDate(value) {
    return parseOffdayDate(value);
}

/**
 * Membandingkan dua Date apakah jatuh di hari yang sama
 * (tahun, bulan, dan tanggal sama).
 */
function isSameDate(dateA, dateB) {
    if (!(dateA instanceof Date) || !(dateB instanceof Date)) return false;
    if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) return false;

    return (
        dateA.getFullYear() === dateB.getFullYear() &&
        dateA.getMonth() === dateB.getMonth() &&
        dateA.getDate() === dateB.getDate()
    );
}

/**
 * Membersihkan teks (trim) agar aman dipakai untuk
 * perbandingan/pengurutan maupun ditampilkan.
 */
function cleanText(value) {
    return String(value ?? "").trim();
}

/**
 * Alias escapeHtml, dipakai di beberapa bagian kode kalender
 * dengan penulisan "escapeHTML" (huruf besar semua).
 */
function escapeHTML(value) {
    return escapeHtml(value);
}

/**
 * Menampilkan tiga kalender berdasarkan role.
 *
 * Kalender selalu menggunakan calendarData lengkap (semua staff),
 * tidak terpengaruh filter pada tabel maupun role user yang login.
 */
function renderCalendar(data) {
    const calendarItems = Array.isArray(data) ? data : [];

    const monthLabel = document.getElementById("calendarMonthLabel");

    if (monthLabel) {
        monthLabel.textContent =
            formatCalendarMonthYear(calendarViewDate);
    }

    renderRoleCalendar("CS", calendarItems, "calendarCS");
    renderRoleCalendar("KAPTEN", calendarItems, "calendarKapten");
    renderRoleCalendar("KASIR", calendarItems, "calendarKasir");
}


/**
 * Menampilkan satu kalender berdasarkan role.
 */
function renderRoleCalendar(role, data, elementId) {
    const container = document.getElementById(elementId);

    if (!container) return;

    const normalizedRole = normalizeRole(role);

    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const previousMonthDays = new Date(year, month, 0).getDate();

    const roleQuota = getRoleQuota(normalizedRole);

    const roleItems = data.filter(item => {
        const itemRole = normalizeRole(item.role);
        const itemDate = parseDate(item.tanggal);

        return (
            itemRole === normalizedRole &&
            itemDate &&
            itemDate.getFullYear() === year &&
            itemDate.getMonth() === month
        );
    });

    const dayNames = [
        "Min",
        "Sen",
        "Sel",
        "Rab",
        "Kam",
        "Jum",
        "Sab"
    ];

    let html = `
        <div class="offday-calendar-grid">
    `;

    dayNames.forEach(dayName => {
        html += `
            <div class="calendar-weekday">
                ${dayName}
            </div>
        `;
    });

    /*
     * Tanggal dari bulan sebelumnya.
     */
    for (
        let blankIndex = firstDayIndex - 1;
        blankIndex >= 0;
        blankIndex--
    ) {
        const previousDay = previousMonthDays - blankIndex;

        html += `
            <div class="calendar-day outside">
                <span class="calendar-day-number">
                    ${previousDay}
                </span>
            </div>
        `;
    }

    /*
     * Tanggal pada bulan aktif.
     */
    for (let day = 1; day <= totalDays; day++) {
        const selectedDate = new Date(year, month, day);

        const dayItems = roleItems.filter(item => {
            const itemDate = parseDate(item.tanggal);

            return (
                itemDate &&
                isSameDate(itemDate, selectedDate)
            );
        });

        const calendarState = getCalendarDayState(
            dayItems,
            roleQuota
        );

        const hasData = dayItems.length > 0;

        html += `
            <button
                type="button"
                class="
                    calendar-day
                    ${calendarState.className}
                "
                onclick="
                    showCalendarDayDetail(
                        '${normalizedRole}',
                        ${year},
                        ${month},
                        ${day}
                    )
                "
                ${hasData ? "" : "disabled"}
                title="${normalizedRole}, ${day} ${formatCalendarMonthYear(calendarViewDate)} — ${calendarState.label || "Tidak ada offday"}"
                aria-label="
                    ${normalizedRole},
                    ${day} ${formatCalendarMonthYear(calendarViewDate)},
                    ${calendarState.label || "Tidak ada offday"}
                "
            >
                <span class="calendar-day-number">
                    ${day}
                </span>

                ${
                    dayItems.length > 1
                        ? `<small>${dayItems.length}</small>`
                        : ""
                }
            </button>
        `;
    }

    /*
     * Mengisi sisa kalender agar tetap 5 atau 6 baris.
     */
    const usedCells = firstDayIndex + totalDays;

    const trailingCells =
        usedCells <= 35
            ? 35 - usedCells
            : 42 - usedCells;

    for (let day = 1; day <= trailingCells; day++) {
        html += `
            <div class="calendar-day outside">
                <span class="calendar-day-number">
                    ${day}
                </span>
            </div>
        `;
    }

    html += `</div>`;

    container.innerHTML = html;
}


/**
 * Menentukan warna dan kondisi suatu tanggal.
 *
 * Prioritas:
 * 1. Kuota penuh
 * 2. Ada pengajuan menunggu
 * 3. Ada pengajuan disetujui
 * 4. Hanya berisi pengajuan ditolak
 */
function getCalendarDayState(items, quota) {
    if (!Array.isArray(items) || items.length === 0) {
        return {
            className: "",
            label: ""
        };
    }

    const activeItems = items.filter(item => {
        const status = normalizeStatus(item.status);

        return !isRejectedOffdayStatus(status);
    });

    const approvedItems = activeItems.filter(item => {
        return isApprovedOffdayStatus(item.status);
    });

    const pendingItems = activeItems.filter(item => {
        return isPendingOffdayStatus(item.status);
    });

    const isFull =
        activeItems.length >= Number(quota || 1);

    if (isFull) {
        return {
            className: "full",
            label: `Penuh ${activeItems.length}/${quota}`
        };
    }

    if (pendingItems.length > 0) {
        return {
            className: "pending has-off",
            label: `${pendingItems.length} Menunggu`
        };
    }

    if (approvedItems.length > 0) {
        return {
            className: "approved has-off",
            label: `${approvedItems.length} Disetujui`
        };
    }

    return {
        className: "rejected",
        label: "Ditolak"
    };
}


/**
 * Membuat isi ringkas pada kotak tanggal.
 *
 * Contoh:
 *
 * 29
 * Anthony
 * +2
 */
function createCalendarDayContent(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return "";
    }

    const sortedItems = [...items].sort((itemA, itemB) => {
        const statusA = getCalendarStatusPriority(itemA.status);
        const statusB = getCalendarStatusPriority(itemB.status);

        if (statusA !== statusB) {
            return statusA - statusB;
        }

        return cleanText(itemA.nama).localeCompare(
            cleanText(itemB.nama),
            "id"
        );
    });

    const firstItem = sortedItems[0];

    const firstName =
        cleanText(firstItem.nama) || "Tanpa Nama";

    const additionalCount = sortedItems.length - 1;

    return `
        <div class="calendar-day-content">
            <span
                class="calendar-staff-name"
                title="${escapeHTML(firstName)}"
            >
                ${escapeHTML(firstName)}
            </span>

            ${
                additionalCount > 0
                    ? `
                        <span class="calendar-more-count">
                            +${additionalCount}
                        </span>
                    `
                    : ""
            }
        </div>
    `;
}


/**
 * Prioritas tampilan nama pada kalender:
 *
 * Disetujui → Menunggu → Ditolak.
 */
function getCalendarStatusPriority(status) {
    if (isApprovedOffdayStatus(status)) return 1;
    if (isPendingOffdayStatus(status)) return 2;
    if (isRejectedOffdayStatus(status)) return 3;

    return 4;
}


/**
 * Menggeser bulan kalender.
 */
function changeCalendarMonth(offset) {
    calendarViewDate = new Date(
        calendarViewDate.getFullYear(),
        calendarViewDate.getMonth() + Number(offset || 0),
        1
    );

    renderCalendar(calendarData);
}


/**
 * Membuka popup detail berdasarkan role dan tanggal.
 */
function showCalendarDayDetail(role, year, month, day) {
    const normalizedRole = normalizeRole(role);

    const selectedDate = new Date(
        Number(year),
        Number(month),
        Number(day)
    );

    const selectedItems = calendarData
        .filter(item => {
            const itemRole = normalizeRole(item.role);
            const itemDate = parseDate(item.tanggal);

            return (
                itemRole === normalizedRole &&
                itemDate &&
                isSameDate(itemDate, selectedDate)
            );
        })
        .sort((itemA, itemB) => {
            return (
                getCalendarStatusPriority(itemA.status) -
                getCalendarStatusPriority(itemB.status)
            );
        });

    if (selectedItems.length === 0) return;

    const modal =
        document.getElementById("calendarDetailModal");

    const title =
        document.getElementById("calendarDetailTitle");

    const body =
        document.getElementById("calendarDetailBody");

    if (!modal || !title || !body) return;

    const quota = getRoleQuota(normalizedRole);

    const activeCount = selectedItems.filter(item => {
        return !isRejectedOffdayStatus(item.status);
    }).length;

    title.textContent =
        `${normalizedRole} — ` +
        formatCalendarDisplayDate(selectedDate);

    body.innerHTML = `
        <div class="calendar-detail-summary">
            <div>
                <span class="calendar-detail-summary-label">
                    Role
                </span>

                <strong>
                    ${escapeHTML(normalizedRole)}
                </strong>
            </div>

            <div>
                <span class="calendar-detail-summary-label">
                    Kuota
                </span>

                <strong>
                    ${activeCount}/${quota}
                </strong>
            </div>

            <div>
                <span class="calendar-detail-summary-label">
                    Total Pengajuan
                </span>

                <strong>
                    ${selectedItems.length}
                </strong>
            </div>
        </div>

        <div class="calendar-detail-list">
            ${selectedItems
                .map(item => createCalendarDetailItem(item))
                .join("")}
        </div>
    `;

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
}


/**
 * Membuat satu kartu detail pengajuan.
 */
function createCalendarDetailItem(item) {
    const status = normalizeStatus(item.status);

    const statusClass = isApprovedOffdayStatus(status)
        ? "approved"
        : isPendingOffdayStatus(status)
            ? "pending"
            : isRejectedOffdayStatus(status)
                ? "rejected"
                : "unknown";

    return `
        <article class="calendar-detail-item ${statusClass}">
            <div class="calendar-detail-item-header">
                <div>
                    <div class="calendar-detail-name">
                        ${escapeHTML(item.nama || "-")}
                    </div>

                    <div class="calendar-detail-role">
                        ${escapeHTML(item.role || "-")}
                        ·
                        Shift ${escapeHTML(item.shift || "-")}
                    </div>
                </div>

                <span class="calendar-detail-badge ${statusClass}">
                    ${escapeHTML(status)}
                </span>
            </div>

            <div class="calendar-detail-grid">
                <div>
                    <span>Tanggal Offday</span>

                    <strong>
                        ${escapeHTML(item.tanggal || "-")}
                    </strong>
                </div>

                <div>
                    <span>Disetujui Oleh</span>

                    <strong>
                        ${escapeHTML(item.approvedBy || "-")}
                    </strong>
                </div>

                <div>
                    <span>Tanggal Approval</span>

                    <strong>
                        ${escapeHTML(item.approvedDate || "-")}
                    </strong>
                </div>
            </div>

            <div class="calendar-detail-section">
                <span class="calendar-detail-section-label">
                    Alasan
                </span>

                <p>
                    ${escapeHTML(item.alasan || "-")}
                </p>
            </div>

            ${
                cleanText(item.catatan)
                    ? `
                        <div class="calendar-detail-section">
                            <span class="calendar-detail-section-label">
                                Catatan
                            </span>

                            <p>
                                ${escapeHTML(item.catatan)}
                            </p>
                        </div>
                    `
                    : ""
            }
        </article>
    `;
}


/**
 * Menutup popup kalender.
 */
function closeCalendarDetailModal() {
    const modal =
        document.getElementById("calendarDetailModal");

    if (!modal) return;

    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
}


/**
 * Membuat popup kalender secara otomatis.
 */
function createCalendarDetailModal() {
    if (
        document.getElementById("calendarDetailModal")
    ) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "calendarDetailModal";
    modal.className = "calendar-detail-modal";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
        <div
            class="calendar-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendarDetailTitle"
        >
            <div class="calendar-detail-header">
                <div>
                    <span class="calendar-detail-eyebrow">
                        Detail Jadwal Offday
                    </span>

                    <h3 id="calendarDetailTitle">
                        Detail Offday
                    </h3>
                </div>

                <button
                    type="button"
                    class="calendar-detail-close"
                    onclick="closeCalendarDetailModal()"
                    aria-label="Tutup detail"
                >
                    ×
                </button>
            </div>

            <div id="calendarDetailBody"></div>
        </div>
    `;

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeCalendarDetailModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            modal.style.display === "flex"
        ) {
            closeCalendarDetailModal();
        }
    });

    document.body.appendChild(modal);
}


/* ==========================================================
   CALENDAR STATUS HELPERS
========================================================== */

function isApprovedOffdayStatus(status) {
    const normalizedStatus = normalizeStatus(status);

    return (
        normalizedStatus === "DISETUJUI" ||
        normalizedStatus === "APPROVED"
    );
}


function isPendingOffdayStatus(status) {
    const normalizedStatus = normalizeStatus(status);

    return (
        normalizedStatus === "MENUNGGU" ||
        normalizedStatus === "PENDING"
    );
}


function isRejectedOffdayStatus(status) {
    const normalizedStatus = normalizeStatus(status);

    return (
        normalizedStatus === "DITOLAK" ||
        normalizedStatus === "REJECTED"
    );
}


/* ==========================================================
   CALENDAR DATE FORMAT
========================================================== */

function formatCalendarMonthYear(date) {
    if (!(date instanceof Date)) return "-";

    return new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric"
    }).format(date);
}


function formatCalendarDisplayDate(date) {
    if (!(date instanceof Date)) return "-";

    return new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(date);
}