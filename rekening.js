const API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

const currentUser = getLoginUser();
const currentSystemRole = String(currentUser?.role || "").toUpperCase();
const currentUsername = String(currentUser?.username || "").trim();

let rekeningData = [];
let staffProfile = null;
let staffPassportMap = {};
let pendingRejectRow = null;
let rekeningActiveStatusTab = "";

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
    const submitModal = document.getElementById("rekeningSubmitModal");
    submitModal?.addEventListener("click", event => {
        if (event.target === submitModal) closeRekeningSubmitModal();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && submitModal?.style.display === "flex") {
            closeRekeningSubmitModal();
        }
    });

    const tbody = document.getElementById("dataRekening");
    if (tbody && typeof ocSkeletonRows === "function") {
        tbody.innerHTML = ocSkeletonRows(8);
    }

    loadRekening();
    loadStaffProfile();

    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
        await loadRekening();
        showToast("Data berhasil diperbarui.");
    });

    document.getElementById("btnSubmitRekening")?.addEventListener("click", submitRekening);
    document.getElementById("searchRekening")?.addEventListener("input", renderRekeningTable);

    document.querySelectorAll(".rk-status-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".rk-status-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            rekeningActiveStatusTab = tab.dataset.status || "";
            renderRekeningTable();
        });
    });
});

/* ==========================================================
   MODAL
========================================================== */

function openRekeningSubmitModal() {
    const modal = document.getElementById("rekeningSubmitModal");
    if (modal) {
        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
    }
}

function closeRekeningSubmitModal() {
    const modal = document.getElementById("rekeningSubmitModal");
    if (modal) {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }
}

/* ==========================================================
   PROFIL STAFF OTOMATIS
========================================================== */

async function loadStaffProfile() {
    const display = document.getElementById("staffProfileDisplay");
    const warning = document.getElementById("staffProfileWarning");
    const submitButton = document.getElementById("btnSubmitRekening");

    try {
        const params = new URLSearchParams({ type: "staff", token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (!Array.isArray(result)) return;

        staffPassportMap = {};
        result.forEach(item => {
            const key = String(item.nama || "").trim().toUpperCase();
            if (key) staffPassportMap[key] = String(item.passport || "-");
        });

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
            display.innerHTML = `<strong>${own.nama}</strong> &middot; ${own.jabatan} &middot; Passport ${own.passport || "-"}`;
        }
    } catch (error) {
        console.error("Gagal memuat data profil staff:", error);
    }
}

/* ==========================================================
   LOAD & RENDER
========================================================== */

async function loadRekening() {
    const tbody = document.getElementById("dataRekening");
    if (tbody && typeof ocSkeletonRows === "function") {
        tbody.innerHTML = ocSkeletonRows(8);
    }

    try {
        const params = new URLSearchParams({ type: "rekening", token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (!Array.isArray(result)) {
            if (handleExpiredSession_(result.message)) return;
            throw new Error(result.message || "Format data tidak valid.");
        }

        rekeningData = result;
        renderRekeningSummary(result);
        renderRekeningTable();
    } catch (error) {
        console.error("Gagal memuat data rekening:", error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="10">Gagal memuat data.</td></tr>`;
        showToast("Gagal memuat data ganti rekening.", "error");
    }
}

function renderRekeningSummary(data) {
    const counts = { total: data.length, pending: 0, approved: 0, rejected: 0 };

    data.forEach(item => {
        if (item.status === "MENUNGGU") counts.pending++;
        else if (item.status === "DISETUJUI") counts.approved++;
        else if (item.status === "DITOLAK") counts.rejected++;
    });

    setRkText("summaryTotal", counts.total);
    setRkText("summaryPending", counts.pending);
    setRkText("summaryApproved", counts.approved);
    setRkText("summaryRejected", counts.rejected);

    document.querySelector(".summary-pending")
        ?.classList.toggle("has-pending", counts.pending > 0);
}

function renderRekeningTable() {
    const tbody = document.getElementById("dataRekening");
    if (!tbody) return;

    const keyword = String(document.getElementById("searchRekening")?.value || "").trim().toLowerCase();
    const statusFilter = rekeningActiveStatusTab;

    const filtered = rekeningData.filter(item => {
        const matchesKeyword = !keyword || [item.nama, item.role, item.status]
            .map(value => String(value || "").toLowerCase())
            .join(" ")
            .includes(keyword);

        const matchesStatus = !statusFilter || item.status === statusFilter;
        return matchesKeyword && matchesStatus;
    });

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="10">${rekeningData.length ? "Tidak ada data yang sesuai." : "Belum ada pengajuan ganti rekening."}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((item, index) => {
        const canApprove = currentSystemRole === "MASTER" && item.status === "MENUNGGU";
        const isOwn = normalizeRkCompare_(item.nama) === normalizeRkCompare_(staffProfile?.nama || "");
        const canDelete = currentSystemRole === "MASTER" || (isOwn && item.status === "MENUNGGU");

        const actionButtons = [];
        if (canApprove) {
            actionButtons.push(`<button type="button" class="rk-action-btn approve" onclick="approveRekening(${Number(item.row)})">Setujui</button>`);
            actionButtons.push(`<button type="button" class="rk-action-btn reject" onclick="openRekeningRejectModal(${Number(item.row)})">Tolak</button>`);
        }
        if (canDelete) {
            actionButtons.push(`<button type="button" class="rk-action-btn delete" onclick="deleteRekening(${Number(item.row)})">Hapus</button>`);
        }

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${rkEscape(item.nama)}</td>
                <td>${rkEscape(item.role)}</td>
                <td class="rk-wrap">${rkEscape(item.bankLama)} / ${rkEscape(item.noRekLama)}<br><small>${rkEscape(item.pemilikLama)}</small></td>
                <td class="rk-wrap">${rkEscape(item.bankBaru)} / ${rkEscape(item.noRekBaru)}<br><small>${rkEscape(item.pemilikBaru)}</small></td>
                <td>${rkStatusBadge(item.status)}</td>
                <td>${rkEscape(item.approvedBy || "-")}</td>
                <td><button type="button" class="rk-detail-btn" onclick="openRekeningDetailModal(${index})" title="Lihat detail">👁</button></td>
                <td><button type="button" class="rk-report-btn" onclick="copyRekeningReport(${index})" title="Copy laporan untuk admin">📋 Copy</button></td>
                <td>${actionButtons.length ? actionButtons.join("") : '<span class="rk-muted">-</span>'}</td>
            </tr>
        `;
    }).join("");

    tbody.dataset.filteredIndex = JSON.stringify(filtered.map(item => rekeningData.indexOf(item)));
}

function normalizeRkCompare_(value) {
    return String(value || "").trim().toUpperCase();
}

function rkStatusBadge(status) {
    const className = status === "DISETUJUI" ? "approved" : status === "DITOLAK" ? "rejected" : "pending";
    return `<span class="rk-status-badge ${className}">${rkEscape(status)}</span>`;
}

function openRekeningDetailModal(filteredIndex) {
    const indexMap = JSON.parse(document.getElementById("dataRekening").dataset.filteredIndex || "[]");
    const item = rekeningData[indexMap[filteredIndex]];
    if (!item) return;

    const body = document.getElementById("rekeningDetailBody");
    const modal = document.getElementById("rekeningDetailModal");
    if (!body || !modal) return;

    body.innerHTML = `
        <div class="calendar-detail-item">
            <div class="calendar-detail-name">${rkEscape(item.nama)} &middot; ${rkEscape(item.role)}</div>
            <p><strong>Rekening Lama:</strong> ${rkEscape(item.bankLama)} / ${rkEscape(item.noRekLama)} / ${rkEscape(item.pemilikLama)}</p>
            <p><strong>Rekening Baru:</strong> ${rkEscape(item.bankBaru)} / ${rkEscape(item.noRekBaru)} / ${rkEscape(item.pemilikBaru)}</p>
            <p><strong>Link Validasi:</strong> ${item.linkValidasi ? `<a href="${rkEscape(item.linkValidasi)}" target="_blank" rel="noopener">${rkEscape(item.linkValidasi)}</a>` : "-"}</p>
            <p><strong>Status:</strong> ${rkStatusBadge(item.status)}</p>
            <p><strong>Diproses oleh:</strong> ${rkEscape(item.approvedBy || "-")} ${item.approvedDate ? `(${rkEscape(item.approvedDate)})` : ""}</p>
            <p><strong>Catatan:</strong> ${rkEscape(item.catatan || "-")}</p>
        </div>
    `;

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
}

function closeRekeningDetailModal() {
    const modal = document.getElementById("rekeningDetailModal");
    if (modal) {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }
}

/* ==========================================================
   SUBMIT
========================================================== */

async function submitRekening() {
    const button = document.getElementById("btnSubmitRekening");

    if (!staffProfile) {
        showToast("Data staff Anda belum ditemukan, tidak bisa mengajukan.", "error");
        return;
    }

    const payload = {
        bankLama: document.getElementById("bankLama")?.value.trim() || "",
        noRekLama: document.getElementById("noRekLama")?.value.trim() || "",
        pemilikLama: document.getElementById("pemilikLama")?.value.trim() || "",
        bankBaru: document.getElementById("bankBaru")?.value.trim() || "",
        noRekBaru: document.getElementById("noRekBaru")?.value.trim() || "",
        pemilikBaru: document.getElementById("pemilikBaru")?.value.trim() || "",
        linkValidasi: document.getElementById("linkValidasi")?.value.trim() || ""
    };

    if (Object.values(payload).some(value => !value)) {
        showToast("Semua data rekening lama, baru, dan link validasi wajib diisi.", "error");
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Mengirim...";
    }

    try {
        const params = new URLSearchParams({
            type: "submitRekening",
            token: getLoginToken(),
            ...payload
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            ["bankLama", "noRekLama", "pemilikLama", "bankBaru", "noRekBaru", "pemilikBaru", "linkValidasi"]
                .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

            closeRekeningSubmitModal();
            await loadRekening();
        }
    } catch (error) {
        console.error("Gagal mengirim pengajuan ganti rekening:", error);
        showToast("Gagal mengirim pengajuan.", "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Ajukan Ganti Rekening";
        }
    }
}

/* ==========================================================
   APPROVE / REJECT / DELETE
========================================================== */

async function approveRekening(row) {
    await processRekeningApproval("approveRekening", row, "");
}

function openRekeningRejectModal(row) {
    pendingRejectRow = row;
    document.getElementById("rekeningRejectReason").value = "";
    const modal = document.getElementById("rekeningRejectModal");
    if (modal) {
        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
    }
}

function closeRekeningRejectModal() {
    pendingRejectRow = null;
    const modal = document.getElementById("rekeningRejectModal");
    if (modal) {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }
}

async function confirmRekeningReject() {
    const catatan = document.getElementById("rekeningRejectReason")?.value.trim() || "";

    if (!catatan) {
        showToast("Alasan penolakan wajib diisi.", "error");
        return;
    }

    if (pendingRejectRow) {
        await processRekeningApproval("rejectRekening", pendingRejectRow, catatan);
    }

    closeRekeningRejectModal();
}

async function processRekeningApproval(type, row, catatan) {
    try {
        const params = new URLSearchParams({ type, row: String(row), token: getLoginToken(), catatan });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) await loadRekening();
    } catch (error) {
        console.error("Gagal memproses pengajuan:", error);
        showToast("Gagal memproses pengajuan.", "error");
    }
}

async function deleteRekening(row) {
    const confirmed = typeof ocConfirm === "function"
        ? await ocConfirm({ title: "Hapus Pengajuan", message: "Yakin mau hapus pengajuan ganti rekening ini?" })
        : confirm("Yakin mau hapus pengajuan ini?");

    if (!confirmed) return;

    try {
        const params = new URLSearchParams({ type: "deleteRekening", row: String(row), token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) await loadRekening();
    } catch (error) {
        console.error("Gagal menghapus pengajuan:", error);
        showToast("Gagal menghapus pengajuan.", "error");
    }
}

/* ==========================================================
   LAPORAN COPY-PASTE
========================================================== */

function copyRekeningReport(filteredIndex) {
    const indexMap = JSON.parse(document.getElementById("dataRekening").dataset.filteredIndex || "[]");
    const item = rekeningData[indexMap[filteredIndex]];
    if (!item) return;

    const text =
`NO PASPOR : ${getStaffPassport_(item.nama)}
NAMA STAFF : ${item.nama}

NO REK SEBELUM NYA : ${item.bankLama} / ${item.noRekLama}
BANK/NO REKENING/NAMA PEMILIK REK : ${item.pemilikLama}

GANTI/NO REK TERBARUNYA : ${item.bankBaru} / ${item.noRekBaru}
NAMA BANK/NAMA PEMILIK REK : ${item.pemilikBaru}`;

    copyRkToClipboard(text, "Laporan ganti rekening disalin.");
}

function getStaffPassport_(nama) {
    return staffPassportMap[normalizeRkCompare_(nama)] || "-";
}

function copyRkToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => showToast(successMessage))
            .catch(() => fallbackRkCopy(text, successMessage));
    } else {
        fallbackRkCopy(text, successMessage);
    }
}

function fallbackRkCopy(text, successMessage) {
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

function setRkText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function rkEscape(value) {
    return String(value ?? "-")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
