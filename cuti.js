const API_CUTI = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec?type=cuti";

document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("dataCuti");
    if (tbody && typeof ocSkeletonRows === "function") {
        tbody.innerHTML = ocSkeletonRows(6);
    }
});

fetch(`${API_CUTI}&token=${encodeURIComponent(getLoginToken())}`)
  .then(response => response.json())
  .then(data => {
    if (!Array.isArray(data)) {
      const message = String(data?.message || "").toLowerCase();

      if (message.includes("sesi tidak valid") || message.includes("login ulang")) {
        alert("Sesi Anda sudah berakhir. Silakan login ulang.");
        localStorage.removeItem("loginUser");
        window.location.href = "login.html";
        return;
      }

      throw new Error(data?.message || "Format data tidak valid.");
    }

    const tbody = document.getElementById("dataCuti");
    tbody.innerHTML = "";

    data.forEach(cuti => {
      tbody.innerHTML += `
        <tr>
          <td>${cuti.nama || ""}</td>
          <td>${cuti.role || ""}</td>
          <td>${cuti.pengajuanCuti || ""}</td>
          <td>${cuti.startCuti || ""}</td>
          <td>${cuti.endCuti || ""}</td>
          <td>${cuti.status || ""}</td>
        </tr>
      `;
    });
  })
  .catch(error => {
    console.error("Gagal mengambil data cuti:", error);
  });