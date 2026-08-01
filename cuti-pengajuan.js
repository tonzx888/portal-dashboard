const API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

const currentUser = getLoginUser();
const currentSystemRole = String(currentUser?.role || "").toUpperCase();
const currentUsername = String(currentUser?.username || "").trim();

// Nama Leader yang mengisi kolom "ACC LDR" di laporan copy-paste.
// Ganti di sini kalau Leader-nya berbeda.
const CUTI_LEADER_NAME = "ANTHONY";

let cutiData = [];
let staffPassportMap = {};
let staffProfile = null;
let pendingRejectRow = null;

const CUTI_ROLE_QUOTA_DAYS = { KASIR: 12, KAPTEN: 14, CS: 14 };

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

function openCutiSubmitModal() {
    const modal = document.getElementById("cutiSubmitModal");
    if (!modal) return;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
}

function closeCutiSubmitModal() {
    const modal = document.getElementById("cutiSubmitModal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
}

document.addEventListener("DOMContentLoaded", () => {
    const submitModal = document.getElementById("cutiSubmitModal");
    submitModal?.addEventListener("click", event => {
        if (event.target === submitModal) closeCutiSubmitModal();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && submitModal?.style.display === "flex") {
            closeCutiSubmitModal();
        }
    });

    const tbody = document.getElementById("dataCuti");
    if (tbody && typeof ocSkeletonRows === "function") {
        tbody.innerHTML = ocSkeletonRows(12);
    }

    if (typeof ocInitCustomSelect === "function") {
        ocInitCustomSelect(document.getElementById("jenisCuti"));
    }

    document.getElementById("calendarPrev")?.addEventListener("click", () => changeCutiMonth(-1));
    document.getElementById("calendarNext")?.addEventListener("click", () => changeCutiMonth(1));

    loadCuti();
    loadEligibility();
    loadStaffProfileAndPassportMap();

    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
        await Promise.all([loadCuti(), loadEligibility()]);
        showToast("Data berhasil diperbarui.");
    });

    document.getElementById("btnSubmitCuti")?.addEventListener("click", submitCuti);
    document.getElementById("searchCuti")?.addEventListener("input", renderCutiTable);

    document.querySelectorAll(".cuti-status-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".cuti-status-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            cutiActiveStatusTab = tab.dataset.status || "";
            renderCutiTable();
        });
    });

    document.getElementById("jenisCuti")?.addEventListener("change", updateCutiDayLock);
    document.getElementById("tanggalMulai")?.addEventListener("change", updateCutiEndPreview);
    document.getElementById("jumlahHari")?.addEventListener("input", updateCutiEndPreview);
    document.getElementById("tanggalMulaiLokal")?.addEventListener("change", updateCutiEndPreview);
    document.getElementById("tanggalMulaiKerja")?.addEventListener("change", updateCutiEndPreview);
    document.getElementById("jumlahHariLokal")?.addEventListener("input", updateCutiEndPreview);
    document.getElementById("jumlahHariKerja")?.addEventListener("input", updateCutiEndPreview);

    document.getElementById("urgentToggle")?.addEventListener("change", event => {
        document.querySelector(".cuti-urgent-box")
            ?.classList.toggle("is-urgent", event.target.checked);
        updateCutiDayLock();
    });
});

/**
 * Mengatur tampilan & kunci kolom Jumlah Hari sesuai jenis cuti:
 * - Jenis tunggal (Lokal/Indonesia/Kerja/Setahun): 1 tanggal mulai,
 *   jumlah hari terkunci ke jatah role (KECUALI Cuti Urgent aktif,
 *   boleh diisi manual).
 * - "Lokal + Kerja": 2 tanggal mulai terpisah (masing-masing satu
 *   periode), jumlah hari SELALU terkunci ke jatah role untuk
 *   kedua periode -- tidak bisa diedit manual sama sekali.
 */
function updateCutiDayLock() {
    const jenisCuti = document.getElementById("jenisCuti")?.value || "";
    const isUrgent = document.getElementById("urgentToggle")?.checked || false;
    const isCombo = jenisCuti === "CUTI LOKAL + CUTI KERJA";
    const jumlahHariInput = document.getElementById("jumlahHari");
    if (!jumlahHariInput) return;

    document.getElementById("singlePeriodFields").hidden = isCombo;
    document.getElementById("comboPeriodFields").hidden = !isCombo;
    document.getElementById("sharedJumlahHariField").hidden = isCombo;

    const role = staffProfile?.jabatan || "";
    const lockedDays = jenisCuti === "SETAHUN" ? 25 : (CUTI_ROLE_QUOTA_DAYS[role] || 12);

    // Mode tunggal: terkunci ke role KECUALI urgent aktif (boleh manual).
    // Mode kombinasi: jumlah hari diisi manual per periode (lihat updateCutiComboTotal).
    const isFleksibel = !isCombo && isUrgent;

    jumlahHariInput.readOnly = !isFleksibel;
    jumlahHariInput.classList.toggle("is-editable", isFleksibel);

    if (!isCombo) {
        if (!isFleksibel) {
            jumlahHariInput.value = jenisCuti ? lockedDays : "";
        } else if (!jumlahHariInput.value) {
            jumlahHariInput.value = "";
            jumlahHariInput.placeholder = "Isi manual (1-90 hari)";
        }
    }

    updateCutiEndPreview();
    updateCutiComboTotal();
}

function updateCutiEndPreview() {
    const jumlahHari = Number(document.getElementById("jumlahHari")?.value || 0);
    fillEndDatePreview("tanggalMulai", "tanggalSelesaiPreview", jumlahHari);

    const hariLokal = Number(document.getElementById("jumlahHariLokal")?.value || 0);
    const hariKerja = Number(document.getElementById("jumlahHariKerja")?.value || 0);
    fillEndDatePreview("tanggalMulaiLokal", "tanggalSelesaiLokalPreview", hariLokal);
    fillEndDatePreview("tanggalMulaiKerja", "tanggalSelesaiKerjaPreview", hariKerja);

    updateCutiComboTotal();
}

/**
 * Menampilkan indikator total hari Lokal + Kerja, dan menandai
 * hijau/merah tergantung sudah pas dengan jatah role atau belum.
 */
function updateCutiComboTotal() {
    const hint = document.getElementById("cutiComboTotalHint");
    if (!hint) return;

    const jenisCuti = document.getElementById("jenisCuti")?.value || "";
    if (jenisCuti !== "CUTI LOKAL + CUTI KERJA") return;

    const hariLokal = Number(document.getElementById("jumlahHariLokal")?.value || 0);
    const hariKerja = Number(document.getElementById("jumlahHariKerja")?.value || 0);
    const total = hariLokal + hariKerja;

    const role = staffProfile?.jabatan || "";
    const target = CUTI_ROLE_QUOTA_DAYS[role] || 12;

    hint.textContent = `Total: ${total} / ${target} hari`;
    hint.classList.toggle("match", total === target && total > 0);
    hint.classList.toggle("mismatch", total !== target);
}

function fillEndDatePreview(startId, previewId, jumlahHari) {
    const preview = document.getElementById(previewId);
    const tanggalMulai = document.getElementById(startId)?.value || "";
    if (!preview) return;

    if (!tanggalMulai || !jumlahHari || jumlahHari < 1) {
        preview.value = "";
        return;
    }

    const start = new Date(`${tanggalMulai}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + jumlahHari - 1);

    preview.value = end.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

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
        banner.innerHTML = `Cuti terakhir berakhir <strong>${escapeCutiHtml(result.lastCutiEnd)}</strong> — cuti reguler berikutnya boleh diajukan mulai <strong>${escapeCutiHtml(result.nextEligibleDate)}</strong>.`;
    } catch (error) {
        console.error("Gagal memuat info kelayakan cuti:", error);
    }
}

async function loadStaffProfileAndPassportMap() {
    const display = document.getElementById("staffProfileDisplay");
    const warning = document.getElementById("staffProfileWarning");
    const submitButton = document.getElementById("btnSubmitCuti");

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
                warning.textContent = `Username "${currentUsername}" tidak ditemukan pada kolom Username di Data Staff. Hubungi MASTER untuk melengkapi data staff terlebih dahulu sebelum bisa mengajukan cuti.`;
            }
            if (submitButton) submitButton.disabled = true;
            return;
        }

        staffProfile = own;

        if (display) {
            display.innerHTML = `<strong>${own.nama}</strong> &middot; ${own.jabatan} &middot; Passport ${own.passport || "-"}`;
        }

        updateCutiDayLock();
    } catch (error) {
        console.error("Gagal memuat data profil staff:", error);
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
        renderCalendar();
    } catch (error) {
        console.error("Gagal memuat data cuti:", error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="12">Gagal memuat data cuti.</td></tr>`;
        showToast("Gagal memuat data cuti.", "error");
    }
}

function renderCutiSummary(data) {
    const uniqueSubmissions = new Set();
    const counts = { pending: 0, approved: 0, rejected: 0 };

    data.forEach(item => {
        uniqueSubmissions.add(item.groupKey || `${item.nama}|${item.timestamp}`);

        if (item.status === "MENUNGGU") counts.pending++;
        else if (item.status === "DISETUJUI") counts.approved++;
        else if (item.status === "DITOLAK") counts.rejected++;
    });

    setCutiText("summaryTotal", uniqueSubmissions.size);
    setCutiText("summaryPending", counts.pending);
    setCutiText("summaryApproved", counts.approved);
    setCutiText("summaryRejected", counts.rejected);

    document.querySelector(".summary-pending")
        ?.classList.toggle("has-pending", counts.pending > 0);
}

let cutiActiveStatusTab = "";

function renderCutiTable() {
    const tbody = document.getElementById("dataCuti");
    if (!tbody) return;

    const keyword = String(document.getElementById("searchCuti")?.value || "").trim().toLowerCase();
    const statusFilter = cutiActiveStatusTab;

    const filtered = cutiData.filter(item => {
        const matchesKeyword = !keyword || [item.nama, item.role, item.status, item.jenisCuti]
            .map(value => String(value || "").toLowerCase())
            .join(" ")
            .includes(keyword);

        const matchesStatus = !statusFilter || item.status === statusFilter;

        return matchesKeyword && matchesStatus;
    });

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="11">${cutiData.length ? "Tidak ada data yang sesuai." : "Belum ada pengajuan cuti."}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((item, index) => {
        const canApprove = currentSystemRole === "MASTER" && item.status === "MENUNGGU";
        const isOwn = normalizeCutiNameCompare_(item.nama) === normalizeCutiNameCompare_(staffProfile?.nama || "");
        const canDelete = currentSystemRole === "MASTER" || (isOwn && item.status === "MENUNGGU");

        const actionButtons = [];
        if (canApprove) {
            actionButtons.push(`<button type="button" class="cuti-action-btn approve" onclick="approveCuti(${Number(item.row)})">Setujui</button>`);
            actionButtons.push(`<button type="button" class="cuti-action-btn reject" onclick="openCutiRejectModal(${Number(item.row)})">Tolak</button>`);
        }
        if (canDelete) {
            actionButtons.push(`<button type="button" class="cuti-action-btn delete" onclick="deleteCuti(${Number(item.row)})" title="Hapus pengajuan (mis. salah tanggal)">Hapus</button>`);
        }

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeCutiHtml(item.nama)} ${item.urgent ? '<span class="cuti-urgent-badge">URGENT</span>' : ""}</td>
                <td>${escapeCutiHtml(item.role)}</td>
                <td>${escapeCutiHtml(item.jenisCuti)}</td>
                <td>${formatCutiLongDate_(item.tanggalMulaiInput)} &ndash; ${formatCutiLongDate_(item.tanggalSelesaiInput)}</td>
                <td>${escapeCutiHtml(item.totalHari)}</td>
                <td>${cutiStatusBadge(item.status)}</td>
                <td>${escapeCutiHtml(item.approvedBy || "-")}</td>
                <td><button type="button" class="cuti-detail-btn" onclick="openCutiDetailModal(${index})" title="Lihat detail">👁</button></td>
                <td class="cuti-report-cell">
                    <button type="button" class="cuti-report-btn" onclick="copyCutiReportA(${index})" title="Copy laporan untuk task checker admin">📋 Task</button>
                    <button type="button" class="cuti-report-btn" onclick="copyCutiReportB(${index})" title="Copy laporan untuk grup admin">📋 Grup</button>
                </td>
                <td>${actionButtons.length ? actionButtons.join("") : '<span class="cuti-muted">-</span>'}</td>
            </tr>
        `;
    }).join("");

    tbody.dataset.filteredIndex = JSON.stringify(filtered.map(item => cutiData.indexOf(item)));
}

function normalizeCutiNameCompare_(value) {
    return String(value || "").trim().toUpperCase();
}

function cutiStatusBadge(status) {
    const className = status === "DISETUJUI" ? "approved" : status === "DITOLAK" ? "rejected" : "pending";
    return `<span class="cuti-status-badge ${className}">${escapeCutiHtml(status)}</span>`;
}

function openCutiDetailModal(filteredIndex) {
    const indexMap = JSON.parse(document.getElementById("dataCuti").dataset.filteredIndex || "[]");
    const item = cutiData[indexMap[filteredIndex]];
    if (!item) return;

    const body = document.getElementById("cutiDetailBody");
    const modal = document.getElementById("cutiDetailModal");
    if (!body || !modal) return;

    body.innerHTML = `
        <div class="calendar-detail-item">
            <div class="calendar-detail-name">${escapeCutiHtml(item.nama)} &middot; ${escapeCutiHtml(item.role)}</div>
            <div class="calendar-detail-meta">
                <span>${escapeCutiHtml(item.jenisCuti)}</span>
                <span>${formatCutiLongDate_(item.tanggalMulaiInput)} &ndash; ${formatCutiLongDate_(item.tanggalSelesaiInput)} (${escapeCutiHtml(item.totalHari)} hari)</span>
                <span>${cutiStatusBadge(item.status)}</span>
            </div>
            <p><strong>Alasan:</strong> ${escapeCutiHtml(item.alasan || "(tidak diisi)")}</p>
            <p><strong>Diproses oleh:</strong> ${escapeCutiHtml(item.approvedBy || "-")} ${item.approvedDate ? `(${escapeCutiHtml(item.approvedDate)})` : ""}</p>
            <p><strong>Catatan:</strong> ${escapeCutiHtml(item.catatan || "-")}</p>
        </div>
    `;

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
}

function closeCutiDetailModal() {
    const modal = document.getElementById("cutiDetailModal");
    if (modal) {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }
}

async function deleteCuti(row) {
    const confirmed = typeof ocConfirm === "function"
        ? await ocConfirm({ title: "Hapus Pengajuan Cuti", message: "Yakin mau hapus pengajuan ini? Tindakan ini tidak bisa dibatalkan." })
        : confirm("Yakin mau hapus pengajuan ini?");

    if (!confirmed) return;

    try {
        const params = new URLSearchParams({ type: "deleteCuti", row: String(row), token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            await loadCuti();
        }
    } catch (error) {
        console.error("Gagal menghapus pengajuan cuti:", error);
        showToast("Gagal menghapus pengajuan cuti.", "error");
    }
}

async function submitCuti() {
    const button = document.getElementById("btnSubmitCuti");
    const jenisCuti = document.getElementById("jenisCuti")?.value || "";
    const isCombo = jenisCuti === "CUTI LOKAL + CUTI KERJA";
    const jumlahHari = document.getElementById("jumlahHari")?.value || "";
    const alasan = document.getElementById("alasan")?.value.trim() || "";
    const urgent = document.getElementById("urgentToggle")?.checked || false;

    if (!staffProfile) {
        showToast("Data staff Anda belum ditemukan, tidak bisa mengajukan cuti.", "error");
        return;
    }

    if (!jenisCuti) {
        showToast("Jenis cuti wajib diisi.", "error");
        return;
    }

    if (urgent && !alasan) {
        showToast("Alasan wajib diisi untuk Cuti Urgent.", "error");
        return;
    }

    const params = new URLSearchParams({
        type: "submitCuti",
        token: getLoginToken(),
        jenisCuti,
        alasan,
        urgent: String(urgent)
    });

    if (isCombo) {
        const tanggalMulaiLokal = document.getElementById("tanggalMulaiLokal")?.value || "";
        const tanggalMulaiKerja = document.getElementById("tanggalMulaiKerja")?.value || "";
        const hariLokal = document.getElementById("jumlahHariLokal")?.value || "";
        const hariKerja = document.getElementById("jumlahHariKerja")?.value || "";

        if (!tanggalMulaiLokal || !tanggalMulaiKerja || !hariLokal || !hariKerja) {
            showToast("Tanggal mulai dan jumlah hari Cuti Lokal maupun Cuti Kerja wajib diisi.", "error");
            return;
        }

        const role = staffProfile?.jabatan || "";
        const target = CUTI_ROLE_QUOTA_DAYS[role] || 12;
        if (Number(hariLokal) + Number(hariKerja) !== target) {
            showToast(`Total hari Cuti Lokal + Cuti Kerja harus pas ${target} hari sesuai jatah role ${role}.`, "error");
            return;
        }

        params.set("tanggalMulaiLokal", tanggalMulaiLokal);
        params.set("tanggalMulaiKerja", tanggalMulaiKerja);
        params.set("jumlahHariLokal", hariLokal);
        params.set("jumlahHariKerja", hariKerja);
    } else {
        const tanggalMulai = document.getElementById("tanggalMulai")?.value || "";

        if (!tanggalMulai || !jumlahHari) {
            showToast("Tanggal mulai dan jumlah hari wajib diisi.", "error");
            return;
        }

        params.set("tanggalMulai", tanggalMulai);
        params.set("jumlahHari", jumlahHari);
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Mengirim...";
    }

    try {
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            document.getElementById("jenisCuti").value = "";
            document.getElementById("tanggalMulai").value = "";
            document.getElementById("tanggalMulaiLokal").value = "";
            document.getElementById("tanggalMulaiKerja").value = "";
            document.getElementById("jumlahHariLokal").value = "";
            document.getElementById("jumlahHariKerja").value = "";
            document.getElementById("jumlahHari").value = "";
            document.getElementById("tanggalSelesaiPreview").value = "";
            document.getElementById("tanggalSelesaiLokalPreview").value = "";
            document.getElementById("tanggalSelesaiKerjaPreview").value = "";
            document.getElementById("alasan").value = "";
            document.getElementById("urgentToggle").checked = false;
            document.querySelector(".cuti-urgent-box")?.classList.remove("is-urgent");

            if (typeof ocRefreshCustomSelect === "function") {
                ocRefreshCustomSelect(document.getElementById("jenisCuti"));
            }

            updateCutiDayLock();
            closeCutiSubmitModal();
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
STATUS: ${item.role}


START CUTI S/D : ${formatCutiLongDate_(item.tanggalMulaiInput)} S/D ${formatCutiLongDate_(item.tanggalSelesaiInput)}
TOTAL CUTI : ${item.totalHari} HARI

ACC LDR : ${CUTI_LEADER_NAME}`;

    copyCutiToClipboard(text, "Laporan task checker disalin.");
}

function copyCutiReportB(filteredIndex) {
    const indexMap = JSON.parse(document.getElementById("dataCuti").dataset.filteredIndex || "[]");
    const item = cutiData[indexMap[filteredIndex]];
    if (!item) return;

    const text =
`Info : Togelup
Perihal : ${item.jenisCuti}

NO PASPOR : ${getPassportFor(item.nama)}
NAMA STAFF : ${item.nama}
START CUTI S/D : ${formatCutiLongDate_(item.tanggalMulaiInput)} S/D ${formatCutiLongDate_(item.tanggalSelesaiInput)}

TOTAL CUTI : ${item.totalHari} hari

Keterangan : Untuk kelengkapan SIM CARD dan token sudah di check aman. Untuk admin, dan email sudah serah terima ke Leader. Untuk passport sudah berada di tangan staff.`;

    copyCutiToClipboard(text, "Laporan grup admin disalin.");
}

/**
 * Format tanggal panjang ala Indonesia (mis. "29 September 2026"),
 * dipakai khusus di laporan Task. Menerima tanggal format ISO
 * (yyyy-MM-dd) dari tanggalMulaiInput/tanggalSelesaiInput.
 */
function formatCutiLongDate_(isoDate) {
    const text = String(isoDate || "").trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return text || "-";

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (isNaN(date.getTime())) return text;

    return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
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

/* ==========================================================
   KALENDER VISUAL PER ROLE
   (dipindahkan dari halaman Jadwal Cuti ke Pengajuan Cuti --
   pakai data yang sama dengan tabel approval di atas, TIDAK
   fetch ulang ke server)
========================================================== */

const CUTI_ROLE_CONCURRENT_QUOTA = { CS: 2, KAPTEN: 1, KASIR: 2 };

let calendarViewDate = new Date();

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

    const activeItems = cutiData.filter(item =>
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

        const quota = CUTI_ROLE_CONCURRENT_QUOTA[role] || 1;
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

    const items = cutiData.filter(item => {
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

    const quota = CUTI_ROLE_CONCURRENT_QUOTA[role] || 1;
    const warning = items.length >= quota
        ? `<p class="cuti-detail-warning">⚠️ Kuota role ${role} pada tanggal ini sudah penuh (${items.length}/${quota}).</p>`
        : "";

    body.innerHTML = warning + (items.length ? items.map(item => `
        <div class="calendar-detail-item">
            <div class="calendar-detail-name">${escapeCutiHtml(item.nama)}</div>
            <div class="calendar-detail-meta">
                <span>${escapeCutiHtml(item.jenisCuti)}</span>
                <span>${escapeCutiHtml(item.tanggalMulai)} &ndash; ${escapeCutiHtml(item.tanggalSelesai)}</span>
                <span>${escapeCutiHtml(item.status)}</span>
            </div>
            <div class="calendar-detail-reason">${escapeCutiHtml(item.alasan)}</div>
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
