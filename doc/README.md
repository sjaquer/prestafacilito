# 📚 PrestaFacilito — Centro de Documentación Integral

Bienvenido a la documentación oficial de **PrestaFacilito**, la plataforma integral para la administración, originación, seguimiento financiero, cobranza y auditoría de préstamos personales/comerciales y contratos de alquiler de inmuebles.

---

## 🗺️ Mapa de Navegación de la Documentación

La documentación se encuentra estructurada en tres grandes bloques para facilitar su lectura tanto a perfiles de negocio/operaciones como a desarrolladores y arquitectos de software:

```
doc/
├── README.md                                         # [Este archivo] Índice maestro y bienvenida
├── 01_documentacion_no_tecnica.md                    # Guía funcional, reglas de negocio y manual operativo
├── 02_documentacion_tecnica_arquitectura.md          # Arquitectura del sistema, stack, seguridad y base de datos
├── 03_deuda_tecnica.md                               # Registro exhaustivo de deuda técnica y plan de remediación
└── funciones_internas/                               # Especificación técnica detallada por función y subsistema
    ├── 01_motor_calculo_financiero_loanLogic.md      # Motor de amortización (Sistema Francés Adaptativo)
    ├── 02_motor_mora_y_atrasos_moraLogic.md          # Detección de mora, cuotas impagas y préstamos estancados
    ├── 03_motor_score_crediticio_scoreLogic.md       # Algoritmo de scoring crediticio (A, B, C)
    ├── 04_motor_gestion_alquileres_alquilerLogic.md  # Motor de contratos y pagos de alquiler de inmuebles
    ├── 05_servicio_google_drive_google-drive.md      # Integración OAuth2 y almacenamiento seguro en Google Drive
    ├── 06_servicio_google_calendar_google-calendar.md# Sincronización automática de vencimientos en Google Calendar
    ├── 07_autenticacion_seguridad_jwt_auth.md        # Autenticación multifactor por PIN, JWT y cabeceras CSP
    ├── 08_motor_backups_excel_backup.md              # Sistema de respaldos periódicos y exportación Excel XLSX
    ├── 09_motor_compresion_imagenes_ocr.md           # Optimización de imágenes en Canvas y OCR de vouchers
    ├── 10_auditoria_consistencia_base_datos.md       # Script de auditoría de integridad matemática y referencial
    ├── 11_motor_business_intelligence_dashboard.md   # Métricas gerenciales en tiempo real y reportes IA (Gemini)
    ├── 12_subsistema_rutas_api_prestamos_amortizaciones.md # API REST de Préstamos, Pagos y Ajustes
    ├── 13_subsistema_rutas_api_clientes_documentos.md# API REST de Clientes, Expedientes y Teléfonos
    └── 14_subsistema_rutas_api_alquileres_pagos.md   # API REST de Inmuebles, Contratos y Cobros de Renta
```

---

## 📌 Resumen de Módulos Principales

| Documento | Audiencia | Descripción |
| :--- | :--- | :--- |
| [**Documentación No Técnica**](./01_documentacion_no_tecnica.md) | Operadores, Gerencia, Analistas de Cobranza | Explicación en lenguaje de negocio sobre préstamos, cronogramas, clasificación automática de abonos, moras, alquileres y reportes. |
| [**Documentación Técnica de Arquitectura**](./02_documentacion_tecnica_arquitectura.md) | Desarrolladores, DevOps, Tech Leads | Diagramas de componentes, arquitectura React 19 + Express + Supabase, flujo de datos, seguridad CSP, variables de entorno y esquema SQL. |
| [**Registro de Deuda Técnica**](./03_deuda_tecnica.md) | CTO, Desarrolladores, Auditores | Análisis crítico de vulnerabilidades, limitaciones de escalabilidad, cuellos de botella, bugs potenciales y roadmap de modernización. |
| [**Funciones Internas y Subsistemas**](./funciones_internas/) | Desarrolladores Backend & Frontend | Un archivo por función/módulo interno con especificación de interfaces, parámetros, flujos de ejecución, manejo de errores y casos de prueba. |

---

## 🚀 Inicio Rápido para Desarrolladores

### Requisitos Previos
- **Node.js**: v18.0.0 o superior (Recomendado v20.x LTS)
- **NPM**: v9.0.0 o superior
- **Instancia de Supabase**: PostgreSQL con extensiones estándar
- **Google Cloud Console**: Proyecto configurado con APIs de Google Drive y Google Calendar (OAuth 2.0)

### Variables de Entorno Clave (`.env`)
```ini
PORT=3000
NODE_ENV=development
JWT_SECRET=tu_clave_secreta_jwt_muy_segura

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_supabase_anon_o_service_key

# Autenticación PIN
PIN_ADMIN=1234
PIN_OPERATOR=5678
PIN_VIEWER=9012

# Google Drive & Calendar OAuth2
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REFRESH_TOKEN=1//xxx
GOOGLE_DRIVE_FOLDER_ID=carpeta_raiz_drive_vouchers
GOOGLE_DRIVE_CLIENTES_FOLDER_ID=carpeta_documentos_clientes
```

### Comandos de Ejecución
```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (Vite + Express HMR)
npm run dev

# Ejecutar pruebas unitarias de lógica financiera
npm run test

# Ejecutar auditoría de consistencia con Supabase
npm run test:audit

# Compilación para producción
npm run build
npm start
```
