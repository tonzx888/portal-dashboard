const loginUser = JSON.parse(localStorage.getItem("loginUser"));

const role = loginUser.role;

const menu = document.getElementById("sidebarMenu");

let html = "";

if(role==="MASTER"){

html+=`
<li><a href="index.html">🏠 Home</a></li>
<li><a href="staff.html">👥 Data Staff</a></li>
<li><a href="shift.html">🗓️ Jadwal Shift</a></li>
<li><a href="cuti.html">📝 Jadwal Cuti</a></li>
<li><a href="offday.html">📅 Data Offday</a></li>
<li><a href="kasir.html">💰 Data Kasir</a></li>
<li><a href="users.html">👤 User Management</a></li>
`;

}

if(role==="ADMIN"){

html+=`
<li><a href="index.html">🏠 Home</a></li>
<li><a href="staff.html">👥 Data Staff</a></li>
<li><a href="shift.html">🗓️ Jadwal Shift</a></li>
<li><a href="cuti.html">📝 Jadwal Cuti</a></li>
<li><a href="offday.html">📅 Data Offday</a></li>
<li><a href="kasir.html">💰 Data Kasir</a></li>
`;

}

if(role==="STAFF"){

html+=`
<li><a href="index.html">🏠 Dashboard</a></li>
<li><a href="shift.html">🗓️ Jadwal Saya</a></li>
<li><a href="cuti.html">📝 Cuti Saya</a></li>
<li><a href="offday.html">📅 Offday Saya</a></li>
`;

}

menu.innerHTML=html;