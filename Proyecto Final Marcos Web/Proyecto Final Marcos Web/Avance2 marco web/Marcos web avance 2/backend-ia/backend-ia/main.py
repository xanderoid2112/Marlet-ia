from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import json

from models.schemas import CanastaRequest, CanastaResponse, Categoria, CategoriaCreate, CategoriaUpdate, ProductoCreate, ProductoUpdate
from recommender import generar_canasta
from db import db
from config import config

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Supermercado IA API",
    description="API de inteligencia artificial para generación de canastas optimizadas",
    version="1.0.0"
)

# CORS para comunicación con frontend y Spring Boot
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir todos los orígenes para desarrollo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/generar_canasta", response_model=CanastaResponse)
async def generar_canasta_api(request: CanastaRequest):
    """
    Genera una canasta optimizada usando IA
    
    - **usuario_id**: ID del usuario en la base de datos
    - **presupuesto**: Presupuesto máximo para la canasta
    - **productos_deseados**: Lista de IDs de productos que el usuario quiere incluir
    - **preferencias**: Preferencias de marcas, dietas y categorías excluidas
    """
    try:
        logger.info(f"Solicitud de canasta recibida - Usuario: {request.usuario_id}, Presupuesto: {request.presupuesto}")
        
        # Convertir preferencias correctamente
        preferencias_dict = None
        if request.preferencias:
            preferencias_dict = request.preferencias.dict() if hasattr(request.preferencias, 'dict') else request.preferencias
        
        resultado = generar_canasta(
            usuario_id=request.usuario_id,
            presupuesto=request.presupuesto,
            productos_deseados=request.productos_deseados,
            preferencias_usuario=preferencias_dict
        )
        
        logger.info(f"Canasta generada exitosamente - Productos: {len(resultado['productos'])}, Total: {resultado['total']}")
        return resultado
        
    except Exception as e:
        logger.error(f"Error generando canasta: {e}")
        raise HTTPException(status_code=500, detail="Error interno generando la canasta")

@app.get("/health")
async def health_check():
    """Endpoint de salud para verificar que el servicio está funcionando"""
    return {
        "status": "healthy",
        "service": "Supermercado IA API",
        "version": "1.0.0"
    }

@app.get("/categorias", response_model=List[Categoria])
async def obtener_categorias():
    """Obtiene la lista de categorías disponibles"""
    try:
        logger.info("Solicitando categorías de la base de datos")
        query = """
        SELECT id, nombre, slug
        FROM categorias
        WHERE activo = TRUE
        ORDER BY nombre ASC
        """
        categorias_db = db.execute_query(query)
        if not categorias_db:
            return []
        return [dict(cat) for cat in categorias_db]
    except Exception as e:
        logger.error(f"Error obteniendo categorías: {e}")
        raise HTTPException(status_code=500, detail="Error obteniendo categorías")

@app.post("/categorias", response_model=Categoria)
async def crear_categoria(categoria: CategoriaCreate):
    """Crea una nueva categoría"""
    try:
        logger.info(f"Creando categoría: {categoria.nombre}")
        slug = categoria.slug or categoria.nombre.lower().replace(' ', '-').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
        
        query = """
        INSERT INTO categorias (nombre, slug)
        VALUES (%s, %s)
        RETURNING id, nombre, slug
        """
        result = db.execute_query(query, (categoria.nombre, slug))
        if result and len(result) > 0:
            return dict(result[0])
        raise HTTPException(status_code=500, detail="Error creando categoría")
    except Exception as e:
        logger.error(f"Error creando categoría: {e}")
        raise HTTPException(status_code=500, detail=f"Error creando categoría: {str(e)}")

@app.put("/categorias/{categoria_id}", response_model=Categoria)
async def actualizar_categoria(categoria_id: int, categoria: CategoriaUpdate):
    """Actualiza una categoría existente"""
    try:
        logger.info(f"Actualizando categoría {categoria_id}")
        updates = []
        params = []
        
        if categoria.nombre:
            updates.append("nombre = %s")
            params.append(categoria.nombre)
        
        if categoria.slug:
            updates.append("slug = %s")
            params.append(categoria.slug)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No hay campos para actualizar")
        
        params.append(categoria_id)
        query = f"""
        UPDATE categorias
        SET {', '.join(updates)}
        WHERE id = %s
        RETURNING id, nombre, slug
        """
        result = db.execute_query(query, tuple(params))
        if result and len(result) > 0:
            return dict(result[0])
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error actualizando categoría: {e}")
        raise HTTPException(status_code=500, detail=f"Error actualizando categoría: {str(e)}")

@app.delete("/categorias/{categoria_id}")
async def eliminar_categoria(categoria_id: int):
    """Elimina una categoría (Hard Delete)"""
    try:
        logger.info(f"Eliminando categoría {categoria_id} (Hard Delete)")
        # Primero eliminar productos asociados o setearlos a null (opcional, dependiendo de FK)
        # Por ahora intentamos delete directo. Si falla por FK, el usuario lo sabrá.
        query = "DELETE FROM categorias WHERE id = %s RETURNING id"
        result = db.execute_query(query, (categoria_id,))
        if result and len(result) > 0:
            return {"message": "Categoría eliminada exitosamente", "id": categoria_id}
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error eliminando categoría: {e}")
        # Si es error de FK
        if "foreign key constraint" in str(e).lower():
            raise HTTPException(status_code=400, detail="No se puede eliminar: hay productos en esta categoría")
        raise HTTPException(status_code=500, detail=f"Error eliminando categoría: {str(e)}")

@app.get("/productos")
async def obtener_todos_los_productos():
    """Obtiene todos los productos disponibles de la base de datos"""
    try:
        logger.info("Solicitando todos los productos de la base de datos")
        
        query = """
        SELECT 
            p.id,
            p.nombre,
            p.precio,
            p.marcas,
            p.dieta,
            p.url_imagen,
            p.categoria_id,
            p.stock,
            c.nombre AS categoria_nombre,
            c.slug AS categoria_slug
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = TRUE
        ORDER BY nombre ASC
        """
        
        productos_db = db.execute_query(query)
        
        if not productos_db:
            logger.warning("No se encontraron productos en la base de datos")
            return {"productos": []}
        
        # Normalizar precios DECIMAL a float
        productos = []
        for p in productos_db:
            try:
                producto = dict(p)
                if producto.get('precio') is not None:
                    producto['precio'] = float(producto['precio'])
                marca_val = producto.get('marcas') or producto.get('marca')
                producto['marca'] = marca_val
                producto['marcas'] = marca_val
                categoria_nombre = producto.get('categoria_nombre') or producto.get('categoria')
                categoria_slug = producto.get('categoria_slug')
                if categoria_nombre and not categoria_slug:
                    categoria_slug = categoria_nombre.lower().replace(' ', '-')
                producto['categoria_nombre'] = categoria_nombre
                producto['categoria_slug'] = categoria_slug
                producto['categoria'] = categoria_nombre or 'General'
                productos.append(producto)
            except Exception as e:
                logger.warning(f"Error procesando producto {p.get('id')}: {e}")
                continue
        
        logger.info(f"Retornando {len(productos)} productos")
        return {"productos": productos}
        
    except Exception as e:
        logger.error(f"Error obteniendo productos: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo productos: {str(e)}")

@app.get("/productos/recomendados")
async def obtener_productos_recomendados(limit: int = 10):
    """Obtiene una lista de productos recomendados (simulación de IA)"""
    try:
        logger.info(f"Solicitando {limit} productos recomendados")
        
        # Obtener todos los productos activos
        query = """
        SELECT 
            p.id,
            p.nombre,
            p.precio,
            p.marcas,
            p.dieta,
            p.url_imagen,
            p.categoria_id,
            p.stock,
            c.nombre AS categoria_nombre
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = TRUE
        """
        
        productos_db = db.execute_query(query)
        
        if not productos_db:
            return {"productos": []}
            
        # Convertir a lista de diccionarios
        all_products = [dict(p) for p in productos_db]
        
        # Selección aleatoria para simular "recomendación"
        import random
        if len(all_products) > limit:
            recomendados = random.sample(all_products, limit)
        else:
            recomendados = all_products
            
        # Formatear respuesta
        for p in recomendados:
            if p.get('precio') is not None:
                p['precio'] = float(p['precio'])
            marca_val = p.get('marcas') or p.get('marca')
            p['marca'] = marca_val
            p['marcas'] = marca_val
            p['categoria'] = p.get('categoria_nombre') or 'General'
            
        return {"productos": recomendados}
        
    except Exception as e:
        logger.error(f"Error obteniendo recomendaciones: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo recomendaciones: {str(e)}")


@app.get("/productos/recientes")
async def obtener_productos_recientes(limit: int = 4):
    """Obtiene los productos más recientemente COMPRADOS por los usuarios"""
    try:
        logger.info(f"Solicitando {limit} productos recientemente comprados")
        
        # 1. Buscar las últimas compras en la base de datos
        query_compras = "SELECT items FROM compras WHERE items IS NOT NULL ORDER BY fecha_compra DESC LIMIT 20"
        compras_db = db.execute_query(query_compras)
        
        productos_ids = []
        if compras_db:
            for row in compras_db:
                items = row.get('items', [])
                if isinstance(items, str):
                    import json
                    try: items = json.loads(items)
                    except: continue
                
                # Extraer los IDs sin repetir
                for item in items:
                    pid = item.get('producto_id')
                    if pid and pid not in productos_ids:
                        productos_ids.append(int(pid))
                    if len(productos_ids) >= limit: break
                if len(productos_ids) >= limit: break
        
        # 2. Fallback: Si nadie ha comprado nada aún, mostrar los últimos del catálogo
        if not productos_ids:
            query_fallback = """
            SELECT p.id, p.nombre, p.precio, p.marcas, p.dieta, p.url_imagen, p.categoria_id, p.stock, c.nombre AS categoria_nombre
            FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.activo = TRUE ORDER BY p.id DESC LIMIT %s
            """
            productos_db = db.execute_query(query_fallback, (limit,))
        else:
            # 3. Traer los datos exactos de los productos que sí fueron comprados
            format_strings = ','.join(['%s'] * len(productos_ids))
            query_productos = f"""
            SELECT p.id, p.nombre, p.precio, p.marcas, p.dieta, p.url_imagen, p.categoria_id, p.stock, c.nombre AS categoria_nombre
            FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.id IN ({format_strings})
            """
            productos_db = db.execute_query(query_productos, tuple(productos_ids))
        
        if not productos_db:
            return {"productos": []}
            
        # Normalizar los datos para enviarlos al frontend
        productos_formateados = []
        for p in productos_db:
            pd = dict(p)
            if pd.get('precio') is not None: pd['precio'] = float(pd['precio'])
            marca_val = pd.get('marcas') or pd.get('marca')
            pd['marca'] = marca_val
            pd['marcas'] = marca_val
            pd['categoria'] = pd.get('categoria_nombre') or 'General'
            productos_formateados.append(pd)
            
        return {"productos": productos_formateados[:limit]}
        
    except Exception as e:
        logger.error(f"Error obteniendo productos recientes comprados: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/productos/{producto_id}")
async def obtener_producto(producto_id: int):
    """Obtiene un producto específico por su ID"""
    try:
        logger.info(f"Solicitando producto {producto_id}")
        
        query = """
        SELECT 
            p.id,
            p.nombre,
            p.precio,
            p.marcas,
            p.dieta,
            p.url_imagen,
            p.categoria_id,
            p.stock,
            c.nombre AS categoria_nombre,
            c.slug AS categoria_slug
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.id = %s
        """
        
        result = db.execute_query(query, (producto_id,))
        
        if not result or len(result) == 0:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        
        producto = dict(result[0])
        if producto.get('precio') is not None:
            producto['precio'] = float(producto['precio'])
        marca_val = producto.get('marcas') or producto.get('marca')
        producto['marca'] = marca_val
        producto['marcas'] = marca_val
        categoria_nombre = producto.get('categoria_nombre') or producto.get('categoria')
        categoria_slug = producto.get('categoria_slug')
        if categoria_nombre and not categoria_slug:
            categoria_slug = categoria_nombre.lower().replace(' ', '-')
        producto['categoria_nombre'] = categoria_nombre
        producto['categoria_slug'] = categoria_slug
        producto['categoria'] = categoria_nombre or 'General'
        
        return producto
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo producto {producto_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo producto: {str(e)}")

@app.post("/productos")
async def crear_producto(producto: ProductoCreate):
    """Crea un nuevo producto"""
    try:
        logger.info(f"Creando producto: {producto.nombre}")
        query = """
        INSERT INTO productos (nombre, precio, marcas, tipo, dieta, url_imagen, categoria_id, stock)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, nombre, precio, marcas, tipo, dieta, url_imagen, categoria_id, stock
        """
        result = db.execute_query(query, (
            producto.nombre,
            producto.precio,
            producto.marcas,
            producto.tipo,
            producto.dieta,
            producto.url_imagen,
            producto.categoria_id,
            producto.stock
        ))
        if result and len(result) > 0:
            prod = dict(result[0])
            marca_val = prod.get('marcas') or prod.get('marca')
            prod['marca'] = marca_val
            prod['marcas'] = marca_val
            # Obtener información de categoría si existe
            if prod.get('categoria_id'):
                cat_query = "SELECT nombre, slug FROM categorias WHERE id = %s"
                cat_result = db.execute_query(cat_query, (prod['categoria_id'],))
                if cat_result and len(cat_result) > 0:
                    cat = dict(cat_result[0])
                    prod['categoria_nombre'] = cat['nombre']
                    prod['categoria_slug'] = cat['slug']
            prod['categoria'] = prod.get('categoria_nombre') or 'General'
            return prod
        raise HTTPException(status_code=500, detail="Error creando producto")
    except Exception as e:
        logger.error(f"Error creando producto: {e}")
        raise HTTPException(status_code=500, detail=f"Error creando producto: {str(e)}")

@app.put("/productos/{producto_id}")
async def actualizar_producto(producto_id: int, producto: ProductoUpdate):
    """Actualiza un producto existente"""
    try:
        logger.info(f"Actualizando producto {producto_id}")
        updates = []
        params = []
        
        if producto.nombre:
            updates.append("nombre = %s")
            params.append(producto.nombre)
        if producto.precio is not None:
            updates.append("precio = %s")
            params.append(producto.precio)
        if producto.marcas is not None:
            updates.append("marcas = %s")
            params.append(producto.marcas)
        if producto.tipo is not None:
            updates.append("tipo = %s")
            params.append(producto.tipo)
        if producto.dieta is not None:
            updates.append("dieta = %s")
            params.append(producto.dieta)
        if producto.url_imagen is not None:
            updates.append("url_imagen = %s")
            params.append(producto.url_imagen)
        if producto.categoria_id is not None:
            updates.append("categoria_id = %s")
            params.append(producto.categoria_id)
        if producto.stock is not None:
            updates.append("stock = %s")
            params.append(producto.stock)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No hay campos para actualizar")
        
        params.append(producto_id)
        query = f"""
        UPDATE productos
        SET {', '.join(updates)}
        WHERE id = %s
        RETURNING id, nombre, precio, marcas, tipo, dieta, url_imagen, categoria_id, stock
        """
        result = db.execute_query(query, tuple(params))
        if result and len(result) > 0:
            prod = dict(result[0])
            marca_val = prod.get('marcas') or prod.get('marca')
            prod['marca'] = marca_val
            prod['marcas'] = marca_val
            # Obtener información de categoría si existe
            if prod.get('categoria_id'):
                cat_query = "SELECT nombre, slug FROM categorias WHERE id = %s"
                cat_result = db.execute_query(cat_query, (prod['categoria_id'],))
                if cat_result and len(cat_result) > 0:
                    cat = dict(cat_result[0])
                    prod['categoria_nombre'] = cat['nombre']
                    prod['categoria_slug'] = cat['slug']
            prod['categoria'] = prod.get('categoria_nombre') or 'General'
            return prod
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error actualizando producto: {e}")
        raise HTTPException(status_code=500, detail=f"Error actualizando producto: {str(e)}")

@app.delete("/productos/{producto_id}")
async def eliminar_producto(producto_id: int):
    """Elimina un producto (Hard Delete)"""
    try:
        logger.info(f"Eliminando producto {producto_id} (Hard Delete)")
        query = "DELETE FROM productos WHERE id = %s RETURNING id"
        result = db.execute_query(query, (producto_id,))
        if result and len(result) > 0:
            return {"message": "Producto eliminado exitosamente", "id": producto_id}
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error eliminando producto: {e}")
        # Si es error de FK (ej: está en un pedido)
        if "foreign key constraint" in str(e).lower():
            raise HTTPException(status_code=400, detail="No se puede eliminar: el producto está en pedidos existentes")
        raise HTTPException(status_code=500, detail=f"Error eliminando producto: {str(e)}")



@app.post("/entrenar_modelo")
async def entrenar_modelo():
    """Endpoint para entrenar/actualizar el modelo de IA (ejecutar manualmente)"""
    try:
        # Aquí iría la lógica para entrenar el modelo con datos actualizados
        # Por ahora retornamos un mensaje de placeholder
        return {"message": "Funcionalidad de entrenamiento en desarrollo"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# GESTIÓN DE COMPRAS / PEDIDOS
# ==========================================

class ItemCompra(BaseModel):
    producto_id: int
    nombre: str
    precio_unitario: float
    cantidad: int
    subtotal: float

class CompraCreate(BaseModel):
    usuario_id: int
    items: List[ItemCompra]
    subtotal: float
    costo_envio: float
    total: float

class EstadoUpdate(BaseModel):
    estado: str

@app.post("/guardar_compra")
async def guardar_compra(compra: CompraCreate):
    """Guarda una nueva compra en la base de datos"""
    try:
        logger.info(f"Recibiendo compra: {compra}")
        
        # 1. Crear tabla si no existe (idealmente esto va en un script de migración)
        db.execute_query("""
            CREATE TABLE IF NOT EXISTS compras (
                id SERIAL PRIMARY KEY,
                usuario_id INT,
                total DECIMAL(10, 2),
                fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                estado VARCHAR(50) DEFAULT 'pendiente',
                items JSONB,
                subtotal DECIMAL(10, 2),
                costo_envio DECIMAL(10, 2)
            )
        """)
        
        # 2. Insertar compra
        items_json = json.dumps([item.dict() for item in compra.items])
        
        query = """
            INSERT INTO compras (usuario_id, total, items, subtotal, costo_envio, estado)
            VALUES (%s, %s, %s, %s, %s, 'pendiente')
            RETURNING id
        """
        
        result = db.execute_query(query, (
            compra.usuario_id, 
            compra.total, 
            items_json, 
            compra.subtotal, 
            compra.costo_envio
        ))
        
        if not result:
            raise HTTPException(status_code=500, detail="No se pudo guardar la compra")
            
        # Manejar caso donde result es int (rowcount) en lugar de lista (rows)
        if isinstance(result, int):
            logger.warning("INSERT retornó rowcount en lugar de ID. Consultando ID manualmente.")
            # Fallback: obtener el último ID insertado para este usuario
            fallback_query = "SELECT MAX(id) as id FROM compras WHERE usuario_id = %s"
            fallback_result = db.execute_query(fallback_query, (compra.usuario_id,))
            if fallback_result and len(fallback_result) > 0:
                compra_id = fallback_result[0]['id']
            else:
                raise HTTPException(status_code=500, detail="No se pudo recuperar el ID de la compra")
        else:
            compra_id = result[0]['id']
            
        logger.info(f"Compra guardada con ID: {compra_id}")
        
        return {"success": True, "compra_id": compra_id, "message": "Compra guardada exitosamente"}
        
    except Exception as e:
        logger.error(f"Error guardando compra: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.get("/compras")
async def obtener_compras():
    """Obtiene todas las compras registradas"""
    try:
        # Asegurar que la tabla existe
        db.execute_query("""
            CREATE TABLE IF NOT EXISTS compras (
                id SERIAL PRIMARY KEY,
                usuario_id INT,
                total DECIMAL(10, 2),
                fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                estado VARCHAR(50) DEFAULT 'pendiente',
                items JSONB,
                subtotal DECIMAL(10, 2),
                costo_envio DECIMAL(10, 2)
            )
        """)

        query = "SELECT * FROM compras ORDER BY fecha_compra DESC"
        compras = db.execute_query(query)
        
        if not compras:
            return []
            
        # Formatear resultados
        resultados = []
        for c in compras:
            # Convertir items de JSON string/objeto a lista
            items = c.get('items', [])
            if isinstance(items, str):
                items = json.loads(items)
                
            resultados.append({
                "id": c['id'],
                "usuario_id": c['usuario_id'],
                "total": float(c['total']),
                "fecha": c['fecha_compra'].isoformat() if hasattr(c['fecha_compra'], 'isoformat') else str(c['fecha_compra']),
                "estado": c['estado'],
                "items": items,
                "productos": items # Alias para compatibilidad con frontend
            })
            
        return resultados
    except Exception as e:
        logger.error(f"Error obteniendo compras: {e}")
        return [] # Retornar lista vacía en caso de error para no romper frontend

@app.put("/compras/{compra_id}/estado")
async def actualizar_estado_compra(compra_id: int, estado_update: EstadoUpdate):
    """Actualiza el estado de una compra"""
    try:
        query = "UPDATE compras SET estado = %s WHERE id = %s RETURNING id"
        result = db.execute_query(query, (estado_update.estado, compra_id))
        
        if not result:
            raise HTTPException(status_code=404, detail="Compra no encontrada")
            
        return {"success": True, "message": "Estado actualizado"}
    except Exception as e:
        logger.error(f"Error actualizando estado: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=3000,
        reload=True if config.DEBUG else False
    )
@app.get("/admin/estadisticas")
async def obtener_estadisticas():
    """Obtiene estadísticas generales para el dashboard"""
    try:
        logger.info("Calculando estadísticas del dashboard")
        
        # Total productos
        res_prod = db.execute_query("SELECT COUNT(*) as count FROM productos")
        total_productos = res_prod[0]['count'] if res_prod else 0
        
        # Total stock y valor
        res_stock = db.execute_query("SELECT SUM(stock) as total_stock, SUM(stock * precio) as valor_inventario FROM productos")
        total_stock = res_stock[0]['total_stock'] if res_stock and res_stock[0]['total_stock'] else 0
        valor_inventario = float(res_stock[0]['valor_inventario']) if res_stock and res_stock[0]['valor_inventario'] else 0.0
        
        return {
            "total_productos": total_productos,
            "total_stock": total_stock,
            "valor_inventario": valor_inventario
        }
    except Exception as e:
        logger.error(f"Error obteniendo estadisticas: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
