const API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

const currentUser = getLoginUser();
const currentSystemRole = String(currentUser?.role || "").toUpperCase();
const currentUsername = String(currentUser?.username || "").trim();

// Nama Leader yang mengisi kolom "ACC LDR" di laporan copy-paste.
// Ganti di sini kalau Leader-nya berbeda.
const CUTI_LEADER_NAME = "ANTHONY";

let cutiData = [];
let staffPassportMap = {};
let pendingRejectRow = null;

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

/**
 * showToast lokal, memakai sistem toast bersama (ocToast di ui.js)
 * supaya tidak perlu markup #toast khusus di halaman ini.
 */
function showToast(message, type = "success") {
    if (typeof ocToast !== "function") return;

    ocToast(
        type === "error" ? "Gagal" : "Berhasil",
        message || "Proses selesai.",
        { duration: 3500 }
    );
}

document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("dataCuti");
    if (tbody && typeof ocSkeletonRows === "function") {
        tbody.innerHTML = ocSkeletonRows(12);
    }

    if (typeof ocInitCustomSelect === "function") {
        ocInitCustomSelect(document.getElementById("role"));
        ocInitCustomSelect(document.getElementById("jenisCuti"));
        ocInitCustomSelect(document.getElementById("filterStatus"));
    }

    document.getElementById("nama") && (document.getElementById("nama").value = currentUsername);

    loadCuti();
    loadEligibility();
    loadStaffPassportMap();

    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
        await Promise.all([loadCuti(), loadEligibility()]);
        showToast("Data berhasil diperbarui.");
    });

    document.getElementById("btnSubmitCuti")?.addEventListener("click", submitCuti);
    document.getElementById("searchCuti")?.addEventListener("input", renderCutiTable);
    document.getElementById("filterStatus")?.addEventListener("change", renderCutiTable);

    document.getElementById("urgentToggle")?.addEventListener("change", event => {
        document.querySelector(".cuti-urgent-box")
            ?.classList.toggle("is-urgent", event.target.checked);
    });
});

/**
 * Info kapan boleh mengajukan cuti reguler berikutnya, dari
 * riwayat cuti terakhir (gabungan data lama + baru).
 */
async function loadEligibility() {
    const banner = document.getElementById("eligibilityBanner");
    if (!banner) return;

    try {
        const params = new URLSearchParams({ type: "cutiEligibility", token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;
        if (!result.success) return;

        banner.hidden = false;

        if (!result.hasHistory) {
            banner.className = "cuti-eligibility-banner neutral";
            banner.textContent = "Belum ada riwayat cuti sebelumnya. Cuti reguler boleh diajukan (syarat masa kerja minimal 1 tahun tetap berlaku).";
            return;
        }

        banner.className = "cuti-eligibility-banner info";
        banner.innerHTML = `Cuti terakhir berakhir <strong>${escapeCutiHtml(result.lastCutiEnd)}</strong> — cuti reguler berikutnya boleh diajukan mulai <strong>${escapeCutiHtml(result.nextEligibleDate)}</strong>. Butuh lebih cepat? Aktifkan <em>Cuti Urgent</em>.`;
    } catch (error) {
        console.error("Gagal memuat info kelayakan cuti:", error);
    }
}

async function loadStaffPassportMap() {
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
    } catch (error) {
        console.error("Gagal memuat data passport staff:", error);
    }
}

async function loadCuti() {
    const tbody = document.getElementById("dataCuti");
    if (tbody && typeof ocSkeletonRows === "function") {
        tbody.innerHTML = ocSkeletonRows(12);
    }

    try {
        const params = new URLSearchParams({ type: "cuti", token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (!Array.isArray(result)) {
            if (handleExpiredSession_(result.message)) return;
            throw new Error(result.message || "Format data tidak valid.");
        }

        cutiData = result;
        renderCutiSummary(result);
        renderCutiTable();
    } catch (error) {
        console.error("Gagal memuat data cuti:", error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="12">Gagal memuat data cuti.</td></tr>`;
        showToast("Gagal memuat data cuti.", "error");
    }
}

function renderCutiSummary(data) {
    const counts = { total: data.length, pending: 0, approved: 0, rejected: 0 };

    data.forEach(item => {
        if (item.status === "MENUNGGU") counts.pending++;
        else if (item.status === "DISETUJUI") counts.approved++;
        else if (item.status === "DITOLAK") counts.rejected++;
    });

    setCutiText("summaryTotal", counts.total);
    setCutiText("summaryPending", counts.pending);
    setCutiText("summaryApproved", counts.approved);
    setCutiText("summaryRejected", counts.rejected);

    document.querySelector(".summary-pending")
        ?.classList.toggle("has-pending", counts.pending > 0);
}

function renderCutiTable() {
    const tbody = document.getElementById("dataCuti");
    if (!tbody) return;

    const keyword = String(document.getElementById("searchCuti")?.value || "").trim().toLowerCase();
    const statusFilter = document.getElementById("filterStatus")?.value || "";

    const filtered = cutiData.filter(item => {
        const matchesKeyword = !keyword || [item.nama, item.role, item.status, item.jenisCuti]
            .map(value => String(value || "").toLowerCase())
            .join(" ")
            .includes(keyword);

        const matchesStatus = !statusFilter || item.status === statusFilter;

        return matchesKeyword && matchesStatus;
    });

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="12">${cutiData.length ? "Tidak ada data yang sesuai." : "Belum ada pengajuan cuti."}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((item, index) => {
        const canApprove = currentSystemRole === "MASTER" && item.status === "MENUNGGU";

        const actionCell = currentSystemRole === "MASTER"
            ? `<td>
                ${canApprove ? `
                    <button type="button" class="cuti-action-btn approve" onclick="approveCuti(${Number(item.row)})">Setujui</button>
                    <button type="button" class="cuti-action-btn reject" onclick="openCutiRejectModal(${Number(item.row)})">Tolak</button>
                ` : `<span class="cuti-muted">Selesai</span>`}
               </td>`
            : "";

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeCutiHtml(item.nama)} ${item.urgent ? '<span class="cuti-urgent-badge">URGENT</span>' : ""}</td>
                <td>${escapeCutiHtml(item.role)}</td>
                <td>${escapeCutiHtml(item.jenisCuti)}</td>
                <td>${escapeCutiHtml(item.tanggalMulai)} &ndash; ${escapeCutiHtml(item.tanggalSelesai)}</td>
                <td>${escapeCutiHtml(item.totalHari)}</td>
                <td class="cuti-wrap">${escapeCutiHtml(item.alasan)}</td>
                <td>${cutiStatusBadge(item.status)}</td>
                <td>${escapeCutiHtml(item.approvedBy || "-")}</td>
                <td class="cuti-wrap">${escapeCutiHtml(item.catatan || "-")}</td>
                <td class="cuti-report-cell">
                    <button type="button" class="cuti-report-btn" onclick="copyCutiReportA(${index})" title="Copy laporan untuk task checker admin">📋 Task</button>
                    <button type="button" class="cuti-report-btn" onclick="copyCutiReportB(${index})" title="Copy laporan untuk grup admin">📋 Grup</button>
                </td>
                ${actionCell}
            </tr>
        `;
    }).join("");

    tbody.dataset.filteredIndex = JSON.stringify(filtered.map(item => cutiData.indexOf(item)));
}

function cutiStatusBadge(status) {
    const className = status === "DISETUJUI" ? "approved" : status === "DITOLAK" ? "rejected" : "pending";
    return `<span class="cuti-status-badge ${className}">${escapeCutiHtml(status)}</span>`;
}

async function submitCuti() {
    const button = document.getElementById("btnSubmitCuti");
    const role = document.getElementById("role")?.value || "";
    const jenisCuti = document.getElementById("jenisCuti")?.value || "";
    const tanggalMulai = document.getElementById("tanggalMulai")?.value || "";
    const tanggalSelesai = document.getElementById("tanggalSelesai")?.value || "";
    const alasan = document.getElementById("alasan")?.value.trim() || "";
    const urgent = document.getElementById("urgentToggle")?.checked || false;

    if (!role || !jenisCuti || !tanggalMulai || !tanggalSelesai || !alasan) {
        showToast("Role, jenis cuti, tanggal, dan alasan wajib diisi.", "error");
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Mengirim...";
    }

    try {
        const params = new URLSearchParams({
            type: "submitCuti",
            token: getLoginToken(),
            role,
            jenisCuti,
            tanggalMulai,
            tanggalSelesai,
            alasan,
            urgent: String(urgent)
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            document.getElementById("role").value = "";
            document.getElementById("jenisCuti").value = "";
            document.getElementById("tanggalMulai").value = "";
            document.getElementById("tanggalSelesai").value = "";
            document.getElementById("alasan").value = "";
            document.getElementById("urgentToggle").checked = false;
            document.querySelector(".cuti-urgent-box")?.classList.remove("is-urgent");

            if (typeof ocRefreshCustomSelect === "function") {
                ocRefreshCustomSelect(document.getElementById("role"));
                ocRefreshCustomSelect(document.getElementById("jenisCuti"));
            }

            await Promise.all([loadCuti(), loadEligibility()]);
        }
    } catch (error) {
        console.error("Gagal mengirim pengajuan cuti:", error);
        showToast("Gagal mengirim pengajuan cuti.", "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Ajukan Cuti";
        }
    }
}

async function approveCuti(row) {
    await processCutiApproval("approveCuti", row, "");
}

function openCutiRejectModal(row) {
    pendingRejectRow = row;
    document.getElementById("cutiRejectReason").value = "";
    const modal = document.getElementById("cutiRejectModal");
    if (modal) {
        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
    }
}

function closeCutiRejectModal() {
    pendingRejectRow = null;
    const modal = document.getElementById("cutiRejectModal");
    if (modal) {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }
}

async function confirmCutiReject() {
    const catatan = document.getElementById("cutiRejectReason")?.value.trim() || "";

    if (!catatan) {
        showToast("Alasan penolakan wajib diisi.", "error");
        return;
    }

    if (pendingRejectRow) {
        await processCutiApproval("rejectCuti", pendingRejectRow, catatan);
    }

    closeCutiRejectModal();
}

async function processCutiApproval(type, row, catatan) {
    try {
        const params = new URLSearchParams({
            type,
            row: String(row),
            token: getLoginToken(),
            catatan
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            await loadCuti();
        }
    } catch (error) {
        console.error("Gagal memproses persetujuan cuti:", error);
        showToast("Gagal memproses persetujuan cuti.", "error");
    }
}

/* ==========================================================
   GENERATOR LAPORAN COPY-PASTE
========================================================== */

function getPassportFor(nama) {
    const key = String(nama || "").trim().toUpperCase();
    return staffPassportMap[key] || "-";
}

function copyCutiReportA(filteredIndex) {
    const indexMap = JSON.parse(document.getElementById("dataCuti").dataset.filteredIndex || "[]");
    const item = cutiData[indexMap[filteredIndex]];
    if (!item) return;

    const text =
`PENGAJUAN CUTI : ${item.jenisCuti}
NO PASPOR : ${getPassportFor(item.nama)}
NAMA STAFF : ${item.nama}
STATUS: ${item.status}


START CUTI S/D : ${item.tanggalMulai} S/D ${item.tanggalSelesai}
TOTAL CUTI : ${item.totalHari} HARI

ACC LDR : ${CUTI_LEADER_NAME}`;

    copyCutiToClipboard(text, "Laporan task checker disalin.");
}

function copyCutiReportB(filteredIndex) {
    const indexMap = JSON.parse(document.getElementById("dataCuti").dataset.filteredIndex || "[]");
    const item = cutiData[indexMap[filteredIndex]];
    if (!item) return;

    const text =
`Info : 
Perihal : ${item.jenisCuti}
NO PASPOR : ${getPassportFor(item.nama)}
NAMA STAFF : ${item.nama}
START CUTI S/D : ${item.tanggalMulai} S/D ${item.tanggalSelesai}
TOTAL CUTI : ${item.totalHari} hari
Ket : 
Keterangan : Untuk kelengkapan SIM CARD dan token sudah di check aman. Untuk admin, dan email sudah serah terima ke Leader. Untuk passport sudah berada di tangan staff.`;

    copyCutiToClipboard(text, "Laporan grup admin disalin.");
}

function copyCutiToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => showToast(successMessage))
            .catch(() => fallbackCutiCopy(text, successMessage));
    } else {
        fallbackCutiCopy(text, successMessage);
    }
}

function fallbackCutiCopy(text, successMessage) {
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

function setCutiText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function escapeCutiHtml(value) {
    return String(value ?? "-")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
