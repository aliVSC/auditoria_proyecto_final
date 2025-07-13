const { sql, config } = require('./db');

async function registrarAuditoria(usuario, accion, ip, navegador) {
  try {
    const pool = await sql.connect(config);
    await pool.request()
      .input('usuario', sql.NVarChar, usuario)
      .input('accion', sql.NVarChar, accion)
      .input('ip', sql.NVarChar, ip)
      .input('navegador', sql.NVarChar, navegador)
      .query('INSERT INTO Auditoria (usuario, accion, ip, navegador) VALUES (@usuario, @accion, @ip, @navegador)');
  } catch (err) {
    console.error("Error al registrar auditoría:", err);
  }
}

module.exports = { registrarAuditoria };
