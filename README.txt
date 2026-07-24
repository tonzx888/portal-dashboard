OPERATION CENTER - UI BUG FIX

Cara pasang:
1. Tutup tab browser dashboard.
2. Copy seluruh file dalam folder ini ke folder project portal-dashboard.
3. Pilih Replace the files in the destination.
4. Jangan hapus atau replace folder .git.
5. Buka kembali project, lalu tekan Ctrl+F5 pada browser untuk hard refresh.

File baru:
- cuti.css

Perubahan:
- Data Staff memakai shell Dashboard V2.
- Jadwal Cuti memakai shell Dashboard V2.
- Jadwal Offday memakai shell Dashboard V2.
- Manajemen User memakai shell Dashboard V2.
- Topbar, sidebar, user chip, tombol keluar, card, tabel, form, dan modal diseragamkan.
- ID elemen, endpoint API, role permission, dan logika CRUD dipertahankan.

Commit:
git add .
git commit -m "fix(ui): unify active modules with dashboard v2 shell"
git push
