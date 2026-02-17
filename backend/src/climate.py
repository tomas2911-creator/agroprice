"""
Módulo de clima: fetch de Open-Meteo, seed de zonas, queries de clima × precios
"""
import httpx
import logging
from datetime import date, timedelta

from src.database import pool

logger = logging.getLogger("agroprice.climate")

# ============== ZONAS DE PRODUCCIÓN ==============

ZONAS = [
    {"nombre": "Arica", "latitud": -18.48, "longitud": -70.33},
    {"nombre": "Coquimbo-La Serena", "latitud": -29.97, "longitud": -71.34},
    {"nombre": "Quillota-Valparaíso", "latitud": -32.88, "longitud": -71.25},
    {"nombre": "Santiago-RM", "latitud": -33.45, "longitud": -70.66},
    {"nombre": "Rancagua-O'Higgins", "latitud": -34.17, "longitud": -70.74},
    {"nombre": "Talca-Maule", "latitud": -35.43, "longitud": -71.66},
]

# Mapeo producto → zona(s) de producción principal
# (producto_nombre, zona_nombre, peso, mes_inicio, mes_fin, lag_dias)
PRODUCTO_ZONA_MAP = [
    # Hortalizas
    ("Tomate", "Arica", 0.6, 5, 11, 10),
    ("Tomate", "Quillota-Valparaíso", 0.4, 12, 4, 7),
    ("Lechuga", "Santiago-RM", 0.5, None, None, 5),
    ("Lechuga", "Quillota-Valparaíso", 0.5, None, None, 5),
    ("Cebolla", "Coquimbo-La Serena", 0.4, None, None, 14),
    ("Cebolla", "Quillota-Valparaíso", 0.3, None, None, 14),
    ("Cebolla", "Rancagua-O'Higgins", 0.3, None, None, 14),
    ("Choclo", "Santiago-RM", 0.4, None, None, 10),
    ("Choclo", "Rancagua-O'Higgins", 0.3, None, None, 10),
    ("Choclo", "Talca-Maule", 0.3, None, None, 10),
    ("Zapallo", "Quillota-Valparaíso", 0.4, None, None, 14),
    ("Zapallo", "Santiago-RM", 0.3, None, None, 14),
    ("Zapallo", "Rancagua-O'Higgins", 0.3, None, None, 14),
    ("Pimentón", "Quillota-Valparaíso", 0.5, None, None, 10),
    ("Pimentón", "Coquimbo-La Serena", 0.5, None, None, 10),
    ("Zanahoria", "Santiago-RM", 0.5, None, None, 10),
    ("Zanahoria", "Quillota-Valparaíso", 0.5, None, None, 10),
    ("Repollo", "Santiago-RM", 0.6, None, None, 7),
    ("Repollo", "Quillota-Valparaíso", 0.4, None, None, 7),
    ("Coliflor", "Santiago-RM", 0.5, None, None, 7),
    ("Coliflor", "Quillota-Valparaíso", 0.5, None, None, 7),
    ("Brócoli", "Santiago-RM", 0.5, None, None, 7),
    ("Brócoli", "Quillota-Valparaíso", 0.5, None, None, 7),
    ("Poroto Verde", "Santiago-RM", 0.5, None, None, 7),
    ("Poroto Verde", "Rancagua-O'Higgins", 0.5, None, None, 7),
    ("Espinaca", "Santiago-RM", 0.6, None, None, 5),
    ("Acelga", "Santiago-RM", 0.6, None, None, 5),
    ("Apio", "Santiago-RM", 0.6, None, None, 7),
    ("Pepino Dulce", "Coquimbo-La Serena", 0.5, None, None, 10),
    ("Pepino Dulce", "Quillota-Valparaíso", 0.5, None, None, 10),
    ("Ají", "Quillota-Valparaíso", 0.5, None, None, 10),
    ("Ají", "Coquimbo-La Serena", 0.5, None, None, 10),
    ("Betarraga", "Santiago-RM", 0.5, None, None, 10),
    ("Betarraga", "Quillota-Valparaíso", 0.5, None, None, 10),
    ("Alcachofa", "Quillota-Valparaíso", 0.6, None, None, 14),
    ("Haba", "Santiago-RM", 0.5, None, None, 7),
    ("Arveja", "Santiago-RM", 0.5, None, None, 7),
    # Frutas
    ("Manzana", "Talca-Maule", 0.4, None, None, 30),
    ("Manzana", "Rancagua-O'Higgins", 0.4, None, None, 30),
    ("Uva de Mesa", "Coquimbo-La Serena", 0.5, None, None, 21),
    ("Uva de Mesa", "Quillota-Valparaíso", 0.3, None, None, 21),
    ("Palta", "Quillota-Valparaíso", 0.5, None, None, 21),
    ("Palta", "Coquimbo-La Serena", 0.5, None, None, 21),
    ("Cereza", "Rancagua-O'Higgins", 0.5, None, None, 14),
    ("Cereza", "Talca-Maule", 0.5, None, None, 14),
    ("Durazno", "Santiago-RM", 0.4, None, None, 14),
    ("Durazno", "Rancagua-O'Higgins", 0.6, None, None, 14),
    ("Nectarín", "Santiago-RM", 0.4, None, None, 14),
    ("Nectarín", "Rancagua-O'Higgins", 0.6, None, None, 14),
    ("Ciruela", "Rancagua-O'Higgins", 0.5, None, None, 14),
    ("Ciruela", "Talca-Maule", 0.5, None, None, 14),
    ("Naranja", "Coquimbo-La Serena", 0.5, None, None, 21),
    ("Naranja", "Quillota-Valparaíso", 0.5, None, None, 21),
    ("Limón", "Coquimbo-La Serena", 0.5, None, None, 21),
    ("Limón", "Quillota-Valparaíso", 0.5, None, None, 21),
    ("Kiwi", "Talca-Maule", 0.5, None, None, 30),
    ("Kiwi", "Rancagua-O'Higgins", 0.5, None, None, 30),
    ("Frutilla", "Santiago-RM", 0.4, None, None, 7),
    ("Frutilla", "Rancagua-O'Higgins", 0.6, None, None, 7),
    ("Sandía", "Santiago-RM", 0.4, None, None, 14),
    ("Sandía", "Rancagua-O'Higgins", 0.3, None, None, 14),
    ("Sandía", "Talca-Maule", 0.3, None, None, 14),
    ("Melón", "Santiago-RM", 0.4, None, None, 14),
    ("Melón", "Quillota-Valparaíso", 0.3, None, None, 14),
    ("Melón", "Rancagua-O'Higgins", 0.3, None, None, 14),
    ("Pera", "Rancagua-O'Higgins", 0.5, None, None, 21),
    ("Pera", "Talca-Maule", 0.5, None, None, 21),
    ("Damasco", "Santiago-RM", 0.5, None, None, 14),
    ("Damasco", "Rancagua-O'Higgins", 0.5, None, None, 14),
    ("Papaya", "Coquimbo-La Serena", 0.8, None, None, 21),
    ("Arándano", "Talca-Maule", 0.5, None, None, 14),
    ("Arándano", "Rancagua-O'Higgins", 0.5, None, None, 14),
]


async def seed_zonas():
    """Insertar zonas de producción y mapeos si no existen.
    Usa ILIKE para matchear productos parcialmente (ej: 'Tomate' matchea 'Tomate Larga Vida')."""
    async with pool.acquire() as conn:
        # Insertar zonas
        for z in ZONAS:
            await conn.execute("""
                INSERT INTO zonas_produccion (nombre, latitud, longitud)
                VALUES ($1, $2, $3) ON CONFLICT (nombre) DO NOTHING
            """, z["nombre"], z["latitud"], z["longitud"])

        # Insertar mapeos producto → zona (match parcial por nombre)
        matched = 0
        for prod_nombre, zona_nombre, peso, mes_ini, mes_fin, lag in PRODUCTO_ZONA_MAP:
            rows = await conn.fetch("""
                SELECT p.id as pid, z.id as zid
                FROM productos p, zonas_produccion z
                WHERE (p.nombre = $1 OR p.nombre ILIKE $1 || ' %')
                AND z.nombre = $2
            """, prod_nombre, zona_nombre)
            for row in rows:
                await conn.execute("""
                    INSERT INTO producto_zona (producto_id, zona_id, peso, mes_inicio, mes_fin, lag_dias)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (producto_id, zona_id, COALESCE(mes_inicio, 0)) DO UPDATE SET
                        peso = EXCLUDED.peso, mes_fin = EXCLUDED.mes_fin, lag_dias = EXCLUDED.lag_dias
                """, row["pid"], row["zid"], peso, mes_ini, mes_fin, lag)
                matched += 1

    logger.info(f"Seed zonas: {len(ZONAS)} zonas, {matched} mapeos creados de {len(PRODUCTO_ZONA_MAP)} definidos")
    return {"zonas": len(ZONAS), "mapeos": matched}


# ============== FETCH OPEN-METEO ==============

OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"


async def fetch_clima_openmeteo(zona_id: int, lat: float, lon: float,
                                 fecha_inicio: date, fecha_fin: date) -> int:
    """Bajar datos climáticos de Open-Meteo para una zona y guardar en BD"""
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": str(fecha_inicio),
        "end_date": str(fecha_fin),
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,"
                 "relative_humidity_2m_mean,shortwave_radiation_sum,wind_speed_10m_max",
        "timezone": "America/Santiago"
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    daily = data.get("daily", {})
    fechas = daily.get("time", [])
    if not fechas:
        return 0

    temp_max = daily.get("temperature_2m_max", [])
    temp_min = daily.get("temperature_2m_min", [])
    precip = daily.get("precipitation_sum", [])
    humedad = daily.get("relative_humidity_2m_mean", [])
    radiacion = daily.get("shortwave_radiation_sum", [])
    viento = daily.get("wind_speed_10m_max", [])

    rows = []
    for i, f in enumerate(fechas):
        rows.append((
            date.fromisoformat(f), zona_id,
            temp_max[i] if i < len(temp_max) else None,
            temp_min[i] if i < len(temp_min) else None,
            precip[i] if i < len(precip) else None,
            humedad[i] if i < len(humedad) else None,
            radiacion[i] if i < len(radiacion) else None,
            viento[i] if i < len(viento) else None,
        ))

    async with pool.acquire() as conn:
        await conn.executemany("""
            INSERT INTO clima_diario (fecha, zona_id, temp_max, temp_min, precipitacion,
                                      humedad, radiacion_solar, viento_max)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (fecha, zona_id) DO UPDATE SET
                temp_max = EXCLUDED.temp_max, temp_min = EXCLUDED.temp_min,
                precipitacion = EXCLUDED.precipitacion, humedad = EXCLUDED.humedad,
                radiacion_solar = EXCLUDED.radiacion_solar, viento_max = EXCLUDED.viento_max
        """, rows)

    logger.info(f"Clima: {len(rows)} días para zona {zona_id} ({fecha_inicio} → {fecha_fin})")
    return len(rows)


async def importar_clima_todas_zonas(dias_atras: int = 90) -> dict:
    """Importar clima de todas las zonas para los últimos N días"""
    fecha_fin = date.today() - timedelta(days=2)  # Open-Meteo tiene ~2 días de lag
    fecha_inicio = fecha_fin - timedelta(days=dias_atras)

    async with pool.acquire() as conn:
        zonas = await conn.fetch("SELECT id, nombre, latitud, longitud FROM zonas_produccion")

    total = 0
    for z in zonas:
        try:
            n = await fetch_clima_openmeteo(z["id"], z["latitud"], z["longitud"],
                                            fecha_inicio, fecha_fin)
            total += n
        except Exception as e:
            logger.error(f"Error clima zona {z['nombre']}: {e}")

    return {"zonas": len(zonas), "registros_total": total}


async def importar_clima_historico(fecha_inicio: date = None, fecha_fin: date = None) -> dict:
    """Importar historial completo de clima en chunks de 90 días.
    Si no se especifica fecha_inicio, usa la fecha más antigua de precios en BD."""

    if fecha_fin is None:
        fecha_fin = date.today() - timedelta(days=2)

    async with pool.acquire() as conn:
        zonas = await conn.fetch("SELECT id, nombre, latitud, longitud FROM zonas_produccion")

        if fecha_inicio is None:
            row = await conn.fetchrow("SELECT MIN(fecha) as min_fecha FROM precios")
            if row and row["min_fecha"]:
                fecha_inicio = row["min_fecha"]
            else:
                fecha_inicio = date(2023, 1, 1)

    if not zonas:
        return {"error": "No hay zonas. Ejecutar seed_zonas primero.", "registros_total": 0}

    logger.info(f"Importación histórica clima: {fecha_inicio} → {fecha_fin} ({len(zonas)} zonas)")

    CHUNK_DAYS = 90
    total = 0
    chunks_ok = 0
    chunks_error = 0

    for z in zonas:
        chunk_start = fecha_inicio
        while chunk_start < fecha_fin:
            chunk_end = min(chunk_start + timedelta(days=CHUNK_DAYS - 1), fecha_fin)
            try:
                n = await fetch_clima_openmeteo(
                    z["id"], z["latitud"], z["longitud"], chunk_start, chunk_end
                )
                total += n
                chunks_ok += 1
            except Exception as e:
                logger.error(f"Error clima {z['nombre']} ({chunk_start}→{chunk_end}): {e}")
                chunks_error += 1
            chunk_start = chunk_end + timedelta(days=1)

    logger.info(f"Histórico clima: {total} registros, {chunks_ok} chunks OK, {chunks_error} errores")
    return {
        "zonas": len(zonas),
        "fecha_inicio": str(fecha_inicio),
        "fecha_fin": str(fecha_fin),
        "registros_total": total,
        "chunks_ok": chunks_ok,
        "chunks_error": chunks_error,
    }


async def importar_clima_diario():
    """Tarea diaria: importar los últimos 5 días de clima (overlap para llenar gaps)"""
    try:
        result = await importar_clima_todas_zonas(dias_atras=5)
        logger.info(f"Clima diario: {result['registros_total']} registros actualizados")
        return result
    except Exception as e:
        logger.error(f"Error en importación diaria de clima: {e}")


# ============== QUERIES ==============

async def get_zonas() -> list[dict]:
    """Listar zonas de producción"""
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM zonas_produccion ORDER BY nombre")
        return [dict(r) for r in rows]


async def get_clima_serie(zona_id: int, dias: int = 90) -> list[dict]:
    """Serie temporal de clima para una zona"""
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT fecha, temp_max, temp_min, precipitacion, humedad,
                   radiacion_solar, viento_max
            FROM clima_diario
            WHERE zona_id = $1 AND fecha >= CURRENT_DATE - $2 * INTERVAL '1 day'
            ORDER BY fecha
        """, zona_id, dias)
        return [dict(r) for r in rows]


async def get_clima_precio_serie(producto: str, mercado: str = None,
                                  dias: int = 90, variables: list[str] = None) -> dict:
    """Serie combinada: precio diario de un producto + variables climáticas de su zona.
    Soporta múltiples variables simultáneamente."""

    variables_validas = ["temp_max", "temp_min", "precipitacion", "humedad",
                         "radiacion_solar", "viento_max"]
    if not variables:
        variables = ["temp_max"]
    variables = [v for v in variables if v in variables_validas]
    if not variables:
        variables = ["temp_max"]

    # Obtener zona(s) del producto (la de mayor peso para el mes actual)
    # Busca match exacto primero, si no, busca por nombre base (ej: "Tomate Larga Vida" → "Tomate")
    mes_actual = date.today().month
    async with pool.acquire() as conn:
        zona_row = await conn.fetchrow("""
            SELECT z.id, z.nombre, pz.lag_dias, pz.peso
            FROM producto_zona pz
            JOIN zonas_produccion z ON z.id = pz.zona_id
            JOIN productos pr ON pr.id = pz.producto_id
            WHERE (pr.nombre = $1 OR $1 ILIKE pr.nombre || ' %')
            AND (pz.mes_inicio IS NULL OR
                 (pz.mes_inicio <= pz.mes_fin AND $2 BETWEEN pz.mes_inicio AND pz.mes_fin) OR
                 (pz.mes_inicio > pz.mes_fin AND ($2 >= pz.mes_inicio OR $2 <= pz.mes_fin)))
            ORDER BY pz.peso DESC
            LIMIT 1
        """, producto, mes_actual)

        if not zona_row:
            return {"producto": producto, "zona": None, "series": [], "variables": variables}

        zona_id = zona_row["id"]
        zona_nombre = zona_row["nombre"]
        lag = zona_row["lag_dias"] or 7

        # Serie de precios (promedio diario del producto)
        mercado_filter = ""
        params = [producto, dias]
        if mercado:
            mercado_filter = " AND m.nombre = $3"
            params.append(mercado)

        precios = await conn.fetch(f"""
            SELECT p.fecha, ROUND(AVG(p.precio_promedio)::numeric, 0) as precio
            FROM precios p
            JOIN productos pr ON p.producto_id = pr.id
            JOIN mercados m ON p.mercado_id = m.id
            WHERE pr.nombre = $1
            AND p.fecha >= CURRENT_DATE - $2 * INTERVAL '1 day'
            AND p.precio_promedio IS NOT NULL
            {mercado_filter}
            GROUP BY p.fecha
            ORDER BY p.fecha
        """, *params)

        # Serie de clima (todas las variables seleccionadas, con lag aplicado)
        cols = ", ".join(variables)
        clima = await conn.fetch(f"""
            SELECT fecha + $3 * INTERVAL '1 day' as fecha_efecto,
                   {cols}
            FROM clima_diario
            WHERE zona_id = $1
            AND fecha >= CURRENT_DATE - ($2 + $3) * INTERVAL '1 day'
            ORDER BY fecha
        """, zona_id, dias, lag)

    # Crear mapas por fecha
    precio_map = {str(r["fecha"]): float(r["precio"]) for r in precios}

    clima_maps: dict[str, dict] = {v: {} for v in variables}
    for r in clima:
        f_str = str(r["fecha_efecto"].date()) if hasattr(r["fecha_efecto"], 'date') else str(r["fecha_efecto"])
        for v in variables:
            val = r[v]
            clima_maps[v][f_str] = float(val) if val is not None else None

    # Combinar en serie alineada
    all_fecha_sets = [set(precio_map.keys())]
    for v in variables:
        all_fecha_sets.append(set(clima_maps[v].keys()))
    todas_fechas = sorted(set().union(*all_fecha_sets))

    series = []
    for f in todas_fechas:
        punto: dict = {"fecha": f, "precio": precio_map.get(f)}
        for v in variables:
            punto[v] = clima_maps[v].get(f)
        series.append(punto)

    return {
        "producto": producto,
        "zona": zona_nombre,
        "zona_id": zona_id,
        "variables": variables,
        "lag_dias": lag,
        "series": series,
    }


async def get_alertas_clima() -> list[dict]:
    """Detectar alertas climáticas recientes: heladas, lluvias intensas, olas de calor.
    Una fila puede generar múltiples alertas si cumple varias condiciones."""
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT a.fecha, a.zona, a.temp_min, a.temp_max,
                   a.precipitacion, a.viento_max, a.tipo_alerta
            FROM (
                SELECT c.fecha, z.nombre as zona, c.temp_min, c.temp_max,
                       c.precipitacion, c.viento_max,
                       UNNEST(ARRAY_REMOVE(ARRAY[
                           CASE WHEN c.temp_min <= 0 THEN 'helada' END,
                           CASE WHEN c.precipitacion >= 30 THEN 'lluvia_intensa' END,
                           CASE WHEN c.temp_max >= 35 THEN 'ola_calor' END,
                           CASE WHEN c.viento_max >= 60 THEN 'viento_fuerte' END
                       ], NULL)) as tipo_alerta
                FROM clima_diario c
                JOIN zonas_produccion z ON z.id = c.zona_id
                WHERE c.fecha >= CURRENT_DATE - INTERVAL '7 days'
                AND (c.temp_min <= 0 OR c.precipitacion >= 30
                     OR c.temp_max >= 35 OR c.viento_max >= 60)
            ) a
            ORDER BY a.fecha DESC, a.zona
        """)
        return [dict(r) for r in rows]


async def get_clima_correlacion(producto: str, dias: int = 180) -> list[dict]:
    """Correlación entre precio de un producto y cada variable climática de cada zona"""
    async with pool.acquire() as conn:
        zonas = await conn.fetch("SELECT id, nombre FROM zonas_produccion ORDER BY nombre")

        resultados = []
        for zona in zonas:
            for variable in ["temp_max", "temp_min", "precipitacion", "humedad"]:
                row = await conn.fetchrow(f"""
                    WITH precios_dia AS (
                        SELECT p.fecha, AVG(p.precio_promedio) as precio
                        FROM precios p
                        JOIN productos pr ON p.producto_id = pr.id
                        WHERE pr.nombre = $1
                        AND p.fecha >= CURRENT_DATE - $2 * INTERVAL '1 day'
                        AND p.precio_promedio IS NOT NULL
                        GROUP BY p.fecha
                    )
                    SELECT CORR(pd.precio, c.{variable}) as correlacion,
                           COUNT(*) as observaciones
                    FROM precios_dia pd
                    JOIN clima_diario c ON c.fecha = pd.fecha AND c.zona_id = $3
                """, producto, dias, zona["id"])

                if row and row["correlacion"] is not None:
                    resultados.append({
                        "zona": zona["nombre"],
                        "zona_id": zona["id"],
                        "variable": variable,
                        "correlacion": round(float(row["correlacion"]), 3),
                        "observaciones": row["observaciones"],
                    })

        resultados.sort(key=lambda x: abs(x["correlacion"]), reverse=True)
        return resultados
