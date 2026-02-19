"""
Módulo de predicción de precios agrícolas.
Holt-Winters Triple Exponential Smoothing con optimización automática.
Soporta predicción diaria, semanal y mensual.
"""
import logging
import numpy as np
from datetime import date, timedelta

import src.database as _db

logger = logging.getLogger("agroprice.forecast")

NOMBRES_MES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]


def _get_pool():
    p = _db.pool
    if p is None:
        raise RuntimeError("Pool de base de datos no inicializado")
    return p


def _add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, 1)


# ═══════════════════════════════════════════════════════════════
# Holt-Winters Triple Exponential Smoothing (multiplicativo)
# ═══════════════════════════════════════════════════════════════

def _hw_multiplicative(y, period, alpha, beta, gamma, horizon):
    """Holt-Winters multiplicativo. Retorna (fitted, forecasts) o (None, None)."""
    n = len(y)
    if n < period or period < 2:
        return None, None

    # Inicializar nivel: promedio del primer ciclo
    level = float(np.mean(y[:period]))
    if level <= 0:
        level = 1.0

    # Inicializar tendencia
    if n >= 2 * period:
        trend = float(np.mean([(y[i + period] - y[i]) / period for i in range(period)]))
    else:
        trend = 0.0

    # Inicializar factores estacionales
    seasonal = []
    for i in range(period):
        seasonal.append(float(y[i]) / level if level > 0 else 1.0)

    fitted = [0.0] * n
    levels = [level]
    trends = [trend]

    for t in range(n):
        if t < period:
            fitted[t] = level * seasonal[t]
            continue

        s_prev = seasonal[t - period]
        if s_prev <= 0.01:
            s_prev = 0.01

        new_level = alpha * (y[t] / s_prev) + (1 - alpha) * (levels[-1] + trends[-1])
        new_trend = beta * (new_level - levels[-1]) + (1 - beta) * trends[-1]
        new_seasonal = gamma * (y[t] / max(new_level, 1.0)) + (1 - gamma) * s_prev

        levels.append(new_level)
        trends.append(new_trend)
        seasonal.append(new_seasonal)
        fitted[t] = (levels[-2] + trends[-2]) * s_prev

    # Pronósticos
    forecasts = []
    for i in range(1, horizon + 1):
        s_idx = len(seasonal) - period + ((i - 1) % period)
        s_factor = seasonal[s_idx] if 0 <= s_idx < len(seasonal) else 1.0
        fc = (levels[-1] + i * trends[-1]) * s_factor
        forecasts.append(max(float(fc), 0.0))

    return np.array(fitted), np.array(forecasts)


def _optimize_hw(y, period):
    """Grid search para mejores parámetros α, β, γ minimizando MSE in-sample."""
    best_mse = float('inf')
    best_params = (0.3, 0.05, 0.3)

    for a in [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9]:
        for b in [0.001, 0.01, 0.05, 0.1, 0.2]:
            for g in [0.05, 0.1, 0.2, 0.3, 0.5, 0.7]:
                try:
                    fitted, _ = _hw_multiplicative(y, period, a, b, g, 1)
                    if fitted is None:
                        continue
                    errors = y[period:] - fitted[period:]
                    mse = float(np.mean(errors ** 2))
                    if mse < best_mse:
                        best_mse = mse
                        best_params = (a, b, g)
                except Exception:
                    continue

    return best_params


def _exp_smoothing(y, alpha, horizon):
    """Suavizado exponencial simple con tendencia (Holt). Fallback."""
    n = len(y)
    level = float(y[0])
    trend = float(y[1] - y[0]) if n > 1 else 0.0
    fitted = [level]

    for t in range(1, n):
        new_level = alpha * float(y[t]) + (1 - alpha) * (level + trend)
        new_trend = 0.3 * (new_level - level) + 0.7 * trend
        level = new_level
        trend = new_trend
        fitted.append(level)

    forecasts = [max(level + (i + 1) * trend, 0.0) for i in range(horizon)]
    return np.array(fitted), np.array(forecasts)


def _optimize_exp(y):
    """Optimizar alpha para suavizado exponencial."""
    best_a, best_mse = 0.3, float('inf')
    for a in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]:
        f, _ = _exp_smoothing(y, a, 1)
        if len(f) > 1:
            mse = float(np.mean((y[1:] - f[1:]) ** 2))
            if mse < best_mse:
                best_mse = mse
                best_a = a
    return best_a


# ═══════════════════════════════════════════════════════════════
# Query de datos
# ═══════════════════════════════════════════════════════════════

async def _obtener_datos(producto, mercados, variedad, calidad, unidad, granularidad):
    """Obtener datos históricos según granularidad (diario/semanal/mensual)."""
    if granularidad == "semanal":
        fecha_expr = "DATE_TRUNC('week', p.fecha)::date"
    elif granularidad == "diario":
        fecha_expr = "p.fecha"
    else:
        fecha_expr = "DATE_TRUNC('month', p.fecha)::date"

    query = f"""
        SELECT {fecha_expr} as periodo,
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

    query += f" GROUP BY {fecha_expr} ORDER BY periodo"

    pool = _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]


# ═══════════════════════════════════════════════════════════════
# Función principal
# ═══════════════════════════════════════════════════════════════

async def predecir_precios(
    producto: str,
    horizonte: int = 12,
    mercados: list[str] = None,
    variedad: str = None,
    calidad: str = None,
    unidad: str = None,
    granularidad: str = "mensual",
) -> dict:
    """
    Predicción usando Holt-Winters con optimización automática.
    granularidad: 'diario', 'semanal', 'mensual'
    horizonte: periodos a predecir (días/semanas/meses según granularidad)
    """
    historico = await _obtener_datos(
        producto, mercados, variedad, calidad, unidad, granularidad
    )

    # Período estacional según granularidad
    if granularidad == "semanal":
        period = 52
        period_label = "semanas"
        min_data = 26
    elif granularidad == "diario":
        period = 7
        period_label = "días"
        min_data = 14
    else:
        period = 12
        period_label = "meses"
        min_data = 6

    n = len(historico)
    if n < 3:
        return {
            "error": f"Datos insuficientes. Se encontraron {n} {period_label}, se necesitan al menos {min_data}.",
            "historico": [], "prediccion": [], "estacionalidad": [],
            "tendencia": {}, "metricas": {}, "granularidad": granularidad,
        }

    # Arrays
    periodos_dates = [r["periodo"] for r in historico]
    precios = np.array([float(r["precio_promedio"]) for r in historico])
    volumenes = np.array([float(r["volumen"] or 0) for r in historico])

    # ── Entrenar modelo ──
    use_hw = n >= 2 * period
    use_hw_conserv = not use_hw and n >= period

    if use_hw:
        alpha, beta, gamma = _optimize_hw(precios, period)
        fitted, forecasts = _hw_multiplicative(precios, period, alpha, beta, gamma, horizonte)
        modelo = "Holt-Winters (optimizado)"
    elif use_hw_conserv:
        alpha, beta, gamma = 0.3, 0.05, 0.3
        fitted, forecasts = _hw_multiplicative(precios, period, alpha, beta, gamma, horizonte)
        if fitted is None:
            alpha = _optimize_exp(precios)
            fitted, forecasts = _exp_smoothing(precios, alpha, horizonte)
            modelo = "Suavizado exponencial"
        else:
            modelo = "Holt-Winters (conservador)"
    else:
        alpha = _optimize_exp(precios)
        fitted, forecasts = _exp_smoothing(precios, alpha, horizonte)
        beta, gamma = 0.0, 0.0
        modelo = "Suavizado exponencial"

    # ── Métricas de calidad ──
    # Para HW, los primeros 'period' puntos son inicialización, no predicciones reales
    skip = period if (use_hw or use_hw_conserv) else max(1, n // 6)
    if skip >= n:
        skip = max(1, n // 4)
    residuos = precios[skip:] - fitted[skip:]
    p_mean = float(np.mean(precios))

    ss_res = float(np.sum(residuos ** 2))
    # R² contra media de la serie completa (más justo que media parcial)
    ss_tot = float(np.sum((precios[skip:] - p_mean) ** 2))
    r_squared = max(0.0, 1 - ss_res / max(ss_tot, 1e-10))

    mape = float(np.mean(np.abs(residuos / np.maximum(precios[skip:], 1)) * 100))
    std_error = float(np.std(residuos)) if len(residuos) > 1 else float(np.std(precios) * 0.3)

    # Cross-validation (leave-last-k-out)
    cv_errors = []
    cv_k = min(6, n // 5)
    if cv_k >= 1:
        for k in range(1, cv_k + 1):
            train = precios[:n - k]
            actual = float(precios[n - k])
            try:
                if use_hw and len(train) >= 2 * period:
                    _, fc = _hw_multiplicative(train, period, alpha, beta, gamma, k)
                elif len(train) >= period:
                    _, fc = _hw_multiplicative(train, period, 0.3, 0.05, 0.3, k)
                else:
                    _, fc = _exp_smoothing(train, alpha, k)
                if fc is not None and len(fc) >= k:
                    err = abs(float(fc[k - 1]) - actual) / max(actual, 1) * 100
                    cv_errors.append(err)
            except Exception:
                pass

    cv_mape = float(np.mean(cv_errors)) if cv_errors else mape

    # ── Estacionalidad mensual (siempre útil) ──
    hist_mensual = {}
    vol_mensual = {}
    for r in historico:
        m = r["periodo"].month
        p_val = float(r["precio_promedio"])
        v_val = float(r["volumen"] or 0)
        hist_mensual.setdefault(m, []).append(p_val)
        if v_val > 0:
            vol_mensual.setdefault(m, []).append(v_val)

    estac_fmt = []
    for m in range(1, 13):
        vals = hist_mensual.get(m, [])
        vols = vol_mensual.get(m, [])
        avg = float(np.mean(vals)) if vals else p_mean
        factor = avg / p_mean if p_mean > 0 else 1.0
        estac_fmt.append({
            "mes": m,
            "nombre": NOMBRES_MES[m],
            "factor": round(factor, 3),
            "variacion_pct": round((factor - 1) * 100, 1),
            "volumen_promedio": int(round(float(np.mean(vols)))) if vols else 0,
        })

    # ── Generar predicciones ──
    ultimo = periodos_dates[-1]
    predicciones = []

    for i in range(horizonte):
        fc_val = float(forecasts[i])

        # Fecha futura
        if granularidad == "mensual":
            fecha_fut = _add_months(ultimo, i + 1)
        elif granularidad == "semanal":
            fecha_fut = ultimo + timedelta(weeks=i + 1)
        else:
            fecha_fut = ultimo + timedelta(days=i + 1)

        # Bandas de confianza (se ensanchan progresivamente)
        spread = std_error * (1 + 0.08 * (i + 1))
        fc_min = max(fc_val - 1.96 * spread, 0.0)
        fc_max = fc_val + 1.96 * spread

        # Volumen esperado por mes
        mes_num = fecha_fut.month
        vols_mes = vol_mensual.get(mes_num, [])
        vol_esp = float(np.mean(vols_mes)) if vols_mes else 0.0

        # Confianza decreciente
        confianza = max(0, min(100, int(round(100 - cv_mape - (i + 1) * 1.5))))

        predicciones.append({
            "periodo": fecha_fut.isoformat(),
            "precio_predicho": int(round(fc_val)),
            "precio_min": int(round(fc_min)),
            "precio_max": int(round(fc_max)),
            "volumen_esperado": int(round(vol_esp)),
            "confianza": confianza,
        })

    # ── Formatear histórico ──
    historico_fmt = []
    for i, r in enumerate(historico):
        historico_fmt.append({
            "periodo": r["periodo"].isoformat(),
            "precio_promedio": float(r["precio_promedio"]),
            "precio_min": float(r["precio_min"] or 0),
            "precio_max": float(r["precio_max"] or 0),
            "volumen": float(r["volumen"] or 0),
            "ajustado": int(round(float(fitted[i]))),
        })

    # ── Tendencia ──
    # Calcular de los últimos 6 periodos vs precio promedio
    reciente = precios[-min(6, n):]
    x_rec = np.arange(len(reciente), dtype=float)
    if len(reciente) > 1:
        slope = float(np.polyfit(x_rec, reciente, 1)[0])
    else:
        slope = 0.0

    if granularidad == "mensual":
        cambio_anual = slope * 12
    elif granularidad == "semanal":
        cambio_anual = slope * 52
    else:
        cambio_anual = slope * 365

    cambio_anual_pct = round(cambio_anual / max(p_mean, 1) * 100, 1)

    return {
        "historico": historico_fmt,
        "prediccion": predicciones,
        "estacionalidad": estac_fmt,
        "tendencia": {
            "direccion": "alza" if slope > 0 else "baja" if slope < 0 else "estable",
            "cambio_periodo": int(round(slope)),
            "cambio_anual_pct": cambio_anual_pct,
        },
        "metricas": {
            "modelo": modelo,
            "r_squared": round(float(r_squared), 3),
            "mape": round(float(mape), 1),
            "cv_mape": round(cv_mape, 1),
            "std_error": int(round(std_error)),
            "periodos_historia": n,
            "precio_promedio": int(round(p_mean)),
            "precio_actual": int(round(float(precios[-1]))),
        },
        "granularidad": granularidad,
    }
