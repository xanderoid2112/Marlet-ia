/**
 * ===========================================
 * BASE DE DATOS DE PRODUCTOS - CONECTADA A API
 * ===========================================
 * 
 * Este archivo contiene la base de datos central de productos para AI Market.
 * Ahora se conecta al backend para obtener datos reales de la base de datos.
 * 
 * Estructura de cada producto:
 * - id: Identificador único del producto
 * - name: Nombre del producto
 * - price: Precio en soles peruanos
 * - category: Categoría del producto (para filtros)
 * - brand: Marca del producto
 * - img: URL de la imagen del producto
 * - description: Descripción opcional del producto
 */

// Variables globales
let productDatabase = [];
let catalogCategories = [];

/**
 * Carga productos desde la API del backend
 */
async function loadProductsFromAPI() {
    try {
        console.log('🔄 Cargando productos desde API...');

        // Cargar todos los productos desde el endpoint dedicado
        const response = await fetch('https://marlet-ia.onrender.com/productos', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const productos = data.productos || [];

        if (productos.length === 0) {
            throw new Error('No hay productos disponibles en la base de datos');
        }

        // Convertir formato de BD a formato del frontend
        // Usar un Map para eliminar duplicados por ID
        const uniqueProducts = new Map();
        productos.forEach(producto => {
            if (!uniqueProducts.has(producto.id)) {
                const categoryName = producto.categoria_nombre || 'General';
                const categorySlug = producto.categoria_slug || categoryName.toLowerCase().replace(/\s+/g, '-');

                uniqueProducts.set(producto.id, {
                    id: producto.id,
                    name: producto.nombre,
                    price: parseFloat(producto.precio),
                    category: categorySlug,
                    categoryId: producto.categoria_id || null,
                    categoryName,
                    categorySlug,
                    brand: producto.marca || 'N/A',
                    img: producto.url_imagen || 'https://via.placeholder.com/300x300?text=Sin+Imagen',
                    description: ''
                });
            }
        });

        // Convertir Map a Array
        productDatabase = Array.from(uniqueProducts.values());
        window.productDatabase = productDatabase;

        console.log('✅ Productos cargados desde API (sin duplicados):', productDatabase.length);

        // Disparar evento para notificar que los productos se cargaron
        window.dispatchEvent(new CustomEvent('productsLoaded', {
            detail: { products: productDatabase }
        }));

        return productDatabase;
    } catch (error) {
        console.error('❌ Error cargando productos desde API:', error);
        console.log('⚠️ No hay productos disponibles - Base de datos no conectada');

        // NO usar datos locales - el catálogo no debe funcionar sin BD
        productDatabase = [];
        window.productDatabase = productDatabase;

        // Mostrar mensaje de error al usuario
        if (document.getElementById('products-grid')) {
            document.getElementById('products-grid').innerHTML = `
                <div class="col-12">
                    <div class="alert alert-warning">
                        <h5>Base de datos no conectada</h5>
                        <p>Por favor, conecta la base de datos para ver productos disponibles.</p>
                    </div>
                </div>
            `;
        }

        return productDatabase;
    }
}

/**
 * Carga categorías desde la API del backend
 */
async function loadCategoriesFromAPI() {
    try {
        console.log('🔄 Cargando categorías desde API...');
        const response = await fetch('https://marlet-ia.onrender.com/categorias');

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const categorias = Array.isArray(data) ? data : (data.categorias || []);
        catalogCategories = categorias;
        window.catalogCategories = catalogCategories;

        console.log('✅ Categorías cargadas desde API:', categorias.length);

        // Disparar evento para notificar que las categorías se cargaron
        window.dispatchEvent(new CustomEvent('categoriesLoaded', {
            detail: { categories: categorias }
        }));

        return categorias;
    } catch (error) {
        console.error('❌ Error cargando categorías desde API:', error);
        return [];
    }
}

/**
 * Inicializa la carga de datos al cargar la página
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Inicializando carga de productos...');
    loadProductsFromAPI();
    loadCategoriesFromAPI();
});

// Exportar funciones para uso global
window.loadProductsFromAPI = loadProductsFromAPI;
window.loadCategoriesFromAPI = loadCategoriesFromAPI;
window.productDatabase = productDatabase;
window.catalogCategories = catalogCategories;