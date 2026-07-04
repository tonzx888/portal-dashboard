function tampilHome() {
    document.getElementById("content").innerHTML = `
        <h1>Selamat Datang, Karuna</h1>

        <div class="card">
            <h3>Total Staff</h3>
            <p>14 Orang</p>
        </div>

        <div class="card">
            <h3>Staff Cuti</h3>
            <p>2 Orang</p>
        </div>

        <div class="card">
            <h3>Kasir Aktif</h3>
            <p>3 Orang</p>
        </div>
    `;
}

function tampilDataStaff() {
    document.getElementById("content").innerHTML = `
        <h1>Data Staff</h1>

        <div class="card">
            <h3>Daftar Staff</h3>

            <table>
                <tr>
                    <th>Nama</th>
                    <th>Role</th>
                    <th>Shift</th>
                </tr>
                <tr>
                    <td>Andi</td>
                    <td>CS</td>
                    <td>Pagi</td>
                </tr>
                <tr>
                    <td>Budi</td>
                    <td>Kasir</td>
                    <td>Malam</td>
                </tr>
                <tr>
                    <td>Citra</td>
                    <td>Kapten</td>
                    <td>Pagi</td>
                </tr>
            </table>
        </div>
    `;
}

function tampilJadwalShift() {
    document.getElementById("content").innerHTML = `
        <h1>Jadwal Shift</h1>
        <div class="card">
            <h3>Shift Hari Ini</h3>
            <p>Pagi: 07:00 - 19:00</p>
            <p>Malam: 19:00 - 07:00</p>
        </div>
    `;
}

function tampilPengajuanCuti() {
    document.getElementById("content").innerHTML = `
        <h1>Pengajuan Cuti</h1>
        <div class="card">
            <h3>Status Cuti</h3>
            <p>Belum ada pengajuan baru.</p>
        </div>
    `;
}

function tampilLaporan() {
    document.getElementById("content").innerHTML = `
        <h1>Laporan</h1>
        <div class="card">
            <h3>Laporan Operasional</h3>
            <p>Data laporan akan ditampilkan di sini.</p>
        </div>
    `;
}

function tampilDataKasir() {
    document.getElementById("content").innerHTML = `
        <h1>Data Kasir</h1>
        <div class="card">
            <h3>Kasir Aktif</h3>
            <p>3 Orang</p>
        </div>
    `;
}