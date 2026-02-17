import asyncpg
import json
import logging
from datetime import date, datetime
from typing import Optional

from src.config import DATABASE_URL

logger = logging.getLogger("agroprice.database")

pool: Optional[asyncpg.Pool] = None

# Cache en memoria para evitar lookups repetidos
_cache_mercados: dict[str, int] = {}
_cache_productos: dict[tuple[str, str], int] = {}


async def init_db():
    """Inicializar conexión y crear tablas"""
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=3, max_size=15)

    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS mercados (
                id SERIAL PRIMARY KEY,
                nombre TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS productos (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                categoria TEXT NOT NULL,
                UNIQUE(nombre, categoria)
            );

            CREATE TABLE IF NOT EXISTS precios (
                id SERIAL PRIMARY KEY,
                fecha DATE NOT NULL,
                mercado_id INTEGER REFERENCES mercados(id),
                producto_id INTEGER REFERENCES productos(id),
                variedad TEXT,
                calidad TEXT,
                unidad TEXT,
                precio_min REAL,
                precio_max REAL,
                precio_promedio REAL,
                volumen REAL
            );

            -- Migración: agregar calidad si no existe
            DO $$ BEGIN
                ALTER TABLE precios ADD COLUMN IF NOT EXISTS calidad TEXT;
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;

            -- Crear unique constraint si no existe
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_precio_completo'
                ) THEN
                    -- Eliminar constraint vieja si existe
                    BEGIN
                        ALTER TABLE precios DROP CONSTRAINT IF EXISTS precios_fecha_mercado_id_producto_id_variedad_key;
                    EXCEPTION WHEN undefined_object THEN NULL;
                    END;
                    ALTER TABLE precios ADD CONSTRAINT uq_precio_completo
                        UNIQUE(fecha, mercado_id, producto_id, variedad, calidad, unidad);
                END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS importaciones (
                id SERIAL PRIMARY KEY,
                fecha_boletin DATE UNIQUE NOT NULL,
                fecha_importacion TIMESTAMP DEFAULT NOW(),
                registros INTEGER DEFAULT 0,
                estado TEXT DEFAULT 'ok',
                detalle TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_precios_fecha ON precios(fecha);
            CREATE INDEX IF NOT EXISTS idx_precios_mercado ON precios(mercado_id);
            CREATE INDEX IF NOT EXISTS idx_precios_producto ON precios(producto_id);
            CREATE INDEX IF NOT EXISTS idx_precios_fecha_mercado ON precios(fecha, mercado_id);
            CREATE INDEX IF NOT EXISTS idx_precios_fecha_producto ON precios(fecha, producto_id);
            CREATE INDEX IF NOT EXISTS idx_precios_producto_formato ON precios(producto_id, variedad, calidad, unidad);
        """)
    logger.info("Base de datos inicializada correctamente")


async def close_db():
    """Cerrar pool de conexiones"""
    global pool
    if pool:
        await pool.close()


async def get_or_create_mercado(conn, nombre: str) -> int:
    """Obtener o crear mercado, retorna id (con cache)"""
    if nombre in _cache_mercados:
        return _cache_mercados[nombre]
    row = await conn.fetchrow(
        "INSERT INTO mercados (nombre) VALUES ($1) ON CONFLICT (nombre) DO UPDATE SET nombre = $1 RETURNING id",
        nombre
    )
    _cache_mercados[nombre] = row["id"]
    return row["id"]


async def get_or_create_producto(conn, nombre: str, categoria: str) -> int:
    """Obtener o crear producto, retorna id (con cache)"""
    key = (nombre, categoria)
    if key in _cache_productos:
        return _cache_productos[key]
    row = await conn.fetchrow(
        "INSERT INTO productos (nombre, categoria) VALUES ($1, $2) "
        "ON CONFLICT (nombre, categoria) DO UPDATE SET nombre = $1 RETURNING id",
        nombre, categoria
    )
    _cache_productos[key] = row["id"]
    return row["id"]


async def insertar_precios(registros: list[dict]) -> int:
    """Insertar registros de precios en batch optimizado"""
    if not registros:
        return 0

    async with pool.acquire() as conn:
        # Fase 1: Pre-resolver todos los IDs (con cache, muy rápido)
        rows_data = []
        async with conn.transaction():
            for r in registros:
                mercado_id = await get_or_create_mercado(conn, r["mercado"])
                producto_id = await get_or_create_producto(conn, r["producto"], r["categoria"])
                rows_data.append((
                    r["fecha"], mercado_id, producto_id,
                    r.get("variedad"), r.get("calidad"), r.get("unidad"),
                    r.get("precio_min"), r.get("precio_max"),
                    r.get("precio_promedio"), r.get("volumen")
                ))

        # Fase 2: Batch insert con executemany (mucho más rápido que individual)
        count = 0
        BATCH_SIZE = 200
        for i in range(0, len(rows_data), BATCH_SIZE):
            batch = rows_data[i:i + BATCH_SIZE]
            try:
                async with conn.transaction():
                    await conn.executemany("""
                        INSERT INTO precios (fecha, mercado_id, producto_id, variedad, calidad, unidad,
                                           precio_min, precio_max, precio_promedio, volumen)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT ON CONSTRAINT uq_precio_completo
                        DO UPDATE SET
                            precio_min = EXCLUDED.precio_min,
                            precio_max = EXCLUDED.precio_max,
                            precio_promedio = EXCLUDED.precio_promedio,
                            volumen = EXCLUDED.volumen
                    """, batch)
                    count += len(batch)
            except Exception as e:
                logger.error(f"Error en batch insert ({len(batch)} rows): {e}")
                # Fallback: insertar uno por uno para no perder datos
                async with conn.transaction():
                    for row in batch:
                        try:
                            await conn.execute("""
                                INSERT INTO precios (fecha, mercado_id, producto_id, variedad, calidad, unidad,
                                                   precio_min, precio_max, precio_promedio, volumen)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                                ON CONFLICT ON CONSTRAINT uq_precio_completo
                                DO UPDATE SET
                                    precio_min = EXCLUDED.precio_min,
                                    precio_max = EXCLUDED.precio_max,
                                    precio_promedio = EXCLUDED.precio_promedio,
                                    volumen = EXCLUDED.volumen
                            """, *row)
                            count += 1
                        except Exception as e2:
                            logger.error(f"Error insertando registro individual: {e2}")

        return count


async def registrar_importacion(fecha_boletin: date, registros: int, estado: str, detalle: str = None):
    """Registrar log de importación"""
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO importaciones (fecha_boletin, registros, estado, detalle)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (fecha_boletin) DO UPDATE SET
                registros = EXCLUDED.registros,
                estado = EXCLUDED.estado,
                detalle = EXCLUDED.detalle,
                fecha_importacion = NOW()
        """, fecha_boletin, registros, estado, detalle)


async def boletin_ya_importado(fecha: date) -> bool:
    """Verificar si un boletín ya fue importado"""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM importaciones WHERE fecha_boletin = $1 AND estado = 'ok'", fecha
        )
        return row is not None


# ============== QUERIES PARA EL DASHBOARD ==============

async def get_mercados() -> list[dict]:
    """Listar todos los mercados"""
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, nombre FROM mercados ORDER BY nombre")
        return [dict(r) for r in rows]


async def get_productos(categoria: str = None) -> list[dict]:
    """Listar productos, opcionalmente filtrado por categoría"""
    async with pool.acquire() as conn:
        if categoria:
            rows = await conn.fetch(
                "SELECT id, nombre, categoria FROM productos WHERE categoria = $1 ORDER BY nombre",
                categoria
            )
        else:
            rows = await conn.fetch("SELECT id, nombre, categoria FROM productos ORDER BY categoria, nombre")
        return [dict(r) for r in rows]


async def get_subcategorias(producto: str) -> dict:
    """Obtener variedades, calidades y unidades disponibles para un producto"""
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT DISTINCT p.variedad, p.calidad, p.unidad
            FROM precios p
            JOIN productos pr ON p.producto_id = pr.id
            WHERE pr.nombre = $1
            ORDER BY p.variedad, p.calidad, p.unidad
        """, producto)
        variedades = sorted(set(r["variedad"] for r in rows if r["variedad"]))
        calidades = sorted(set(r["calidad"] for r in rows if r["calidad"]))
        unidades = sorted(set(r["unidad"] for r in rows if r["unidad"]))
        return {"variedades": variedades, "calidades": calidades, "unidades": unidades}


async def get_precios(
    fecha_inicio: date = None,
    fecha_fin: date = None,
    mercados: list[str] = None,
    productos: list[str] = None,
    categorias: list[str] = None,
    limit: int = 500
) -> list[dict]:
    """Obtener precios con filtros"""
    query = """
        SELECT p.fecha, m.nombre as mercado, pr.nombre as producto, pr.categoria,
               p.variedad, p.calidad, p.unidad, p.precio_min, p.precio_max, p.precio_promedio, p.volumen
        FROM precios p
        JOIN mercados m ON p.mercado_id = m.id
        JOIN productos pr ON p.producto_id = pr.id
        WHERE 1=1
    """
    params = []
    idx = 1

    if fecha_inicio:
        query += f" AND p.fecha >= ${idx}"
        params.append(fecha_inicio)
        idx += 1
    if fecha_fin:
        query += f" AND p.fecha <= ${idx}"
        params.append(fecha_fin)
        idx += 1
    if mercados:
        query += f" AND m.nombre = ANY(${idx})"
        params.append(mercados)
        idx += 1
    if productos:
        query += f" AND pr.nombre = ANY(${idx})"
        params.append(productos)
        idx += 1
    if categorias:
        query += f" AND pr.categoria = ANY(${idx})"
        params.append(categorias)
        idx += 1

    query += f" ORDER BY p.fecha DESC, m.nombre, pr.nombre LIMIT ${idx}"
    params.append(limit)

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]


async def get_variaciones(dias: int = 7, mercados: list[str] = None,
                          productos: list[str] = None, categorias: list[str] = None) -> list[dict]:
    """Calcular variaciones de precio entre fecha actual y X días atrás"""
    filtros_mercado = ""
    filtros_producto = ""
    params = [dias]
    idx = 2

    if mercados:
        filtros_mercado = f" AND m.nombre = ANY(${idx})"
        params.append(mercados)
        idx += 1
    if productos:
        filtros_producto = f" AND pr.nombre = ANY(${idx})"
        params.append(productos)
        idx += 1
    if categorias:
        filtros_producto += f" AND pr.categoria = ANY(${idx})"
        params.append(categorias)
        idx += 1

    query = f"""
        WITH fecha_actual AS (
            SELECT MAX(fecha) as fecha FROM precios
        ),
        precios_hoy AS (
            SELECT p.producto_id, p.mercado_id, p.variedad, p.calidad, p.unidad,
                   p.precio_promedio, p.volumen, p.fecha
            FROM precios p, fecha_actual fa
            WHERE p.fecha = fa.fecha
        ),
        precios_anterior AS (
            SELECT DISTINCT ON (p.producto_id, p.mercado_id, COALESCE(p.variedad,''), COALESCE(p.calidad,''), COALESCE(p.unidad,''))
                p.producto_id, p.mercado_id, p.variedad, p.calidad, p.unidad,
                p.precio_promedio, p.volumen, p.fecha
            FROM precios p, fecha_actual fa
            WHERE p.fecha <= fa.fecha - $1 * INTERVAL '1 day'
            ORDER BY p.producto_id, p.mercado_id, COALESCE(p.variedad,''), COALESCE(p.calidad,''), COALESCE(p.unidad,''), p.fecha DESC
        )
        SELECT
            pr.nombre as producto, pr.categoria, m.nombre as mercado,
            ph.variedad, ph.calidad, ph.unidad,
            ph.precio_promedio as precio_actual,
            pa.precio_promedio as precio_anterior,
            ph.fecha as fecha_actual,
            pa.fecha as fecha_anterior,
            ph.volumen as volumen_actual,
            pa.volumen as volumen_anterior,
            CASE
                WHEN pa.precio_promedio > 0 THEN
                    ROUND(((ph.precio_promedio - pa.precio_promedio) / pa.precio_promedio * 100)::numeric, 2)
                ELSE NULL
            END as variacion_pct,
            ph.precio_promedio - pa.precio_promedio as variacion_abs
        FROM precios_hoy ph
        JOIN precios_anterior pa ON ph.producto_id = pa.producto_id AND ph.mercado_id = pa.mercado_id
            AND COALESCE(ph.variedad,'') = COALESCE(pa.variedad,'')
            AND COALESCE(ph.calidad,'') = COALESCE(pa.calidad,'')
            AND COALESCE(ph.unidad,'') = COALESCE(pa.unidad,'')
        JOIN productos pr ON ph.producto_id = pr.id
        JOIN mercados m ON ph.mercado_id = m.id
        WHERE 1=1 {filtros_mercado} {filtros_producto}
        ORDER BY variacion_pct DESC NULLS LAST
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]


async def get_serie_temporal(producto: str, mercados: list[str] = None,
                             fecha_inicio: date = None, fecha_fin: date = None,
                             variedad: str = None, calidad: str = None, unidad: str = None) -> list[dict]:
    """Serie temporal de un producto en uno o más mercados"""
    query = """
        SELECT p.fecha, m.nombre as mercado, p.variedad, p.calidad, p.unidad,
               p.precio_promedio, p.precio_min, p.precio_max, p.volumen
        FROM precios p
        JOIN mercados m ON p.mercado_id = m.id
        JOIN productos pr ON p.producto_id = pr.id
        WHERE pr.nombre = $1
    """
    params = [producto]
    idx = 2

    if mercados:
        query += f" AND m.nombre = ANY(${idx})"
        params.append(mercados)
        idx += 1
    if fecha_inicio:
        query += f" AND p.fecha >= ${idx}"
        params.append(fecha_inicio)
        idx += 1
    if fecha_fin:
        query += f" AND p.fecha <= ${idx}"
        params.append(fecha_fin)
        idx += 1
    if variedad:
        query += f" AND p.variedad = ${idx}"
        params.append(variedad)
        idx += 1
    if calidad:
        query += f" AND p.calidad = ${idx}"
        params.append(calidad)
        idx += 1
    if unidad:
        query += f" AND p.unidad = ${idx}"
        params.append(unidad)
        idx += 1

    query += " ORDER BY p.fecha, m.nombre"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]


async def get_spread_mercados(fecha: date = None) -> list[dict]:
    """Spread de precios entre mercados para cada producto (mismo formato)"""
    query = """
        WITH datos AS (
            SELECT pr.nombre as producto, pr.categoria, m.nombre as mercado,
                   p.variedad, p.calidad, p.unidad, p.precio_promedio, p.fecha
            FROM precios p
            JOIN mercados m ON p.mercado_id = m.id
            JOIN productos pr ON p.producto_id = pr.id
            WHERE p.fecha = COALESCE($1, (SELECT MAX(fecha) FROM precios))
            AND p.precio_promedio IS NOT NULL
        )
        SELECT producto, categoria, variedad, calidad, unidad,
               MIN(precio_promedio) as precio_min_mercado,
               MAX(precio_promedio) as precio_max_mercado,
               MAX(precio_promedio) - MIN(precio_promedio) as spread,
               CASE WHEN MIN(precio_promedio) > 0
                    THEN ROUND(((MAX(precio_promedio) - MIN(precio_promedio)) / MIN(precio_promedio) * 100)::numeric, 2)
                    ELSE NULL END as spread_pct,
               (SELECT mercado FROM datos d2 WHERE d2.producto = datos.producto
                AND COALESCE(d2.variedad,'') = COALESCE(datos.variedad,'')
                AND COALESCE(d2.calidad,'') = COALESCE(datos.calidad,'')
                AND COALESCE(d2.unidad,'') = COALESCE(datos.unidad,'')
                AND d2.precio_promedio = MIN(datos.precio_promedio) LIMIT 1) as mercado_barato,
               (SELECT mercado FROM datos d3 WHERE d3.producto = datos.producto
                AND COALESCE(d3.variedad,'') = COALESCE(datos.variedad,'')
                AND COALESCE(d3.calidad,'') = COALESCE(datos.calidad,'')
                AND COALESCE(d3.unidad,'') = COALESCE(datos.unidad,'')
                AND d3.precio_promedio = MAX(datos.precio_promedio) LIMIT 1) as mercado_caro,
               COUNT(DISTINCT mercado) as num_mercados
        FROM datos
        GROUP BY producto, categoria, variedad, calidad, unidad
        HAVING COUNT(DISTINCT mercado) > 1
        ORDER BY spread_pct DESC NULLS LAST
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, fecha)
        return [dict(r) for r in rows]


async def get_volatilidad(dias: int = 30, limit: int = 50) -> list[dict]:
    """Ranking de productos por volatilidad de precio (mismo formato)"""
    query = """
        SELECT pr.nombre as producto, pr.categoria, m.nombre as mercado,
               p.variedad, p.calidad, p.unidad,
               ROUND(STDDEV(p.precio_promedio)::numeric, 2) as desviacion,
               ROUND(AVG(p.precio_promedio)::numeric, 2) as precio_medio,
               CASE WHEN AVG(p.precio_promedio) > 0
                    THEN ROUND((STDDEV(p.precio_promedio) / AVG(p.precio_promedio) * 100)::numeric, 2)
                    ELSE NULL END as coef_variacion,
               MIN(p.precio_promedio) as precio_min_periodo,
               MAX(p.precio_promedio) as precio_max_periodo,
               COUNT(*) as observaciones
        FROM precios p
        JOIN productos pr ON p.producto_id = pr.id
        JOIN mercados m ON p.mercado_id = m.id
        WHERE p.fecha >= CURRENT_DATE - $1 * INTERVAL '1 day'
        AND p.precio_promedio IS NOT NULL
        GROUP BY pr.nombre, pr.categoria, m.nombre, p.variedad, p.calidad, p.unidad
        HAVING COUNT(*) >= 5
        ORDER BY coef_variacion DESC NULLS LAST
        LIMIT $2
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, dias, limit)
        return [dict(r) for r in rows]


async def get_estacionalidad(producto: str, mercado: str = None,
                              variedad: str = None, calidad: str = None, unidad: str = None) -> list[dict]:
    """Precio promedio por mes para análisis estacional"""
    query = """
        SELECT EXTRACT(MONTH FROM p.fecha)::int as mes,
               EXTRACT(YEAR FROM p.fecha)::int as anio,
               ROUND(AVG(p.precio_promedio)::numeric, 2) as precio_promedio,
               ROUND(AVG(p.volumen)::numeric, 2) as volumen_promedio
        FROM precios p
        JOIN productos pr ON p.producto_id = pr.id
        JOIN mercados m ON p.mercado_id = m.id
        WHERE pr.nombre = $1
    """
    params = [producto]
    idx = 2

    if mercado:
        query += f" AND m.nombre = ${idx}"
        params.append(mercado)
        idx += 1
    if variedad:
        query += f" AND p.variedad = ${idx}"
        params.append(variedad)
        idx += 1
    if calidad:
        query += f" AND p.calidad = ${idx}"
        params.append(calidad)
        idx += 1
    if unidad:
        query += f" AND p.unidad = ${idx}"
        params.append(unidad)
        idx += 1

    query += " GROUP BY mes, anio ORDER BY anio, mes"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]


async def get_correlaciones(producto: str, mercado: str, top_n: int = 10,
                            variedad: str = None, calidad: str = None, unidad: str = None) -> list[dict]:
    """Encontrar productos que se correlacionan en precio con el producto dado"""
    filtros_sub = ""
    params_extra = []
    idx_extra = 4
    if variedad:
        filtros_sub += f" AND p.variedad = ${idx_extra}"
        params_extra.append(variedad)
        idx_extra += 1
    if calidad:
        filtros_sub += f" AND p.calidad = ${idx_extra}"
        params_extra.append(calidad)
        idx_extra += 1
    if unidad:
        filtros_sub += f" AND p.unidad = ${idx_extra}"
        params_extra.append(unidad)
        idx_extra += 1

    query = f"""
        WITH base AS (
            SELECT p.fecha, p.precio_promedio
            FROM precios p
            JOIN productos pr ON p.producto_id = pr.id
            JOIN mercados m ON p.mercado_id = m.id
            WHERE pr.nombre = $1 AND m.nombre = $2{filtros_sub}
        ),
        otros AS (
            SELECT pr.nombre as producto, pr.categoria, p.fecha, p.precio_promedio
            FROM precios p
            JOIN productos pr ON p.producto_id = pr.id
            JOIN mercados m ON p.mercado_id = m.id
            WHERE m.nombre = $2 AND pr.nombre != $1
        )
        SELECT o.producto, o.categoria,
               ROUND(CORR(b.precio_promedio, o.precio_promedio)::numeric, 4) as correlacion,
               COUNT(*) as observaciones
        FROM base b
        JOIN otros o ON b.fecha = o.fecha
        GROUP BY o.producto, o.categoria
        HAVING COUNT(*) >= 10
        ORDER BY ABS(CORR(b.precio_promedio, o.precio_promedio)) DESC NULLS LAST
        LIMIT $3
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, producto, mercado, top_n, *params_extra)
        return [dict(r) for r in rows]


async def get_heatmap(fecha: date = None) -> list[dict]:
    """Datos para heatmap: precio promedio por producto x mercado"""
    query = """
        SELECT pr.nombre as producto, pr.categoria, m.nombre as mercado,
               p.variedad, p.calidad, p.unidad, p.precio_promedio
        FROM precios p
        JOIN productos pr ON p.producto_id = pr.id
        JOIN mercados m ON p.mercado_id = m.id
        WHERE p.fecha = COALESCE($1, (SELECT MAX(fecha) FROM precios))
        AND p.precio_promedio IS NOT NULL
        ORDER BY pr.categoria, pr.nombre, p.unidad, m.nombre
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, fecha)
        return [dict(r) for r in rows]


async def get_resumen_diario(fecha: date = None) -> dict:
    """Resumen del día: totales + top subidas/bajadas"""
    async with pool.acquire() as conn:
        if not fecha:
            row = await conn.fetchrow("SELECT MAX(fecha) as fecha FROM precios")
            fecha = row["fecha"]

        if not fecha:
            return {"fecha": None, "total_productos": 0, "total_mercados": 0,
                    "top_subidas": [], "top_bajadas": [], "precio_promedio_general": None}

        stats = await conn.fetchrow("""
            SELECT COUNT(DISTINCT pr.nombre) as total_productos,
                   COUNT(DISTINCT m.nombre) as total_mercados,
                   ROUND(AVG(p.precio_promedio)::numeric, 2) as precio_promedio_general
            FROM precios p
            JOIN productos pr ON p.producto_id = pr.id
            JOIN mercados m ON p.mercado_id = m.id
            WHERE p.fecha = $1
        """, fecha)

        variaciones = await get_variaciones(dias=7)

        top_subidas = [dict(v) for v in variaciones[:10] if v.get("variacion_pct") and v["variacion_pct"] > 0]
        top_bajadas = [dict(v) for v in variaciones if v.get("variacion_pct") and v["variacion_pct"] < 0]
        top_bajadas = top_bajadas[-10:] if len(top_bajadas) > 10 else top_bajadas
        top_bajadas.reverse()

        return {
            "fecha": str(fecha),
            "total_productos": stats["total_productos"],
            "total_mercados": stats["total_mercados"],
            "top_subidas": top_subidas,
            "top_bajadas": top_bajadas,
            "precio_promedio_general": float(stats["precio_promedio_general"]) if stats["precio_promedio_general"] else None
        }


async def get_canasta(items: list[dict], fecha_inicio: date = None, fecha_fin: date = None) -> list[dict]:
    """Evolución de precio de una canasta personalizada"""
    if not items:
        return []

    conditions = []
    params = []
    idx = 1

    for item in items:
        conditions.append(f"(pr.nombre = ${idx} AND m.nombre = ${idx + 1})")
        params.extend([item["producto"], item["mercado"]])
        idx += 2

    where_items = " OR ".join(conditions)

    query = f"""
        SELECT p.fecha,
               SUM(p.precio_promedio) as total_canasta,
               COUNT(*) as items_disponibles,
               json_agg(json_build_object(
                   'producto', pr.nombre, 'mercado', m.nombre,
                   'precio', p.precio_promedio
               )) as detalle
        FROM precios p
        JOIN productos pr ON p.producto_id = pr.id
        JOIN mercados m ON p.mercado_id = m.id
        WHERE ({where_items})
    """

    if fecha_inicio:
        query += f" AND p.fecha >= ${idx}"
        params.append(fecha_inicio)
        idx += 1
    if fecha_fin:
        query += f" AND p.fecha <= ${idx}"
        params.append(fecha_fin)
        idx += 1

    query += " GROUP BY p.fecha ORDER BY p.fecha"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        result = []
        for r in rows:
            d = dict(r)
            d["fecha"] = str(d["fecha"])
            d["total_canasta"] = float(d["total_canasta"]) if d["total_canasta"] else None
            d["detalle"] = json.loads(d["detalle"]) if isinstance(d["detalle"], str) else d["detalle"]
            result.append(d)
        return result


async def get_importaciones() -> list[dict]:
    """Listar log de importaciones"""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM importaciones ORDER BY fecha_boletin DESC LIMIT 500"
        )
        return [dict(r) for r in rows]


async def get_fechas_disponibles() -> list[str]:
    """Listar fechas con datos disponibles"""
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT DISTINCT fecha FROM precios ORDER BY fecha DESC")
        return [str(r["fecha"]) for r in rows]
