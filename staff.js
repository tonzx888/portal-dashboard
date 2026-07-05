const API_URL = "https://script.google.com/macros/s/AKfycbxF6-6uiTcR16VECQcxdkZ37l4cwZcnsq9hmyyhffOY7mD0hNkO10xKnYugQdshp2qiiw/exec";

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
    document.getElementById("dataStaff").innerHTML = `
      <tr>
        <td colspan="5">Gagal memuat data staff.</td>
      </tr>
    `;
    console.error(error);
  });