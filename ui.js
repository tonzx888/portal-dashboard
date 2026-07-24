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
