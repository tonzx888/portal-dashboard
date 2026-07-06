const API_DASHBOARD = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec?type=dashboard";

fetch(API_DASHBOARD)
    .then(response => response.json())
    .then(data => {
        document.getElementById("totalStaff").innerText = data.totalStaff + " Orang";
        document.getElementById("staffCuti").innerText = data.staffCuti + " Orang";
        document.getElementById("offdayHariIni").innerText = data.offdayHariIni + " Orang";
        document.getElementById("passportWarning").innerText = data.passportWarning + " Orang";
        document.getElementById("visaWarning").innerText = data.visaWarning + " Orang";
    })
    .catch(error => {
        console.error("Gagal mengambil data dashboard:", error);
    });