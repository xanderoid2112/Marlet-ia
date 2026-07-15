/**
 * ===========================================
 * GESTIÓN DEL CARRITO DE COMPRAS
 * ===========================================
 * 
 * Este archivo maneja toda la funcionalidad del carrito de compras:
 * - Carga y guarda productos en localStorage
 * - Renderiza los productos en la página
 * - Calcula totales y subtotales
 * - Permite modificar cantidades y eliminar productos
 * - Actualiza el contador del carrito en el navbar
 * - Guarda las compras directamente en la base de datos Neon (vía backend Python)
 */

document.addEventListener('DOMContentLoaded', function () {
    // ===========================================
    // INICIALIZACIÓN Y LIMPIEZA DEL CARRITO
    // ===========================================

    // Cargar el carrito desde localStorage
    const rawCart = JSON.parse(localStorage.getItem('aiMarketCart')) || [];
    const cart = rawCart.map(item => ({
        ...item,
        id: parseInt(item.id, 10), // Asegurar que ID es entero
        price: parseFloat(item.price), // Asegurar que precio es float
        quantity: parseInt(item.quantity, 10) // Asegurar que cantidad es entero
    }));

    // ===========================================
    // ELEMENTOS DEL DOM
    // ===========================================
    const itemsContainer = document.getElementById('cart-items-container');
    const subtotalElem = document.getElementById('cart-subtotal');
    const totalElem = document.getElementById('cart-total');
    const cartCountBadge = document.getElementById('cart-count');
    const emptyCartView = document.getElementById('empty-cart-view');
    const cartView = document.getElementById('cart-view');
    const shippingCost = 5.00;

    // ===========================================
    // CONFIGURACIÓN DE LA BASE DE DATOS
    // ===========================================
    // Usamos el backend local para seguridad
    const API_URL = 'https://marlet-ia.onrender.com/guardar_compra';

    // ===========================================
    // FUNCIONES PRINCIPALES
    // ===========================================

    /**
     * Guarda el carrito en localStorage y actualiza la vista
     */
    const saveCart = () => {
        localStorage.setItem('aiMarketCart', JSON.stringify(cart));
        renderCart();
    };

    const updateCartCount = () => {
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        if (cartCountBadge) {
            cartCountBadge.textContent = totalItems;
        }
    };

    const renderCart = () => {
        updateCartCount();

        if (cart.length === 0) {
            if (emptyCartView) emptyCartView.style.display = 'block';
            if (cartView) cartView.style.display = 'none';
            return;
        } else {
            if (emptyCartView) emptyCartView.style.display = 'none';
            if (cartView) cartView.style.display = 'block';
        }

        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            let subtotal = 0;

            const btnProcederPago = document.getElementById('btn-proceder-pago');
            if (btnProcederPago) {
                btnProcederPago.disabled = cart.length === 0;
            }

            cart.forEach((item, index) => {
                const itemTotal = (item.price || 0) * (item.quantity || 0);
                subtotal += itemTotal;

                itemsContainer.innerHTML += `
                    <div class="card mb-3">
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <div class="d-flex flex-row align-items-center">
                                    <div>
                                        <img src="${item.img || 'https://via.placeholder.com/80'}" class="img-fluid rounded-3 cart-item-img" alt="${item.name}">
                                    </div>
                                    <div class="ms-3">
                                        <h5 class="mb-0">${item.name}</h5>
                                        <p class="small mb-0 text-muted">${item.brand || ''}</p>
                                    </div>
                                </div>
                                <div class="d-flex flex-row align-items-center">
                                    <div style="width: 120px;">
                                        <div class="input-group">
                                            <button class="btn btn-outline-secondary btn-sm" type="button" data-index="${index}" data-action="decrease">-</button>
                                            <input type="number" class="form-control form-control-sm quantity-input" value="${item.quantity}" min="1" readonly>
                                            <button class="btn btn-outline-secondary btn-sm" type="button" data-index="${index}" data-action="increase">+</button>
                                        </div>
                                    </div>
                                    <div style="width: 100px;" class="text-end">
                                        <h5 class="mb-0 fw-semibold">S/ ${itemTotal.toFixed(2)}</h5>
                                    </div>
                                    <a href="#!" class="ms-3 text-danger" data-index="${index}" data-action="remove"><i class="bi bi-trash-fill"></i></a>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            if (subtotalElem) subtotalElem.textContent = `S/ ${subtotal.toFixed(2)}`;
            if (totalElem) totalElem.textContent = `S/ ${(subtotal + shippingCost).toFixed(2)}`;
        }
    };

    /**
     * Obtiene el ID del usuario actual
     */
    const obtenerUsuarioId = () => {
        // En una implementación real, esto vendría de la sesión o autenticación
        try {
            const usuarioGuardado = localStorage.getItem('usuarioActual');
            if (usuarioGuardado) {
                const usuario = JSON.parse(usuarioGuardado);
                return parseInt(usuario.id, 10) || 1;
            }
        } catch (error) {
            console.log('No se pudo obtener usuario, usando valor por defecto');
        }
        return 1; // Valor por defecto para testing
    };

    /**
     * Guarda la compra en la base de datos a través del backend
     */
    const guardarCompraEnBD = async (compraData) => {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(compraData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Error al guardar la compra en el servidor');
            }

            const result = await response.json();

            return {
                success: true,
                compra_id: result.compra_id,
                message: 'Compra guardada exitosamente'
            };

        } catch (error) {
            console.error('Error guardando compra:', error);
            throw error;
        }
    };

    /**
     * Muestra un resumen de la compra realizada
     */
    const mostrarResumenCompra = (compraData, compraId) => {
        // Crear modal dinámicamente
        const modalHTML = `
            <div class="modal fade" id="compraExitosaModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title">¡Compra Exitosa!</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-3">
                                <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>
                            </div>
                            <h6 class="text-center text-success">Tu compra se ha procesado correctamente</h6>
                            <div class="mt-4">
                                <p><strong>ID de Compra:</strong> ${compraId}</p>
                                <p><strong>Total de la compra:</strong> S/ ${compraData.total.toFixed(2)}</p>
                                <p><strong>Productos comprados:</strong> ${compraData.items.length}</p>
                                <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
                                <div class="mt-3 p-2 bg-light rounded">
                                    <small class="text-success">
                                        <i class="bi bi-database-check"></i> 
                                        La compra ha sido guardada en la base de datos.
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Seguir Comprando</button>
                            <a href="catalogo.html" class="btn btn-success">Ir al Catálogo</a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remover modal existente si hay uno
        const modalExistente = document.getElementById('compraExitosaModal');
        if (modalExistente) {
            modalExistente.remove();
        }

        // Agregar nuevo modal al DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Mostrar modal
        const modalElement = document.getElementById('compraExitosaModal');
        const modal = new bootstrap.Modal(modalElement);

        // Configurar evento para cuando se cierre el modal
        modalElement.addEventListener('hidden.bs.modal', function () {
            // Redirigir al catálogo después de cerrar el modal
            window.location.href = 'catalogo.html';
        });

        modal.show();
    };

    // --- EVENT LISTENERS ---
    if (itemsContainer) {
        itemsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('button, a');
            if (!target) return;

            const index = parseInt(target.dataset.index, 10);
            const action = target.dataset.action;

            if (action === 'increase') {
                cart[index].quantity++;
            } else if (action === 'decrease') {
                if (cart[index].quantity > 1) {
                    cart[index].quantity--;
                } else {
                    cart.splice(index, 1);
                }
            } else if (action === 'remove') {
                cart.splice(index, 1);
            }
            saveCart();
        });
    }

    // Agregar funcionalidad al botón "Proceder al Pago"
    const checkoutBtn = document.getElementById('btn-proceder-pago');
    const paymentModalElement = document.getElementById('paymentModal');
    const paymentModal = paymentModalElement ? new bootstrap.Modal(paymentModalElement) : null;
    const confirmPaymentBtn = document.getElementById('btn-confirm-payment');
    const modalTotalAmount = document.getElementById('modal-total-amount');

    if (checkoutBtn && paymentModal) {
        checkoutBtn.addEventListener('click', function () {
            if (cart.length === 0) {
                alert('El carrito está vacío');
                return;
            }

            // Calcular total para mostrar en el modal
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal + shippingCost;

            if (modalTotalAmount) {
                modalTotalAmount.textContent = total.toFixed(2);
            }
            paymentModal.show();
        });
    }

    // Funcionalidad para confirmar el pago desde el modal
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', async function () {
            // Validar campos del formulario de pago
            const cardName = document.getElementById('card-name').value;
            const cardNumber = document.getElementById('card-number').value;
            const cardExpiry = document.getElementById('card-expiry').value;
            const cardCvc = document.getElementById('card-cvc').value;

            if (!cardName || !cardNumber || !cardExpiry || !cardCvc) {
                alert('Por favor, complete todos los campos de pago.');
                return;
            }

            // Ocultar modal
            if (paymentModal) paymentModal.hide();

            // Mostrar loading en el botón de proceder
            if (checkoutBtn) {
                checkoutBtn.disabled = true;
                checkoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Procesando...';
            }

            // Calcular totales nuevamente por seguridad
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal + shippingCost;

            try {
                // Preparar datos para guardar
                const compraData = {
                    usuario_id: obtenerUsuarioId(),
                    items: cart.map(item => ({
                        producto_id: parseInt(item.id, 10),
                        nombre: item.name,
                        precio_unitario: parseFloat(item.price),
                        cantidad: parseInt(item.quantity, 10),
                        subtotal: parseFloat(item.price) * parseInt(item.quantity, 10)
                    })),
                    subtotal: parseFloat(subtotal),
                    costo_envio: parseFloat(shippingCost),
                    total: parseFloat(total)
                };

                console.log('Enviando compra a la base de datos:', compraData);

                // Guardar compra en la base de datos
                const resultado = await guardarCompraEnBD(compraData);

                if (resultado.success) {
                    // Limpiar carrito después de la compra exitosa
                    cart.length = 0;
                    saveCart();

                    // Mostrar resumen de la compra
                    mostrarResumenCompra(compraData, resultado.compra_id);

                } else {
                    throw new Error(resultado.message || 'Error al guardar la compra');
                }

            } catch (error) {
                console.error('Error en el proceso de compra:', error);
                alert('Error al procesar la compra: ' + error.message + '\n\nPor favor, intente nuevamente.');
            } finally {
                // Restaurar botón
                if (checkoutBtn) {
                    checkoutBtn.disabled = false;
                    checkoutBtn.innerHTML = 'Proceder al Pago';
                }
            }
        });
    }

    // --- INICIALIZACIÓN ---
    renderCart();
});