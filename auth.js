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

function requireLogin() {
    const user = getLoginUser();

    if (!user) {
        window.location.href = "login.html";
        return null;
    }

    return user;
}

function logout() {
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
