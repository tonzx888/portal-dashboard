const API_BASE = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

function loadOffday() {
  fetch(`${API_BASE}?type=offday`)
    .then(response => response.json())
    .then(data => {
      const tbody = document.getElementById("dataOffday");
      tbody.innerHTML = "";

      if (data.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5">Belum ada data offday.</td>
          </tr>
        `;
        return;
      }

      data.forEach(item => {
        tbody.innerHTML += `
          <tr>
            <td>${item.nama}</td>
            <td>${item.role}</td>
            <td>${item.tanggal}</td>
            <td>${item.status}</td>
            <td>${item.keterangan || ""}</td>
          </tr>
        `;
      });
    })
    .catch(error => {
      console.error("Gagal mengambil data offday:", error);
    });
}

function submitOffday() {
  const nama = document.getElementById("nama").value.trim();
  const role = document.getElementById("role").value;
  const tanggal = document.getElementById("tanggal").value;
  const keterangan = document.getElementById("keterangan").value.trim();
  const pesan = document.getElementById("pesanSubmit");

  if (!nama || !role || !tanggal) {
    pesan.innerText = "Nama, role, dan tanggal wajib diisi.";
    return;
  }

  const url = `${API_BASE}?type=submitOffday&nama=${encodeURIComponent(nama)}&role=${encodeURIComponent(role)}&tanggal=${encodeURIComponent(tanggal)}&keterangan=${encodeURIComponent(keterangan)}`;

  fetch(url)
    .then(response => response.json())
    .then(result => {
      pesan.innerText = result.message;

      if (result.success) {
        document.getElementById("nama").value = "";
        document.getElementById("role").value = "";
        document.getElementById("tanggal").value = "";
        document.getElementById("keterangan").value = "";

        loadOffday();
      }
    })
    .catch(error => {
      console.error("Gagal submit offday:", error);
      pesan.innerText = "Gagal submit offday.";
    });
}

loadOffday();