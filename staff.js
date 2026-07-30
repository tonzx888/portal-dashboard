const BASE_URL = "https://script.google.com/macros/s/AKfycbyGSUSD7xeGMBTonsc6sEdRQwcI8EYNHTJvC-_ibouo5YCe5OqHw8ARNjXaK-VtDoKMgA/exec";

let staffData = [];
let toastTimer = null;

const loginUserStaff = getLoginUser();
const currentStaffSystemRole = String(loginUserStaff?.role || "").toUpperCase();

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return console.warn(message);
  clearTimeout(toastTimer);
  toast.className = `toast ${type}`;
  toast.textContent = message || "Proses selesai.";
  toast.style.display = "block";
  toastTimer = setTimeout(() => toast.style.display = "none", 3200);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function convertDate(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.substring(0,10);
  const p = text.split("/");
  if (p.length === 3) return `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function parseLocalDate(value) {
  const v = convertDate(value);
  if (!v) return null;
  const [y,m,d] = v.split("-").map(Number);
  return new Date(y,m-1,d);
}

function calculateAge(value) {
  const birth = parseLocalDate(value);
  if (!birth) return "-";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? `${age} TAHUN` : "-";
}

function calculateServicePeriod(value) {
  const join = parseLocalDate(value);
  if (!join) return "-";
  const now = new Date();
  if (join > now) return "-";
  let years = now.getFullYear() - join.getFullYear();
  let months = now.getMonth() - join.getMonth();
  if (now.getDate() < join.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  return `${Math.max(years,0)} TAHUN ${Math.max(months,0)} BULAN`;
}

function isExpiryWarning(value, days = 180) {
  const expiry = parseLocalDate(value);
  if (!expiry) return false;
  const limit = new Date();
  limit.setHours(0,0,0,0);
  limit.setDate(limit.getDate()+days);
  return expiry <= limit;
}

document.addEventListener("DOMContentLoaded", () => {
  if (currentStaffSystemRole !== "MASTER") document.getElementById("btnTambahStaff").style.display = "none";
  loadStaff();

  if (typeof ocInitCustomSelect === "function") {
    ocInitCustomSelect(document.getElementById("filterJabatan"));
    ocInitCustomSelect(document.getElementById("jabatan"));
    // filterDomisili SENGAJA tidak di-init di sini, karena opsinya
    // masih kosong sampai data staff selesai dimuat -- diinit di
    // dalam populateDomisiliFilter() setelah opsi asli terisi.
  }

  document.getElementById("searchStaff")?.addEventListener("input", applyStaffFilters);
  document.getElementById("filterJabatan")?.addEventListener("change", applyStaffFilters);
  document.getElementById("filterDomisili")?.addEventListener("change", applyStaffFilters);
  document.getElementById("btnResetFilter")?.addEventListener("click", () => {
    document.getElementById("searchStaff").value = "";
    document.getElementById("filterJabatan").value = "";
    document.getElementById("filterDomisili").value = "";

    if (typeof ocRefreshCustomSelect === "function") {
      ocRefreshCustomSelect(document.getElementById("filterJabatan"));
      ocRefreshCustomSelect(document.getElementById("filterDomisili"));
    }

    applyStaffFilters();
  });
  document.getElementById("btnRefreshStaff")?.addEventListener("click", loadStaff);
  document.getElementById("btnSave")?.addEventListener("click", saveStaff);
  document.getElementById("tanggalLahir")?.addEventListener("change", updateComputedPreview);
  document.getElementById("tanggalJoin")?.addEventListener("change", updateComputedPreview);
  window.addEventListener("click", e => {
    if (e.target === document.getElementById("modalStaff")) closeModal();
    if (e.target === document.getElementById("modalDetailStaff")) closeDetailModal();
  });
});

async function loadStaff() {
  const tbody = document.getElementById("dataStaff");
  tbody.innerHTML = ocSkeletonRows(11);
  try {
    const response = await fetch(`${BASE_URL}?type=staff&token=${encodeURIComponent(getLoginToken())}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!Array.isArray(result)) throw new Error(result.message || "Format data tidak valid.");
    staffData = result;
    populateDomisiliFilter();
    updateSummary();
    applyStaffFilters();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="11">Gagal memuat data staff.</td></tr>`;
    showToast("Gagal memuat data staff.","error");
  }
}

function updateSummary() {
  const roles = staffData.map(x => String(x.jabatan||"").toUpperCase());
  summaryTotal.textContent = staffData.length;
  summaryCS.textContent = roles.filter(x=>x==="CS").length;
  summaryKapten.textContent = roles.filter(x=>x==="KAPTEN").length;
  summaryKasir.textContent = roles.filter(x=>x==="KASIR").length;
}

function populateDomisiliFilter() {
  const select = document.getElementById("filterDomisili");
  const current = select.value;
  const values = [...new Set(staffData.map(x=>String(x.domisili||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id"));
  select.innerHTML = `<option value="">Semua Domisili</option>` + values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  if (values.includes(current)) select.value = current;

  if (typeof ocInitCustomSelect === "function") {
    ocInitCustomSelect(select);
  }
  if (typeof ocRefreshCustomSelect === "function") {
    ocRefreshCustomSelect(select);
  }
}

function applyStaffFilters() {
  const keyword = String(searchStaff.value||"").trim().toLowerCase();
  const role = String(filterJabatan.value||"").toUpperCase();
  const domisili = String(filterDomisili.value||"").toLowerCase();
  const filtered = staffData.filter(x => {
    const searchable = [x.nama,x.passport,x.jabatan,x.domisili,x.usia,x.masaKerja].join(" ").toLowerCase();
    return searchable.includes(keyword) &&
      (!role || String(x.jabatan||"").toUpperCase()===role) &&
      (!domisili || String(x.domisili||"").toLowerCase()===domisili);
  });
  renderTable(filtered);
}

function renderTable(data) {
  const tbody = document.getElementById("dataStaff");
  const resultCount = document.getElementById("staffResultCount");
  if (resultCount) resultCount.textContent = `${data.length} data`;

  if (!data.length) return tbody.innerHTML = `<tr><td colspan="11">Tidak ada data yang sesuai.</td></tr>`;
  tbody.innerHTML = data.map((x,i)=>{
    const row = Number(x.row);
    const actions = currentStaffSystemRole==="MASTER" ? `
      <div class="staff-action-group">
        <button class="staff-icon-btn edit" onclick="editStaffByRow(${row})" title="Edit" aria-label="Edit ${escapeHtml(x.nama||"")}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
        <button class="staff-icon-btn delete" onclick="deleteStaff(${row})" title="Hapus" aria-label="Hapus ${escapeHtml(x.nama||"")}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>` : `<span class="staff-muted">Lihat saja</span>`;
    return `<tr>
      <td>${i+1}</td>
      <td><button class="staff-name-button" onclick="showStaffDetail(${row})">${escapeHtml(x.nama||"-")}</button></td>
      <td>${escapeHtml(x.jabatan||"-")}</td>
      <td>${escapeHtml(x.usia||calculateAge(x.tanggalLahir))}</td>
      <td>${escapeHtml(x.domisili||"-")}</td>
      <td>${escapeHtml(x.passport||"-")}</td>
      <td class="${isExpiryWarning(x.expPassport)?"staff-warning":"staff-safe"}">${escapeHtml(x.expPassport||"-")}</td>
      <td class="${isExpiryWarning(x.expVisa)?"staff-warning":"staff-safe"}">${escapeHtml(x.expVisa||"-")}</td>
      <td>${escapeHtml(x.tanggalJoin||"-")}</td>
      <td>${escapeHtml(x.masaKerja||calculateServicePeriod(x.tanggalJoin))}</td>
      <td>${actions}</td>
    </tr>`;
  }).join("");
}

function openTambahStaff() {
  if (currentStaffSystemRole!=="MASTER") return;
  modalTitle.textContent="Tambah Staff";
  ["rowStaff","nama","username","passport","jabatan","tanggalLahir","domisili","tanggalJoin"].forEach(id=>document.getElementById(id).value="");
  if (typeof ocRefreshCustomSelect === "function") ocRefreshCustomSelect(document.getElementById("jabatan"));
  updateComputedPreview();
  modalStaff.style.display="flex";
  nama.focus();
}

function editStaffByRow(row) {
  const x = staffData.find(v=>Number(v.row)===Number(row));
  if (!x) return showToast("Data staff tidak ditemukan.","error");
  editStaff(x);
}

function editStaff(x) {
  if (currentStaffSystemRole!=="MASTER") return;
  modalTitle.textContent="Edit Staff";
  rowStaff.value=x.row||"";
  nama.value=x.nama||"";
  document.getElementById("username").value=x.username||"";
  passport.value=x.passport||"";
  jabatan.value=String(x.jabatan||"").toUpperCase();
  if (typeof ocRefreshCustomSelect === "function") ocRefreshCustomSelect(document.getElementById("jabatan"));
  tanggalLahir.value=convertDate(x.tanggalLahir);
  domisili.value=x.domisili||"";
  tanggalJoin.value=convertDate(x.tanggalJoin);
  updateComputedPreview();
  closeDetailModal();
  modalStaff.style.display="flex";
}

function updateComputedPreview() {
  previewUsia.textContent=calculateAge(tanggalLahir.value);
  previewMasaKerja.textContent=calculateServicePeriod(tanggalJoin.value);
}

function closeModal(){modalStaff.style.display="none"}
function closeDetailModal(){modalDetailStaff.style.display="none"}

function showStaffDetail(row) {
  const x = staffData.find(v=>Number(v.row)===Number(row));
  if (!x) return showToast("Data staff tidak ditemukan.","error");
  detailNama.textContent=x.nama||"Detail Staff";
  const fields=[
    ["Username",x.username||"Belum diisi"],
    ["Jabatan",x.jabatan],["No Passport",x.passport],["Exp Passport",x.expPassport],
    ["Exp Visa",x.expVisa],["Tanggal Lahir",x.tanggalLahir],
    ["Usia",x.usia||calculateAge(x.tanggalLahir)],["Domisili",x.domisili],
    ["Tanggal Join",x.tanggalJoin],["Masa Kerja",x.masaKerja||calculateServicePeriod(x.tanggalJoin)]
  ];
  detailStaffBody.innerHTML=fields.map(([a,b])=>`<div class="staff-detail-item"><span>${escapeHtml(a)}</span><strong>${escapeHtml(b||"-")}</strong></div>`).join("");
  btnDetailEdit.style.display=currentStaffSystemRole==="MASTER"?"inline-flex":"none";
  btnDetailEdit.onclick=()=>editStaffByRow(row);
  modalDetailStaff.style.display="flex";
}

async function saveStaff() {
  if (currentStaffSystemRole!=="MASTER") return;
  const payload={
    row:rowStaff.value.trim(),nama:nama.value.trim(),
    username:document.getElementById("username").value.trim(),
    passport:passport.value.trim(),
    jabatan:jabatan.value.trim(),
    tanggalLahir:tanggalLahir.value,domisili:domisili.value.trim(),tanggalJoin:tanggalJoin.value
  };
  if (!payload.nama||!payload.passport||!payload.jabatan) return showToast("Nama, passport, dan jabatan wajib diisi.","error");
  if (!payload.username) return showToast("Username login wajib diisi (dipakai untuk menghubungkan ke modul lain seperti Cuti).","error");
  if (!payload.tanggalLahir||!payload.domisili||!payload.tanggalJoin) return showToast("Tanggal lahir, domisili, dan tanggal join wajib diisi.","error");
  btnSave.disabled=true;btnSave.textContent="Menyimpan...";
  try{
    const params=new URLSearchParams({...payload,type:payload.row?"editStaff":"addStaff",token:getLoginToken()});
    const response=await fetch(`${BASE_URL}?${params.toString()}`);
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const result=await response.json();
    showToast(result.message||"Proses selesai.",result.success?"success":"error");
    if(result.success){closeModal();await loadStaff();}
  }catch(error){console.error(error);showToast("Terjadi kesalahan saat menyimpan data.","error")}
  finally{btnSave.disabled=false;btnSave.textContent="Simpan"}
}

async function deleteStaff(row) {
  if(currentStaffSystemRole!=="MASTER")return;
  const valid=Number(row);
  const x=staffData.find(v=>Number(v.row)===valid);
  if(!valid||valid<=1)return showToast("Data tidak valid.","error");
  if(!confirm(`Hapus ${x?.nama||"staff ini"}?`))return;
  try{
    const response=await fetch(`${BASE_URL}?${new URLSearchParams({type:"deleteStaff",row:String(valid),token:getLoginToken()})}`);
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const result=await response.json();
    showToast(result.message||"Proses selesai.",result.success?"success":"error");
    if(result.success)await loadStaff();
  }catch(error){console.error(error);showToast("Terjadi kesalahan saat menghapus data.","error")}
}
