/**
 * ===========================================
 * CANASTA INTELIGENTE CON IA
 * ===========================================
 * 
 * Este archivo maneja la funcionalidad de la canasta inteligente:
 * - Generación automática de canastas usando IA del backend
 * - Filtrado por marcas preferidas
 * - Visualización con gráfico circular (Chart.js)
 * - Integración con el carrito principal
 * - Gestión de productos recomendados
 */

document.addEventListener('DOMContentLoaded', function () {
    // ===========================================
    // CONFIGURACIÓN
    // ===========================================
    const API_BASE_URL = 'https://marlet-ia.onrender.com';
    let canastaGenerada = [];
    let carritoPrincipal = JSON.parse(localStorage.getItem('aiMarketCart')) || [];

    // ===========================================
    // ELEMENTOS DEL DOM
    // ===========================================
    const presupuestoInput = document.getElementById('presupuesto');
    const personasInput = document.getElementById('numero-personas');
    const preferenciasInput = document.getElementById('preferencias');
    const generarCanastaBtn = document.getElementById('generar-canasta');
    const resumenContainer = document.getElementById('resumen-canasta');
    const productosRecomendadosContainer = document.getElementById('productos-recomendados');
    const addAllToCartBtn = document.getElementById('add-all-to-cart-btn');

    const obtenerNombreCategoria = (producto) => producto.categoria_nombre || producto.categoria || 'Sin categoría';
    const obtenerSlugCategoria = (producto) => producto.categoria_slug || (producto.categoria_nombre ? producto.categoria_nombre.toLowerCase().replace(/\s+/g, '-') : (producto.categoria || '').toLowerCase().replace(/\s+/g, '-'));

    const brandSearchInput = document.getElementById('brand-search');
    const brandListContainer = document.getElementById('brand-list');
    let allBrands = []; // Almacén de marcas únicas

    // ===========================================
    // EVENT LISTENERS
    // ===========================================
    generarCanastaBtn.addEventListener('click', function () {
        const presupuesto = parseFloat(presupuestoInput.value) || 0;
        const numeroPersonas = parseInt(personasInput.value) || 1;
        const preferencias = preferenciasInput.value;

        // Obtener productos deseados seleccionados (checkboxes)
        const checkboxes = document.querySelectorAll('#productos-deseados-container input[type="checkbox"]:checked');
        const productosDeseados = Array.from(checkboxes).map(cb => parseInt(cb.value));

        // Obtener marcas seleccionadas (ahora desde los chips dinámicos)
        const marcasSeleccionadas = document.querySelectorAll('.marca-chip.active');
        const marcasArray = Array.from(marcasSeleccionadas).map(btn => btn.dataset.marca);

        if (presupuesto <= 0) {
            alert('Por favor ingresa un presupuesto válido');
            return;
        }

        generarCanastaIA(presupuesto, numeroPersonas, preferencias, productosDeseados, marcasArray);
    });

    // Buscador de marcas
    if (brandSearchInput) {
        brandSearchInput.addEventListener('input', function (e) {
            const term = e.target.value.toLowerCase();
            const filteredBrands = allBrands.filter(brand => brand.toLowerCase().includes(term));
            renderBrands(filteredBrands);
        });
    }

    // Función para cargar marcas desde la API
    async function loadBrands() {
        try {
            const response = await fetch(`${API_BASE_URL}/productos`);
            if (!response.ok) throw new Error('Error al cargar productos para marcas');
            const data = await response.json();
            const products = Array.isArray(data) ? data : (data.productos || []);

            // Extraer marcas únicas y limpiar
            const brandsSet = new Set();
            products.forEach(p => {
                if (p.marcas && p.marcas.trim() !== '' && p.marcas !== 'N/A') {
                    brandsSet.add(p.marcas.trim());
                }
            });

            // Agregar marcas comunes por defecto si la lista es corta
            // const defaultBrands = ['Gloria', 'Nestlé', 'Bimbo', 'Primor', 'Costeño', 'Laive', 'San Fernando', 'Altomayo', 'Inca Kola', 'Coca-Cola'];
            // defaultBrands.forEach(b => brandsSet.add(b));

            allBrands = Array.from(brandsSet).sort();
            renderBrands(allBrands);

        } catch (error) {
            console.error('Error loading brands:', error);
            brandListContainer.innerHTML = '<small class="text-danger">Error al cargar marcas</small>';
        }
    }

    function renderBrands(brandsToRender) {
        if (!brandListContainer) return;
        brandListContainer.innerHTML = '';

        if (brandsToRender.length === 0) {
            brandListContainer.innerHTML = '<small class="text-muted">No se encontraron marcas</small>';
            return;
        }

        brandsToRender.forEach(brand => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-secondary btn-sm marca-chip';
            btn.textContent = brand;
            btn.dataset.marca = brand;
            btn.onclick = function () {
                this.classList.toggle('active');
                this.classList.toggle('btn-primary');
                this.classList.toggle('btn-outline-secondary');
                this.classList.toggle('text-white');
            };
            brandListContainer.appendChild(btn);
        });
    }

    if (addAllToCartBtn) {
        addAllToCartBtn.addEventListener('click', agregarTodoAlCarrito);
    }


    // ===========================================
    // FUNCIONES PRINCIPALES
    // ===========================================
    async function generarCanastaIA(presupuesto, numeroPersonas, preferencias, productosDeseados = [], marcasSeleccionadas = []) {
        try {
            mostrarCargando(true);

            // Ajustar presupuesto para solicitar una canasta base por persona
            // El usuario ingresa el presupuesto TOTAL, así que lo dividimos entre las personas
            const presupuestoAjustado = numeroPersonas > 0 ? (presupuesto / numeroPersonas) : presupuesto;

            // Preparar datos para la API
            const dietas = extraerDietasDePreferencias(preferencias);
            const categoriasExcluidas = extraerCategoriasExcluidas(preferencias);
            
            // Combinar marcas seleccionadas de chips y del cuadro de texto
            const marcasTexto = extraerMarcasDePreferencias(preferencias);
            const todasLasMarcas = [...new Set([...marcasSeleccionadas, ...marcasTexto])];

            const requestData = {
                usuario_id: 1, // ID temporal del usuario
                presupuesto: presupuestoAjustado,
                productos_deseados: productosDeseados, // Lista de IDs de productos deseados
                preferencias: (todasLasMarcas.length > 0 || dietas.length > 0 || categoriasExcluidas.length > 0) ? {
                    marcas_preferidas: todasLasMarcas,
                    dietas: dietas,
                    categorias_excluidas: categoriasExcluidas
                } : undefined
            };

            const response = await fetch(`${API_BASE_URL}/generar_canasta`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }

            const resultado = await response.json();
            canastaGenerada = resultado.productos || [];

            // Verificar si no hay productos (base de datos no conectada)
            if (canastaGenerada.length === 0) {
                throw new Error('No hay productos disponibles. La base de datos no está conectada.');
            }

            // Ajustar cantidades según número de personas
            if (numeroPersonas > 1) {
                canastaGenerada = canastaGenerada.map(producto => ({
                    ...producto,
                    cantidad: numeroPersonas,
                    precio_total: producto.precio * numeroPersonas
                }));
            }

            mostrarProductosRecomendados(canastaGenerada, numeroPersonas);
            mostrarResumenCanasta(resultado, numeroPersonas);
            actualizarGrafico(resultado, numeroPersonas);

        } catch (error) {
            console.error('Error generando canasta:', error);

            // Mostrar mensaje de error específico
            if (canastaGenerada.length === 0) {
                mostrarError('La base de datos no está conectada. Por favor, conecta la base de datos para usar Compras Rápidas.');
            } else {
                mostrarError('Error al generar la canasta. Verifica que el backend esté funcionando.');
            }
        } finally {
            mostrarCargando(false);
        }
    }

    function extraerMarcasDePreferencias(preferencias) {
        if (!preferencias || preferencias.trim() === '') return [];
        const preferenciasLower = preferencias.toLowerCase();
        
        return allBrands.filter(brand => {
            const brandLower = brand.toLowerCase();
            const index = preferenciasLower.indexOf(brandLower);
            if (index === -1) return false;
            
            // Verificar si hay una palabra de negación antes de la marca
            // para no añadirla como preferida (ej: "sin Bimbo", "no Gloria", "excluir Nestlé")
            const textBefore = preferenciasLower.substring(Math.max(0, index - 15), index);
            const tieneNegacion = /\b(sin|no|excluir|evitar|menos|excepto)\b/.test(textBefore);
            
            return !tieneNegacion;
        });
    }

    function extraerDietasDePreferencias(preferencias) {
        if (!preferencias || preferencias.trim() === '') return [];

        // Lista ampliada de dietas con variaciones
        const dietaMap = {
            'vegan': 'vegano',
            'vegano': 'vegano',
            'veganos': 'vegano',
            'vegán': 'vegano',
            'vegana': 'vegano',
            'vegetariano': 'vegetariana',
            'vegetariana': 'vegetariana',
            'vegetarianos': 'vegetariana',
            'sin gluten': 'sin_gluten',
            'gluten free': 'sin_gluten',
            'orgánico': 'regular',
            'orgánica': 'regular',
            'organic': 'regular',
            'baja en calorías': 'regular',
            'regular': 'regular',
            'sin lactosa': 'sin_lactosa',
            'lactose free': 'sin_lactosa',
            'sin azúcar': 'regular'
        };

        const preferenciasLower = preferencias.toLowerCase();
        const dietasEncontradas = [];

        // Buscar coincidencias en las preferencias
        for (const [keyword, dieta] of Object.entries(dietaMap)) {
            if (preferenciasLower.includes(keyword.toLowerCase())) {
                dietasEncontradas.push(dieta);
            }
        }

        // Eliminar duplicados
        return [...new Set(dietasEncontradas)];
    }

    function extraerCategoriasExcluidas(preferencias) {
        if (!preferencias || preferencias.trim() === '') return [];

        const categoriaMap = {
            'carne': 'Carnes',
            'carnes': 'Carnes',
            'pollos': 'Carnes',
            'pollo': 'Carnes',
            'cerdo': 'Carnes',
            'res': 'Carnes',
            'pescados': 'Pescados',
            'pescado': 'Pescados',
            'mariscos': 'Pescados',
            'alcohol': 'Bebidas',
            'licor': 'Bebidas',
            'cerveza': 'Bebidas',
            'vino': 'Bebidas',
            'bebidas alcohólicas': 'Bebidas',
            'gaseosas': 'Bebidas',
            'refrescos': 'Bebidas',
            'snacks': 'Snacks',
            'chips': 'Snacks',
            'papas fritas': 'Snacks',
            'dulces': 'Dulces',
            'chocolate': 'Dulces',
            'golosinas': 'Dulces'
        };

        const preferenciasLower = preferencias.toLowerCase();
        const categoriasExcluidas = [];

        // Buscar palabras clave de exclusión de manera flexible
        if (
            preferenciasLower.includes('excluir') || 
            preferenciasLower.includes('no quiero') || 
            preferenciasLower.includes('sin') || 
            preferenciasLower.includes('no ') || 
            preferenciasLower.includes('evitar') ||
            preferenciasLower.includes('menos') ||
            preferenciasLower.includes('excepto')
        ) {
            for (const [keyword, categoria] of Object.entries(categoriaMap)) {
                if (preferenciasLower.includes(keyword)) {
                    categoriasExcluidas.push(categoria);
                }
            }
        }

        // Eliminar duplicados
        return [...new Set(categoriasExcluidas)];
    }

    function mostrarProductosRecomendados(productos, numeroPersonas = 1) {
        if (!productosRecomendadosContainer) return;

        productosRecomendadosContainer.innerHTML = '';

        if (productos.length === 0) {
            productosRecomendadosContainer.innerHTML = `
                <div class="col-12">
                    <p class="text-muted text-center">No se encontraron productos recomendados.</p>
                </div>
            `;
            return;
        }

        productos.forEach(producto => {
            const cantidad = producto.cantidad || 1;
            const precio = producto.precio_total || producto.precio;
            const precioUnitario = producto.precio;

            const productoDiv = document.createElement('div');
            productoDiv.className = 'col-md-6 col-lg-4 mb-3';
            productoDiv.innerHTML = `
                <div class="card product-card h-100">
                    <img src="${producto.url_imagen || 'https://via.placeholder.com/200x150?text=Producto'}" 
                         class="card-img-top" alt="${producto.nombre}" 
                         style="height: 150px; object-fit: cover;">
                    <div class="card-body p-3">
                        <h6 class="card-title">${producto.nombre}</h6>
                        ${cantidad > 1 ? `<p class="text-muted mb-1">Cantidad: ${cantidad} unidades</p>` : ''}
                        <p class="card-text">
                            <span class="text-success fw-bold">S/ ${precio.toFixed(2)}</span>
                            ${cantidad > 1 ? `<small class="text-muted d-block">(S/ ${precioUnitario.toFixed(2)} c/u)</small>` : ''}
                        </p>
                        <small class="text-muted">${obtenerNombreCategoria(producto)}</small>
                        ${producto.marca ? `<br><small class="text-muted">${producto.marca}</small>` : ''}
                        ${producto.es_deseado ? '<span class="badge bg-primary ms-1">Deseado</span>' : ''}
                    </div>
                </div>
            `;
            productosRecomendadosContainer.appendChild(productoDiv);
        });
    }

    function mostrarResumenCanasta(resultado, numeroPersonas = 1) {
        if (!resumenContainer) return;

        // Recalcular total basado en cantidades ajustadas
        let totalAjustado = resultado.total || 0;
        if (numeroPersonas > 1 && canastaGenerada.length > 0) {
            totalAjustado = canastaGenerada.reduce((sum, p) => sum + (p.precio_total || p.precio), 0);
        }

        // El presupuesto del resultado es por persona (lo que enviamos al backend)
        // Lo multiplicamos para mostrar el presupuesto TOTAL original
        const presupuestoPerPerson = resultado.presupuesto || 0;
        const presupuestoTotal = presupuestoPerPerson * numeroPersonas;

        const ahorro = Math.max(0, presupuestoTotal - totalAjustado);
        const porcentajeAhorro = presupuestoTotal > 0 ? ((ahorro / presupuestoTotal) * 100) : 0;

        // Mostrar preferencias aplicadas (marcas, dietas, exclusiones)
        const marcasSeleccionadas = Array.from(document.querySelectorAll('.marca-chip.active')).map(btn => btn.dataset.marca);
        const textoPreferencias = (document.getElementById('preferencias')?.value || '').trim();
        const dietasSeleccionadas = extraerDietasDePreferencias(textoPreferencias);
        const categoriasExcluidas = extraerCategoriasExcluidas(textoPreferencias);

        const mensajeAhorro = ahorro > 0
            ? `
                <div class="alert alert-success py-2 mb-3">
                    <small class="d-block text-muted mb-1">Ahorro respecto al presupuesto inicial</small>
                    <strong>¡Genial!</strong> Estás ahorrando <span class="fw-bold">S/ ${ahorro.toFixed(2)}</span> del monto que configuraste (S/ ${presupuestoTotal.toFixed(2)}).
                </div>
            `
            : `
                <div class="alert alert-warning py-2 mb-3">
                    <small class="d-block text-muted mb-1">Presupuesto excedido</small>
                    Te faltan <span class="fw-bold">S/ ${(Math.abs(ahorro)).toFixed(2)}</span> para cubrir el monto establecido (S/ ${presupuestoTotal.toFixed(2)}).
                </div>
            `;

        resumenContainer.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">Resumen de tu Canasta</h5>
                    ${numeroPersonas > 1 ? `<small class="text-muted">Para ${numeroPersonas} personas</small>` : ''}
                </div>
                <div class="card-body">
                    ${mensajeAhorro}
                    <div class="row mb-3">
                        <div class="col-6">
                            <small class="text-muted">Total:</small>
                            <div class="fw-bold">S/ ${totalAjustado.toFixed(2)}</div>
                        </div>
                        <div class="col-6">
                            <small class="text-muted">Presupuesto:</small>
                            <div class="fw-bold">S/ ${presupuestoTotal.toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-6">
                            <small class="text-muted">Ahorro:</small>
                            <div class="fw-bold text-success">S/ ${ahorro.toFixed(2)}</div>
                        </div>
                        <div class="col-6">
                            <small class="text-muted">% Ahorro:</small>
                            <div class="fw-bold text-success">${porcentajeAhorro.toFixed(1)}%</div>
                        </div>
                    </div>
                    ${(marcasSeleccionadas.length || dietasSeleccionadas.length || categoriasExcluidas.length) ? `
                    <div class="mb-3">
                        <small class="text-muted d-block">Preferencias aplicadas</small>
                        ${marcasSeleccionadas.length ? `<div><span class="badge bg-primary me-1">Marca</span> ${marcasSeleccionadas.join(', ')}</div>` : ''}
                        ${dietasSeleccionadas.length ? `<div><span class="badge bg-success me-1">Dieta</span> ${dietasSeleccionadas.join(', ')}</div>` : ''}
                        ${categoriasExcluidas.length ? `<div><span class="badge bg-warning text-dark me-1">Excluye</span> ${categoriasExcluidas.join(', ')}</div>` : ''}
                    </div>` : ''}
                    <div class="row">
                        <div class="col-6">
                            <small class="text-muted">Productos:</small>
                            <div class="fw-bold">${resultado.productos_recomendados || 0}</div>
                        </div>
                        <div class="col-6">
                            <small class="text-muted">Deseados:</small>
                            <div class="fw-bold">${resultado.productos_deseados || 0}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function actualizarGrafico(resultado, numeroPersonas = 1) {
        const ctx = document.getElementById('grafico-canasta');
        if (!ctx) return;

        // Destruir gráfico existente si existe
        if (window.graficoCanasta) {
            window.graficoCanasta.destroy();
        }

        // Agrupar productos por categoría usando canastaGenerada para tener los precios totales
        const categorias = {};
        (canastaGenerada || []).forEach(producto => {
            const categoria = obtenerNombreCategoria(producto);
            if (!categorias[categoria]) {
                categorias[categoria] = 0;
            }
            // Usar precio_total si existe (cantidad > 1), sino precio unitario
            categorias[categoria] += (producto.precio_total || producto.precio);
        });

        const labels = Object.keys(categorias);
        const data = Object.values(categorias);
        const colors = ['#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997'];

        window.graficoCanasta = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    function agregarTodoAlCarrito() {
        if (canastaGenerada.length === 0) {
            alert('No hay productos en la canasta para agregar');
            return;
        }

        let totalItemsAgregados = 0;

        canastaGenerada.forEach(producto => {
            const cantidad = producto.cantidad || 1;
            const precioUnitario = producto.precio;

            const itemExistente = carritoPrincipal.find(item => item.name === producto.nombre);
            if (itemExistente) {
                itemExistente.quantity += cantidad;
            } else {
                carritoPrincipal.push({
                    id: producto.id,
                    name: producto.nombre,
                    price: precioUnitario,
                    quantity: cantidad,
                    img: producto.url_imagen || 'https://via.placeholder.com/150',
                    category: obtenerSlugCategoria(producto) || '',
                    categoryName: obtenerNombreCategoria(producto),
                    brand: producto.marca || 'N/A'
                });
            }

            totalItemsAgregados += cantidad;
        });

        localStorage.setItem('aiMarketCart', JSON.stringify(carritoPrincipal));
        actualizarContadorCarrito();

        // Mostrar confirmación
        const toast = document.createElement('div');
        toast.className = 'toast position-fixed top-0 end-0 m-3';
        toast.innerHTML = `
            <div class="toast-header bg-success text-white">
                <strong class="me-auto">¡Éxito!</strong>
            </div>
            <div class="toast-body">
                Se agregaron ${totalItemsAgregados} productos al carrito
            </div>
        `;
        document.body.appendChild(toast);

        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();

        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }

    function actualizarContadorCarrito() {
        const cartCount = document.getElementById('cart-count');
        if (cartCount) {
            const totalItems = carritoPrincipal.reduce((sum, item) => sum + item.cantidad, 0);
            cartCount.textContent = totalItems;
        }
    }

    function mostrarCargando(mostrar) {
        const btn = document.getElementById('generar-canasta');
        if (btn) {
            if (mostrar) {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generando...';
            } else {
                btn.disabled = false;
                btn.innerHTML = 'Generar Canasta';
            }
        }
    }

    function mostrarError(mensaje) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show';
        alertDiv.innerHTML = `
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(alertDiv, container.firstChild);
        }
    }

    // ===========================================
    // FUNCIÓN PARA CARGAR PRODUCTOS DESEADOS ALEATORIOS
    // ===========================================
    async function cargarProductosDeseados() {
        const container = document.getElementById('productos-deseados-container');
        if (!container) return;

        try {
            container.innerHTML = '<div class="text-center py-2"><div class="spinner-border spinner-border-sm text-secondary" role="status"></div></div>';

            const response = await fetch(`${API_BASE_URL}/productos/recomendados?limit=12`);
            if (!response.ok) throw new Error('Error al cargar productos deseados');
            const data = await response.json();
            const allProducts = Array.isArray(data) ? data : (data.productos || []);

            if (allProducts.length === 0) {
                container.innerHTML = '<small class="text-muted d-block text-center">No hay sugerencias disponibles por el momento.</small>';
                return;
            }

            // Mostrar los productos recomendados
            const productosSeleccionados = allProducts;

            // Generar HTML para los checkboxes
            container.innerHTML = productosSeleccionados.map(producto => `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${producto.id}" id="producto-${producto.id}">
                    <label class="form-check-label" for="producto-${producto.id}">
                        ${producto.nombre} <small class="text-muted">(${producto.marca || 'Genérico'})</small>
                    </label>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error loading desired products:', error);
            container.innerHTML = '<small class="text-danger d-block text-center">Error al cargar sugerencias.</small>';
        }
    }

    // ===========================================
    // INICIALIZACIÓN
    // ===========================================
    actualizarContadorCarrito();
    cargarProductosDeseados(); // Cargar productos aleatorios al iniciar
    loadBrands(); // Cargar marcas dinámicas

    // Auto-actualización del resumen cuando cambian opciones (precio, personas, marcas, preferencias)
    function debounce(fn, delay = 500) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
    }

    function getMarcasSeleccionadas() {
        return Array.from(document.querySelectorAll('.marca-chip.active')).map(btn => btn.dataset.marca);
    }

    function getProductosDeseadosSeleccionados() {
        const checks = document.querySelectorAll('#productos-deseados-container input[type="checkbox"]:checked');
        return Array.from(checks).map(cb => parseInt(cb.value));
    }

    const triggerAutoGenerar = debounce(() => {
        const presupuesto = parseFloat(presupuestoInput?.value) || 0;
        const numeroPersonas = parseInt(personasInput?.value) || 1;
        const preferencias = preferenciasInput?.value || '';
        const productosDeseados = getProductosDeseadosSeleccionados();
        const marcasSeleccionadas = getMarcasSeleccionadas();
        if (presupuesto > 0) {
            generarCanastaIA(presupuesto, numeroPersonas, preferencias, productosDeseados, marcasSeleccionadas);
        }
    }, 600);

    if (presupuestoInput) presupuestoInput.addEventListener('input', triggerAutoGenerar);
    if (personasInput) personasInput.addEventListener('input', triggerAutoGenerar);
    if (preferenciasInput) preferenciasInput.addEventListener('input', triggerAutoGenerar);

    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.classList && target.classList.contains('marca-chip')) {
            // toggle ya lo maneja el listener existente; aquí sólo re-generamos
            triggerAutoGenerar();
        }
    });

    document.getElementById('productos-deseados-container')?.addEventListener('change', (e) => {
        if (e.target && e.target.matches('input[type="checkbox"]')) {
            triggerAutoGenerar();
        }
    });
});