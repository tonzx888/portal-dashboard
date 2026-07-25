const loginUser = JSON.parse(localStorage.getItem("loginUser"));

if (!loginUser) {
  window.location.href = "login.html";
}

const role = String(loginUser?.role || "").toUpperCase();
const menu = document.getElementById("sidebarMenu");

const menuItems = [
  {
    href: "index.html",
    icon: "HM",
    label: "Home",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "staff.html",
    icon: "ST",
    label: "Data Staff",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "cuti.html",
    icon: "CT",
    label: "Jadwal Cuti",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "offday.html",
    icon: "OF",
    label: "Jadwal Offday",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "users.html",
    icon: "US",
    label: "Manajemen User",
    roles: ["MASTER"]
  }
];

if (menu) {
  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  menu.innerHTML = menuItems
    .filter(item => item.roles.includes(role))
    .map(item => `
      <li>
        <a
          href="${item.href}"
          class="${item.href === currentPage ? "active" : ""}">
          <span class="oc-nav-icon" aria-hidden="true">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      </li>
    `)
    .join("");
}
