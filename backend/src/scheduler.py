import logging
from datetime import date, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from src.scraper import importar_hoy, importar_boletin
from src.climate import importar_clima_diario
from src.database import get_ultima_fecha_importada

logger = logging.getLogger("agroprice.scheduler")

scheduler = AsyncIOScheduler()


def iniciar_scheduler():
    """Iniciar el scheduler para descarga diaria automática"""
    # Ejecutar todos los días hábiles a las 14:00 (hora Chile)
    # ODEPA actualiza el boletín durante la mañana
    scheduler.add_job(
        _tarea_diaria,
        CronTrigger(day_of_week="mon-fri", hour=14, minute=0, timezone="America/Santiago"),
        id="importar_boletin_diario",
        name="Importar boletín diario ODEPA",
        replace_existing=True,
    )

    # Reintento a las 17:00 por si falló el primero
    scheduler.add_job(
        _tarea_reintento,
        CronTrigger(day_of_week="mon-fri", hour=17, minute=0, timezone="America/Santiago"),
        id="reintento_boletin_diario",
        name="Reintento boletín diario ODEPA",
        replace_existing=True,
    )

    # Importar clima diario a las 15:00 (después del boletín ODEPA)
    scheduler.add_job(
        _tarea_clima,
        CronTrigger(day_of_week="mon-fri", hour=15, minute=0, timezone="America/Santiago"),
        id="importar_clima_diario",
        name="Importar clima diario Open-Meteo",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler iniciado: ODEPA 14:00, clima 15:00, reintento 17:00 (hora Chile)")


async def _tarea_diaria():
    """Tarea programada: importar boletín del día"""
    try:
        resultado = await importar_hoy()
        logger.info(f"Importación diaria: {resultado}")
    except Exception as e:
        logger.error(f"Error en importación diaria: {e}")


async def _tarea_reintento():
    """Reintento si la primera importación falló"""
    try:
        resultado = await importar_hoy()
        if resultado["estado"] == "ya_importado":
            logger.info("Reintento: boletín ya importado, no se necesita acción")
        else:
            logger.info(f"Reintento importación: {resultado}")
    except Exception as e:
        logger.error(f"Error en reintento: {e}")


async def _tarea_clima():
    """Tarea programada: importar clima de los últimos días"""
    try:
        resultado = await importar_clima_diario()
        logger.info(f"Clima diario: {resultado}")
    except Exception as e:
        logger.error(f"Error en importación clima diario: {e}")


async def catch_up_importaciones():
    """Importar boletines faltantes desde la última importación exitosa.
    Se ejecuta al startup para recuperar días perdidos por reinicios."""
    try:
        ultima = await get_ultima_fecha_importada()
        if ultima is None:
            logger.info("Catch-up: no hay importaciones previas, nada que recuperar")
            return

        hoy = date.today()
        if ultima >= hoy:
            logger.info(f"Catch-up: datos al día (última={ultima})")
            return

        # Generar lista de días hábiles faltantes
        faltantes = []
        dia = ultima + timedelta(days=1)
        while dia <= hoy:
            if dia.weekday() < 5:  # Solo lunes a viernes
                faltantes.append(dia)
            dia += timedelta(days=1)

        if not faltantes:
            logger.info(f"Catch-up: no hay días hábiles faltantes (última={ultima})")
            return

        logger.info(f"Catch-up: importando {len(faltantes)} días faltantes ({faltantes[0]} → {faltantes[-1]})")
        ok = 0
        registros_total = 0
        for fecha in faltantes:
            try:
                resultado = await importar_boletin(fecha)
                if resultado["estado"] == "ok":
                    ok += 1
                    registros_total += resultado["registros"]
                logger.info(f"  Catch-up {fecha}: {resultado['estado']} ({resultado['registros']} reg)")
            except Exception as e:
                logger.error(f"  Catch-up {fecha}: error {e}")

        logger.info(f"Catch-up completado: {ok}/{len(faltantes)} boletines, {registros_total} registros")

        # También importar clima de los días faltantes
        try:
            resultado_clima = await importar_clima_diario()
            logger.info(f"Catch-up clima: {resultado_clima}")
        except Exception as e:
            logger.error(f"Catch-up clima falló: {e}")

    except Exception as e:
        logger.error(f"Catch-up error general: {e}")


def detener_scheduler():
    """Detener el scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler detenido")
