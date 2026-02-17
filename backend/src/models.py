from pydantic import BaseModel
from typing import Optional
from datetime import date


class PrecioRegistro(BaseModel):
    id: Optional[int] = None
    fecha: date
    mercado: str
    producto: str
    categoria: str  # "fruta" o "hortaliza"
    variedad: Optional[str] = None
    unidad: Optional[str] = None
    precio_min: Optional[float] = None
    precio_max: Optional[float] = None
    precio_promedio: Optional[float] = None
    volumen: Optional[float] = None


class Mercado(BaseModel):
    id: Optional[int] = None
    nombre: str


class Producto(BaseModel):
    id: Optional[int] = None
    nombre: str
    categoria: str


class ImportacionLog(BaseModel):
    id: Optional[int] = None
    fecha_boletin: date
    fecha_importacion: Optional[str] = None
    registros: int
    estado: str  # "ok", "error", "no_disponible"
    detalle: Optional[str] = None


class FiltroPrecios(BaseModel):
    mercados: Optional[list[str]] = None
    productos: Optional[list[str]] = None
    categorias: Optional[list[str]] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None


class VariacionConfig(BaseModel):
    dias: int = 7  # Comparar con X días atrás
    mercados: Optional[list[str]] = None
    productos: Optional[list[str]] = None
    categorias: Optional[list[str]] = None


class CanastaItem(BaseModel):
    producto: str
    mercado: str


class CanastaConfig(BaseModel):
    nombre: str
    items: list[CanastaItem]
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None


class ResumenDiario(BaseModel):
    fecha: date
    total_productos: int
    total_mercados: int
    top_subidas: list[dict]
    top_bajadas: list[dict]
    precio_promedio_general: Optional[float] = None
