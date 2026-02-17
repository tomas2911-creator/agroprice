import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from src.scraper import importar_hoy

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

    scheduler.start()
    logger.info("Scheduler iniciado: importación diaria a las 14:00 y reintento a las 17:00 (hora Chile)")


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


def detener_scheduler():
    """Detener el scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler detenido")
