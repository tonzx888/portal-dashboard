const loginUser = JSON.parse(localStorage.getItem("loginUser"));

if (!loginUser) {
  window.location.href = "login.html";
}

const role = String(loginUser?.role || "").toUpperCase();
const menu = document.getElementById("sidebarMenu");

const menuItems = [
  {
    href: "index.html",
    icon: "OV",
    label: "Overview",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "staff.html",
    icon: "PS",
    label: "Personnel",
    roles: ["MASTER", "ADMIN"]
  },
  {
    href: "shift.html",
    icon: "SH",
    label: role === "STAFF" ? "My Schedule" : "Shift Schedule",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "cuti.html",
    icon: "LV",
    label: role === "STAFF" ? "My Leave" : "Leave",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "offday.html",
    icon: "OF",
    label: role === "STAFF" ? "My Offday" : "Offday",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "kasir.html",
    icon: "CS",
    label: "Cashier Data",
    roles: ["MASTER", "ADMIN"]
  },
  {
    href: "laporan.html",
    icon: "RP",
    label: "Reports",
    roles: ["MASTER", "ADMIN"]
  },
  {
    href: "users.html",
    icon: "AC",
    label: "Access Control",
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
