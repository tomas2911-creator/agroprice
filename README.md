# AgroPrice 🥬

Dashboard de análisis de precios de frutas y hortalizas en mercados mayoristas de Chile.

Fuente de datos: [ODEPA - Boletín diario](https://www.odepa.gob.cl/publicaciones/boletines/boletin-diario-de-precios-y-volumenes-de-frutas-en-mercados-mayoristas)

## Features

- **Resumen diario**: KPIs, top subidas y bajadas
- **Tabla de precios**: Con filtros por mercado, producto, categoría, fechas
- **Variaciones configurables**: Comparar precios con X días atrás (1, 7, 14, 30, etc.)
- **Serie temporal**: Evolución de precio de un producto en múltiples mercados
- **Spread entre mercados**: Detectar dónde está más barato/caro cada producto
- **Ranking de volatilidad**: Productos con mayor variación de precio
- **Análisis estacional**: Comportamiento de precios por mes y año
- **Correlaciones**: Productos que se mueven juntos en precio
- **Heatmap**: Precios por producto × mercado en una tabla visual
- **Canasta personalizable**: Crear tu propia canasta y ver evolución del costo total
- **Exportar CSV**: Descargar datos filtrados
- **Importación automática**: Cron diario + importación histórica desde enero 2023

## Stack

- **Backend**: Python 3.12, FastAPI, asyncpg, openpyxl, APScheduler
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Recharts, Lucide Icons
- **BD**: PostgreSQL 16
- **Deploy**: Railway

## Deploy en Railway

### 1. Crear proyecto en Railway

Necesitas 3 servicios:
- **PostgreSQL**: Agregar addon PostgreSQL desde Railway Dashboard
- **Backend**: Conectar el repo, root directory = `backend`
- **Frontend**: Conectar el repo, root directory = `frontend`

### 2. Variables de entorno - Backend

```
DATABASE_URL=<la que te da Railway al agregar PostgreSQL>
PORT=8000
ODEPA_BASE_URL=https://www.odepa.gob.cl/wp-content/uploads
HISTORICAL_START_DATE=2023-01-01
```

### 3. Variables de entorno - Frontend

```
VITE_API_URL=https://<tu-backend>.up.railway.app
```

### 4. Cargar datos históricos

Una vez desplegado, ir al dashboard → sección "Importación" → "Importar rango histórico":
- Desde: 2023-01-01
- Hasta: (vacío = hoy)
- Click en "Importar Histórico"

Esto descargará y procesará todos los boletines desde enero 2023. Después, el cron automático importará el boletín diario cada día hábil a las 14:00 hora Chile.

## Desarrollo local

```bash
# Base de datos
docker compose up db -d

# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn src.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```
