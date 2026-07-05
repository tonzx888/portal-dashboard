const API_CUTI = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec?type=cuti";

fetch(API_CUTI)
  .then(response => response.json())
  .then(data => {
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