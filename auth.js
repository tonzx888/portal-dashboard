function logout() {
    localStorage.removeItem("loginUser");
    window.location.href = "login.html";
}

const user = localStorage.getItem("loginUser");

if (!user) {
    window.location.href = "login.html";
}