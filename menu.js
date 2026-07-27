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
  rekening: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>`,
  banding: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M9 12l2 2 4-4"/></svg>`,
  announcement: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v3a1 1 0 0 0 1 1h2l3.5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M16 8a3 3 0 0 1 0 8"/><path d="M19 5a7 7 0 0 1 0 14"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`,
  calendarDays: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`
};

const menuItems = [
  {
    href: "index.html",
    icon: menuIcons.home,
    label: "Home",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "announcement.html",
    icon: menuIcons.announcement,
    label: "📢 Announcement",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    href: "staff.html",
    icon: menuIcons.staff,
    label: "Data Staff",
    roles: ["MASTER", "ADMIN", "STAFF"]
  },
  {
    icon: menuIcons.cuti,
    label: "Cuti Staff",
    roles: ["MASTER", "ADMIN", "STAFF"],
    pendingKey: "cuti",
    pendingRoles: ["MASTER"],
    children: [
      { href: "cuti-pengajuan.html", icon: menuIcons.send, label: "Pengajuan Cuti" },
      { href: "cuti.html", icon: menuIcons.calendarDays, label: "Jadwal Cuti" }
    ]
  },
  {
    href: "offday.html",
    icon: menuIcons.offday,
    label: "Jadwal Offday",
    roles: ["MASTER", "ADMIN", "STAFF"],
    pendingKey: "offday",
    pendingRoles: ["MASTER"]
  },
  {
    href: "rekening.html",
    icon: menuIcons.rekening,
    label: "Req Ganti Rek",
    roles: ["MASTER", "ADMIN", "STAFF"],
    pendingKey: "rekening",
    pendingRoles: ["MASTER"]
  },
  {
    href: "banding.html",
    icon: menuIcons.banding,
    label: "Banding Kesalahan",
    roles: ["MASTER", "ADMIN", "STAFF"],
    pendingKey: "banding",
    pendingRoles: ["MASTER", "ADMIN"]
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
    .map(item => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => child.href === currentPage);

        const childrenHtml = item.children.map(child => `
          <li>
            <a
              href="${child.href}"
              class="oc-nav-sub-link ${child.href === currentPage ? "active" : ""}">
              <span class="oc-nav-icon oc-nav-icon-sub" aria-hidden="true">${child.icon}</span>
              <span>${child.label}</span>
            </a>
          </li>
        `).join("");

        return `
          <li class="oc-nav-group ${hasActiveChild ? "open" : ""}">
            <button
              type="button"
              class="oc-nav-group-toggle ${hasActiveChild ? "active" : ""}"
              onclick="this.closest('.oc-nav-group').classList.toggle('open')">
              <span class="oc-nav-icon" aria-hidden="true">${item.icon}</span>
              <span class="oc-nav-group-label">${item.label}</span>
              ${item.pendingKey ? `<span class="oc-nav-badge" data-pending-key="${item.pendingKey}" hidden></span>` : ""}
              <span class="oc-nav-chevron" aria-hidden="true">${menuIcons.chevron}</span>
            </button>
            <div class="oc-nav-sub-collapse">
              <ul class="oc-nav-sub">${childrenHtml}</ul>
            </div>
          </li>
        `;
      }

      return `
        <li>
          <a
            href="${item.href}"
            class="${item.href === currentPage ? "active" : ""}">
            <span class="oc-nav-icon" aria-hidden="true">${item.icon}</span>
            <span>${item.label}</span>
            ${item.pendingKey ? `<span class="oc-nav-badge" data-pending-key="${item.pendingKey}" hidden></span>` : ""}
          </a>
        </li>
      `;
    })
    .join("");

  loadSidebarPendingBadges_();
}

/**
 * Ambil jumlah pending semua modul (Cuti/Offday/Rekening/Banding)
 * lewat endpoint dashboard yang sudah ada, lalu tampilkan sebagai
 * badge merah di sidebar -- cuma untuk role yang relevan approve
 * modul tersebut (supaya STAFF tidak lihat badge yang bukan
 * urusannya).
 */
async function loadSidebarPendingBadges_() {
  const badgeEls = document.querySelectorAll(".oc-nav-badge[data-pending-key]");
  if (!badgeEls.length) return;

  try {
    const token = loginUser?.token ? String(loginUser.token) : "";
    const params = new URLSearchParams({ type: "dashboard", token });
    const response = await fetch(
      `https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec?${params.toString()}`
    );
    const result = await response.json();
    const pending = result?.pending || {};

    const menuLookup = {};
    menuItems.forEach(item => {
      if (item.pendingKey) menuLookup[item.pendingKey] = item;
    });

    badgeEls.forEach(el => {
      const key = el.dataset.pendingKey;
      const menuItem = menuLookup[key];
      const allowedRoles = menuItem?.pendingRoles || [];
      const count = Number(pending[key] || 0);

      if (allowedRoles.includes(role) && count > 0) {
        el.textContent = count > 99 ? "99+" : String(count);
        el.removeAttribute("hidden");
      }
    });
  } catch (error) {
    console.error("Gagal memuat notifikasi pending sidebar:", error);
  }
}
