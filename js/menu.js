const botonMenu = document.getElementById("botonMenu");
const botonCerrarMenu = document.getElementById("botonCerrarMenu");
const menuNav = document.getElementById("menuNav");
const fondoMenu = document.getElementById("fondoMenu");

function abrirMenu() {
  menuNav.classList.add("abierto");
  fondoMenu.classList.add("activo");
}

function cerrarMenu() {
  menuNav.classList.remove("abierto");
  fondoMenu.classList.remove("activo");
}

if (botonMenu) botonMenu.addEventListener("click", abrirMenu);
if (botonCerrarMenu) botonCerrarMenu.addEventListener("click", cerrarMenu);
if (fondoMenu) fondoMenu.addEventListener("click", cerrarMenu);