const API_URL = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec?type=staff";

fetch(API_URL)
  .then(response => response.json())
  .then(data => {
    const tbody = document.getElementById("dataStaff");

    tbody.innerHTML = "";

    data.forEach(staff => {
      tbody.innerHTML += `
        <tr>
          <td>${staff.nama}</td>
          <td>${staff.passport}</td>
          <td>${staff.jabatan}</td>
          <td>${staff.expPassport}</td>
          <td>${staff.expVisa}</td>
        </tr>
      `;
    });
  })
  .catch(error => {
    console.error("Gagal mengambil data staff:", error);

    document.getElementById("dataStaff").innerHTML = `
      <tr>
        <td colspan="5">Gagal memuat data staff.</td>
      </tr>
    `;
  });