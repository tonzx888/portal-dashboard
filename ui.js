(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getToastStack() {
    let stack = document.querySelector(".oc-toast-stack");

    if (!stack) {
      stack = document.createElement("div");
      stack.className = "oc-toast-stack";
      document.body.appendChild(stack);
    }

    return stack;
  }

  window.ocToast = function (title, message = "", options = {}) {
    const duration = Number(options.duration || 3200);
    const stack = getToastStack();
    const toast = document.createElement("div");

    toast.className = "oc-toast";
    toast.style.setProperty("--toast-duration", `${duration}ms`);
    toast.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      ${message ? `<p>${escapeHtml(message)}</p>` : ""}
    `;

    stack.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, duration + 150);
  };

  window.ocOpenModal = function (id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  window.ocCloseModal = function (id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  window.ocSetLoading = function (element, isLoading, text = "Memproses...") {
    if (!element) return;

    if (isLoading) {
      element.dataset.ocOriginalText = element.innerHTML;
      element.disabled = true;
      element.textContent = text;
      return;
    }

    element.disabled = false;

    if (element.dataset.ocOriginalText) {
      element.innerHTML = element.dataset.ocOriginalText;
      delete element.dataset.ocOriginalText;
    }
  };

  window.ocConfirm = function (options = {}) {
    const title = options.title || "Konfirmasi";
    const message = options.message || "Lanjutkan tindakan ini?";
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  };

  /**
   * Membuat baris <tr> skeleton (blok berkedip) sebanyak rowCount,
   * masing-masing berisi colCount sel <td>, untuk dipakai sebagai
   * placeholder saat tabel sedang memuat data dari server.
   * Terasa lebih cepat dibanding teks "Memuat data..." polos,
   * walau waktu tunggunya sama.
   */
  window.ocSkeletonRows = function (colCount, rowCount = 5) {
    const makeCell = () =>
      `<td><span class="oc-skeleton" style="display:block;height:14px;width:${60 + Math.round(Math.random() * 30)}%"></span></td>`;
    const makeRow = () =>
      `<tr class="oc-skeleton-row">${Array.from({ length: colCount }, makeCell).join("")}</tr>`;
    return Array.from({ length: rowCount }, makeRow).join("");
  };

  /**
   * Mengganti tampilan <select> bawaan browser dengan dropdown
   * custom bergaya sendiri (tombol + daftar pilihan), tapi tetap
   * mempertahankan <select> aslinya (disembunyikan) supaya semua
   * kode lain yang membaca/mengubah `.value` / event "change"
   * tidak perlu diubah sama sekali.
   *
   * Dipanggil sekali per elemen, misalnya:
   *   ocInitCustomSelect(document.getElementById("role"));
   */
  window.ocInitCustomSelect = function (selectEl) {
    if (!selectEl || selectEl.dataset.ocCustomized === "true") return;
    selectEl.dataset.ocCustomized = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "oc-custom-select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "oc-custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    if (selectEl.disabled) trigger.disabled = true;

    const triggerLabel = document.createElement("span");
    trigger.appendChild(triggerLabel);

    const list = document.createElement("div");
    list.className = "oc-custom-select-list";
    list.setAttribute("role", "listbox");

    function buildOptions() {
      list.innerHTML = "";

      Array.from(selectEl.options).forEach(opt => {
        const item = document.createElement("div");
        item.className = "oc-custom-select-option";
        item.setAttribute("role", "option");
        item.textContent = opt.text;
        item.dataset.value = opt.value;

        if (opt.disabled) item.classList.add("disabled");
        if (opt.value === selectEl.value) item.classList.add("selected");

        item.addEventListener("click", () => {
          if (opt.disabled) return;

          selectEl.value = opt.value;
          refresh();
          closeList();
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        });

        list.appendChild(item);
      });
    }

    function refresh() {
      const selected = selectEl.options[selectEl.selectedIndex];
      triggerLabel.textContent = selected ? selected.text : "";
      trigger.classList.toggle("placeholder", !selectEl.value);

      list.querySelectorAll(".oc-custom-select-option").forEach(item => {
        item.classList.toggle("selected", item.dataset.value === selectEl.value);
      });
    }

    function positionList() {
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const estimatedHeight = Math.min(240, list.scrollHeight || 240);
      const openUpward = spaceBelow < estimatedHeight + 12 && rect.top > spaceBelow;

      list.style.left = `${rect.left}px`;
      list.style.width = `${rect.width}px`;

      if (openUpward) {
        list.style.top = "auto";
        list.style.bottom = `${window.innerHeight - rect.top + 6}px`;
      } else {
        list.style.bottom = "auto";
        list.style.top = `${rect.bottom + 6}px`;
      }
    }

    function closeList() {
      wrapper.classList.remove("open");
      list.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      window.removeEventListener("scroll", positionList, true);
      window.removeEventListener("resize", positionList);
    }

    trigger.addEventListener("click", () => {
      if (selectEl.disabled) return;
      const willOpen = !wrapper.classList.contains("open");

      document.querySelectorAll(".oc-custom-select.open")
        .forEach(el => el.classList.remove("open"));
      document.querySelectorAll(".oc-custom-select-list.open")
        .forEach(el => el.classList.remove("open"));

      if (willOpen) {
        positionList();
        wrapper.classList.add("open");
        list.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
        window.addEventListener("scroll", positionList, true);
        window.addEventListener("resize", positionList);
      } else {
        closeList();
      }
    });

    document.addEventListener("click", event => {
      if (!wrapper.contains(event.target) && !list.contains(event.target)) {
        closeList();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && wrapper.classList.contains("open")) {
        closeList();
      }
    });

    buildOptions();
    refresh();

    wrapper.appendChild(trigger);
    // PENTING: list SENGAJA dijadikan anak langsung <body>, BUKAN
    // anak wrapper. Kalau list ditaruh di dalam wrapper yang ada di
    // dalam elemen ber-backdrop-filter/transform (mis. modal kaca),
    // "position: fixed" pada list jadi terikat ke elemen itu, bukan
    // ke layar penuh -- itulah sebab dropdown pernah muncul "nyasar"
    // di posisi yang salah saat dipakai di dalam modal.
    document.body.appendChild(list);
    selectEl.insertAdjacentElement("afterend", wrapper);
    selectEl.classList.add("oc-native-select-hidden");

    // Kalau kode lain mengubah selectEl.value langsung (bukan lewat
    // klik di dropdown ini), panggil ocRefreshCustomSelect supaya
    // tampilannya ikut sinkron.
    selectEl.ocRefreshCustomSelect = refresh;
  };

  /**
   * Sinkronkan ulang tampilan dropdown custom setelah kode lain
   * mengubah select.value secara langsung (misalnya reset form).
   */
  window.ocRefreshCustomSelect = function (selectEl) {
    if (selectEl && typeof selectEl.ocRefreshCustomSelect === "function") {
      selectEl.ocRefreshCustomSelect();
    }
  };

  document.addEventListener("click", event => {
    const closeButton = event.target.closest("[data-oc-close]");

    if (closeButton) {
      ocCloseModal(closeButton.getAttribute("data-oc-close"));
    }

    if (event.target.classList.contains("oc-modal")) {
      ocCloseModal(event.target.id);
    }
  });
})();

// Shared Operation Center topbar helpers
window.addEventListener("DOMContentLoaded", () => {
  const user = typeof getLoginUser === "function" ? getLoginUser() : null;
  const username = String(user?.username || "").trim();
  const role = String(user?.role || "").trim();
  const initials = username.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]?.toUpperCase()).join("") || "OC";
  const initialNode = document.getElementById("userInitial");
  if (initialNode) initialNode.textContent = initials;
  const loginName = document.getElementById("loginUserName");
  if (loginName && username) loginName.textContent = [username, role].filter(Boolean).join(" · ");
  document.getElementById("btnLogout")?.addEventListener("click", () => {
    if (typeof logout === "function") logout();
  });
});
