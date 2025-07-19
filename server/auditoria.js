const sql = require("mssql");
const { config } = require("./db");

/**
 * Registra un evento de auditoría en la tabla Auditoria.
 * @param {Object} data - Objeto con los datos de auditoría.
 * @param {string} data.usuario - Usuario que realizó la acción.
 * @param {string} data.accion - Descripción de la acción realizada.
 * @param {string} data.ip - Dirección IP del cliente.
 * @param {string} data.navegador - Navegador/Agente del cliente.
 * @param {string} [data.metodo_pago] - Método de pago (opcional).
 * @param {string} [data.producto] - Producto afectado (opcional).
 * @param {number} [data.cantidad] - Cantidad de producto (opcional).
 * @param {string} [data.error] - Mensaje de error (opcional).
 */
async function registrarAuditoria({
  usuario,
  accion,
  ip,
  navegador,
  metodo_pago = null,
  producto = null,
  cantidad = null,
  error = null
}) {
  try {
    await sql.connect(config);
    await sql.query`
      INSERT INTO Auditoria (usuario, accion, ip, navegador, fecha, metodo_pago, producto, cantidad, error)
      VALUES (${usuario}, ${accion}, ${ip}, ${navegador}, GETDATE(), ${metodo_pago}, ${producto}, ${cantidad}, ${error})
    `;
  } catch (err) {
    console.error("Error al registrar auditoría:", err);
  }
}

module.exports = { registrarAuditoria };

