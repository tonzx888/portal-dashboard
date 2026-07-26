const API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

// Kuota maksimal staff per role yang boleh cuti bersamaan.
// Samakan angka ini dengan CUTI_ROLE_CONCURRENT_QUOTA di Cuti.gs
// kalau nanti diubah, supaya warna "penuh" di kalender konsisten.
const CUTI_ROLE_QUOTA = { CS: 2, KAPTEN: 1, KASIR: 2 };

let cutiCalendarData = [];
let cutiListData = [];
let calendarViewDate = new Date();

document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("dataCuti");
    if (tbody && typeof ocSkeletonRows === "function") {
        tbody.innerHTML = ocSkeletonRows(6);
    }

    if (typeof ocInitCustomSelect === "function") {
        ocInitCustomSelect(document.getElementById("filterCutiStatus"));
    }

    loadCutiCalendar();

    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
        await loadCutiCalendar();
        showCutiToast("Data berhasil diperbarui.");
    });

    document.getElementById("calendarPrev")?.addEventListener("click", () => changeCutiMonth(-1));
    document.getElementById("calendarNext")?.addEventListener("click", () => changeCutiMonth(1));
    document.getElementById("cutiSearch")?.addEventListener("input", renderCutiList);
    document.getElementById("filterCutiStatus")?.addEventListener("change", renderCutiList);
});

function showCutiToast(message, type = "success") {
    if (typeof ocToast === "function") {
        ocToast(type === "error" ? "Gagal" : "Berhasil", message, { duration: 3200 });
    }
}

function handleCutiExpiredSession_(message) {
    const text = String(message || "").toLowerCase();
    const isExpired = text.includes("sesi tidak valid") || text.includes("login ulang");

    if (isExpired) {
        alert("Sesi Anda sudah berakhir. Silakan login ulang.");
        localStorage.removeItem("loginUser");
        window.location.href = "login.html";
    }

    return isExpired;
}

async function loadCutiCalendar() {
    try {
        const params = new URLSearchParams({ type: "cutiCalendar", token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (!Array.isArray(result)) {
            if (handleCutiExpiredSession_(result.message)) return;
            throw new Error(result.message || "Format data tidak valid.");
        }

        cutiCalendarData = result;
        cutiListData = result;

        renderCutiSummary(result);
        renderCalendar();
        renderCutiList();
    } catch (error) {
        console.error("Gagal memuat kalender cuti:", error);
        const tbody = document.getElementById("dataCuti");
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="cuti-loading">Gagal memuat data cuti.</td></tr>`;
        showCutiToast("Gagal memuat data cuti.", "error");
    }
}

/* ==========================================================
   RINGKASAN
========================================================== */

function renderCutiSummary(data) {
    const today = startOfCutiVisualDay_(new Date());
    let active = 0, upcoming = 0, done = 0;

    data.forEach(item => {
        if (item.status === "DITOLAK") return;

        const start = parseCutiVisualDate_(item.tanggalMulaiInput);
        const end = parseCutiVisualDate_(item.tanggalSelesaiInput);
        if (!start || !end) return;

        if (today >= start && today <= end) active++;
        else if (today < start) upcoming++;
        else done++;
    });

    setCutiVisualText("cutiTotal", data.length);
    setCutiVisualText("cutiActive", active);
    setCutiVisualText("cutiUpcoming", upcoming);
    setCutiVisualText("cutiDone", done);
}

/* ==========================================================
   KALENDER VISUAL PER ROLE
========================================================== */

function changeCutiMonth(offset) {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + offset, 1);
    renderCalendar();
}

function renderCalendar() {
    const monthLabel = document.getElementById("calendarMonthLabel");
    if (monthLabel) monthLabel.textContent = formatCutiMonthYear_(calendarViewDate);

    ["CS", "KAPTEN", "KASIR"].forEach(role => renderRoleCalendar(role));
}

function renderRoleCalendar(role) {
    const container = document.querySelector(`#calendar${role} .calendar-body`);
    if (!container) return;

    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = firstDay.getDay();

    const activeItems = cutiCalendarData.filter(item =>
        String(item.role || "").toUpperCase() === role && item.status !== "DITOLAK"
    );

    let html = `
        <div class="calendar-weekday">Min</div><div class="calendar-weekday">Sen</div>
        <div class="calendar-weekday">Sel</div><div class="calendar-weekday">Rab</div>
        <div class="calendar-weekday">Kam</div><div class="calendar-weekday">Jum</div>
        <div class="calendar-weekday">Sab</div>
    `;

    for (let i = 0; i < firstDayIndex; i++) {
        html += `<div class="calendar-day outside"></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
        const cellDate = startOfCutiVisualDay_(new Date(year, month, day));

        const dayItems = activeItems.filter(item => {
            const start = parseCutiVisualDate_(item.tanggalMulaiInput);
            const end = parseCutiVisualDate_(item.tanggalSelesaiInput);
            return start && end && cellDate >= start && cellDate <= end;
        });

        const quota = CUTI_ROLE_QUOTA[role] || 1;
        const isFull = dayItems.length >= quota;
        const hasData = dayItems.length > 0;

        const stateClass = !hasData ? "" : isFull ? "full" : "has-off";

        html += `
            <button
                type="button"
                class="calendar-day ${stateClass}"
                ${hasData ? "" : "disabled"}
                title="${role}, ${day} ${formatCutiMonthYear_(calendarViewDate)} — ${hasData ? dayItems.length + " orang cuti" : "Tidak ada cuti"}"
                onclick="showCutiDayDetail('${role}', ${year}, ${month}, ${day})"
            >
                <span class="calendar-day-number">${day}</span>
                ${dayItems.length > 1 ? `<small>${dayItems.length}</small>` : ""}
            </button>
        `;
    }

    container.innerHTML = html;
}

function showCutiDayDetail(role, year, month, day) {
    const cellDate = startOfCutiVisualDay_(new Date(year, month, day));

    const items = cutiCalendarData.filter(item => {
        if (String(item.role || "").toUpperCase() !== role || item.status === "DITOLAK") return false;
        const start = parseCutiVisualDate_(item.tanggalMulaiInput);
        const end = parseCutiVisualDate_(item.tanggalSelesaiInput);
        return start && end && cellDate >= start && cellDate <= end;
    });

    const modal = document.getElementById("cutiDayDetailModal");
    const title = document.getElementById("cutiDayDetailTitle");
    const body = document.getElementById("cutiDayDetailBody");
    if (!modal || !title || !body) return;

    title.textContent = `${role} — ${day} ${formatCutiMonthYear_(calendarViewDate)}`;

    const quota = CUTI_ROLE_QUOTA[role] || 1;
    const warning = items.length >= quota
        ? `<p class="cuti-detail-warning">⚠️ Kuota role ${role} pada tanggal ini sudah penuh (${items.length}/${quota}).</p>`
        : "";

    body.innerHTML = warning + (items.length ? items.map(item => `
        <div class="calendar-detail-item">
            <div class="calendar-detail-name">${cutiVisualEscape(item.nama)}</div>
            <div class="calendar-detail-meta">
                <span>${cutiVisualEscape(item.jenisCuti)}</span>
                <span>${cutiVisualEscape(item.tanggalMulai)} &ndash; ${cutiVisualEscape(item.tanggalSelesai)}</span>
                <span>${cutiVisualEscape(item.status)}</span>
            </div>
            <div class="calendar-detail-reason">${cutiVisualEscape(item.alasan)}</div>
        </div>
    `).join("") : `<p class="cuti-detail-empty">Tidak ada staff ${role} yang cuti pada tanggal ini.</p>`);

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
}

function closeCutiDayDetail() {
    const modal = document.getElementById("cutiDayDetailModal");
    if (modal) {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }
}

/* ==========================================================
   DAFTAR CUTI (TABEL)
========================================================== */

function renderCutiList() {
    const tbody = document.getElementById("dataCuti");
    if (!tbody) return;

    const keyword = String(document.getElementById("cutiSearch")?.value || "").trim().toLowerCase();
    const statusFilter = document.getElementById("filterCutiStatus")?.value || "";

    const filtered = cutiListData.filter(item => {
        const matchesKeyword = !keyword || [item.nama, item.role, item.jenisCuti, item.status]
            .map(value => String(value || "").toLowerCase())
            .join(" ")
            .includes(keyword);

        const matchesStatus = !statusFilter || item.status === statusFilter;
        return matchesKeyword && matchesStatus;
    });

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="cuti-loading">${cutiListData.length ? "Tidak ada data yang sesuai pencarian." : "Belum ada data cuti."}</td></tr>`;
        return;
    }

    const sorted = [...filtered].sort((a, b) => {
        const dateA = parseCutiVisualDate_(a.tanggalMulaiInput);
        const dateB = parseCutiVisualDate_(b.tanggalMulaiInput);
        return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
    });

    tbody.innerHTML = sorted.map(item => `
        <tr>
            <td>${cutiVisualEscape(item.nama)} ${item.urgent ? '<span class="cuti-urgent-badge">URGENT</span>' : ""}</td>
            <td>${cutiVisualEscape(item.role)}</td>
            <td>${cutiVisualEscape(item.jenisCuti)}</td>
            <td>${cutiVisualEscape(item.tanggalMulai)} &ndash; ${cutiVisualEscape(item.tanggalSelesai)}</td>
            <td>${cutiVisualEscape(item.totalHari)}</td>
            <td><span class="cuti-status-badge ${item.status === "DISETUJUI" ? "approved" : item.status === "DITOLAK" ? "rejected" : "pending"}">${cutiVisualEscape(item.status)}</span></td>
        </tr>
    `).join("");
}

/* ==========================================================
   HELPER
========================================================== */

function startOfCutiVisualDay_(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseCutiVisualDate_(value) {
    const text = String(value || "").trim();
    if (!text) return null;

    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;

    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatCutiMonthYear_(date) {
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function setCutiVisualText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function cutiVisualEscape(value) {
    return String(value ?? "-")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
