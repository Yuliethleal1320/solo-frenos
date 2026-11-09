/* Datos locales (localStorage) + autenticación de demostración */
const DB = {
  get(k) { try { return JSON.parse(localStorage.getItem('sf_' + k)); } catch { return null; } },
  set(k, v) { localStorage.setItem('sf_' + k, JSON.stringify(v)); },
  id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
};
const CATS = ['Frenos', 'Rodamientos', 'Bandas', 'Engrases', 'Bosters', 'Bombas'];

(function seed() {
  if (DB.get('productos')) return;
  const p = (codigo, nombre, categoria, precio, stock, min) => ({ id: DB.id(), codigo, nombre, categoria, precio, stock, min });
  DB.set('productos', [
    p('FR-001', 'Pastillas de freno delanteras', 'Frenos', 85000, 12, 5),
    p('FR-002', 'Pastillas de freno traseras', 'Frenos', 70000, 10, 5),
    p('FR-003', 'Disco de freno', 'Frenos', 160000, 6, 3),
    p('FR-004', 'Líquido de frenos DOT 4', 'Frenos', 18000, 20, 8),
    p('RO-001', 'Rodamiento de rueda', 'Rodamientos', 45000, 3, 4),
    p('BA-001', 'Banda de freno', 'Bandas', 38000, 9, 4),
    p('EN-001', 'Grasa para rodamientos', 'Engrases', 15000, 14, 5),
    p('BO-001', 'Bóster de freno', 'Bosters', 380000, 2, 2),
    p('BM-001', 'Bomba de freno', 'Bombas', 190000, 5, 2)
  ]);
  DB.set('clientes', [{ id: DB.id(), nombre: 'Cliente de ejemplo', cedula: '1000000001', telefono: '3001234567', correo: 'ejemplo@correo.com' }]);
  DB.set('tickets', []);
  DB.set('movimientos', []);
})();

const Auth = {
  users: [
    { u: 'admin_taller', p: 'admin123', nombre: 'Tobías Hoyos Garzón', rol: 'Administrador' },
    { u: 'sandra', p: 'sandra123', nombre: 'Sandra Mireya Leal Gil', rol: 'Propietaria' }
  ],
  login(u, p, remember) {
    const f = this.users.find(x => x.u === u && x.p === p);
    if (!f) return false;
    (remember ? localStorage : sessionStorage).setItem('sf_session', JSON.stringify({ u: f.u, nombre: f.nombre, rol: f.rol }));
    return true;
  },
  current() {
    try { return JSON.parse(sessionStorage.getItem('sf_session') || localStorage.getItem('sf_session')); } catch { return null; }
  },
  require() { const s = this.current(); if (!s) location.replace('login.html'); return s; },
  logout() { sessionStorage.removeItem('sf_session'); localStorage.removeItem('sf_session'); location.href = 'index.html'; }
};
