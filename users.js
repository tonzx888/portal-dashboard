const loginUser = JSON.parse(localStorage.getItem("loginUser"));

if (!loginUser || loginUser.role !== "MASTER") {
    alert("Akses ditolak. Halaman ini hanya untuk MASTER.");
    window.location.href = "index.html";
}