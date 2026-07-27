const API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

const currentUser = getLoginUser();
const currentSystemRole = String(currentUser?.role || "").toUpperCase();

let announcementData = [];
let pendingDeleteRow = null;

function showToast(message, type = "success") {
    if (typeof ocToast !== "function") return;
    ocToast(type === "error" ? "Gagal" : "Berhasil", message || "Proses selesai.", { duration: 3500 });
}

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

document.addEventListener("DOMContentLoaded", () => {
    if (currentSystemRole === "MASTER") {
        document.getElementById("btnAddAnnouncement")?.removeAttribute("hidden");
    }

    loadAnnouncements();

    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
        await loadAnnouncements();
        showToast("Data berhasil diperbarui.");
    });

    document.getElementById("btnSubmitAnnouncement")?.addEventListener("click", submitAnnouncement);

    ["announcementSubmitModal", "announcementDetailModal"].forEach(id => {
        const modal = document.getElementById(id);
        modal?.addEventListener("click", event => {
            if (event.target === modal) modal.style.display = "none";
        });
    });
});

async function loadAnnouncements() {
    const container = document.getElementById("announcementList");

    try {
        const params = new URLSearchParams({ type: "announcements", token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (!Array.isArray(result)) {
            if (handleExpiredSession_(result.message)) return;
            throw new Error(result.message || "Format data tidak valid.");
        }

        announcementData = result;

        // Simpan penanda "sudah dilihat" supaya bell notifikasi tidak
        // terus-terusan menganggap ini baru.
        if (result.length) {
            localStorage.setItem("lastSeenAnnouncementRow", String(Math.max(...result.map(item => Number(item.row) || 0))));
        }

        renderAnnouncementList();
    } catch (error) {
        console.error("Gagal memuat announcement:", error);
        if (container) container.innerHTML = `<p class="announcement-empty">Gagal memuat data announcement.</p>`;
        showToast("Gagal memuat data announcement.", "error");
    }
}

function renderAnnouncementList() {
    const container = document.getElementById("announcementList");
    if (!container) return;

    if (!announcementData.length) {
        container.innerHTML = `<p class="announcement-empty">Belum ada announcement.</p>`;
        return;
    }

    container.innerHTML = announcementData.map((item, index) => `
        <button type="button" class="announcement-card" onclick="openAnnouncementDetailModal(${index})">
            <div class="announcement-card-icon">📢</div>
            <div class="announcement-card-body">
                <strong>${annEscape(item.judul)}</strong>
                <p>${annEscape(truncateAnnouncement_(item.isi, 140))}</p>
                <small>${annEscape(item.timestamp)} &middot; oleh ${annEscape(item.dibuatOleh)}</small>
            </div>
            <span class="announcement-card-arrow" aria-hidden="true">→</span>
        </button>
    `).join("");
}

function truncateAnnouncement_(text, maxLength) {
    const value = String(text || "");
    return value.length > maxLength ? value.slice(0, maxLength).trim() + "..." : value;
}

/* ==========================================================
   MODAL SUBMIT
========================================================== */

function openAnnouncementSubmitModal() {
    document.getElementById("announcementJudul").value = "";
    document.getElementById("announcementIsi").value = "";

    const modal = document.getElementById("announcementSubmitModal");
    if (modal) { modal.style.display = "flex"; modal.setAttribute("aria-hidden", "false"); }
}

function closeAnnouncementSubmitModal() {
    const modal = document.getElementById("announcementSubmitModal");
    if (modal) { modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
}

async function submitAnnouncement() {
    const button = document.getElementById("btnSubmitAnnouncement");
    const judul = document.getElementById("announcementJudul")?.value.trim() || "";
    const isi = document.getElementById("announcementIsi")?.value.trim() || "";

    if (!judul || !isi) {
        showToast("Judul dan isi announcement wajib diisi.", "error");
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Mempublikasikan...";
    }

    try {
        const params = new URLSearchParams({
            type: "submitAnnouncement",
            token: getLoginToken(),
            judul,
            isi
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            closeAnnouncementSubmitModal();
            await loadAnnouncements();
        }
    } catch (error) {
        console.error("Gagal mempublikasikan announcement:", error);
        showToast("Gagal mempublikasikan announcement.", "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Publikasikan";
        }
    }
}

/* ==========================================================
   MODAL DETAIL
========================================================== */

function openAnnouncementDetailModal(index) {
    const item = announcementData[index];
    if (!item) return;

    pendingDeleteRow = Number(item.row);

    document.getElementById("announcementDetailDate").textContent = item.timestamp;
    document.getElementById("announcementDetailTitle").textContent = item.judul;
    document.getElementById("announcementDetailBody").textContent = item.isi;
    document.getElementById("announcementDetailAuthor").textContent = item.dibuatOleh;

    document.getElementById("btnDeleteAnnouncement").hidden = currentSystemRole !== "MASTER";

    const modal = document.getElementById("announcementDetailModal");
    if (modal) { modal.style.display = "flex"; modal.setAttribute("aria-hidden", "false"); }
}

function closeAnnouncementDetailModal() {
    pendingDeleteRow = null;
    const modal = document.getElementById("announcementDetailModal");
    if (modal) { modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
}

async function deleteAnnouncementConfirm() {
    if (!pendingDeleteRow) return;

    const confirmed = typeof ocConfirm === "function"
        ? await ocConfirm({ title: "Hapus Announcement", message: "Yakin mau hapus announcement ini? Staff yang belum baca tidak akan lihat lagi." })
        : confirm("Yakin mau hapus announcement ini?");

    if (!confirmed) return;

    try {
        const params = new URLSearchParams({ type: "deleteAnnouncement", row: String(pendingDeleteRow), token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            closeAnnouncementDetailModal();
            await loadAnnouncements();
        }
    } catch (error) {
        console.error("Gagal menghapus announcement:", error);
        showToast("Gagal menghapus announcement.", "error");
    }
}

function annEscape(value) {
    return String(value ?? "-")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
