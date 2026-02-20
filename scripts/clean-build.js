/**
 * Hapus folder .next dan out agar build berikutnya bersih.
 * Dipanggil sebelum deploy supaya semua fitur terbaru ikut ke hosting.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dirs = ['.next', 'out'];

for (const dir of dirs) {
  const full = path.join(root, dir);
  try {
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true });
      console.log('Dihapus:', dir);
    }
  } catch (err) {
    console.warn('Peringatan: tidak bisa hapus', dir, err.message);
  }
}
