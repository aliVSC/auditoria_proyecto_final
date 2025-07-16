const sql = require("mssql");
const { config } = require("./db");

async function registrarAuditoria(usuario, accion, ip, navegador) {
  try {
    await sql.connect(config);
    await sql.query`
      INSERT INTO Auditoria (usuario, accion, ip, navegador, fecha)
      VALUES (${usuario}, ${accion}, ${ip}, ${navegador}, GETDATE())
    `;
  } catch (error) {
    console.error("Error al registrar auditoría:", error);
  }
}

module.exports = { registrarAuditoria };
