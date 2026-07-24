const API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

let offdayData = [];
let toastTimer = null;
let calendarViewDate = new Date();

const currentUser = getLoginUser();
const currentSystemRole = String(currentUser?.role || "").toUpperCase();
const currentUsername = String(currentUser?.username || "").trim();

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
    injectCalendarStyles();
    createCalendarDetailModal();
    setupOffdayPage();
    loadOffday();
    loadSummary();

    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
        await Promise.all([loadOffday(), loadSummary()]);
        showToast("Data berhasil diperbarui.");
    });

    document.getElementById("btnSubmitOffday")?.addEventListener("click", submitOffday);
    document.getElementById("searchOffday")?.addEventListener("input", applyOffdayFilters);
    document.getElementById("filterStatus")?.addEventListener("change", applyOffdayFilters);
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
    if (tbody) tbody.innerHTML = `<tr><td colspan="10">Memuat data offday...</td></tr>`;

    try {
        const params = new URLSearchParams({
            type: "offday",
            systemRole: currentSystemRole,
            username: currentUsername
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        if (!Array.isArray(result)) throw new Error(result.message || "Format data tidak valid.");

        offdayData = result;
        applyOffdayFilters();
        renderCalendar(offdayData);
    } catch (error) {
        console.error("Gagal mengambil data offday:", error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="10">Gagal memuat data offday.</td></tr>`;
        showToast("Gagal memuat data offday.", "error");
    }
}

async function loadSummary() {
    try {
        const response = await fetch(`${API_BASE}?type=offdaySummary`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const summary = await response.json();
        document.getElementById("summaryTotal").textContent = summary.total || 0;
        document.getElementById("summaryPending").textContent = summary.menunggu || 0;
        document.getElementById("summaryApproved").textContent = summary.disetujui || 0;
        document.getElementById("summaryRejected").textContent = summary.ditolak || 0;
    } catch (error) {
        console.error("Gagal mengambil ringkasan offday:", error);
    }
}

function applyOffdayFilters() {
    const keyword = String(document.getElementById("searchOffday")?.value || "").trim().toLowerCase();
    const status = String(document.getElementById("filterStatus")?.value || "").toUpperCase();

    const filtered = offdayData.filter(item => {
        const searchable = [item.nama, item.role, item.shift, item.status, item.alasan, item.catatan]
            .join(" ")
            .toLowerCase();

        return searchable.includes(keyword) && (!status || String(item.status || "").toUpperCase() === status);
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
        showToast("Role, shift, tanggal, dan alasan wajib diisi.", "error");
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Mengirim...";
    }

    try {
        const params = new URLSearchParams({
            type: "submitOffday",
            nama,
            role,
            shift,
            tanggal,
            alasan
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            document.getElementById("role").value = "";
            document.getElementById("shift").value = "";
            document.getElementById("tanggal").value = "";
            document.getElementById("alasan").value = "";
            await Promise.all([loadOffday(), loadSummary()]);
        }
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
            systemRole: currentSystemRole,
            approvedBy: currentUsername,
            catatan
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            await Promise.all([loadOffday(), loadSummary()]);
        }
    } catch (error) {
        console.error("Gagal memproses approval:", error);
        showToast("Gagal memproses pengajuan.", "error");
    }
}

/* =======================
   OFFDAY CALENDAR
======================= */

function renderCalendar(data) {
    renderRoleCalendar("CS", data, "calendarCS");
    renderRoleCalendar("KAPTEN", data, "calendarKapten");
    renderRoleCalendar("KASIR", data, "calendarKasir");
}

function renderRoleCalendar(role, data, elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;

    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const roleItems = data.filter(item => {
        const itemRole = String(item.role || "").toUpperCase();
        const itemStatus = String(item.status || "").toUpperCase();
        const itemDate = parseOffdayDate(item.tanggal);

        return itemRole === role &&
            itemStatus !== "DITOLAK" &&
            itemDate &&
            itemDate.getFullYear() === year &&
            itemDate.getMonth() === month;
    });

    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

    let html = `
        <div class="offday-calendar-box">
            <div class="offday-calendar-toolbar">
                <button type="button" class="calendar-nav-btn" onclick="changeCalendarMonth(-1)">‹</button>
                <strong>${escapeHtml(formatMonthYear(calendarViewDate))}</strong>
                <button type="button" class="calendar-nav-btn" onclick="changeCalendarMonth(1)">›</button>
            </div>
            <div class="offday-calendar-grid">
    `;

    dayNames.forEach(dayName => {
        html += `<div class="calendar-weekday">${dayName}</div>`;
    });

    for (let blank = 0; blank < firstDay; blank++) {
        html += `<div class="calendar-day empty"></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
        const dayItems = roleItems.filter(item => {
            const itemDate = parseOffdayDate(item.tanggal);
            return itemDate && itemDate.getDate() === day;
        });

        let stateClass = "";
        if (dayItems.length === 1) stateClass = "has-off";
        if (dayItems.length >= 2) stateClass = "full";

        const countBadge = dayItems.length > 0
            ? `<span class="calendar-count">${dayItems.length}</span>`
            : "";

        html += `
            <button
                type="button"
                class="calendar-day ${stateClass}"
                onclick="showCalendarDayDetail('${role}', ${year}, ${month}, ${day})"
                ${dayItems.length === 0 ? "disabled" : ""}
            >
                <span>${day}</span>
                ${countBadge}
            </button>
        `;
    }

    html += `</div></div>`;
    container.innerHTML = html;
}

function changeCalendarMonth(offset) {
    calendarViewDate = new Date(
        calendarViewDate.getFullYear(),
        calendarViewDate.getMonth() + Number(offset),
        1
    );

    renderCalendar(offdayData);
}

function showCalendarDayDetail(role, year, month, day) {
    const selectedItems = offdayData.filter(item => {
        const itemRole = String(item.role || "").toUpperCase();
        const itemStatus = String(item.status || "").toUpperCase();
        const itemDate = parseOffdayDate(item.tanggal);

        return itemRole === role &&
            itemStatus !== "DITOLAK" &&
            itemDate &&
            itemDate.getFullYear() === Number(year) &&
            itemDate.getMonth() === Number(month) &&
            itemDate.getDate() === Number(day);
    });

    if (selectedItems.length === 0) return;

    const modal = document.getElementById("calendarDetailModal");
    const title = document.getElementById("calendarDetailTitle");
    const body = document.getElementById("calendarDetailBody");

    title.textContent = `${role} — ${formatDisplayDate(new Date(year, month, day))}`;

    body.innerHTML = selectedItems.map(item => `
        <div class="calendar-detail-item">
            <div class="calendar-detail-name">${escapeHtml(item.nama || "-")}</div>
            <div class="calendar-detail-meta">
                <span>Shift: ${escapeHtml(item.shift || "-")}</span>
                <span>Status: ${escapeHtml(item.status || "-")}</span>
            </div>
            <div class="calendar-detail-reason">${escapeHtml(item.alasan || "-")}</div>
        </div>
    `).join("");

    modal.style.display = "flex";
}

function closeCalendarDetailModal() {
    const modal = document.getElementById("calendarDetailModal");
    if (modal) modal.style.display = "none";
}

function createCalendarDetailModal() {
    if (document.getElementById("calendarDetailModal")) return;

    const modal = document.createElement("div");
    modal.id = "calendarDetailModal";
    modal.className = "calendar-detail-modal";

    modal.innerHTML = `
        <div class="calendar-detail-panel">
            <div class="calendar-detail-header">
                <h3 id="calendarDetailTitle">Detail Offday</h3>
                <button type="button" class="calendar-detail-close" onclick="closeCalendarDetailModal()">×</button>
            </div>
            <div id="calendarDetailBody"></div>
        </div>
    `;

    modal.addEventListener("click", event => {
        if (event.target === modal) closeCalendarDetailModal();
    });

    document.body.appendChild(modal);
}

function injectCalendarStyles() {
    if (document.getElementById("offdayCalendarStyles")) return;

    const style = document.createElement("style");
    style.id = "offdayCalendarStyles";
    style.textContent = `
        .offday-calendar-box{width:100%;padding:14px;border:1px solid #334155;border-radius:12px;background:#111827;color:#f8fafc}
        .offday-calendar-toolbar{display:grid;grid-template-columns:36px 1fr 36px;align-items:center;gap:8px;margin-bottom:12px;text-align:center}
        .offday-calendar-toolbar strong{color:#fff;font-size:14px;text-transform:capitalize}
        .calendar-nav-btn{min-height:34px!important;padding:4px 8px!important;border:1px solid #475569!important;border-radius:7px!important;background:#1e293b!important;color:#fff!important;font-size:22px!important;line-height:1!important;cursor:pointer!important}
        .offday-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(32px,1fr));gap:6px}
        .calendar-weekday{padding:7px 2px;color:#94a3b8;text-align:center;font-size:11px;font-weight:700}
        .calendar-day{position:relative;min-height:42px!important;padding:5px!important;border:1px solid #334155!important;border-radius:8px!important;background:#172033!important;color:#f8fafc!important;cursor:pointer!important}
        .calendar-day:not(:disabled):hover{border-color:#60a5fa!important;background:#253752!important}
        .calendar-day:disabled{cursor:default!important;opacity:1!important}
        .calendar-day.empty{border-color:transparent!important;background:transparent!important}
        .calendar-day.has-off{border-color:#2563eb!important;background:#1d4ed8!important;color:#fff!important}
        .calendar-day.full{border-color:#ef4444!important;background:#dc2626!important;color:#fff!important}
        .calendar-count{position:absolute;top:3px;right:5px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:rgba(15,23,42,.75);color:#fff;font-size:10px;line-height:16px}
        .calendar-detail-modal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(2,6,23,.78)}
        .calendar-detail-panel{width:min(520px,100%);max-height:80vh;overflow-y:auto;padding:20px;border:1px solid #475569;border-radius:12px;background:#1e293b;color:#f8fafc;box-shadow:0 20px 50px rgba(0,0,0,.4)}
        .calendar-detail-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:15px}
        .calendar-detail-header h3{margin:0;color:#fff}
        .calendar-detail-close{min-height:34px!important;padding:3px 10px!important;background:#dc2626!important;color:#fff!important;font-size:20px!important}
        .calendar-detail-item{padding:14px;margin-bottom:10px;border:1px solid #334155;border-radius:9px;background:#111827}
        .calendar-detail-name{margin-bottom:7px;color:#fff;font-weight:800}
        .calendar-detail-meta{display:flex;flex-wrap:wrap;gap:8px 14px;margin-bottom:8px;color:#cbd5e1;font-size:12px}
        .calendar-detail-reason{color:#e2e8f0;line-height:1.45}
    `;

    document.head.appendChild(style);
}
