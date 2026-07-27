const API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

const currentUser = getLoginUser();
const currentSystemRole = String(currentUser?.role || "").toUpperCase();
const currentUsername = String(currentUser?.username || "").trim();

let bandingData = [];
let staffProfile = null;
let pendingRow = null;
let bandingActiveStatusTab = "";

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
    if (typeof ocToast !== "function") return;
    ocToast(type === "error" ? "Gagal" : "Berhasil", message || "Proses selesai.", { duration: 3500 });
}

document.addEventListener("DOMContentLoaded", () => {
    ["bandingSubmitModal"].forEach(id => {
        const modal = document.getElementById(id);
        modal?.addEventListener("click", event => {
            if (event.target === modal) modal.style.display = "none";
        });
    });

    const tbody = document.getElementById("dataBanding");
    if (tbody && typeof ocSkeletonRows === "function") {
        tbody.innerHTML = ocSkeletonRows(8);
    }

    loadBanding();
    loadStaffProfile();

    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
        await loadBanding();
        showToast("Data berhasil diperbarui.");
    });

    document.getElementById("btnSubmitBanding")?.addEventListener("click", submitBanding);
    document.getElementById("searchBanding")?.addEventListener("input", renderBandingTable);

    document.querySelectorAll(".rk-status-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".rk-status-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            bandingActiveStatusTab = tab.dataset.status || "";
            renderBandingTable();
        });
    });
});

/* ==========================================================
   MODAL
========================================================== */

function openBandingSubmitModal() {
    const modal = document.getElementById("bandingSubmitModal");
    if (modal) { modal.style.display = "flex"; modal.setAttribute("aria-hidden", "false"); }
}

function closeBandingSubmitModal() {
    const modal = document.getElementById("bandingSubmitModal");
    if (modal) { modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
}

function closeBandingDetailModal() {
    const modal = document.getElementById("bandingDetailModal");
    if (modal) { modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
}

function closeBandingRejectModal() {
    pendingRow = null;
    const modal = document.getElementById("bandingRejectModal");
    if (modal) { modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
}

function closeBandingDoneModal() {
    pendingRow = null;
    const modal = document.getElementById("bandingDoneModal");
    if (modal) { modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
}

function openBandingNoteModal(row) {
    pendingRow = row;
    document.getElementById("bandingNoteText").value = "";
    const modal = document.getElementById("bandingNoteModal");
    if (modal) { modal.style.display = "flex"; modal.setAttribute("aria-hidden", "false"); }
}

function closeBandingNoteModal() {
    pendingRow = null;
    const modal = document.getElementById("bandingNoteModal");
    if (modal) { modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
}

async function confirmBandingNote() {
    const keteranganAudit = document.getElementById("bandingNoteText")?.value.trim() || "";
    if (pendingRow) await processBandingAudit("noteBanding", pendingRow, keteranganAudit);
    closeBandingNoteModal();
}

/* ==========================================================
   PROFIL STAFF OTOMATIS
========================================================== */

async function loadStaffProfile() {
    const display = document.getElementById("staffProfileDisplay");
    const warning = document.getElementById("staffProfileWarning");
    const submitButton = document.getElementById("btnSubmitBanding");

    try {
        const params = new URLSearchParams({ type: "staff", token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (!Array.isArray(result)) return;

        const own = result.find(item =>
            String(item.username || "").trim().toUpperCase() === currentUsername.toUpperCase()
        );

        if (!own) {
            if (display) display.textContent = "-";
            if (warning) {
                warning.hidden = false;
                warning.textContent = `Username "${currentUsername}" tidak ditemukan pada kolom Username di Data Staff. Hubungi MASTER untuk melengkapi data staff terlebih dahulu.`;
            }
            if (submitButton) submitButton.disabled = true;
            return;
        }

        staffProfile = own;

        if (display) {
            display.innerHTML = `<strong>${own.nama}</strong> &middot; ${own.jabatan}`;
        }
    } catch (error) {
        console.error("Gagal memuat data profil staff:", error);
    }
}

/* ==========================================================
   LOAD & RENDER
========================================================== */

async function loadBanding() {
    const tbody = document.getElementById("dataBanding");
    if (tbody && typeof ocSkeletonRows === "function") {
        tbody.innerHTML = ocSkeletonRows(8);
    }

    try {
        const params = new URLSearchParams({ type: "banding", token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (!Array.isArray(result)) {
            if (handleExpiredSession_(result.message)) return;
            throw new Error(result.message || "Format data tidak valid.");
        }

        bandingData = result;
        renderBandingSummary(result);
        renderBandingTable();
    } catch (error) {
        console.error("Gagal memuat data banding:", error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="9">Gagal memuat data.</td></tr>`;
        showToast("Gagal memuat data banding.", "error");
    }
}

function renderBandingSummary(data) {
    const counts = { total: data.length, pending: 0, done: 0, tolak: 0 };

    data.forEach(item => {
        if (item.status === "MENUNGGU") counts.pending++;
        else if (item.status === "DONE") counts.done++;
        else if (item.status === "BANDING DI TOLAK") counts.tolak++;
    });

    setBdText("summaryTotal", counts.total);
    setBdText("summaryPending", counts.pending);
    setBdText("summaryDone", counts.done);
    setBdText("summaryTolak", counts.tolak);

    document.querySelector(".summary-pending")
        ?.classList.toggle("has-pending", counts.pending > 0);
}

function renderBandingTable() {
    const tbody = document.getElementById("dataBanding");
    if (!tbody) return;

    const keyword = String(document.getElementById("searchBanding")?.value || "").trim().toLowerCase();
    const statusFilter = bandingActiveStatusTab;

    const filtered = bandingData.filter(item => {
        const matchesKeyword = !keyword || [item.nama, item.kodeLivechat, item.status]
            .map(value => String(value || "").toLowerCase())
            .join(" ")
            .includes(keyword);

        const matchesStatus = !statusFilter || item.status === statusFilter;
        return matchesKeyword && matchesStatus;
    });

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="9">${bandingData.length ? "Tidak ada data yang sesuai." : "Belum ada banding kesalahan."}</td></tr>`;
        return;
    }

    const canAudit = currentSystemRole === "MASTER" || currentSystemRole === "ADMIN";

    tbody.innerHTML = filtered.map((item, index) => {
        const isOwn = normalizeBdCompare_(item.nama) === normalizeBdCompare_(staffProfile?.nama || "");
        const canDelete = canAudit || (isOwn && item.status === "MENUNGGU");

        const actionButtons = [];
        if (canAudit && item.status === "MENUNGGU") {
            actionButtons.push(`<button type="button" class="rk-action-btn approve" onclick="openBandingDoneModal(${Number(item.row)})">Done</button>`);
            actionButtons.push(`<button type="button" class="rk-action-btn note" onclick="openBandingNoteModal(${Number(item.row)})">Note</button>`);
            actionButtons.push(`<button type="button" class="rk-action-btn reject" onclick="openBandingRejectModal(${Number(item.row)})">Tolak</button>`);
        }
        if (canDelete) {
            actionButtons.push(`<button type="button" class="rk-action-btn delete" onclick="deleteBanding(${Number(item.row)})">Hapus</button>`);
        }

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${bdEscape(item.tanggalKesalahan)}</td>
                <td>${bdEscape(item.nama)}</td>
                <td>${bdEscape(item.kodeLivechat)}</td>
                <td>${bdStatusBadge(item.status)}</td>
                <td>${bdEscape(item.processedBy || "-")}</td>
                <td><button type="button" class="rk-detail-btn" onclick="openBandingDetailModal(${index})" title="Lihat detail">👁</button></td>
                <td><button type="button" class="rk-report-btn" onclick="copyBandingReport(${index})" title="Copy laporan untuk grup auditor">📋 Copy</button></td>
                <td>${actionButtons.length ? actionButtons.join("") : '<span class="rk-muted">-</span>'}</td>
            </tr>
        `;
    }).join("");

    tbody.dataset.filteredIndex = JSON.stringify(filtered.map(item => bandingData.indexOf(item)));
}

function normalizeBdCompare_(value) {
    return String(value || "").trim().toUpperCase();
}

function bdStatusBadge(status) {
    const className = status === "DONE" ? "approved" : status === "BANDING DI TOLAK" ? "rejected" : status === "NOTE" ? "note" : "pending";
    return `<span class="rk-status-badge ${className}">${bdEscape(status)}</span>`;
}

function openBandingDetailModal(filteredIndex) {
    const indexMap = JSON.parse(document.getElementById("dataBanding").dataset.filteredIndex || "[]");
    const item = bandingData[indexMap[filteredIndex]];
    if (!item) return;

    const body = document.getElementById("bandingDetailBody");
    const modal = document.getElementById("bandingDetailModal");
    if (!body || !modal) return;

    body.innerHTML = `
        <div class="calendar-detail-item">
            <div class="calendar-detail-name">${bdEscape(item.nama)} &middot; ${bdEscape(item.role)}</div>
            <p><strong>Tanggal Kesalahan:</strong> ${bdEscape(item.tanggalKesalahan)}</p>
            <p><strong>Kode Livechat:</strong> ${bdEscape(item.kodeLivechat)}</p>
            <p><strong>Link Kesalahan:</strong> ${item.linkKesalahan ? `<a href="${bdEscape(item.linkKesalahan)}" target="_blank" rel="noopener">${bdEscape(item.linkKesalahan)}</a>` : "-"}</p>
            <p><strong>Keterangan Banding:</strong> ${bdEscape(item.keteranganBanding)}</p>
            <p><strong>Lampiran:</strong> ${item.lampiranBanding ? `<a href="${bdEscape(item.lampiranBanding)}" target="_blank" rel="noopener">${bdEscape(item.lampiranBanding)}</a>` : "-"}</p>
            <p><strong>Status:</strong> ${bdStatusBadge(item.status)}</p>
            <p><strong>Keterangan Audit:</strong> ${bdEscape(item.keteranganAudit || "-")}</p>
            <p><strong>Diproses oleh:</strong> ${bdEscape(item.processedBy || "-")} ${item.processedDate ? `(${bdEscape(item.processedDate)})` : ""}</p>
        </div>
    `;

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
}

/* ==========================================================
   SUBMIT
========================================================== */

async function submitBanding() {
    const button = document.getElementById("btnSubmitBanding");

    if (!staffProfile) {
        showToast("Data staff Anda belum ditemukan, tidak bisa mengajukan.", "error");
        return;
    }

    const tanggalKesalahan = document.getElementById("tanggalKesalahan")?.value || "";
    const kodeLivechat = document.getElementById("kodeLivechat")?.value.trim() || "";
    const linkKesalahan = document.getElementById("linkKesalahan")?.value.trim() || "";
    const keteranganBanding = document.getElementById("keteranganBanding")?.value.trim() || "";
    const lampiranBanding = document.getElementById("lampiranBanding")?.value.trim() || "";

    if (!tanggalKesalahan || !kodeLivechat || !keteranganBanding) {
        showToast("Tanggal kesalahan, kode livechat, dan keterangan banding wajib diisi.", "error");
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Mengirim...";
    }

    try {
        const params = new URLSearchParams({
            type: "submitBanding",
            token: getLoginToken(),
            tanggalKesalahan,
            kodeLivechat,
            linkKesalahan,
            keteranganBanding,
            lampiranBanding
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            ["tanggalKesalahan", "kodeLivechat", "linkKesalahan", "keteranganBanding", "lampiranBanding"]
                .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

            closeBandingSubmitModal();
            await loadBanding();
        }
    } catch (error) {
        console.error("Gagal mengirim banding:", error);
        showToast("Gagal mengirim banding.", "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Ajukan Banding";
        }
    }
}

/* ==========================================================
   AUDIT (DONE / TOLAK) & DELETE
========================================================== */

function openBandingDoneModal(row) {
    pendingRow = row;
    document.getElementById("bandingDoneNote").value = "";
    const modal = document.getElementById("bandingDoneModal");
    if (modal) { modal.style.display = "flex"; modal.setAttribute("aria-hidden", "false"); }
}

async function confirmBandingDone() {
    const keteranganAudit = document.getElementById("bandingDoneNote")?.value.trim() || "";
    if (pendingRow) await processBandingAudit("approveBanding", pendingRow, keteranganAudit);
    closeBandingDoneModal();
}

function openBandingRejectModal(row) {
    pendingRow = row;
    document.getElementById("bandingRejectReason").value = "";
    const modal = document.getElementById("bandingRejectModal");
    if (modal) { modal.style.display = "flex"; modal.setAttribute("aria-hidden", "false"); }
}

async function confirmBandingReject() {
    const keteranganAudit = document.getElementById("bandingRejectReason")?.value.trim() || "";

    if (!keteranganAudit) {
        showToast("Keterangan audit wajib diisi untuk menolak banding.", "error");
        return;
    }

    if (pendingRow) await processBandingAudit("rejectBanding", pendingRow, keteranganAudit);
    closeBandingRejectModal();
}

async function processBandingAudit(type, row, keteranganAudit) {
    try {
        const params = new URLSearchParams({ type, row: String(row), token: getLoginToken(), keteranganAudit });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) await loadBanding();
    } catch (error) {
        console.error("Gagal memproses audit:", error);
        showToast("Gagal memproses audit.", "error");
    }
}

async function deleteBanding(row) {
    const confirmed = typeof ocConfirm === "function"
        ? await ocConfirm({ title: "Hapus Banding", message: "Yakin mau hapus data banding ini?" })
        : confirm("Yakin mau hapus data banding ini?");

    if (!confirmed) return;

    try {
        const params = new URLSearchParams({ type: "deleteBanding", row: String(row), token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) await loadBanding();
    } catch (error) {
        console.error("Gagal menghapus banding:", error);
        showToast("Gagal menghapus banding.", "error");
    }
}

/* ==========================================================
   LAPORAN COPY-PASTE (GRUP AUDITOR)
========================================================== */

// Nama situs yang tertulis di laporan grup auditor.
const BANDING_SITUS_NAME = "Togelup";

function copyBandingReport(filteredIndex) {
    const indexMap = JSON.parse(document.getElementById("dataBanding").dataset.filteredIndex || "[]");
    const item = bandingData[indexMap[filteredIndex]];
    if (!item) return;

    const text =
`Situs : ${BANDING_SITUS_NAME}
Tanggal : ${formatBandingLongDate_(item.tanggalKesalahan)}
${item.nama} - ${getStaffPassportForBanding_(item.nama)}
Lampiran Kesalahan :
${item.linkKesalahan || "-"}

Banding : 
${item.keteranganBanding}

Lampiran Banding :
${item.lampiranBanding || ""}`;

    copyBdToClipboard(text, "Laporan grup auditor disalin.");
}

function getStaffPassportForBanding_(nama) {
    if (staffProfile && normalizeBdCompare_(staffProfile.nama) === normalizeBdCompare_(nama)) {
        return staffProfile.passport || "-";
    }
    return "-";
}

/**
 * Format tanggal panjang gaya Inggris (mis. "22 July 2026"), sesuai
 * contoh laporan grup auditor. Menerima tanggal format DD/MM/YYYY
 * dari kolom tanggalKesalahan.
 */
function formatBandingLongDate_(ddmmyyyy) {
    const text = String(ddmmyyyy || "").trim();
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return text || "-";

    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    if (isNaN(date.getTime())) return text;

    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function copyBdToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => showToast(successMessage))
            .catch(() => fallbackBdCopy(text, successMessage));
    } else {
        fallbackBdCopy(text, successMessage);
    }
}

function fallbackBdCopy(text, successMessage) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    try {
        document.execCommand("copy");
        showToast(successMessage);
    } catch (error) {
        showToast("Gagal menyalin laporan.", "error");
    }

    document.body.removeChild(textarea);
}

/* ==========================================================
   HELPER
========================================================== */

function setBdText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function bdEscape(value) {
    return String(value ?? "-")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
