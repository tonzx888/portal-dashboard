const API_URL = "TEMPEL_LINK_APPS_SCRIPT_EXEC_DI_SINI";

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
        <td colspan="5">Gagal memuat data.</td>
      </tr>
    `;

    console.error(error);
  });