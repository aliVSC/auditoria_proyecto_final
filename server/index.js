const express = require("express");
const path = require("path");
const sql = require("mssql");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const { config } = require("./db");
const { registrarAuditoria } = require("./auditoria");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(express.static(path.join(__dirname, "../public")));

let carritoTemporal = {};

// ------------------ RUTAS ------------------

app.get("/", (req, res) => {
  if (req.query.exito === "1") {
    res.send("<p style='text-align:center;color:green;'>✅ ¡Compra realizada con éxito! Revisa tu correo para la factura.</p>");
  } else {
    res.redirect("/registro");
  }
});

// Registro de usuario
app.get("/registro", (req, res) => {
  res.render("registro");
});

app.post("/registro", async (req, res) => {
  const { cedula, nombres, apellidos, fechaNacimiento, correo, contrasena } = req.body;
  const ip = req.ip;
  const navegador = req.headers["user-agent"];

  try {
    await sql.connect(config);

    const result = await sql.query`SELECT * FROM Usuarios WHERE cedula = ${cedula}`;
    if (result.recordset.length > 0) return res.send("La cédula ya está registrada.");

    await sql.query`
      INSERT INTO Usuarios (cedula, nombres, apellidos, fecha_nacimiento, correo, contrasena)
      VALUES (${cedula}, ${nombres}, ${apellidos}, ${fechaNacimiento}, ${correo}, ${contrasena})
    `;

    await registrarAuditoria({
      usuario: correo,
      accion: "Registro de nuevo usuario",
      ip,
      navegador
    });
    res.redirect("/login");
  } catch (error) {
    console.error("Error en registro:", error);
    await registrarAuditoria({
      usuario: correo,
      accion: "Error en registro de usuario",
      ip,
      navegador,
      error: error.message
    });
    res.status(500).send("Error al registrar usuario.");
  }
});

// Login
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { correo, contrasena } = req.body;
  const ip = req.ip;
  const navegador = req.headers["user-agent"];

  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT * FROM Usuarios WHERE correo = ${correo} AND contrasena = ${contrasena}
    `;

    if (result.recordset.length > 0) {
      await registrarAuditoria({
        usuario: correo,
        accion: "Inicio de sesión exitoso",
        ip,
        navegador
      });
      res.redirect("/informacion.html");
    } else {
      await registrarAuditoria({
        usuario: correo,
        accion: "Intento fallido de inicio de sesión",
        ip,
        navegador
      });
      res.status(401).send("Correo o contraseña incorrectos.");
    }
  } catch (error) {
    console.error("Error en login:", error);
    await registrarAuditoria({
      usuario: correo,
      accion: "Error en login",
      ip,
      navegador,
      error: error.message
    });
    res.status(500).send("Error en el servidor.");
  }
});

// Productos
app.get("/productos", async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query("SELECT * FROM Productos");
    res.render("productos", { productos: result.recordset });
  } catch (error) {
    res.status(500).send("Error al cargar productos.");
  }
});

// Registrar clic en producto
app.post("/producto/clic", async (req, res) => {
  const { correo, producto } = req.body;
  await registrarAuditoria({
    usuario: correo || "Invitado",
    accion: "Clic en producto",
    ip: req.ip,
    navegador: req.headers["user-agent"],
    producto
  });
  res.send("Clic registrado");
});

// Comprar producto individual
app.post("/comprar", async (req, res) => {
  const { usuarioCorreo, productoId, cantidad } = req.body;
  const ip = req.ip;
  const navegador = req.headers["user-agent"];

  try {
    await sql.connect(config);
    const usuarioResult = await sql.query`SELECT id FROM Usuarios WHERE correo = ${usuarioCorreo}`;
    const usuarioId = usuarioResult.recordset[0]?.id;
    if (!usuarioId) return res.status(404).send("Usuario no encontrado");

    const productoResult = await sql.query`SELECT * FROM Productos WHERE id = ${productoId}`;
    const producto = productoResult.recordset[0];
    if (!producto) return res.status(404).send("Producto no encontrado");

    const precioUnitario = producto.precio;
    const compra = await sql.query`INSERT INTO Compras (usuario_id) OUTPUT INSERTED.id VALUES (${usuarioId})`;
    const compraId = compra.recordset[0].id;

    await sql.query`
      INSERT INTO DetalleCompra (compra_id, producto_id, cantidad, precio_unitario)
      VALUES (${compraId}, ${productoId}, ${cantidad}, ${precioUnitario})
    `;

    await registrarAuditoria({
      usuario: usuarioCorreo,
      accion: "Compra realizada (compra individual)",
      ip,
      navegador,
      producto: producto.nombre,
      cantidad
    });

    res.send("Compra realizada con éxito");
  } catch (error) {
    console.error("Error en la compra:", error);
    await registrarAuditoria({
      usuario: usuarioCorreo,
      accion: "Error en compra individual",
      ip,
      navegador,
      error: error.message
    });
    res.status(500).send("Error al realizar compra.");
  }
});

// Historial
app.get("/historial", async (req, res) => {
  const correo = req.query.correo;

  try {
    await sql.connect(config);
    const usuarioResult = await sql.query`SELECT id FROM Usuarios WHERE correo = ${correo}`;
    const usuarioId = usuarioResult.recordset[0]?.id;
    if (!usuarioId) return res.status(404).send("Usuario no encontrado");

    await registrarAuditoria({
      usuario: correo,
      accion: "Visualizó su historial de compras",
      ip: req.ip,
      navegador: req.headers["user-agent"]
    });

    const compras = await sql.query`
      SELECT C.fecha, P.nombre, DC.cantidad, DC.precio_unitario
      FROM Compras C
      JOIN DetalleCompra DC ON C.id = DC.compra_id
      JOIN Productos P ON P.id = DC.producto_id
      WHERE C.usuario_id = ${usuarioId}
      ORDER BY C.fecha DESC
    `;

    res.render("historial", { compras: compras.recordset, correo });
  } catch (error) {
    console.error("Error al obtener historial:", error);
    res.status(500).send("Error al cargar historial.");
  }
});

// Carrito
app.get("/carrito", (req, res) => {
  const carrito = Object.values(carritoTemporal);
  res.render("carrito", { carrito });
});

app.post("/carrito/agregar", async (req, res) => {
  const { productoId, cantidad } = req.body;

  try {
    await sql.connect(config);
    const productoResult = await sql.query`SELECT * FROM Productos WHERE id = ${productoId}`;
    const producto = productoResult.recordset[0];
    if (!producto) return res.status(404).send("Producto no encontrado");

    if (carritoTemporal[productoId]) {
      carritoTemporal[productoId].cantidad += parseInt(cantidad);
    } else {
      carritoTemporal[productoId] = {
        id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: parseInt(cantidad)
      };
    }

    await registrarAuditoria({
      usuario: "Invitado",
      accion: "Agregó producto al carrito",
      ip: req.ip,
      navegador: req.headers["user-agent"],
      producto: producto.nombre,
      cantidad
    });

    res.redirect("/carrito");
  } catch (err) {
    console.error("Error al agregar al carrito:", err);
    res.status(500).send("Error interno");
  }
});

// Checkout
app.get("/checkout", (req, res) => {
  const carrito = Object.values(carritoTemporal);
  res.render("checkout", { carrito });
});

// Finalizar compra
app.post("/finalizar-compra", async (req, res) => {
  const { correo, metodo_pago } = req.body;

  try {
    await sql.connect(config);
    const usuario = await sql.query`SELECT id FROM Usuarios WHERE correo = ${correo}`;
    if (usuario.recordset.length === 0) return res.status(404).send("Usuario no encontrado");

    const usuarioId = usuario.recordset[0].id;
    const compra = await sql.query`
      INSERT INTO Compras (usuario_id, correo, metodo_pago)
      OUTPUT INSERTED.id
      VALUES (${usuarioId}, ${correo}, ${metodo_pago})
    `;
    const compraId = compra.recordset[0].id;

    let total = 0;
    const detalleHTML = Object.values(carritoTemporal).map(p => {
      const subtotal = p.precio * p.cantidad;
      total += subtotal;
      return `<li>${p.nombre} x${p.cantidad} - $${subtotal.toFixed(2)}</li>`;
    }).join("");

    const iva = total * 0.15;
    const totalConIVA = total + iva;

    for (const p of Object.values(carritoTemporal)) {
      await sql.query`
        INSERT INTO DetalleCompra (compra_id, producto_id, cantidad, precio_unitario)
        VALUES (${compraId}, ${p.id}, ${p.cantidad}, ${p.precio})
      `;
    }

    const contenidoHTML = `
      <h2>Factura de tu compra en AUTHENTIC</h2>
      <p><strong>Método de pago:</strong> ${metodo_pago}</p>
      <ul>${detalleHTML}</ul>
      <p><strong>Subtotal:</strong> $${total.toFixed(2)}</p>
      <p><strong>IVA (15%):</strong> $${iva.toFixed(2)}</p>
      <p><strong>Total a pagar:</strong> $${totalConIVA.toFixed(2)}</p>
    `;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "alialanuca05@gmail.com",
        pass: "lrku gler xndn vsgo"
      }
    });

    try {
      await transporter.sendMail({
        from: "AUTHENTIC <TU_CORREO@gmail.com>",
        to: correo,
        subject: "Factura AUTHENTIC",
        html: contenidoHTML
      });
    } catch (err) {
      await registrarAuditoria({
        usuario: correo,
        accion: "Error en envío de PDF",
        ip: req.ip,
        navegador: req.headers["user-agent"],
        error: err.message
      });
      throw err;
    }

    await registrarAuditoria({
      usuario: correo,
      accion: "Realizó una compra",
      ip: req.ip,
      navegador: req.headers["user-agent"],
      metodo_pago,
      producto: Object.values(carritoTemporal).map(p => p.nombre).join(", "),
      cantidad: Object.values(carritoTemporal).reduce((sum, p) => sum + p.cantidad, 0)
    });

    carritoTemporal = {};
    res.redirect("/?exito=1");

  } catch (error) {
    console.error("Error al finalizar compra:", error);
    await registrarAuditoria({
      usuario: correo,
      accion: "Error al finalizar compra",
      ip: req.ip,
      navegador: req.headers["user-agent"],
      error: error.message
    });
    res.status(500).send("Error al procesar la compra.");
  }
});

// ------------------ INICIAR SERVIDOR ------------------
app.listen(3000, () => {
  console.log("Servidor iniciado en http://localhost:3000");
});
