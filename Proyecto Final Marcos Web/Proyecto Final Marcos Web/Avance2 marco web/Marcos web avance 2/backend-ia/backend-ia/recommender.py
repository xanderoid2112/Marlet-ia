import random
import logging
from typing import List, Dict, Any, Optional
from db import db

logger = logging.getLogger(__name__)

# ==========================================
# REGLAS DE NEGOCIO AVANZADAS
# ==========================================
PRODUCTOS_ESENCIALES = ['arroz', 'leche', 'huevos', 'aceite', 'pan', 'agua']
CATEGORIAS_SALUDABLES = ['frutas y verduras', 'pescados', 'granos', 'legumbres']

# Diccionario de productos que se compran juntos
REGLAS_COMPLEMENTARIEDAD = {
    'pasta': ['salsa', 'queso'],
    'fideos': ['salsa', 'queso'],
    'arroz': ['aceite', 'menestras', 'pollo'],
    'pan': ['mantequilla', 'mermelada', 'queso', 'jamon'],
    'leche': ['cereal', 'avena', 'cafe']
}

def generar_canasta(usuario_id: int, presupuesto: float, productos_deseados: List[int] = None, preferencias_usuario: Dict = None) -> Dict[str, Any]:
    """Genera una canasta optimizada usando IA Heurística Avanzada"""
    try:
        logger.info(f"Generando canasta para usuario {usuario_id} con presupuesto {presupuesto}")
        productos = obtener_productos_disponibles()
        
        if not productos:
            return crear_respuesta_vacia(presupuesto)
            
        # 1. Filtros Duros
        try:
            productos_filtrados = aplicar_filtros_preferencias(productos, preferencias_usuario)
        except Exception as e:
            logger.warning(f"Error aplicando filtros: {e}")
            productos_filtrados = productos
            
        # 2. Historial de compras
        historial_compras = obtener_historial_usuario(usuario_id)
        
        canasta_productos = []
        costo_actual = 0.0
        
        # 3. Inyectar Productos Deseados
        if productos_deseados:
            for producto_id in productos_deseados:
                producto = next((p for p in productos_filtrados if p['id'] == producto_id), None)
                if producto and costo_actual + producto['precio'] <= presupuesto:
                    canasta_productos.append({
                        **producto,
                        'es_deseado': True,
                        'score_relevancia': 1.0
                    })
                    costo_actual += producto['precio']
                    
        # 4. Inyectar Top Historial si no hay deseados
        productos_prioritarios = []
        if not productos_deseados and historial_compras:
            for producto_id in historial_compras[:3]:
                producto = next((p for p in productos_filtrados if p['id'] == producto_id), None)
                if producto and costo_actual + producto['precio'] <= presupuesto:
                    productos_prioritarios.append({
                        **producto,
                        'es_deseado': False,
                        'es_del_historial': True,
                        'score_relevancia': 0.95
                    })
                    costo_actual += producto['precio']
                    
        canasta_productos.extend(productos_prioritarios)
        
        # 5. Generar Recomendaciones (Scoring Avanzado)
        presupuesto_restante = presupuesto - costo_actual
        productos_recomendados = generar_recomendaciones_ia(
            productos_filtrados, 
            canasta_productos, 
            presupuesto_restante,
            usuario_id,
            historial_compras
        )
        
        canasta_productos.extend(productos_recomendados)
        
        total = sum(p['precio'] for p in canasta_productos)
        ahorro = max(0, presupuesto - total)
        porcentaje_ahorro = (ahorro / presupuesto * 100) if presupuesto > 0 else 0
        
        return {
            "productos": canasta_productos,
            "total": round(total, 2),
            "presupuesto": presupuesto,
            "ahorro": round(ahorro, 2),
            "porcentaje_ahorro": round(porcentaje_ahorro, 2),
            "productos_recomendados": len([p for p in canasta_productos if not p.get('es_deseado', False)]),
            "productos_deseados": len([p for p in canasta_productos if p.get('es_deseado', False)])
        }
        
    except Exception as e:
        logger.error(f"Error generando canasta: {e}")
        return crear_respuesta_vacia(presupuesto)

def generar_recomendaciones_ia(productos: List[Dict], canasta_actual: List[Dict], presupuesto_restante: float, usuario_id: int, historial: List[int] = None) -> List[Dict]:
    if presupuesto_restante <= 0 or len(productos) == 0:
        return []

    categorias_incluidas = {}
    nombres_en_canasta = [p.get('nombre', '').lower() for p in canasta_actual]
    
    for p in canasta_actual:
        cat = p.get('categoria', '') or p.get('categoria_nombre', '')
        categorias_incluidas[cat] = categorias_incluidas.get(cat, 0) + 1

    productos_con_score = []
    for producto in productos:
        # Evitar duplicados exactos en la canasta
        if producto.get('nombre', '').lower() in nombres_en_canasta:
            continue
            
        score = calcular_score_relevancia(producto, canasta_actual, usuario_id, historial)

        # Penalización por saturación de categoría (Garantiza diversidad)
        cat = producto.get('categoria', '') or producto.get('categoria_nombre', '')
        veces = categorias_incluidas.get(cat, 0)
        if veces >= 2:
            score *= 0.3
        elif veces == 1:
            score *= 0.65

        productos_con_score.append({**producto, '_score': score})

    # Ordenar por el mejor score
    productos_con_score.sort(key=lambda x: x['_score'], reverse=True)

    recomendaciones = []
    categorias_recomendadas = {}

    for producto in productos_con_score:
        precio = producto['precio']
        cat = producto.get('categoria', '') or producto.get('categoria_nombre', '')

        if precio > presupuesto_restante:
            continue

        if categorias_recomendadas.get(cat, 0) >= 2:
            continue

        score_final = producto['_score']
        recomendaciones.append({
            **{k: v for k, v in producto.items() if k != '_score'},
            'es_deseado': False,
            'score_relevancia': round(min(score_final, 1.0), 3)
        })
        presupuesto_restante -= precio
        categorias_recomendadas[cat] = categorias_recomendadas.get(cat, 0) + 1

        if len(recomendaciones) >= 20:
            break

    return recomendaciones

def calcular_score_relevancia(producto: Dict, canasta_actual: List[Dict], usuario_id: int, historial: List[int] = None) -> float:
    score = 0.4  # Score base

    cat_prod = (producto.get('categoria', '') or producto.get('categoria_nombre', '')).lower()
    nombre_prod = producto.get('nombre', '').lower()
    
    # 1. Bono Nutricional y Saludable
    dieta = producto.get('dieta', '').lower() if producto.get('dieta') else ''
    if cat_prod in CATEGORIAS_SALUDABLES or dieta in ['vegano', 'vegetariano', 'sin_gluten', 'saludable']:
        score += 0.15

    # 2. Bono de Complementariedad (Cross-Selling Inteligente)
    nombres_canasta = [p.get('nombre', '').lower() for p in canasta_actual]
    for key, complementos in REGLAS_COMPLEMENTARIEDAD.items():
        # Si un producto de la canasta activa una regla, buscar complementos
        if any(key in n for n in nombres_canasta):
            if any(comp in nombre_prod for comp in complementos):
                score += 0.3  # Bono muy alto por ser el complemento perfecto
                break

    # 3. Bono de Supervivencia (Cold Start para productos esenciales)
    if not historial or len(historial) < 3:
        if any(esencial in nombre_prod for esencial in PRODUCTOS_ESENCIALES):
            score += 0.25

    # 4. Bonus por historial (Prioriza recurrencia)
    if historial and producto.get('id') in historial:
        score += 0.35
        if producto.get('id') in historial[:3]:
            score += 0.15

    # 5. Bonus por accesibilidad económica
    precio = producto.get('precio', 0)
    if precio <= 5:
        score += 0.20
    elif precio <= 15:
        score += 0.10

    # 6. Bonus por disponibilidad (Stock)
    stock = producto.get('stock', 0) or 0
    if stock > 20:
        score += 0.10

    return min(1.0, score)

# Las funciones obtener_productos_disponibles, obtener_historial_usuario, aplicar_filtros_preferencias 
# y crear_respuesta_vacia se mantienen EXACTAMENTE IGUAL como las tenías.

def obtener_productos_disponibles() -> List[Dict]:
    try:
        query = """
        SELECT p.id, p.nombre, p.precio, p.marcas, p.dieta, p.url_imagen, p.categoria_id, p.stock, c.nombre AS categoria_nombre, c.slug AS categoria_slug
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        ORDER BY precio ASC
        """
        productos_db = db.execute_query(query)
        if productos_db and len(productos_db) > 0:
            productos_normalizados = []
            for p in productos_db:
                try:
                    pn = dict(p)
                    if pn.get('precio') is not None: pn['precio'] = float(pn['precio'])
                    marca_val = pn.get('marcas') or pn.get('marca')
                    pn['marca'] = marca_val
                    pn['marcas'] = marca_val
                    pn['stock'] = pn.get('stock') or 0
                    categoria_nombre = pn.get('categoria_nombre') or pn.get('categoria')
                    categoria_slug = pn.get('categoria_slug')
                    if categoria_nombre and not categoria_slug: categoria_slug = categoria_nombre.lower().replace(' ', '-')
                    pn['categoria_nombre'] = categoria_nombre
                    pn['categoria_slug'] = categoria_slug
                    pn['categoria'] = categoria_nombre or ''
                    productos_normalizados.append(pn)
                except Exception as e:
                    continue
            return productos_normalizados
        return []
    except Exception as e:
        return []

def obtener_historial_usuario(usuario_id: int) -> List[int]:
    import json
    try:
        query = "SELECT items FROM compras WHERE usuario_id = %s AND items IS NOT NULL ORDER BY fecha_compra DESC LIMIT 10"
        result = db.execute_query(query, (usuario_id,))
        fallback_ids = [69, 70, 40, 44, 66, 39, 62, 68]
        if not result: return fallback_ids
        producto_counts = {}
        for row in result:
            items = row.get('items', [])
            if isinstance(items, str):
                try: items = json.loads(items)
                except Exception: continue
            if isinstance(items, list):
                for item in items:
                    pid = item.get('producto_id')
                    if pid: producto_counts[int(pid)] = producto_counts.get(int(pid), 0) + int(item.get('cantidad', 1))
        productos_ordenados = sorted(producto_counts.items(), key=lambda x: x[1], reverse=True)
        historial_ids = [p[0] for p in productos_ordenados]
        if not historial_ids: return fallback_ids
        return historial_ids
    except Exception as e:
        return [69, 70, 40, 44, 66, 39, 62, 68]

def aplicar_filtros_preferencias(productos: List[Dict], preferencias: Dict = None) -> List[Dict]:
    if not preferencias: return productos
    productos_filtrados = productos.copy()
    
    if preferencias.get('marcas_preferidas') and len(preferencias['marcas_preferidas']) > 0:
        marcas_preferidas = [m.lower() for m in preferencias['marcas_preferidas']]
        productos_con_marca = [p for p in productos_filtrados if p.get('marca') and p['marca'].lower() in marcas_preferidas]
        if len(productos_con_marca) > 0:
            otros_productos = [p for p in productos_filtrados if p not in productos_con_marca]
            productos_filtrados = productos_con_marca + otros_productos
            
    if preferencias.get('dietas') and len(preferencias['dietas']) > 0:
        dietas = [d.lower() for d in preferencias['dietas']]
        normalized_dietas = []
        for d in dietas:
            if d in ['vegano', 'vegana']: normalized_dietas.extend(['vegano', 'vegana'])
            elif d in ['sin_gluten', 'sin gluten', 'gluten free']: normalized_dietas.extend(['sin_gluten', 'sin gluten'])
            elif d in ['sin_lactosa', 'sin lactosa', 'lactose free']: normalized_dietas.extend(['sin_lactosa', 'sin lactosa'])
            elif d in ['vegetariano', 'vegetariana']: normalized_dietas.extend(['vegetariano', 'vegetariana'])
            else: normalized_dietas.append(d)
            
        # 👇 NUEVA LÓGICA: Exige que haya dieta, separa por comas y verifica si hay match
        productos_filtrados = [
            p for p in productos_filtrados 
            if p.get('dieta') and any(d.strip() in normalized_dietas for d in p['dieta'].lower().split(','))
        ]
        
    if preferencias.get('categorias_excluidas'):
        categorias_excluidas = [c.lower() for c in preferencias['categorias_excluidas']]
        productos_filtrados = [p for p in productos_filtrados if all((valor or '').lower() not in categorias_excluidas for valor in [p.get('categoria'), p.get('categoria_nombre'), p.get('categoria_slug')])]
        
    if len(productos_filtrados) == 0: return productos
    return productos_filtrados

def crear_respuesta_vacia(presupuesto: float) -> Dict[str, Any]:
    return {"productos": [], "total": 0.0, "presupuesto": presupuesto, "ahorro": presupuesto, "porcentaje_ahorro": 100.0, "productos_recomendados": 0, "productos_deseados": 0}