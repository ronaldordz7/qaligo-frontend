// =========================
// CONFIGURACIÓN
// =========================
const API_BASE = "https://qaligo-backend.onrender.com";

const STORAGE_CART_KEY = "qaligo_cart";
const STORAGE_TOKEN_KEY = "qaligo_token";
const STORAGE_USER_KEY = "qaligo_user";

let cart = JSON.parse(localStorage.getItem(STORAGE_CART_KEY) || "[]");
let token = localStorage.getItem(STORAGE_TOKEN_KEY) || null;
let currentUser = JSON.parse(localStorage.getItem(STORAGE_USER_KEY) || "null");

// =========================
// UTILIDADES GENERALES
// =========================
function saveCart() {
  localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(cart));
  updateNavCartCount();
}

function setAuth(user, jwtToken) {
  currentUser = user;
  token = jwtToken;
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  localStorage.setItem(STORAGE_TOKEN_KEY, jwtToken);
  updateNavAuth();
}

function clearAuth() {
  currentUser = null;
  token = null;
  localStorage.removeItem(STORAGE_USER_KEY);
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  updateNavAuth();
}

function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

// =========================
// NAVBAR
// =========================
function updateNavAuth() {
  const btn = document.getElementById("nav-auth-btn");
  if (!btn) return;

  if (currentUser) {
    btn.textContent = currentUser.name || currentUser.email;
    btn.href = "profile.html";
  } else {
    btn.textContent = "Iniciar sesión";
    btn.href = "login.html";
  }
}

function updateNavCartCount() {
  const span = document.getElementById("nav-cart-count");
  if (!span) return;
  const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
  span.textContent = totalQty;
}

// =========================
// PRODUCTOS & MENÚ
// =========================
async function initMenuPage() {
  const grid = document.getElementById("product-grid");
  if (!grid) return;

  const filterRow = document.getElementById("filter-row");
  const searchInput = document.getElementById("search-input");

  try {
    const res = await apiFetch("/api/products");

    const products = await res.json();

    const categories = ["Todo", ...new Set(products.map((p) => p.category || "Otros"))];

    // Filtros
    filterRow.innerHTML = "";
    categories.forEach((cat, idx) => {
      const btn = document.createElement("button");
      btn.className = "filter-pill" + (idx === 0 ? " active" : "");
      btn.textContent = cat;
      btn.dataset.category = cat;
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-pill").forEach((el) => el.classList.remove("active"));
        btn.classList.add("active");
        const filtered =
          cat === "Todo" ? products : products.filter((p) => p.category === cat);
        renderProductGrid(filtered, grid);
      });
      filterRow.appendChild(btn);
    });

    // Búsqueda por texto
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const text = e.target.value.toLowerCase();
        const filtered = products.filter(
          (p) =>
            p.name.toLowerCase().includes(text) ||
            (p.description && p.description.toLowerCase().includes(text))
        );
        renderProductGrid(filtered, grid);
      });
    }

    renderProductGrid(products, grid);
  } catch (err) {
    console.error(err);
    grid.innerHTML = "<p>Error cargando productos.</p>";
  }

  renderCartPanel();

  const btnCheckout = document.getElementById("btn-go-checkout");
  if (btnCheckout) {
    btnCheckout.addEventListener("click", () => {
      window.location.href = "checkout.html";
    });
  }

  setupChatbot();
}

function renderProductGrid(products, grid) {
  grid.innerHTML = "";
  products.forEach((p) => {
    const price = Number(p.price);
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${p.imageUrl ||
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"}" alt="${p.name}">
      <div class="product-card-body">
        <div class="product-card-title">${p.name}</div>
        <div class="product-card-desc">${p.description || ""}</div>
        <div class="product-card-footer">
          <span class="product-price">S/ ${price.toFixed(2)}</span>
          <button class="btn-add" data-id="${p.id}">+</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.addEventListener(
    "click",
    (e) => {
      if (e.target.matches(".btn-add")) {
        const id = Number(e.target.dataset.id);
        const product = products.find((p) => p.id === id);
        if (product) addToCart(product);
      }
    },
  );
}

// =========================
// CARRITO
// =========================
function addToCart(product) {
  const existing = cart.find((i) => i.id === product.id);
  if (existing) existing.qty += 1;
  else
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      qty: 1,
    });
  saveCart();
  renderCartPanel();
}

function changeCartQuantity(productId, delta) {
  const item = cart.find((i) => i.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter((i) => i.id !== productId);
  }
  saveCart();
  renderCartPanel();
}

function renderCartPanel() {
  const itemsContainer = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total");
  if (!itemsContainer || !totalEl) return;

  itemsContainer.innerHTML = "";
  let total = 0;

  cart.forEach((item) => {
    total += item.price * item.qty;
    const row = document.createElement("div");
    row.className = "cart-item-row";
    row.innerHTML = `
      <span>${item.name}</span>
      <span class="cart-item-controls">
        <button data-id="${item.id}" data-delta="-1">-</button>
        <span>${item.qty}</span>
        <button data-id="${item.id}" data-delta="1">+</button>
        <span>S/ ${(item.price * item.qty).toFixed(2)}</span>
      </span>
    `;
    itemsContainer.appendChild(row);
  });

  totalEl.textContent = `S/ ${total.toFixed(2)}`;

  itemsContainer.addEventListener(
    "click",
    (e) => {
      if (e.target.tagName === "BUTTON") {
        const id = Number(e.target.dataset.id);
        const delta = Number(e.target.dataset.delta);
        changeCartQuantity(id, delta);
      }
    },
    { once: true }
  );
}

// =========================
// CHECKOUT
// =========================
function initCheckoutPage() {
  const list = document.getElementById("checkout-items");
  if (!list) return;

  updateCheckoutSummary();

  const btnConfirm = document.getElementById("btn-confirm-order");
  const msgEl = document.getElementById("checkout-message");

  btnConfirm.addEventListener("click", async () => {
    if (!currentUser || !token) {
      msgEl.style.color = "#dc2626";
      msgEl.textContent = "Debes iniciar sesión para confirmar tu pedido.";
      return;
    }

    if (cart.length === 0) {
      msgEl.style.color = "#dc2626";
      msgEl.textContent = "Tu carrito está vacío.";
      return;
    }

    const itemsPayload = cart.map((item) => ({
      productId: item.id,
      quantity: item.qty,
    }));

    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          items: itemsPayload,
          // puedes agregar aquí address si luego lo manejas en el backend
        }),
      });

      if (!res.ok) throw new Error("Error en pedido");

      await res.json();

      msgEl.style.color = "#16a34a";
      msgEl.textContent = "¡Pedido confirmado! 🎉";

      cart = [];
      saveCart();
      updateCheckoutSummary();
    } catch (err) {
      console.error(err);
      msgEl.style.color = "#dc2626";
      msgEl.textContent = "Error al confirmar el pedido.";
    }
  });
}

function updateCheckoutSummary() {
  const list = document.getElementById("checkout-items");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const shippingEl = document.getElementById("checkout-shipping");
  const totalEl = document.getElementById("checkout-total");
  if (!list || !subtotalEl || !shippingEl || !totalEl) return;

  list.innerHTML = "";
  let subtotal = 0;
  cart.forEach((item) => {
    subtotal += item.price * item.qty;
    const row = document.createElement("div");
    row.className = "cart-item-row";
    row.innerHTML = `
      <span>${item.name} x${item.qty}</span>
      <span>S/ ${(item.price * item.qty).toFixed(2)}</span>
    `;
    list.appendChild(row);
  });

  const shipping = cart.length > 0 ? 5 : 0;
  subtotalEl.textContent = `S/ ${subtotal.toFixed(2)}`;
  shippingEl.textContent = `S/ ${shipping.toFixed(2)}`;
  totalEl.textContent = `S/ ${(subtotal + shipping).toFixed(2)}`;
}

// =========================
// LOGIN / REGISTRO
// =========================
function initAuthPages() {
  const btnLogin = document.getElementById("btn-login");
  const btnRegister = document.getElementById("btn-register");

  if (btnLogin) {
    const msg = document.getElementById("login-message");
    btnLogin.addEventListener("click", async () => {
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) throw new Error("Credenciales inválidas");

        const data = await res.json(); // { user, token }
        setAuth(data.user, data.token);

        msg.style.color = "#16a34a";
        msg.textContent = "Inicio de sesión exitoso. Redirigiendo...";

        setTimeout(() => {
          window.location.href = "menu.html";
        }, 800);
      } catch (err) {
        console.error(err);
        msg.style.color = "#dc2626";
        msg.textContent = "Error al iniciar sesión.";
      }
    });
  }

  if (btnRegister) {
    const msg = document.getElementById("register-message");
    btnRegister.addEventListener("click", async () => {
      const name = document.getElementById("reg-name").value;
      const email = document.getElementById("reg-email").value;
      const password = document.getElementById("reg-password").value;

      try {
        const res = await fetch(`${API_BASE}/auth/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        if (!res.ok) throw new Error("Error en registro");

        await res.json();
        msg.style.color = "#16a34a";
        msg.textContent = "Registro exitoso. Ahora puedes iniciar sesión.";
      } catch (err) {
        console.error(err);
        msg.style.color = "#dc2626";
        msg.textContent = "Error al registrar usuario.";
      }
    });
  }
}

// =========================
// PERFIL + ÓRDENES
// =========================
async function initProfilePage() {
  const nameEl = document.getElementById("profile-name");
  if (!nameEl) return;

  if (!currentUser || !token) {
    nameEl.textContent = "Debes iniciar sesión para ver tu perfil.";
    return;
  }

  nameEl.textContent = currentUser.name;
  const emailEl = document.getElementById("profile-email");
  if (emailEl) emailEl.textContent = currentUser.email;

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      clearAuth();
      window.location.href = "menu.html";
    });
  }

  const ordersList = document.getElementById("orders-list");
  try {
    const res = await apiFetch(`api/orders/${currentUser.id}`);
    if (!res.ok) throw new Error("Error obteniendo órdenes");
    const orders = await res.json();

    if (!orders.length) {
      ordersList.innerHTML = "<p>No tienes pedidos aún.</p>";
      return;
    }

    ordersList.innerHTML = "";
    orders.forEach((order) => {
      const card = document.createElement("div");
      card.className = "order-card";
      card.innerHTML = `
        <div><strong>Pedido #${order.id}</strong> - ${order.status}</div>
        <div>Total: S/ ${Number(order.total).toFixed(2)}</div>
        <div>Items: ${order.orderItems.length}</div>
      `;
      ordersList.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    ordersList.innerHTML = "<p>Error al cargar pedidos.</p>";
  }
}

// =========================
// CHATBOT
// =========================
function setupChatbot() {
  const panel = document.getElementById("chatbot-panel");
  const log = document.getElementById("chat-log");
  const input = document.getElementById("chat-input");
  const btn = document.getElementById("chat-send-btn");
  const toggleBtn = document.getElementById("nav-chat-toggle");

  if (!panel || !log || !input || !btn) return;

  const pushBot = (text) => {
    const div = document.createElement("div");
    div.className = "chat-msg-bot";
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  };

  const pushUser = (text) => {
    const div = document.createElement("div");
    div.className = "chat-msg-user";
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  };

  pushBot("¡Hola! Soy Q'aliBot 🤖. Dime si buscas algo ligero, alto en proteína o vegano.");

  btn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    pushUser(text);

    const lower = text.toLowerCase();
    let reply =
      "Para algo balanceado te recomiendo nuestros bowls con quinoa, verduras y proteína magra.";

    if (lower.includes("ligero") || lower.includes("bajo en calorías")) {
      reply = "Prueba una de nuestras ensaladas verdes, son súper ligeras. 🥗";
    } else if (lower.includes("proteína") || lower.includes("gym")) {
      reply =
        "Los bowls con pollo o tofu y quinoa son ideales para alta proteína sin exceso de grasa.";
    } else if (lower.includes("vegano") || lower.includes("vegetal")) {
      reply =
        "Tenemos wraps y bowls veganos con legumbres, quinoa y verduras frescas. 🌱";
    }

    setTimeout(() => pushBot(reply), 400);
    input.value = "";
  });

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      panel.style.display = panel.style.display === "none" ? "flex" : "none";
    });
  }
}

// =========================
// INICIALIZACIÓN
// =========================
document.addEventListener("DOMContentLoaded", () => {
  updateNavAuth();
  updateNavCartCount();

  const page = document.body.dataset.page;

  if (page === "menu") {
    initMenuPage();
  } else if (page === "checkout") {
    renderCartPanel();
    updateCheckoutSummary();
    initCheckoutPage();
  } else if (page === "login" || page === "register") {
    initAuthPages();
  } else if (page === "profile") {
    initProfilePage();
  }
});
