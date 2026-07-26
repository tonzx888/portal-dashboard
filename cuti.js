const API_CUTI = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec?type=cuti";

let cutiData = [];

document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("dataCuti");
    if (tbody && typeof ocSkeletonRows === "function") {
        tbody.innerHTML = ocSkeletonRows(6);
    }

    document.getElementById("cutiSearch")?.addEventListener("input", renderCutiTable);

    loadCuti();
});

async function loadCuti() {
    try {
        const response = await fetch(`${API_CUTI}&token=${encodeURIComponent(getLoginToken())}`);
        const data = await response.json();

        if (!Array.isArray(data)) {
            const message = String(data?.message || "").toLowerCase();

            if (message.includes("sesi tidak valid") || message.includes("login ulang")) {
                alert("Sesi Anda sudah berakhir. Silakan login ulang.");
                localStorage.removeItem("loginUser");
                window.location.href = "login.html";
                return;
            }

            throw new Error(data?.message || "Format data tidak valid.");
        }

        cutiData = data;
        renderCutiSummary(data);
        renderCutiTable();
    } catch (error) {
        console.error("Gagal mengambil data cuti:", error);
        const tbody = document.getElementById("dataCuti");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="cuti-loading">Gagal memuat data cuti.</td></tr>`;
        }
    }
}

/**
 * Menyimpulkan kategori status cuti dari teks status di sheet,
 * dipakai untuk pewarnaan badge & kartu ringkasan.
 */
function classifyCutiStatus(status) {
    const text = String(status || "").trim().toUpperCase();

    if (["SEDANG CUTI", "AKTIF", "VALID", "DISETUJUI", "APPROVED"].includes(text)) {
        return "active";
    }
    if (["AKAN DATANG", "UPCOMING", "MENUNGGU", "PENDING"].includes(text)) {
        return "upcoming";
    }
    if (["SELESAI", "DONE", "COMPLETED"].includes(text)) {
        return "done";
    }
    if (["DITOLAK", "REJECTED", "BATAL", "CANCELLED"].includes(text)) {
        return "rejected";
    }
    return "other";
}

function renderCutiSummary(data) {
    const counts = { total: data.length, active: 0, upcoming: 0, done: 0 };

    data.forEach(item => {
        const category = classifyCutiStatus(item.status);
        if (category === "active") counts.active++;
        else if (category === "upcoming") counts.upcoming++;
        else if (category === "done") counts.done++;
    });

    setCutiText("cutiTotal", counts.total);
    setCutiText("cutiActive", counts.active);
    setCutiText("cutiUpcoming", counts.upcoming);
    setCutiText("cutiDone", counts.done);
}

function renderCutiTable() {
    const tbody = document.getElementById("dataCuti");
    if (!tbody) return;

    const keyword = String(document.getElementById("cutiSearch")?.value || "")
        .trim()
        .toLowerCase();

    const filtered = keyword
        ? cutiData.filter(item => {
            const haystack = [item.nama, item.role, item.status]
                .map(value => String(value || "").toLowerCase())
                .join(" ");
            return haystack.includes(keyword);
        })
        : cutiData;

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="cuti-loading">
                ${cutiData.length ? "Tidak ada data yang sesuai pencarian." : "Belum ada data cuti."}
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(cuti => {
        const category = classifyCutiStatus(cuti.status);

        return `
            <tr>
                <td>${cutiEscape(cuti.nama)}</td>
                <td>${cutiEscape(cuti.role)}</td>
                <td>${cutiEscape(cuti.pengajuanCuti)}</td>
                <td>${cutiEscape(cuti.startCuti)}</td>
                <td>${cutiEscape(cuti.endCuti)}</td>
                <td><span class="cuti-status-badge ${category}">${cutiEscape(cuti.status || "-")}</span></td>
            </tr>
        `;
    }).join("");
}

function setCutiText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function cutiEscape(value) {
    return typeof escapeHtml === "function"
        ? escapeHtml(value ?? "-")
        : String(value ?? "-");
}
