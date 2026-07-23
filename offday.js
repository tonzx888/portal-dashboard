const API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

let offdayData = [];
let toastTimer = null;

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

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

document.addEventListener("DOMContentLoaded", () => {
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
        submissionCard.style.display = "none";
        tableTitle.textContent = "Approval Pengajuan Offday";
        tableSubtitle.textContent = "MASTER dapat menyetujui atau menolak pengajuan yang masih menunggu.";
    } else if (currentSystemRole === "ADMIN") {
        submissionCard.style.display = "none";
        actionHeader.style.display = "none";
        tableTitle.textContent = "Monitoring Offday";
        tableSubtitle.textContent = "ADMIN memiliki akses baca tanpa hak approval.";
    } else {
        actionHeader.style.display = "none";
        tableTitle.textContent = "Riwayat Offday Saya";
        tableSubtitle.textContent = "Riwayat pengajuan ditampilkan berdasarkan username akun login.";
    }
}

async function loadOffday() {
    const tbody = document.getElementById("dataOffday");
    tbody.innerHTML = `<tr><td colspan="10">Memuat data offday...</td></tr>`;

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
    } catch (error) {
        console.error("Gagal mengambil data offday:", error);
        tbody.innerHTML = `<tr><td colspan="10">Gagal memuat data offday.</td></tr>`;
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

        return searchable.includes(keyword) && (!status || item.status === status);
    });

    renderOffday(filtered);
}

function renderOffday(data) {
    const tbody = document.getElementById("dataOffday");

    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10">Belum ada data yang sesuai.</td></tr>`;
        return;
    }

    let html = "";

    data.forEach((item, index) => {
        const canApprove = currentSystemRole === "MASTER" && item.status === "MENUNGGU";
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
    const role = document.getElementById("role").value;
    const shift = document.getElementById("shift").value;
    const tanggal = document.getElementById("tanggal").value;
    const alasan = document.getElementById("alasan").value.trim();

    if (!nama || !role || !shift || !tanggal || !alasan) {
        showToast("Role, shift, tanggal, dan alasan wajib diisi.", "error");
        return;
    }

    button.disabled = true;
    button.textContent = "Mengirim...";

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
        button.disabled = false;
        button.textContent = "Ajukan Offday";
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
