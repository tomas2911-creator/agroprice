import asyncio
import logging
import json
from datetime import date, datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from src.config import PORT
from src.database import (
    init_db, close_db, get_mercados, get_productos, get_subcategorias, get_precios,
    get_variaciones, get_serie_temporal, get_spread_mercados,
    get_volatilidad, get_estacionalidad, get_correlaciones,
    get_heatmap, get_resumen_diario, get_canasta, get_importaciones,
    get_fechas_disponibles
)
from src.scraper import importar_boletin, importar_historico
from src.scheduler import iniciar_scheduler, detener_scheduler
from src.models import VariacionConfig, CanastaConfig

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s"
)
logger = logging.getLogger("agroprice")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup y shutdown"""
    await init_db()
    iniciar_scheduler()
    logger.info("AgroPrice iniciado")
    yield
    detener_scheduler()
    await close_db()
    logger.info("AgroPrice detenido")


app = FastAPI(
    title="AgroPrice",
    description="Dashboard de precios de frutas y hortalizas - Mercados mayoristas de Chile (ODEPA)",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== ENDPOINTS DE DATOS ==============

@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/api/mercados")
async def listar_mercados():
    """Listar todos los mercados disponibles"""
    return await get_mercados()


@app.get("/api/productos")
async def listar_productos(categoria: Optional[str] = None):
    """Listar productos, opcionalmente filtrado por categoría (fruta/hortaliza)"""
    return await get_productos(categoria)


@app.get("/api/fechas")
async def listar_fechas():
    """Listar todas las fechas con datos disponibles"""
    return await get_fechas_disponibles()


@app.get("/api/producto/subcategorias")
async def subcategorias_producto(producto: str):
    """Obtener variedades, calidades y unidades de un producto"""
    return await get_subcategorias(producto)


@app.get("/api/precios")
async def consultar_precios(
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    mercados: Optional[str] = Query(None, description="Mercados separados por coma"),
    productos: Optional[str] = Query(None, description="Productos separados por coma"),
    categorias: Optional[str] = Query(None, description="Categorías separadas por coma"),
    limit: int = Query(500, ge=1, le=5000)
):
    """Consultar precios con filtros"""
    mercados_list = [m.strip() for m in mercados.split(",")] if mercados else None
    productos_list = [p.strip() for p in productos.split(",")] if productos else None
    categorias_list = [c.strip() for c in categorias.split(",")] if categorias else None

    return await get_precios(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        mercados=mercados_list,
        productos=productos_list,
        categorias=categorias_list,
        limit=limit
    )


@app.get("/api/resumen")
async def resumen_diario(fecha: Optional[date] = None):
    """Resumen del día con top subidas y bajadas"""
    return await get_resumen_diario(fecha)


# ============== ENDPOINTS DE ANÁLISIS ==============

@app.get("/api/variaciones")
async def consultar_variaciones(
    dias: int = Query(7, ge=1, le=365),
    mercados: Optional[str] = None,
    productos: Optional[str] = None,
    categorias: Optional[str] = None
):
    """Variaciones de precio respecto a X días atrás"""
    mercados_list = [m.strip() for m in mercados.split(",")] if mercados else None
    productos_list = [p.strip() for p in productos.split(",")] if productos else None
    categorias_list = [c.strip() for c in categorias.split(",")] if categorias else None

    return await get_variaciones(
        dias=dias,
        mercados=mercados_list,
        productos=productos_list,
        categorias=categorias_list
    )


@app.get("/api/serie-temporal")
async def serie_temporal(
    producto: str,
    mercados: Optional[str] = None,
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    variedad: Optional[str] = None,
    calidad: Optional[str] = None,
    unidad: Optional[str] = None
):
    """Serie temporal de un producto"""
    mercados_list = [m.strip() for m in mercados.split(",")] if mercados else None
    return await get_serie_temporal(producto, mercados_list, fecha_inicio, fecha_fin,
                                     variedad=variedad, calidad=calidad, unidad=unidad)


@app.get("/api/spread")
async def spread_mercados(fecha: Optional[date] = None):
    """Diferencia de precios entre mercados"""
    return await get_spread_mercados(fecha)


@app.get("/api/volatilidad")
async def ranking_volatilidad(
    dias: int = Query(30, ge=7, le=365),
    limit: int = Query(50, ge=1, le=200)
):
    """Ranking de productos por volatilidad"""
    return await get_volatilidad(dias, limit)


@app.get("/api/estacionalidad")
async def estacionalidad(
    producto: str,
    mercado: Optional[str] = None,
    variedad: Optional[str] = None,
    calidad: Optional[str] = None,
    unidad: Optional[str] = None
):
    """Análisis estacional de un producto"""
    return await get_estacionalidad(producto, mercado, variedad=variedad, calidad=calidad, unidad=unidad)


@app.get("/api/correlaciones")
async def correlaciones(
    producto: str,
    mercado: str,
    top_n: int = Query(10, ge=1, le=50),
    variedad: Optional[str] = None,
    calidad: Optional[str] = None,
    unidad: Optional[str] = None
):
    """Productos correlacionados en precio"""
    return await get_correlaciones(producto, mercado, top_n, variedad=variedad, calidad=calidad, unidad=unidad)


@app.get("/api/heatmap")
async def heatmap(fecha: Optional[date] = None):
    """Datos para heatmap de precios"""
    return await get_heatmap(fecha)


@app.post("/api/canasta")
async def canasta(config: CanastaConfig):
    """Evolución de precio de una canasta personalizada"""
    items = [{"producto": i.producto, "mercado": i.mercado} for i in config.items]
    return await get_canasta(items, config.fecha_inicio, config.fecha_fin)


# ============== ENDPOINTS DE IMPORTACIÓN ==============

@app.post("/api/importar/fecha")
async def importar_fecha(fecha: date, forzar: bool = False):
    """Importar boletín de una fecha específica"""
    resultado = await importar_boletin(fecha, forzar=forzar)
    return resultado


# ============== BACKGROUND IMPORT TRACKING ==============

_import_status = {
    "running": False,
    "progress": 0,
    "total": 0,
    "ok": 0,
    "registros": 0,
    "errors": 0,
    "current_date": None,
    "started_at": None,
    "finished_at": None,
}


async def _run_background_import(fecha_inicio: date, fecha_fin: date, forzar: bool):
    """Ejecutar importación en background con tracking"""
    global _import_status
    try:
        from datetime import timedelta
        # Generar lista de fechas hábiles
        fechas = []
        f = fecha_inicio
        while f <= fecha_fin:
            if f.weekday() < 5:
                fechas.append(f)
            f += timedelta(days=1)

        _import_status.update({
            "running": True, "progress": 0, "total": len(fechas),
            "ok": 0, "registros": 0, "errors": 0,
            "current_date": None, "started_at": datetime.now().isoformat(),
            "finished_at": None
        })

        logger.info(f"Background import: {len(fechas)} fechas ({fecha_inicio} → {fecha_fin})")

        semaforo = asyncio.Semaphore(5)

        async def importar_con_tracking(fecha):
            async with semaforo:
                _import_status["current_date"] = str(fecha)
                resultado = await importar_boletin(fecha, forzar=forzar)
                _import_status["progress"] += 1
                if resultado["estado"] == "ok":
                    _import_status["ok"] += 1
                    _import_status["registros"] += resultado["registros"]
                elif resultado["estado"] not in ("ya_importado", "no_disponible"):
                    _import_status["errors"] += 1
                return resultado

        await asyncio.gather(*[importar_con_tracking(f) for f in fechas])

        _import_status["finished_at"] = datetime.now().isoformat()
        _import_status["running"] = False
        logger.info(f"Background import done: {_import_status['ok']} ok, {_import_status['registros']} reg")

    except Exception as e:
        logger.error(f"Background import error: {e}")
        _import_status["running"] = False
        _import_status["finished_at"] = datetime.now().isoformat()


@app.post("/api/importar/historico")
async def importar_hist(
    fecha_inicio: date,
    fecha_fin: Optional[date] = None,
    forzar: bool = False,
    background: bool = True
):
    """Importar boletines históricos. Con background=true retorna inmediatamente."""
    if fecha_fin is None:
        fecha_fin = date.today()

    if background:
        if _import_status["running"]:
            raise HTTPException(status_code=409, detail="Ya hay una importación en curso")
        asyncio.create_task(_run_background_import(fecha_inicio, fecha_fin, forzar))
        return {"status": "started", "mensaje": f"Importación iniciada en background ({fecha_inicio} → {fecha_fin})"}
    else:
        resultados = await importar_historico(fecha_inicio, fecha_fin, forzar=forzar)
        total_ok = sum(1 for r in resultados if r["estado"] == "ok")
        total_registros = sum(r["registros"] for r in resultados)
        return {
            "total_boletines": len(resultados),
            "importados_ok": total_ok,
            "total_registros": total_registros,
            "detalle": resultados
        }


@app.get("/api/importar/status")
async def import_status():
    """Ver progreso de la importación en curso"""
    pct = round(_import_status["progress"] / _import_status["total"] * 100, 1) if _import_status["total"] > 0 else 0
    return {
        **_import_status,
        "porcentaje": pct
    }


@app.get("/api/importaciones")
async def listar_importaciones():
    """Log de importaciones realizadas"""
    return await get_importaciones()


# ============== EXPORT CSV ==============

@app.get("/api/export/csv")
async def exportar_csv(
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    mercados: Optional[str] = None,
    productos: Optional[str] = None,
    categorias: Optional[str] = None
):
    """Exportar datos filtrados en formato CSV"""
    mercados_list = [m.strip() for m in mercados.split(",")] if mercados else None
    productos_list = [p.strip() for p in productos.split(",")] if productos else None
    categorias_list = [c.strip() for c in categorias.split(",")] if categorias else None

    datos = await get_precios(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        mercados=mercados_list,
        productos=productos_list,
        categorias=categorias_list,
        limit=50000
    )

    def generar_csv():
        yield "fecha,mercado,producto,categoria,variedad,calidad,unidad,precio_min,precio_max,precio_promedio,volumen\n"
        for d in datos:
            yield (f"{d['fecha']},{d['mercado']},{d['producto']},{d['categoria']},"
                   f"{d.get('variedad', '')},{d.get('calidad', '')},{d.get('unidad', '')},"
                   f"{d.get('precio_min', '')},{d.get('precio_max', '')},"
                   f"{d.get('precio_promedio', '')},{d.get('volumen', '')}\n")

    return StreamingResponse(
        generar_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=agroprice_export_{date.today()}.csv"}
    )



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=PORT, reload=True)
