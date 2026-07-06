function getLoginUser() {
    const user = localStorage.getItem("loginUser");

    if (!user) {
        return null;
    }

    return JSON.parse(user);
}

function requireLogin() {
    const user = getLoginUser();

    if (!user) {
        window.location.href = "login.html";
    }
}

function logout() {
    localStorage.removeItem("loginUser");
    window.location.href = "login.html";
}

requireLogin();