function getLoginUser() {
    const user = localStorage.getItem("loginUser");

    if (!user) return null;

    try {
        return JSON.parse(user);
    } catch (error) {
        localStorage.removeItem("loginUser");
        return null;
    }
}

/**
 * Mengambil token sesi yang didapat dari backend saat login.
 * Dipakai di setiap request API yang butuh identitas terverifikasi
 * (bukan lagi mengirim role/username mentah).
 */
function getLoginToken() {
    const user = getLoginUser();
    return user && user.token ? String(user.token) : "";
}

function requireLogin() {
    const user = getLoginUser();

    if (!user) {
        window.location.href = "login.html";
        return null;
    }

    return user;
}

function logout() {
    const token = getLoginToken();

    // Beri tahu server untuk menghapus sesi ini juga (best-effort,
    // tidak menunggu responsnya supaya logout tetap terasa instan).
    if (token) {
        fetch(`https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec?type=logout&token=${encodeURIComponent(token)}`)
            .catch(() => {});
    }

    localStorage.removeItem("loginUser");
    window.location.href = "login.html";
}

const authenticatedUser = requireLogin();

document.addEventListener("DOMContentLoaded", () => {
    const userInfo = document.getElementById("userInfo");

    if (userInfo && authenticatedUser) {
        userInfo.textContent = `${authenticatedUser.username} · ${authenticatedUser.role}`;
    }
});
