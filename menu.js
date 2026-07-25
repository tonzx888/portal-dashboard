const loginUser = JSON.parse(localStorage.getItem("loginUser"));

if (!loginUser) {
  window.location.href = "login.html";
}

const role = String(loginUser?.role || "").toUpperCase();
const menu = document.getElementById("sidebarMenu");

const menuIcons = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  staff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  cuti: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  offday: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`
};

const menuItems = [
  {
    href: "index.html",
    icon: menuIcons.home,
    label: "Home",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "staff.html",
    icon: menuIcons.staff,
    label: "Data Staff",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "cuti.html",
    icon: menuIcons.cuti,
    label: "Jadwal Cuti",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "offday.html",
    icon: menuIcons.offday,
    label: "Jadwal Offday",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "users.html",
    icon: menuIcons.users,
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
