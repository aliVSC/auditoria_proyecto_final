// db.js
module.exports.config = {
  user: "sa",
  password: "12345",
  server: "localhost",
  port: 1433, // Este valor es obligatorio si estás viendo errores de conexión
  database: "TiendaAuthentic",
  options: {
    encrypt: false, // o true si usas Azure
    trustServerCertificate: true,
  }
};

