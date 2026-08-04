const API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

const currentUser = getLoginUser();
const currentSystemRole = String(currentUser?.role || "").toUpperCase();

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
    if (currentSystemRole !== "MASTER") {
        document.getElementById("settingsList").innerHTML = `
            <p class="settings-empty">Halaman ini khusus untuk MASTER.</p>
        `;
        return;
    }

    loadSettings();

    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
        await loadSettings();
        showToast("Data berhasil diperbarui.");
    });
});

async function loadSettings() {
    const container = document.getElementById("settingsList");

    try {
        const params = new URLSearchParams({ type: "settings", token: getLoginToken() });
        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (!Array.isArray(result)) {
            if (handleExpiredSession_(result.message)) return;
            throw new Error(result.message || "Format data tidak valid.");
        }

        renderSettings(result);
    } catch (error) {
        console.error("Gagal memuat pengaturan:", error);
        if (container) container.innerHTML = `<p class="settings-empty">Gagal memuat pengaturan.</p>`;
        showToast("Gagal memuat pengaturan.", "error");
    }
}

function renderSettings(items) {
    const container = document.getElementById("settingsList");
    if (!container) return;

    container.innerHTML = items.map(item => `
        <div class="settings-item">
            <div class="settings-item-copy">
                <strong>${settingsEscape(item.label)}</strong>
                <small>
                    ${item.updatedBy
                        ? `Terakhir diubah oleh <b>${settingsEscape(item.updatedBy)}</b> &middot; ${settingsEscape(item.updatedAt)}`
                        : `Belum pernah diubah &middot; nilai default ${item.defaultValue}`}
                </small>
            </div>
            <div class="settings-item-control">
                <button type="button" class="settings-step" onclick="stepSetting('${item.key}', -1)" aria-label="Kurangi">&minus;</button>
                <input type="number" min="1" step="1" id="setting-${settingsEscapeAttr(item.key)}" value="${item.value}" data-key="${settingsEscapeAttr(item.key)}">
                <button type="button" class="settings-step" onclick="stepSetting('${item.key}', 1)" aria-label="Tambah">&plus;</button>
                <span class="settings-item-unit">orang</span>
                <button type="button" class="oc-btn oc-btn-primary settings-save-btn" onclick="saveSetting('${item.key}')">Simpan</button>
            </div>
        </div>
    `).join("");
}

function stepSetting(key, delta) {
    const input = document.getElementById(`setting-${key}`);
    if (!input) return;
    const next = Math.max(1, (Number(input.value) || 1) + delta);
    input.value = next;
}

async function saveSetting(key) {
    const input = document.getElementById(`setting-${key}`);
    if (!input) return;

    const value = Number(input.value);

    if (!Number.isInteger(value) || value < 1) {
        showToast("Nilai wajib berupa angka bulat, minimal 1.", "error");
        return;
    }

    try {
        const params = new URLSearchParams({
            type: "updateSetting",
            token: getLoginToken(),
            key,
            value: String(value)
        });

        const response = await fetch(`${API_BASE}?${params.toString()}`);
        const result = await response.json();

        if (handleExpiredSession_(result.message)) return;

        showToast(result.message, result.success ? "success" : "error");

        if (result.success) {
            await loadSettings();
        }
    } catch (error) {
        console.error("Gagal menyimpan pengaturan:", error);
        showToast("Gagal menyimpan pengaturan.", "error");
    }
}

function settingsEscape(value) {
    return String(value ?? "-")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function settingsEscapeAttr(value) {
    return String(value ?? "").replace(/[^a-zA-Z0-9_]/g, "");
}
