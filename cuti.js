alert("cuti.js berjalan");

const API_CUTI = "https://script.google.com/macros/s/AKfycbzfXgGREpLHqMC_UWswMbQgEg59TrS5nfcRo8FKuoZFBFjSx2WBRzj-TjQkAg30fiVFNw/exec?type=cuti";

fetch(API_CUTI)
  .then(response => response.json())
  .then(data => {
    const tbody = document.getElementById("dataCuti");
    tbody.innerHTML = "";

    data.forEach(cuti => {
      tbody.innerHTML += `
        <tr>
          <td>${cuti.nama}</td>
          <td>${cuti.role}</td>
          <td>${cuti.pengajuanCuti}</td>
          <td>${cuti.startCuti}</td>
          <td>${cuti.endCuti}</td>
          <td>${cuti.status}</td>
        </tr>
      `;
    });
  });