const U = Auth.require();
const $ = (s, e = document) => e.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(n).toLocaleString('es-CO');
const fdate = d => new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
const day = d => new Date(d).toLocaleDateString('en-CA');
const P = () => DB.get('productos'), C = () => DB.get('clientes'), T = () => DB.get('tickets'), M = () => DB.get('movimientos');
const low = p => p.stock <= p.min;
const kpi = (l, v, c = '') => `<div class="kpi"><small>${l}</small><b class="${c}">${v}</b></div>`;
const f = (n, l, v = '', t = 'text') => `<label>${l}<input name="${n}" type="${t}" value="${esc(v)}" ${t === 'number' ? 'min="0"' : ''}></label>`;
const val = (m, n) => m.querySelector(`[name=${n}]`).value.trim();
const opts = (arr, sel) => arr.map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');

function modal(title, body, onOk, okText = 'Guardar') {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box"><h3>${title}</h3><div class="err" hidden></div>${body}<div class="row end"><button class="btn ghost" data-x>Cerrar</button>${onOk ? `<button class="btn" data-ok>${okText}</button>` : ''}</div></div>`;
  document.body.append(m);
  m.onclick = e => { if (e.target === m || e.target.hasAttribute('data-x')) m.remove(); };
  const ok = $('[data-ok]', m);
  if (ok) ok.onclick = () => {
    const r = onOk(m);
    if (r === true) { m.remove(); go(); } else if (r) { const er = $('.err', m); er.textContent = r; er.hidden = false; }
  };
}

/* Movimiento de stock con trazabilidad (quién, cuándo, cuánto) */
function moveStock(pid, tipo, qty, obs) {
  const ps = P(), p = ps.find(x => x.id === pid);
  if (!p) return 'Producto no encontrado.';
  if (!(qty > 0)) return 'La cantidad debe ser mayor que cero.';
  if (tipo === 'salida' && qty > p.stock) return `Stock insuficiente de "${p.nombre}" (disponible: ${p.stock}).`;
  p.stock += tipo === 'entrada' ? qty : -qty;
  DB.set('productos', ps);
  DB.set('movimientos', [...M(), { id: DB.id(), fecha: new Date().toISOString(), tipo, pid, nombre: p.nombre, qty, obs, usuario: U.nombre }]);
  return null;
}

/* ---------- Vistas ---------- */
function ticketTable(list) {
  if (!list.length) return '<p class="empty">No hay tickets recientes</p>';
  return `<table><tr><th>Ticket</th><th>Fecha</th><th>Cliente</th><th>Pago</th><th class="r">Total</th><th></th></tr>${list.map(t => `<tr><td>${t.id}</td><td>${fdate(t.fecha)}</td><td>${esc(t.cliente)}</td><td>${t.pago}</td><td class="r">${money(t.total)}</td><td class="r"><button class="btn ghost sm" data-act="ver" data-id="${t.id}">Ver</button></td></tr>`).join('')}</table>`;
}

function inicio() {
  const t = T(), hoy = t.filter(x => day(x.fecha) === day(new Date())), lows = P().filter(low);
  return `<div class="kpis">${kpi('Ventas del día', money(hoy.reduce((a, x) => a + x.total, 0)))}${kpi('Tickets generados', t.length)}${kpi('Stock bajo', lows.length, 'red')}${kpi('Clientes atendidos', new Set(t.filter(x => x.clienteId).map(x => x.clienteId)).size, 'green')}</div>
  ${lows.length ? `<div class="alert">⚠️ Stock bajo: ${lows.map(p => esc(p.nombre) + ' (' + p.stock + ')').join(', ')}</div>` : ''}
  <div class="panel"><h3>Últimos tickets</h3>${ticketTable(t.slice(-5).reverse())}</div>`;
}

let q = '', cat = '';
function invRows() {
  const l = P().filter(p => (!cat || p.categoria === cat) && (p.nombre + p.codigo).toLowerCase().includes(q.toLowerCase()));
  if (!l.length) return '<tr><td colspan="7" class="empty">Sin productos</td></tr>';
  return l.map(p => `<tr><td>${esc(p.codigo)}</td><td>${esc(p.nombre)}</td><td>${p.categoria}</td><td class="r">${money(p.precio)}</td><td class="r">${p.stock}</td><td><span class="badge ${p.stock === 0 ? 'out' : low(p) ? 'low' : ''}">${p.stock === 0 ? 'Agotado' : low(p) ? 'Stock bajo' : 'Disponible'}</span></td>
  <td class="r"><button class="btn ghost sm" data-act="mov-new" data-id="${p.id}">± Stock</button> <button class="btn ghost sm" data-act="prod-edit" data-id="${p.id}">Editar</button> <button class="btn dng sm" data-act="prod-del" data-id="${p.id}">Eliminar</button></td></tr>`).join('');
}
function inventario() {
  return `<div class="row"><input id="q" placeholder="Buscar por nombre o código" value="${esc(q)}"><select id="cat"><option value="">Todas las categorías</option>${opts(CATS.map(c => [c, c]), cat)}</select><button class="btn" data-act="prod-new">+ Nuevo producto</button></div>
  <div class="panel"><table><tr><th>Código</th><th>Producto</th><th>Categoría</th><th class="r">Precio</th><th class="r">Stock</th><th>Estado</th><th></th></tr><tbody id="tb">${invRows()}</tbody></table></div>`;
}
function prodForm(id) {
  const p = id ? P().find(x => x.id === id) : { codigo: '', nombre: '', categoria: CATS[0], precio: '', stock: 0, min: 3 };
  modal(id ? 'Editar producto' : 'Nuevo producto', `<div class="grid2">${f('codigo', 'Código', p.codigo)}${f('nombre', 'Nombre', p.nombre)}<label>Categoría<select name="categoria">${opts(CATS.map(c => [c, c]), p.categoria)}</select></label>${f('precio', 'Precio unitario', p.precio, 'number')}${id ? '' : f('stock', 'Stock inicial', p.stock, 'number')}${f('min', 'Stock mínimo', p.min, 'number')}</div>${id ? '<p style="color:var(--mut);margin-top:10px">El stock se modifica desde "± Stock" para dejar registro del movimiento.</p>' : ''}`, m => {
    const d = { codigo: val(m, 'codigo'), nombre: val(m, 'nombre'), categoria: val(m, 'categoria'), precio: +val(m, 'precio'), min: +val(m, 'min') };
    if (!d.codigo || !d.nombre) return 'Código y nombre son obligatorios.';
    if (!(d.precio > 0)) return 'El precio debe ser mayor que cero.';
    if (P().some(x => x.codigo.toLowerCase() === d.codigo.toLowerCase() && x.id !== id)) return 'Ya existe un producto con ese código.';
    if (id) { DB.set('productos', P().map(x => x.id === id ? { ...x, ...d } : x)); return true; }
    const stock = +val(m, 'stock') || 0, np = { id: DB.id(), ...d, stock: 0 };
    DB.set('productos', [...P(), np]);
    if (stock > 0) moveStock(np.id, 'entrada', stock, 'Inventario inicial');
    return true;
  });
}
function movForm(pid) {
  modal('Registrar movimiento', `<div class="grid2"><label>Producto<select name="pid">${opts(P().map(p => [p.id, `${p.nombre} (stock ${p.stock})`]), pid)}</select></label><label>Tipo<select name="tipo"><option value="entrada">Entrada</option><option value="salida">Salida</option></select></label>${f('qty', 'Cantidad', 1, 'number')}${f('obs', 'Observación')}</div>`,
    m => moveStock(val(m, 'pid'), val(m, 'tipo'), +val(m, 'qty'), val(m, 'obs')) || true);
}

function ventas() { return `<div class="panel"><h3>Historial de ventas</h3>${ticketTable([...T()].reverse())}</div>`; }
function ticketModal(id) {
  const t = T().find(x => x.id === id); if (!t) return;
  modal(`Ticket ${t.id}`, `<p style="color:var(--mut)">${fdate(t.fecha)} · ${esc(t.cliente)} · ${t.pago}<br>Atendió: ${esc(t.usuario)}</p><table class="tk"><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Subtotal</th></tr>${t.items.map(i => `<tr><td>${esc(i.nombre)}</td><td class="r">${i.qty}</td><td class="r">${money(i.precio)}</td><td class="r">${money(i.qty * i.precio)}</td></tr>`).join('')}</table><div class="tot">Total: ${money(t.total)}</div><button class="btn ghost" onclick="window.print()">🖨 Imprimir</button>`);
}

function clientes() {
  const l = C();
  return `<div class="row"><button class="btn" data-act="cli-new">+ Nuevo cliente</button></div><div class="panel"><table><tr><th>Nombre</th><th>Cédula</th><th>Teléfono</th><th>Correo</th><th></th></tr>${l.length ? l.map(c => `<tr><td>${esc(c.nombre)}</td><td>${esc(c.cedula)}</td><td>${esc(c.telefono)}</td><td>${esc(c.correo)}</td><td class="r"><button class="btn ghost sm" data-act="cli-edit" data-id="${c.id}">Editar</button> <button class="btn dng sm" data-act="cli-del" data-id="${c.id}">Eliminar</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty">Sin clientes</td></tr>'}</table></div>`;
}
function cliForm(id) {
  const c = id ? C().find(x => x.id === id) : { nombre: '', cedula: '', telefono: '', correo: '' };
  modal(id ? 'Editar cliente' : 'Nuevo cliente', `<div class="grid2">${f('nombre', 'Nombre completo', c.nombre)}${f('cedula', 'Cédula', c.cedula)}${f('telefono', 'Teléfono', c.telefono)}${f('correo', 'Correo (opcional)', c.correo, 'email')}</div>`, m => {
    const d = { nombre: val(m, 'nombre'), cedula: val(m, 'cedula'), telefono: val(m, 'telefono'), correo: val(m, 'correo') };
    if (!d.nombre || !d.cedula || !d.telefono) return 'Nombre, cédula y teléfono son obligatorios.';
    if (!/^\d+$/.test(d.cedula)) return 'La cédula debe ser numérica.';
    if (!/^\d{7,10}$/.test(d.telefono)) return 'Teléfono inválido (7 a 10 dígitos).';
    if (d.correo && !/^\S+@\S+\.\S+$/.test(d.correo)) return 'Correo electrónico inválido.';
    const o = C().filter(x => x.id !== id);
    if (o.some(x => x.cedula === d.cedula)) return 'Ya existe un cliente con esa cédula.';
    if (d.correo && o.some(x => x.correo.toLowerCase() === d.correo.toLowerCase())) return 'Ese correo ya está registrado.';
    DB.set('clientes', id ? C().map(x => x.id === id ? { ...x, ...d } : x) : [...C(), { id: DB.id(), ...d }]);
    return true;
  });
}

let mt = '';
function movimientos() {
  const l = [...M()].reverse().filter(x => !mt || x.tipo === mt);
  return `<div class="row"><select id="mt"><option value="">Entradas y salidas</option>${opts([['entrada', 'Solo entradas'], ['salida', 'Solo salidas']], mt)}</select><button class="btn" data-act="mov-new">+ Registrar movimiento</button></div><div class="panel"><table><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="r">Cant.</th><th>Observación</th><th>Responsable</th></tr>${l.length ? l.map(x => `<tr><td>${fdate(x.fecha)}</td><td>${esc(x.nombre)}</td><td><span class="badge ${x.tipo === 'salida' ? 'out' : ''}">${x.tipo}</span></td><td class="r">${x.qty}</td><td>${esc(x.obs)}</td><td>${esc(x.usuario)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">Sin movimientos</td></tr>'}</table></div>`;
}

let rf = '', rt = '';
const ventasFiltradas = () => T().filter(t => (!rf || day(t.fecha) >= rf) && (!rt || day(t.fecha) <= rt));
const ventasRep = () => { const l = ventasFiltradas(); return ticketTable([...l].reverse()) + `<div class="tot">Total: ${money(l.reduce((a, x) => a + x.total, 0))}</div>`; };
function reportes() {
  const p = P(), t = T(), lows = p.filter(low);
  return `<div class="kpis">${kpi('Valor del inventario', money(p.reduce((a, x) => a + x.stock * x.precio, 0)))}${kpi('Productos', p.length)}${kpi('Stock bajo', lows.length, 'red')}${kpi('Ventas totales', money(t.reduce((a, x) => a + x.total, 0)), 'green')}</div>
  <div class="panel"><h3>Ventas realizadas</h3><div class="row"><input type="date" id="rf" value="${rf}"><input type="date" id="rt" value="${rt}"><button class="btn" data-act="csv-ventas">Exportar CSV</button></div><div id="rv">${ventasRep()}</div></div>
  <div class="panel"><h3>Productos con menor stock</h3><div class="row"><button class="btn" data-act="csv-inv">Exportar inventario CSV</button></div><table><tr><th>Producto</th><th class="r">Stock</th><th class="r">Mínimo</th></tr>${[...p].sort((a, b) => a.stock - b.stock).slice(0, 5).map(x => `<tr><td>${esc(x.nombre)}</td><td class="r">${x.stock}</td><td class="r">${x.min}</td></tr>`).join('')}</table></div>`;
}
function csv(name, rows) {
  const txt = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + txt], { type: 'text/csv' })); a.download = name; a.click();
}

/* Nuevo ticket */
let cart = [];
const cartTotal = () => cart.reduce((a, i) => a + i.qty * i.precio, 0);
function cartHtml() {
  return `<table class="tk"><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Subtotal</th><th></th></tr>${cart.length ? cart.map((i, n) => `<tr><td>${esc(i.nombre)}</td><td class="r">${i.qty}</td><td class="r">${money(i.qty * i.precio)}</td><td class="r"><button class="btn dng sm" data-act="cart-del" data-id="${n}">✕</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty">Agregue productos al ticket</td></tr>'}</table><div class="tot">Total: ${money(cartTotal())}</div><button class="btn" data-act="cart-save">Generar ticket</button>`;
}
function nuevo() {
  return `<div class="panel"><div class="grid2"><label>Cliente<select id="tcli"><option value="">Cliente de mostrador</option>${opts(C().map(c => [c.id, `${c.nombre} - ${c.cedula}`]))}</select></label><label>Método de pago<select id="tpago"><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option></select></label></div><br>
  <div class="row"><select id="tprod">${opts(P().filter(p => p.stock > 0).map(p => [p.id, `${p.nombre} · ${money(p.precio)} (stock ${p.stock})`]))}</select><input id="tqty" type="number" min="1" value="1" style="max-width:100px"><button class="btn" data-act="cart-add">Agregar</button></div><div id="cart">${cartHtml()}</div></div>`;
}

/* ---------- Acciones y enrutador ---------- */
const acts = {
  'prod-new': () => prodForm(), 'prod-edit': prodForm,
  'prod-del': id => { if (confirm('¿Eliminar este producto?')) { DB.set('productos', P().filter(p => p.id !== id)); go(); } },
  'mov-new': movForm, 'cli-new': () => cliForm(), 'cli-edit': cliForm,
  'cli-del': id => { if (confirm('¿Eliminar este cliente?')) { DB.set('clientes', C().filter(c => c.id !== id)); go(); } },
  'ver': ticketModal,
  'csv-ventas': () => csv('ventas.csv', [['Ticket', 'Fecha', 'Cliente', 'Pago', 'Total'], ...ventasFiltradas().map(t => [t.id, fdate(t.fecha), t.cliente, t.pago, t.total])]),
  'csv-inv': () => csv('inventario.csv', [['Código', 'Producto', 'Categoría', 'Precio', 'Stock', 'Mínimo'], ...P().map(p => [p.codigo, p.nombre, p.categoria, p.precio, p.stock, p.min])]),
  'cart-add': () => {
    const p = P().find(x => x.id === $('#tprod').value), qty = +$('#tqty').value; if (!p || !(qty > 0)) return;
    const ya = cart.find(i => i.pid === p.id), tot = (ya ? ya.qty : 0) + qty;
    if (tot > p.stock) return alert(`Stock insuficiente. Disponible: ${p.stock}`);
    ya ? ya.qty = tot : cart.push({ pid: p.id, nombre: p.nombre, qty, precio: p.precio });
    $('#cart').innerHTML = cartHtml();
  },
  'cart-del': n => { cart.splice(+n, 1); $('#cart').innerHTML = cartHtml(); },
  'cart-save': () => {
    if (!cart.length) return alert('Agregue al menos un producto.');
    const id = 'T-' + String(T().length + 1).padStart(4, '0'), cl = C().find(c => c.id === $('#tcli').value);
    for (const i of cart) { const e = moveStock(i.pid, 'salida', i.qty, 'Venta ' + id); if (e) return alert(e); }
    DB.set('tickets', [...T(), { id, fecha: new Date().toISOString(), clienteId: cl?.id || '', cliente: cl?.nombre || 'Cliente de mostrador', items: cart, pago: $('#tpago').value, total: cartTotal(), usuario: U.nombre }]);
    cart = []; location.hash = '#ventas'; ticketModal(id);
  }
};
const routes = { inicio: ['Inicio', inicio], inventario: ['Inventario', inventario], ventas: ['Ventas / Tickets', ventas], clientes: ['Clientes', clientes], movimientos: ['Movimientos', movimientos], reportes: ['Reportes', reportes], nuevo: ['Nuevo Ticket', nuevo] };
function go() {
  const k = routes[location.hash.slice(1)] ? location.hash.slice(1) : 'inicio';
  $('#title').textContent = 'Solo Frenos Admin - ' + routes[k][0];
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.k === k));
  $('#main').innerHTML = routes[k][1]();
}
$('#uname').textContent = U.nombre;
$('#out').onclick = e => { e.preventDefault(); Auth.logout(); };
window.onhashchange = go;
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) acts[b.dataset.act]?.(b.dataset.id); });
document.addEventListener('input', e => {
  const i = e.target.id;
  if (i === 'q' || i === 'cat') { q = $('#q').value; cat = $('#cat').value; $('#tb').innerHTML = invRows(); }
  if (i === 'mt') { mt = e.target.value; go(); }
  if (i === 'rf' || i === 'rt') { rf = $('#rf').value; rt = $('#rt').value; $('#rv').innerHTML = ventasRep(); }
});
go();
