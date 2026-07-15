# Cambios de Integración - Panel de Administración con PostgreSQL

## Comandos para Inicializar el Backend

### Backend FastAPI (Python)

```bash
# Navegar al directorio del backend
cd "Avance2 marco web\Marcos web avance 2\backend-ia\backend-ia"

# Iniciar el servidor FastAPI
python main.py
```

El backend se ejecutará en: `https://marlet-ia.onrender.com`

### Verificar que el Backend está Corriendo

```bash
# Verificar salud del servicio
curl https://marlet-ia.onrender.com/health
```

Debería retornar:
```json
{
  "status": "healthy",
  "service": "Supermercado IA API",
  "version": "1.0.0"
}
```

---

## Resumen de Cambios Realizados

### 1. Backend (FastAPI) - `backend-ia/backend-ia/main.py`

#### Nuevos Endpoints Agregados:

**Categorías:**
- `GET /categorias` - Obtiene todas las categorías
- `POST /categorias` - Crea una nueva categoría
- `PUT /categorias/{categoria_id}` - Actualiza una categoría
- `DELETE /categorias/{categoria_id}` - Elimina una categoría

**Productos:**
- `GET /productos` - Obtiene todos los productos (ya existía, se mejoró)
- `GET /productos/{producto_id}` - **NUEVO**: Obtiene un producto específico por ID
- `POST /productos` - Crea un nuevo producto
- `PUT /productos/{producto_id}` - Actualiza un producto
- `DELETE /productos/{producto_id}` - Elimina un producto

#### Mejoras en Endpoints Existentes:
- `GET /productos` ahora hace `LEFT JOIN` con la tabla `categorias` para incluir:
  - `categoria_id`
  - `categoria_nombre`
  - `categoria_slug`

### 2. Modelos (Schemas) - `backend-ia/backend-ia/models/schemas.py`

#### Nuevos Modelos Agregados:
- `Categoria` - Modelo para categorías (id, nombre, slug)
- `CategoriaCreate` - Modelo para crear categorías
- `CategoriaUpdate` - Modelo para actualizar categorías
- `ProductoCreate` - Modelo para crear productos
- `ProductoUpdate` - Modelo para actualizar productos

#### Modelos Actualizados:
- `Producto` y `ProductoCanasta` ahora incluyen:
  - `categoria_id: Optional[int]`
  - `categoria_nombre: Optional[str]`
  - `categoria_slug: Optional[str]`

### 3. Frontend - Panel de Administración

#### Archivo: `js/administracion.js`

**Funciones Actualizadas:**

1. **`loadCategorias()`**
   - Ahora carga categorías desde `GET /categorias` en lugar de `localStorage`
   - Almacena en `window.categorias`

2. **`guardarCategoriaAPI(payload, categoriaId)`** - **NUEVA**
   - Guarda categorías usando `POST /categorias` o `PUT /categorias/{id}`
   - Genera automáticamente el `slug` a partir del nombre

3. **`deleteCategoria(id)`**
   - Ahora elimina usando `DELETE /categorias/{id}`

4. **`updateProductTypeDropdown()`**
   - Carga categorías dinámicamente desde `GET /categorias`
   - Usa `categoria_id` como valor del select en lugar del nombre

5. **`loadProducts()`**
   - Carga productos desde `GET /productos`
   - Mapea correctamente `categoria_id`, `categoria_nombre`, `categoria_slug`

6. **`setupSaveProductButton()`**
   - Guarda productos usando `POST /productos` o `PUT /productos/{id}`
   - Usa `categoria_id` en lugar de nombre de categoría
   - Incluye campos `marca` y `dieta`
   - **Corregido**: Ahora es una función `async` para permitir `await`

7. **`editProduct(id)`**
   - Carga correctamente `marca` y `dieta` en el formulario
   - Usa `categoria_id` para seleccionar la categoría en el dropdown

8. **`deleteProduct(id)`**
   - Ahora elimina usando `DELETE /productos/{id}`

9. **`renderCategorias()`**
   - Muestra solo los campos que existen en la BD: `nombre` y `slug`
   - Eliminados campos que no existen: icono, color, descripción

10. **`renderProducts()`**
    - Muestra `categoria_nombre` en lugar de `tipo`

#### Archivo: `administracion.html`

**Formulario de Categorías:**
- Simplificado para mostrar solo el campo "Nombre"
- Eliminados campos: descripción, icono, color (no existen en BD)
- El slug se genera automáticamente

**Formulario de Productos:**
- Dropdown de categorías ahora se carga dinámicamente (sin opciones hardcodeadas)
- Agregado campo "Marca"
- Agregado campo "Dieta" (select con opciones: vegano, vegetariana, sin_gluten)
- Eliminadas opciones hardcodeadas de categorías

### 4. Correcciones de Errores

**Errores Corregidos:**
- 5 errores de linter: `await` expressions en función no-async
  - Solución: Convertido el event listener en `setupSaveProductButton()` a `async function`

---

## Estructura de la Base de Datos

### Tabla: `categorias`
```sql
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL
);
```

### Tabla: `productos`
```sql
-- La tabla productos debe tener:
- id
- nombre
- precio
- marca
- tipo (puede ser NULL)
- dieta
- url_imagen
- categoria_id (FOREIGN KEY a categorias.id)
```

---

## Flujo de Sincronización

1. **Panel de Administración** → Crea/Edita categoría
2. **API FastAPI** → Guarda en PostgreSQL (`categorias` table)
3. **Catálogo/Compras Rápidas** → Carga categorías desde `GET /categorias`
4. **Resultado**: Categorías aparecen automáticamente en todas las páginas

---

## Pruebas Recomendadas

1. **Agregar una categoría desde el panel:**
   - Ir a Panel de Administración → Categorías
   - Agregar nueva categoría (ej: "Bebidas")
   - Verificar que aparece en el catálogo

2. **Agregar un producto:**
   - Ir a Panel de Administración → Productos
   - Seleccionar una categoría del dropdown
   - Completar campos: nombre, precio, imagen, marca, dieta
   - Guardar y verificar que aparece en catálogo/compras rápidas

3. **Editar un producto:**
   - Hacer clic en "Editar" en un producto
   - Verificar que el formulario se carga correctamente
   - Cambiar categoría y guardar
   - Verificar que los cambios se reflejan

4. **Eliminar categoría/producto:**
   - Eliminar desde el panel
   - Verificar que desaparece de todas las páginas

---

## Notas Importantes

- El backend debe estar corriendo en `https://marlet-ia.onrender.com` para que el panel funcione
- Todas las operaciones CRUD ahora se realizan directamente contra PostgreSQL
- Ya no se usa `localStorage` para categorías y productos
- El slug de categorías se genera automáticamente a partir del nombre
- Los productos deben tener un `categoria_id` válido para aparecer correctamente

---

## Troubleshooting

**Problema**: Las categorías no aparecen en el catálogo
- **Solución**: Verificar que el backend esté corriendo y que `GET /categorias` retorne datos

**Problema**: Error al guardar producto
- **Solución**: Verificar que se haya seleccionado una categoría válida en el dropdown

**Problema**: El backend no inicia
- **Solución**: Verificar que todas las dependencias estén instaladas (`pip install -r requirements.txt`)

---

**Fecha de Cambios**: Noviembre 2025
**Versión**: 1.0.0

