const API_BASE_URL = 'https://marlet-ia.onrender.com';
const PYTHON_API_URL = 'https://marlet-ia.onrender.com';

// Variables globales
let productos = [];
let pedidos = [];
let categorias = [];

// Inicialización
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM cargado, inicializando...');
    setupEventListeners();
    checkLoginStatus();
});

function setupEventListeners() {
    // Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function () {
            document.querySelector('.sidebar').classList.toggle('active');
        });
    }

    // Navegación
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function () {
            // Remover clase active de todos
            navItems.forEach(nav => nav.classList.remove('active'));
            // Agregar a este
            this.classList.add('active');

            // Ocultar todas las secciones
            const sections = [
                'section-dashboard',
                'section-productos',
                'section-categorias',
                'section-pedidos',
                'section-estadisticas',
                'section-ajustes'
            ];

            sections.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            // Mostrar la sección correspondiente
            const span = this.querySelector('span');
            if (span) {
                const text = span.textContent.trim();
                let sectionId = '';

                if (text === 'Dashboard') sectionId = 'section-dashboard';
                else if (text === 'Productos') sectionId = 'section-productos';
                else if (text === 'Categorías') sectionId = 'section-categorias';
                else if (text === 'Pedidos') sectionId = 'section-pedidos';
                else if (text === 'Estadísticas') sectionId = 'section-estadisticas';
                else if (text === 'Ajustes') sectionId = 'section-ajustes';

                const section = document.getElementById(sectionId);
                if (section) {
                    section.style.display = 'block';
                    // Cargar datos específicos
                    if (sectionId === 'section-productos') loadProducts();
                    if (sectionId === 'section-categorias') loadCategories();
                    if (sectionId === 'section-pedidos') loadOrders();
                    if (sectionId === 'section-estadisticas') renderCharts();
                    if (sectionId === 'section-dashboard') updateDashboard();
                }
            }
        });
    });

    // Botón flotante para agregar producto
    const floatingBtn = document.getElementById('floating-btn');
    if (floatingBtn) {
        floatingBtn.addEventListener('click', function () {
            const addBtn = document.getElementById('add-product-btn');
            if (addBtn) addBtn.click(); // Si existe un botón oculto

            // O abrir modal directamente
            document.getElementById('product-form').reset();
            document.getElementById('product-id').value = '';
            document.getElementById('form-title').textContent = 'Agregar Nuevo Producto';
            // Ir a sección productos si no estamos ahí
            const prodNav = Array.from(document.querySelectorAll('.nav-item span')).find(s => s.textContent.trim() === 'Productos');
            if (prodNav) prodNav.parentElement.click();
        });
    }

    // Configurar botón de guardar producto - ELIMINADO para evitar duplicidad con onclick
    // setupSaveProductButton();
    // Configurar botón de guardar categoría - ELIMINADO
    // setupSaveCategoryButton();
}

// --- LOGIN ---
function handleLogin(e) {
    e.preventDefault();
    console.log('Intento de login...');
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');

    console.log(`Usuario: ${user}, Pass: ${pass}`);

    if (user === 'admin' && pass === 'admin123') {
        console.log('Login exitoso');
        localStorage.setItem('adminLoggedIn', 'true');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-panel').classList.remove('hidden');
        loadInitialData();
    } else {
        console.log('Login fallido');
        if (errorMsg) errorMsg.style.display = 'block';
        alert('Usuario o contraseña incorrectos');
    }
}

function checkLoginStatus() {
    // Verificar si se solicita forzar login desde URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('force_login') === 'true') {
        localStorage.removeItem('adminLoggedIn');
        // Limpiar URL para no buclear
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    const loginScreen = document.getElementById('login-screen');
    const adminPanel = document.getElementById('admin-panel');

    if (isLoggedIn) {
        if (loginScreen) loginScreen.style.display = 'none';
        if (adminPanel) adminPanel.classList.remove('hidden');
        loadInitialData();
    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (adminPanel) adminPanel.classList.add('hidden');
    }
}

function logout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        localStorage.removeItem('adminLoggedIn');
        window.location.href = 'index.html';
    }
}

// --- CARGA DE DATOS INICIAL ---
async function loadInitialData() {
    console.log('Cargando datos iniciales...');
    await loadProducts();
    await loadCategories();
    await loadOrders(); // Cargar pedidos al inicio

    // Actualizar dashboard después de cargar todo
    updateDashboard();
}

async function loadProducts() {
    console.log('Cargando productos...');
    const container = document.getElementById('product-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/productos`);
        if (!response.ok) throw new Error('Error al cargar productos');
        const data = await response.json();
        // El backend devuelve { productos: [...] } o directamente [...]
        productos = Array.isArray(data) ? data : (data.productos || []);
        renderProducts();
    } catch (error) {
        console.error(error);
        container.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar productos</td></tr>';
    }
}

function renderProducts() {
    const container = document.getElementById('product-list');
    if (!container) return;

    let tableHTML = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Imagen</th>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Precio</th>
                        <th>Stock</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (productos.length === 0) {
        tableHTML += `<tr><td colspan="6" class="text-center">No hay productos registrados</td></tr>`;
    } else {
        productos.forEach(product => {
            tableHTML += `
                <tr>
                    <td>
                        <img src="${product.url_imagen || 'img/placeholder.jpg'}" alt="${product.nombre}" 
                             style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                    </td>
                    <td>
                        <div style="font-weight: bold;">${product.nombre}</div>
                        <small class="text-muted">${product.marcas || ''}</small>
                    </td>
                    <td>${product.categoria || product.categoria_nombre || 'General'}</td>
                    <td>S/ ${parseFloat(product.precio).toFixed(2)}</td>
                    <td>
                        <span class="badge ${parseInt(product.stock) < 10 ? 'badge-danger' : 'badge-success'}">
                            ${product.stock}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="window.editProduct(${product.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="window.deleteProduct(${product.id})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }

    tableHTML += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tableHTML;
}

// Función global para guardar producto
window.handleSaveProduct = async function () {
    const nombre = document.getElementById('product-name').value;
    const precio = document.getElementById('product-price').value;
    const stock = document.getElementById('product-stock').value;
    const categoria = document.getElementById('product-type').value;
    const marcas = document.getElementById('product-brand').value;
    const imagen = document.getElementById('product-image').value;
   const checkboxes = document.querySelectorAll('.diet-checkbox:checked');
    const dieta = Array.from(checkboxes).map(cb => cb.value).join(',') || null;
    const id = document.getElementById('product-id').value;

    // Validaciones básicas
    if (!nombre || !precio || !categoria) {
        showNotification('Por favor complete los campos obligatorios (*)', 'error');
        return;
    }

    const productData = {
        nombre,
        precio: parseFloat(precio),
        stock: parseInt(stock) || 0,
        categoria_id: parseInt(categoria),
        marcas: marcas || null,
        url_imagen: imagen || null,
        // 👇 NUEVO: Añadirlo al paquete que se envía a la base de datos
        dieta: dieta || null 
    };

    try {
        let url = `${API_BASE_URL}/productos`;
        let method = 'POST';
        if (id) {
            url += `/${id}`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });

        if (!response.ok) throw new Error('Error al guardar');

        showNotification('Producto guardado exitosamente', 'success');
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
        document.getElementById('form-title').textContent = 'Agregar Nuevo Producto';
        loadProducts();
    } catch (error) {
        console.error(error);
        showNotification('Error al guardar producto', 'error');
    }
};



window.editProduct = function (id) {
    const product = productos.find(p => p.id === id);
    if (!product) return;

    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.nombre;
    document.getElementById('product-price').value = product.precio;
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('product-type').value = product.categoria_id || '';
    document.getElementById('product-brand').value = product.marcas || '';
    document.getElementById('product-image').value = product.url_imagen || '';
   document.querySelectorAll('.diet-checkbox').forEach(cb => cb.checked = false); 
    if (product.dieta) {
        const dietasGuardadas = product.dieta.split(',').map(d => d.trim());
        document.querySelectorAll('.diet-checkbox').forEach(cb => {
            if (dietasGuardadas.includes(cb.value)) {
                cb.checked = true;
            }
        });
    }

    document.getElementById('form-title').textContent = 'Editar Producto';

    // Scroll al formulario
    document.getElementById('product-form').scrollIntoView({ behavior: 'smooth' });
};
window.deleteProduct = async function (id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/productos/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Error al eliminar');

        showNotification('Producto eliminado', 'success');
        loadProducts();
    } catch (error) {
        console.error(error);
        showNotification('Error al eliminar producto', 'error');
    }
};

// ==========================================
// MÓDULO CATEGORÍAS
// ==========================================
async function loadCategories() {
    console.log('Cargando categorías...');
    try {
        const response = await fetch(`${API_BASE_URL}/categorias`);
        if (!response.ok) throw new Error('Error al cargar categorías');
        categorias = await response.json();
        renderCategories();
        updateProductTypeDropdown();
    } catch (error) {
        console.error(error);
    }
}

function renderCategories() {
    const container = document.getElementById('category-list');
    if (!container) return;

    let html = `
        <table class="table table-hover">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    categorias.forEach(cat => {
        html += `
            <tr>
                <td>${cat.id}</td>
                <td>${cat.nombre}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteCategory(${cat.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Función global para guardar categoría
window.handleSaveCategory = async function () {
    console.log('Intentando guardar categoría...');
    const nombre = document.getElementById('category-name').value;
    if (!nombre) {
        showNotification('El nombre de la categoría es obligatorio', 'error');
        return;
    }

    try {
        console.log('Enviando petición POST a /categorias...');
        const response = await fetch(`${API_BASE_URL}/categorias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = errorText;
            try {
                // Intentar parsear si es JSON
                const errorJson = JSON.parse(errorText);
                if (errorJson.detail) {
                    errorMessage = errorJson.detail;
                }
            } catch (e) {
                // No es JSON, usar texto plano
            }
            throw new Error(errorMessage);
        }

        showNotification('Categoría agregada', 'success');
        document.getElementById('category-name').value = '';
        loadCategories();
    } catch (error) {
        console.error(error);
        alert(`Error detallado: ${error.message}`);
        showNotification('Error al guardar categoría: ' + error.message, 'error');
    }
};

window.deleteCategory = async function (id) {
    if (!confirm('¿Eliminar categoría?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/categorias/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Error al eliminar');
        showNotification('Categoría eliminada', 'success');
        loadCategories();
    } catch (error) {
        console.error(error);
        showNotification('Error al eliminar categoría', 'error');
    }
};

async function updateProductTypeDropdown() {
    const select = document.getElementById('product-type');
    if (!select) return;

    // Guardar valor actual si existe
    const currentValue = select.value;

    select.innerHTML = '<option value="">Seleccione...</option>';
    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });

    if (currentValue) select.value = currentValue;
}

// ==========================================
// MÓDULO PEDIDOS
// ==========================================
async function loadOrders() {
    console.log('Cargando pedidos...');
    const container = document.getElementById('pedidos-body');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="7" class="text-center">Cargando pedidos...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/compras`);
        if (!response.ok) throw new Error('Error al cargar pedidos');
        const data = await response.json();
        let rawPedidos = Array.isArray(data) ? data : (data.compras || []);

        // Normalizar datos para uso global
        pedidos = rawPedidos.map(p => ({
            ...p,
            productos: p.productos || p.items || [],
            fecha: p.fecha || p.fecha_compra || new Date().toISOString()
        }));

        // Si no hay pedidos en la API, mostrar mensaje vacío
        if (pedidos.length === 0) {
            console.log('API sin pedidos.');
        }

        renderOrders();
        updateDashboard(); // Actualizar estadísticas con los datos normalizados
    } catch (error) {
        console.error(error);
        container.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar pedidos. Asegúrate de que el backend esté corriendo.</td></tr>';
    }
}

// Datos demo para pedidos
function getDemoOrders() {
    const now = new Date();
    return [
        {
            id: 1001,
            usuario_id: 1,
            total: 195.00,
            fecha: new Date(now.setDate(now.getDate())).toISOString(),
            estado: "pendiente",
            productos: [{ nombre: "Polo Tommy", cantidad: 2 }, { nombre: "Camisa Blanca", cantidad: 1 }]
        },
        {
            id: 1002,
            usuario_id: 2,
            total: 135.00,
            fecha: new Date(now.setDate(now.getDate() - 2)).toISOString(),
            estado: "enviado",
            productos: [{ nombre: "Polera Mujer", cantidad: 1 }]
        },
        {
            id: 1003,
            usuario_id: 3,
            total: 215.00,
            fecha: new Date(now.setDate(now.getDate() - 5)).toISOString(),
            estado: "entregado",
            productos: [{ nombre: "Polo Tommy", cantidad: 1 }, { nombre: "Camisa Celeste", cantidad: 2 }]
        }
    ];
}

function renderOrders() {
    const container = document.getElementById('pedidos-body');
    if (!container) return;

    console.log('Renderizando pedidos:', pedidos);

    if (!pedidos || pedidos.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="text-center">No hay pedidos registrados</td></tr>';
        return;
    }

    let html = '';
    pedidos.forEach(pedido => {
        // Mapeo de campos backend -> frontend
        const fechaRaw = pedido.fecha || pedido.fecha_compra || new Date().toISOString();
        const fecha = new Date(fechaRaw).toLocaleDateString();

        const listaProductos = pedido.productos || pedido.items || [];
        const itemsCount = listaProductos.length;

        const total = parseFloat(pedido.total).toFixed(2);

        // Determinar clase de estado
        let badgeClass = 'bg-secondary';
        if (pedido.estado === 'pendiente') badgeClass = 'bg-warning text-dark';
        if (pedido.estado === 'completado') badgeClass = 'bg-success';
        if (pedido.estado === 'cancelado') badgeClass = 'bg-danger';

        html += `
            <tr>
                <td>#${pedido.id}</td>
                <td>Usuario ${pedido.usuario_id}</td>
                <td>${fecha}</td>
                <td>${itemsCount} items</td>
                <td>S/ ${total}</td>
                <td><span class="badge ${badgeClass}">${pedido.estado}</span></td>
                <td>
                    <div class="d-flex gap-2">
                        <select class="form-select form-select-sm" style="width: auto;" 
                                onchange="updateOrderStatus(${pedido.id}, this.value)">
                            <option value="pendiente" ${pedido.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="completado" ${pedido.estado === 'completado' ? 'selected' : ''}>Completado</option>
                            <option value="cancelado" ${pedido.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                        <button class="btn btn-sm btn-primary" onclick="viewOrderDetails(${pedido.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    container.innerHTML = html;
}

// Exponer función para el botón de actualizar
window.actualizarPedidos = loadOrders;

window.limpiarDatosAntiguos = function () {
    alert('Funcionalidad de limpieza no implementada aún');
};

window.updateOrderStatus = async function (id, status) {
    try {
        const response = await fetch(`${API_BASE_URL}/compras/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: status })
        });
        if (!response.ok) throw new Error('Error al actualizar estado');
        showNotification('Estado actualizado', 'success');
    } catch (error) {
        console.error(error);
        showNotification('Error al actualizar estado', 'error');
    }
};

window.viewOrderDetails = function (id) {
    alert('Detalles del pedido ' + id);
};

// Filtros de pedidos
window.filtrarPedidos = function (estado) {
    // Actualizar botones activos
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(estado === 'todos' ? 'todos' : estado)) {
            btn.classList.add('active');
        }
    });

    const container = document.getElementById('pedidos-body');
    if (!container) return;

    // Filtrar
    const pedidosFiltrados = estado === 'todos'
        ? pedidos
        : pedidos.filter(p => p.estado === estado);

    if (pedidosFiltrados.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="text-center">No hay pedidos con este estado</td></tr>';
        return;
    }

    // Renderizar filtrados (reutilizando lógica de renderOrders pero con array específico)
    let html = '';
    pedidosFiltrados.forEach(pedido => {
        const fechaRaw = pedido.fecha || pedido.fecha_compra || new Date().toISOString();
        const fecha = new Date(fechaRaw).toLocaleDateString();
        const listaProductos = pedido.productos || pedido.items || [];
        const itemsCount = listaProductos.length;
        const total = parseFloat(pedido.total).toFixed(2);

        let badgeClass = 'bg-secondary';
        if (pedido.estado === 'pendiente') badgeClass = 'bg-warning text-dark';
        if (pedido.estado === 'completado') badgeClass = 'bg-success';
        if (pedido.estado === 'cancelado') badgeClass = 'bg-danger';

        html += `
            <tr>
                <td>#${pedido.id}</td>
                <td>Usuario ${pedido.usuario_id}</td>
                <td>${fecha}</td>
                <td>${itemsCount} items</td>
                <td>S/ ${total}</td>
                <td><span class="badge ${badgeClass}">${pedido.estado}</span></td>
                <td>
                    <div class="d-flex gap-2">
                        <select class="form-select form-select-sm" style="width: auto;" 
                                onchange="updateOrderStatus(${pedido.id}, this.value)">
                            <option value="pendiente" ${pedido.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="completado" ${pedido.estado === 'completado' ? 'selected' : ''}>Completado</option>
                            <option value="cancelado" ${pedido.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                        <button class="btn btn-sm btn-primary" onclick="viewOrderDetails(${pedido.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    container.innerHTML = html;
};

// ==========================================
// MÓDULO ESTADÍSTICAS (GRÁFICOS Y TABLAS)
// ==========================================
function renderCharts() {
    if (typeof Chart === 'undefined') return;

    // Destruir gráficos anteriores si existen para actualizar
    if (window.salesChartInstance) window.salesChartInstance.destroy();
    if (window.categoryChartInstance) window.categoryChartInstance.destroy();

    // 1. Gráfico de Ventas (Line Chart)
    const ctx1 = document.getElementById('ventas-chart');
    if (ctx1) {
        // Asegurar que sea un canvas
        if (ctx1.tagName !== 'CANVAS') {
            const parent = ctx1.parentElement;
            parent.innerHTML = '<canvas id="salesChart"></canvas>';
        }
    }

    const salesCanvas = document.getElementById('salesChart');
    if (salesCanvas) {
        const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const data = new Array(12).fill(0);

        if (pedidos) {
            pedidos.forEach(p => {
                if (p.estado !== 'cancelado') {
                    const date = new Date(p.fecha || p.fecha_compra);
                    if (!isNaN(date)) {
                        const month = date.getMonth(); // 0-11
                        data[month] += parseFloat(p.total);
                    }
                }
            });
        }

        window.salesChartInstance = new Chart(salesCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventas (S/)',
                    data: data,
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78, 115, 223, 0.05)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // 2. Gráfico de Categorías (Doughnut Chart)
    const ctx2 = document.getElementById('categoria-chart');
    if (ctx2) {
        // Asegurar que sea un canvas
        if (ctx2.tagName !== 'CANVAS') {
            const parent = ctx2.parentElement;
            parent.innerHTML = '<canvas id="categoryChartCanvas"></canvas>';
        }
    }

    const categoryCanvas = document.getElementById('categoryChartCanvas');
    if (categoryCanvas) {
        const catCount = {};
        productos.forEach(p => {
            const catName = p.categoria || p.categoria_nombre || 'General';
            catCount[catName] = (catCount[catName] || 0) + 1;
        });

        const labels = Object.keys(catCount);
        const data = Object.values(catCount);

        window.categoryChartInstance = new Chart(categoryCanvas, {
            type: 'doughnut',
            data: {
                labels: labels.length ? labels : ['Sin datos'],
                datasets: [{
                    data: data.length ? data : [1],
                    backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b'],
                    hoverBackgroundColor: ['#2e59d9', '#17a673', '#2c9faf', '#dda20a', '#be2617'],
                    hoverBorderColor: "rgba(234, 236, 244, 1)",
                }]
            },
            cutout: '70%',
        });
    }
}

// ==========================================
// DASHBOARD & UTILIDADES
// ==========================================
async function updateDashboard() {
    console.log('Actualizando dashboard...');

    // Calcular estadísticas locales
    const totalProductos = productos.length;
    let totalStock = 0;
    let valorInventario = 0;

    productos.forEach(p => {
        const stock = parseInt(p.stock) || 0;
        const precio = parseFloat(p.precio) || 0;
        totalStock += stock;
        valorInventario += stock * precio;
    });

    let ventasTotales = 0;
    const clientesSet = new Set();

    if (pedidos && pedidos.length > 0) {
        pedidos.forEach(p => {
            if (p.estado !== 'cancelado') {
                ventasTotales += parseFloat(p.total) || 0;
            }
            if (p.usuario_id) clientesSet.add(p.usuario_id);
        });
    }

    // Actualizar tarjetas del Dashboard principal
    const totalProductsElem = document.getElementById('total-products');
    const totalStockElem = document.getElementById('total-stock');
    const totalValueElem = document.getElementById('total-value');

    if (totalProductsElem) totalProductsElem.textContent = totalProductos;
    if (totalStockElem) totalStockElem.textContent = totalStock;
    if (totalValueElem) totalValueElem.textContent = `S/ ${valorInventario.toFixed(2)}`;

    // Actualizar sección de Estadísticas (IDs específicos)
    const statsVentas = document.getElementById('total-ventas');
    const statsProductos = document.getElementById('productos-activos');
    const statsClientes = document.getElementById('clientes-totales');
    const statsInventario = document.getElementById('inventario-valor');

    if (statsVentas) statsVentas.textContent = `S/ ${ventasTotales.toFixed(2)}`;
    if (statsProductos) statsProductos.textContent = totalProductos;
    if (statsClientes) statsClientes.textContent = clientesSet.size || 0;
    if (statsInventario) statsInventario.textContent = `S/ ${valorInventario.toFixed(2)}`;

    // Actualizar tabla de productos más vendidos (si existe)
    if (typeof updateTopProductsTable === 'function') {
        updateTopProductsTable();
    }

    // Actualizar gráficos (renderProductCategorySummary ya fue eliminado)
    renderCharts();
}

function updateTopProductsTable() {
    const tbody = document.getElementById('productos-vendidos-body');
    if (!tbody) return;

    // Calcular ventas por producto
    const productSales = {};

    if (pedidos) {
        pedidos.forEach(pedido => {
            if (pedido.estado !== 'cancelado' && pedido.productos) {
                pedido.productos.forEach(item => {
                    // Intentar normalizar nombre para agrupar
                    const name = item.nombre;
                    if (!productSales[name]) {
                        productSales[name] = {
                            nombre: name,
                            cantidad: 0,
                            ingresos: 0
                        };
                    }
                    productSales[name].cantidad += (item.cantidad || 1);
                    // Si tenemos precio unitario en el item, usarlo, sino estimar
                    const precio = item.precio_unitario || (item.subtotal / item.cantidad) || 0;
                    productSales[name].ingresos += (precio * (item.cantidad || 1));
                });
            }
        });
    }

    // Convertir a array y ordenar
    const sortedProducts = Object.values(productSales).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);

    let html = '';
    if (sortedProducts.length === 0) {
        html = '<tr><td colspan="5" class="text-center">No hay datos de ventas aún</td></tr>';
    } else {
        sortedProducts.forEach(p => {
            // Buscar info extra del producto si es posible
            const productInfo = productos.find(prod => prod.nombre === p.nombre) || {};

            html += `
                <tr>
                    <td>${p.nombre}</td>
                    <td>${productInfo.categoria || productInfo.categoria_nombre || 'General'}</td>
                    <td>${p.cantidad}</td>
                    <td>S/ ${p.ingresos.toFixed(2)}</td>
                    <td>${productInfo.stock || 'N/A'}</td>
                </tr>
            `;
        });
    }
    tbody.innerHTML = html;
}

// Función expuesta para el botón "Actualizar" en estadísticas
window.actualizarEstadisticas = function () {
    loadInitialData();
    showNotification('Estadísticas actualizadas', 'success');
};

// Modales
window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (modalId === 'stock-modal') populateStockModal();
        if (modalId === 'value-modal') populateValueModal();
        if (modalId === 'products-modal') populateProductsModal();
    }
};

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
};

function populateProductsModal() {
    const tbody = document.getElementById('products-modal-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    productos.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${p.nombre}</td>
            <td>${p.categoria || p.categoria_nombre || 'Sin categoría'}</td>
            <td>S/ ${parseFloat(p.precio).toFixed(2)}</td>
            <td>${parseInt(p.stock) || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

function populateStockModal() {
    const tbody = document.getElementById('stock-modal-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    productos.forEach(p => {
        const stock = parseInt(p.stock) || 0;
        let estadoClass = 'badge-success';
        let estadoText = 'Normal';

        if (stock <= 5) {
            estadoClass = 'badge-danger';
            estadoText = 'Crítico';
        } else if (stock <= 15) {
            estadoClass = 'badge-warning';
            estadoText = 'Bajo';
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${p.nombre}</td>
            <td>${stock}</td>
            <td><span class="badge ${estadoClass}">${estadoText}</span></td>
        `;
        tbody.appendChild(row);
    });
}

function populateValueModal() {
    const tbody = document.getElementById('value-modal-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    let total = 0;
    productos.forEach(p => {
        const stock = parseInt(p.stock) || 0;
        const precio = parseFloat(p.precio) || 0;
        const valor = stock * precio;
        total += valor;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${p.nombre}</td>
            <td>${stock}</td>
            <td>S/ ${precio.toFixed(2)}</td>
            <td>S/ ${valor.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });

    const rowTotal = document.createElement('tr');
    rowTotal.style.fontWeight = 'bold';
    rowTotal.style.backgroundColor = '#f8f9fa';
    rowTotal.innerHTML = `
        <td colspan="3" style="text-align:right">TOTAL:</td>
        <td>S/ ${total.toFixed(2)}</td>
    `;
    tbody.appendChild(rowTotal);
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    } else {
        alert(message);
    }
}
