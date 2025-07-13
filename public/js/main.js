document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const correo = e.target.correo.value;
  const contraseña = e.target.contraseña.value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, contraseña })
  });

  const data = await res.json();
  alert(data.mensaje);
});
