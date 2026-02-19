"""
Módulo de predicción de precios agrícolas.
Usa descomposición estacional + tendencia lineal para proyectar precios futuros.
"""
import logging
import numpy as np
from datetime import date, timedelta
from calendar import monthrange

import src.database as _db

logger = logging.getLogger("agroprice.forecast")


def _get_pool():
    """Obtener pool de conexiones de forma segura"""
    p = _db.pool
    if p is None:
        raise RuntimeError("Pool de base de datos no inicializado")
    return p


def _add_months(d: date, months: int) -> date:
    """Sumar meses a una fecha de forma segura"""
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, 1)


async def obtener_historico_mensual(
    producto: str,
    mercados: list[str] = None,
    variedad: str = None,
    calidad: str = None,
    unidad: str = None,
) -> list[dict]:
    """Obtener promedios mensuales históricos para un producto"""
    query = """
        SELECT DATE_TRUNC('month', p.fecha)::date as mes,
               ROUND(AVG(p.precio_promedio)::numeric, 0) as precio_promedio,
               ROUND(AVG(p.precio_min)::numeric, 0) as precio_min,
               ROUND(AVG(p.precio_max)::numeric, 0) as precio_max,
               ROUND(AVG(p.volumen)::numeric, 0) as volumen,
               COUNT(*) as registros
        FROM precios p
        JOIN mercados m ON p.mercado_id = m.id
        JOIN productos pr ON p.producto_id = pr.id
        WHERE pr.nombre = $1
          AND p.precio_promedio IS NOT NULL
          AND p.precio_promedio > 0
    """
    params = [producto]
    idx = 2

    if mercados:
        query += f" AND m.nombre = ANY(${idx})"
        params.append(mercados)
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

    query += " GROUP BY DATE_TRUNC('month', p.fecha) ORDER BY mes"

    pool = _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]


async def predecir_precios(
    producto: str,
    meses_futuro: int = 12,
    mercados: list[str] = None,
    variedad: str = None,
    calidad: str = None,
    unidad: str = None,
) -> dict:
    """
    Predicción de precios usando descomposición estacional + tendencia lineal.

    Retorna:
    - historico: datos mensuales históricos
    - prediccion: meses futuros con precio estimado + bandas de confianza
    - estacionalidad: factores estacionales por mes
    - tendencia: pendiente y dirección
    - metricas: estadísticas del modelo
    """
    historico = await obtener_historico_mensual(
        producto, mercados, variedad, calidad, unidad
    )

    if len(historico) < 3:
        return {
            "error": "Datos insuficientes para predecir. Se necesitan al menos 3 meses de historia.",
            "historico": [],
            "prediccion": [],
            "estacionalidad": {},
            "tendencia": {},
            "metricas": {},
        }

    # Extraer arrays
    meses = [r["mes"] for r in historico]
    precios = np.array([float(r["precio_promedio"]) for r in historico])
    volumenes = np.array([float(r["volumen"] or 0) for r in historico])

    n = len(precios)

    # ── 1. Tendencia lineal ──
    x = np.arange(n, dtype=float)
    # Regresión lineal: precio = a + b*x
    x_mean = x.mean()
    p_mean = precios.mean()
    b = np.sum((x - x_mean) * (precios - p_mean)) / max(np.sum((x - x_mean) ** 2), 1e-10)
    a = p_mean - b * x_mean
    tendencia_values = a + b * x

    # ── 2. Estacionalidad (factor por mes del año) ──
    # Calcular residuos respecto a tendencia
    ratios_por_mes = {m: [] for m in range(1, 13)}
    for i, fecha_mes in enumerate(meses):
        if tendencia_values[i] > 0:
            ratio = precios[i] / tendencia_values[i]
        else:
            ratio = 1.0
        ratios_por_mes[fecha_mes.month].append(ratio)

    factores_estacionales = {}
    for mes_num in range(1, 13):
        if ratios_por_mes[mes_num]:
            factores_estacionales[mes_num] = float(np.mean(ratios_por_mes[mes_num]))
        else:
            factores_estacionales[mes_num] = 1.0

    # ── 3. Error estándar del modelo ──
    fitted = np.array([
        tendencia_values[i] * factores_estacionales.get(meses[i].month, 1.0)
        for i in range(n)
    ])
    residuos = precios - fitted
    std_error = float(np.std(residuos)) if n > 2 else float(np.std(precios) * 0.2)

    # R² del modelo
    ss_res = np.sum(residuos ** 2)
    ss_tot = np.sum((precios - p_mean) ** 2)
    r_squared = 1 - (ss_res / max(ss_tot, 1e-10))

    # MAPE (Mean Absolute Percentage Error)
    mape = float(np.mean(np.abs(residuos / np.maximum(precios, 1)) * 100))

    # ── 4. Volumen estacional ──
    vol_por_mes = {m: [] for m in range(1, 13)}
    for i, fecha_mes in enumerate(meses):
        if volumenes[i] > 0:
            vol_por_mes[fecha_mes.month].append(float(volumenes[i]))

    vol_estacional = {}
    for mes_num in range(1, 13):
        if vol_por_mes[mes_num]:
            vol_estacional[mes_num] = float(np.mean(vol_por_mes[mes_num]))
        else:
            vol_estacional[mes_num] = 0

    # ── 5. Generar predicciones ──
    ultimo_mes = meses[-1]
    predicciones = []

    for i in range(1, meses_futuro + 1):
        mes_futuro_date = _add_months(ultimo_mes, i)
        mes_num = mes_futuro_date.month

        # Tendencia extrapolada
        x_futuro = float(n + i - 1)
        tendencia_fut = float(a + b * x_futuro)

        # Precio predicho = tendencia * factor estacional
        factor = float(factores_estacionales.get(mes_num, 1.0))
        precio_pred = max(tendencia_fut * factor, 0.0)

        # Bandas de confianza (se ensanchan con el tiempo)
        incertidumbre = float(std_error) * (1 + 0.1 * i)
        precio_min_v = max(precio_pred - 1.96 * incertidumbre, 0.0)
        precio_max_v = precio_pred + 1.96 * incertidumbre

        # Volumen esperado
        vol_esperado = float(vol_estacional.get(mes_num, 0))

        predicciones.append({
            "mes": mes_futuro_date.isoformat(),
            "precio_predicho": int(round(precio_pred)),
            "precio_min": int(round(precio_min_v)),
            "precio_max": int(round(precio_max_v)),
            "factor_estacional": round(factor, 3),
            "volumen_esperado": int(round(vol_esperado)),
            "confianza": max(0, min(100, int(round(100 - mape - i * 2)))),
        })

    # ── 6. Formatear histórico ──
    historico_fmt = []
    for i, r in enumerate(historico):
        historico_fmt.append({
            "mes": r["mes"].isoformat(),
            "precio_promedio": float(r["precio_promedio"]),
            "precio_min": float(r["precio_min"] or 0),
            "precio_max": float(r["precio_max"] or 0),
            "volumen": float(r["volumen"] or 0),
            "tendencia": int(round(float(tendencia_values[i]))),
            "ajustado": int(round(float(fitted[i]))),
        })

    # ── 7. Estacionalidad formateada ──
    nombres_mes = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]
    estacionalidad_fmt = []
    for m in range(1, 13):
        f_est = float(factores_estacionales[m])
        estacionalidad_fmt.append({
            "mes": m,
            "nombre": nombres_mes[m],
            "factor": round(f_est, 3),
            "variacion_pct": round((f_est - 1) * 100, 1),
            "volumen_promedio": int(round(float(vol_estacional.get(m, 0)))),
        })

    # Tendencia mensual en pesos
    b_float = float(b)
    p_mean_float = float(p_mean)
    tendencia_mensual = int(round(b_float))
    tendencia_anual_pct = round(b_float * 12 / max(p_mean_float, 1) * 100, 1)

    return {
        "historico": historico_fmt,
        "prediccion": predicciones,
        "estacionalidad": estacionalidad_fmt,
        "tendencia": {
            "direccion": "alza" if b_float > 0 else "baja" if b_float < 0 else "estable",
            "cambio_mensual": tendencia_mensual,
            "cambio_anual_pct": tendencia_anual_pct,
            "precio_base": int(round(float(a))),
        },
        "metricas": {
            "r_squared": round(float(r_squared), 3),
            "mape": round(float(mape), 1),
            "std_error": int(round(float(std_error))),
            "meses_historia": n,
            "precio_promedio": int(round(p_mean_float)),
            "precio_actual": int(round(float(precios[-1]))),
        },
    }
