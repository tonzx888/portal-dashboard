const loginUser = JSON.parse(localStorage.getItem("loginUser"));

if (!loginUser) {
  window.location.href = "login.html";
}

const role = String(loginUser?.role || "").toUpperCase();
const menu = document.getElementById("sidebarMenu");

let html = "";

if (role === "MASTER") {
  html = `
    <li><a href="index.html">🏠 Home</a></li>
    <li><a href="staff.html">👥 Data Staff</a></li>
    <li><a href="cuti.html">📝 Jadwal Cuti</a></li>
    <li><a href="offday.html">📅 Data Offday</a></li>
    <li><a href="users.html">👤 User Management</a></li>
  `;
} else if (role === "ADMIN") {
  html = `
    <li><a href="index.html">🏠 Home</a></li>
    <li><a href="staff.html">👥 Data Staff</a></li>
    <li><a href="cuti.html">📝 Jadwal Cuti</a></li>
    <li><a href="offday.html">📅 Data Offday</a></li>
  `;
} else if (role === "STAFF") {
  html = `
    <li><a href="index.html">🏠 Dashboard</a></li>
    <li><a href="cuti.html">📝 Cuti Saya</a></li>
    <li><a href="offday.html">📅 Offday Saya</a></li>
  `;
}

if (menu) {
  menu.innerHTML = html;
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  menu.querySelectorAll("a").forEach(link => {
    if (link.getAttribute("href") === currentPage) link.classList.add("active");
  });
}
