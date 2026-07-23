const BASE_URL = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

let staffData = [];
let toastTimer = null;

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");

    if (!toast) {
        console.warn(message);
        return;
    }

    clearTimeout(toastTimer);

    toast.className = `toast ${type}`;
    toast.textContent = message || "Proses selesai.";
    toast.style.display = "block";

    toastTimer = setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

function convertDate(value) {
    if (!value) return "";

    const dateValue = String(value).trim();

    // Sudah dalam format yyyy-MM-dd atau ISO.
    if (/^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
        return dateValue.substring(0, 10);
    }

    // Format dd/MM/yyyy.
    const parts = dateValue.split("/");

    if (parts.length !== 3) return "";

    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year = parts[2];

    return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
    loadStaff();

    const searchInput = document.getElementById("searchStaff");
    const saveButton = document.getElementById("btnSave");
    const modal = document.getElementById("modalStaff");

    if (searchInput) {
        searchInput.addEventListener("input", searchStaff);
    }

    if (saveButton) {
        saveButton.addEventListener("click", saveStaff);
    }

    window.addEventListener("click", event => {
        if (event.target === modal) {
            closeModal();
        }
    });
});

async function loadStaff() {
    const tbody = document.getElementById("dataStaff");

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7">Memuat data...</td>
        </tr>
    `;

    try {
        const response = await fetch(`${BASE_URL}?type=staff`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!Array.isArray(result)) {
            throw new Error(result.message || "Format data staff tidak valid.");
        }

        staffData = result;
        renderTable(staffData);
    } catch (error) {
        console.error("Gagal memuat data staff:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="7">Gagal memuat data staff.</td>
            </tr>
        `;

        showToast("Gagal memuat data staff.", "error");
    }
}

function renderTable(data) {
    const tbody = document.getElementById("dataStaff");

    if (!tbody) return;

    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">Tidak ada data.</td>
            </tr>
        `;
        return;
    }

    let html = "";

    data.forEach((staff, index) => {
        const row = Number(staff.row);

        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(staff.nama || "-")}</td>
                <td>${escapeHtml(staff.passport || "-")}</td>
                <td>${escapeHtml(staff.jabatan || "-")}</td>
                <td>${escapeHtml(staff.expPassport || "-")}</td>
                <td>${escapeHtml(staff.expVisa || "-")}</td>
                <td>
                    <button
                        type="button"
                        class="btn-warning"
                        onclick="editStaffByRow(${row})"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        class="btn-danger"
                        onclick="deleteStaff(${row})"
                    >
                        Hapus
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function editStaffByRow(row) {
    const staff = staffData.find(item => Number(item.row) === Number(row));

    if (!staff) {
        showToast("Data staff tidak ditemukan.", "error");
        return;
    }

    editStaff(staff);
}

function searchStaff() {
    const keyword = String(
        document.getElementById("searchStaff")?.value || ""
    ).trim().toLowerCase();

    const filteredData = staffData.filter(staff => {
        const nama = String(staff.nama || "").toLowerCase();
        const passport = String(staff.passport || "").toLowerCase();
        const jabatan = String(staff.jabatan || "").toLowerCase();

        return (
            nama.includes(keyword) ||
            passport.includes(keyword) ||
            jabatan.includes(keyword)
        );
    });

    renderTable(filteredData);
}

function openTambahStaff() {
    document.getElementById("modalTitle").textContent = "Tambah Staff";
    document.getElementById("rowStaff").value = "";
    document.getElementById("nama").value = "";
    document.getElementById("passport").value = "";
    document.getElementById("jabatan").value = "";
    document.getElementById("expPassport").value = "";
    document.getElementById("expVisa").value = "";
    document.getElementById("modalStaff").style.display = "block";

    document.getElementById("nama").focus();
}

function editStaff(staff) {
    document.getElementById("modalTitle").textContent = "Edit Staff";
    document.getElementById("rowStaff").value = staff.row || "";
    document.getElementById("nama").value = staff.nama || "";
    document.getElementById("passport").value = staff.passport || "";
    document.getElementById("jabatan").value = staff.jabatan || "";
    document.getElementById("expPassport").value = convertDate(staff.expPassport);
    document.getElementById("expVisa").value = convertDate(staff.expVisa);
    document.getElementById("modalStaff").style.display = "block";

    document.getElementById("nama").focus();
}

function closeModal() {
    const modal = document.getElementById("modalStaff");

    if (modal) {
        modal.style.display = "none";
    }
}

async function saveStaff() {
    const button = document.getElementById("btnSave");

    const row = document.getElementById("rowStaff").value.trim();
    const nama = document.getElementById("nama").value.trim();
    const passport = document.getElementById("passport").value.trim();
    const jabatan = document.getElementById("jabatan").value.trim();
    const expPassport = document.getElementById("expPassport").value;
    const expVisa = document.getElementById("expVisa").value;

    if (!nama) {
        showToast("Nama staff wajib diisi.", "error");
        document.getElementById("nama").focus();
        return;
    }

    if (!passport) {
        showToast("Nomor passport wajib diisi.", "error");
        document.getElementById("passport").focus();
        return;
    }

    if (!jabatan) {
        showToast("Jabatan wajib diisi.", "error");
        document.getElementById("jabatan").focus();
        return;
    }

    button.disabled = true;
    button.textContent = "Menyimpan...";

    try {
        const type = row ? "editStaff" : "addStaff";
        const params = new URLSearchParams({
            type,
            nama,
            passport,
            jabatan,
            expPassport,
            expVisa
        });

        if (row) {
            params.set("row", row);
        }

        const response = await fetch(`${BASE_URL}?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        showToast(
            result.message || "Proses selesai.",
            result.success ? "success" : "error"
        );

        if (result.success) {
            closeModal();
            await loadStaff();
        }
    } catch (error) {
        console.error("Gagal menyimpan data staff:", error);
        showToast("Terjadi kesalahan saat menyimpan data.", "error");
    } finally {
        button.disabled = false;
        button.textContent = "Simpan";
    }
}

async function deleteStaff(row) {
    const validRow = Number(row);

    if (!validRow || validRow <= 1) {
        showToast("Data staff tidak valid.", "error");
        return;
    }

    if (!confirm("Hapus staff ini?")) return;

    try {
        const params = new URLSearchParams({
            type: "deleteStaff",
            row: String(validRow)
        });

        const response = await fetch(`${BASE_URL}?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        showToast(
            result.message || "Proses selesai.",
            result.success ? "success" : "error"
        );

        if (result.success) {
            await loadStaff();
        }
    } catch (error) {
        console.error("Gagal menghapus data staff:", error);
        showToast("Terjadi kesalahan saat menghapus data.", "error");
    }
}
