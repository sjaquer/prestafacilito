
Especificación Técnico-Funcional: Módulo de Préstamos Flexibles con Amortización Variable (Estilo Francés Adaptativo)

Este documento define de forma estricta la lógica de negocio, los estados y el comportamiento algorítmico del sistema de créditos de la aplicación. Está diseñado para servir como fuente de verdad absoluta (contexto persistente) para modelos de Inteligencia Artificial de programación encargados del desarrollo del backend, bases de datos y API.

1. Filosofía del Modelo de Negocio

El sistema rompe con la rigidez bancaria tradicional. Su objetivo principal es garantizar la recuperación total del capital mediante la adaptabilidad a la capacidad de pago del cliente, priorizando la continuidad de los abonos sobre el cumplimiento estricto de un calendario fijo.

Reglas de Oro del Sistema:

Cobro sobre Saldo Deudor: Los intereses de cada período se calculan única y exclusivamente sobre el capital que el cliente aún debe.

Prioridad de Imputación de Pagos: Cualquier abono recibido se destina primero a cubrir los intereses devengados. El excedente se aplica directamente a la reducción del capital.

Plazo Dinámico (Extensión Automática): Al no exigir una cuota fija estricta, si un abono es menor al proyectado originalmente, el saldo de capital no amortizado se desplaza automáticamente hacia nuevos períodos, recalculando los intereses en consecuencia. El préstamo no "vence" destructivamente; se extiende dinámicamente hasta que el saldo llegue a cero.

2. Entidades y Estructura de Datos (Modelo de Base de Datos)

Para implementar esta lógica de manera óptima, la entidad Prestamo y sus relaciones deben manejar los siguientes campos críticos:

Entidad: Prestamo

Campo

Tipo de Dato Recomendado

Descripción

id

UUID / String

Identificador único.

capital_inicial

Decimal(10,2)

Monto original prestado (ej: 1000.00).

saldo_capital

Decimal(10,2)

Capital pendiente por pagar. Inicialmente igual al capital inicial.

interes_pendiente_acumulado

Decimal(10,2)

Intereses devengados que no alcanzaron a ser cubiertos en pagos anteriores. Inicialmente 0.00.

tasa_interes_mensual

Decimal(5,4)

Tasa en decimales (ej: 0.1500 para un 15%).

estado

Enum / String

ACTIVO, LIQUIDADO, MORA_CRITICA.

fecha_creacion

Datetime / Timestamp

Fecha de registro del préstamo.

fecha_ultimo_proceso

Datetime / Timestamp

Fecha del último cálculo de intereses o procesamiento de pago.

Entidad: Pago (Historial de Transacciones)

Campo

Tipo de Dato Recomendado

Descripción

id

UUID / String

Identificador único de la transacción.

prestamo_id

UUID / String

Referencia o Llave foránea hacia el Préstamo.

monto_abonado

Decimal(10,2)

La cantidad de dinero que entrega el cliente.

monto_aplicado_interes

Decimal(10,2)

Parte del abono que absorbió el interés.

monto_aplicado_capital

Decimal(10,2)

Parte del abono que redujo el capital.

saldo_capital_restante

Decimal(10,2)

Estado del capital después de procesar esta transacción.

fecha_pago

Datetime / Timestamp

Fecha y hora en que se realizó el pago.

3. Algoritmo Central de Procesamiento de Pagos

Cada vez que el cliente realiza un pago, el sistema debe ejecutar el siguiente flujo lógico de forma transaccional (Atómica):

[Recibir Pago: monto_abonado]
          │
          ▼
[Calcular Interés del Período] ──► Interes_Mes = (saldo_capital * tasa_interes_mensual)
          │
          ▼
[Calcular Deuda de Interés Total] ──► Interes_Total = Interes_Mes + interes_pendiente_acumulado
          │
          ▼
¿monto_abonado >= Interes_Total?
          ├──► SÍ (Pago cubre intereses):
          │     1. monto_aplicado_interes = Interes_Total
          │     2. excedente = monto_abonado - Interes_Total
          │     3. monto_aplicado_capital = MIN(excedente, saldo_capital)
          │     4. saldo_capital = saldo_capital - monto_aplicado_capital
          │     5. interes_pendiente_acumulado = 0.00
          │     6. si saldo_capital == 0 -> estado = 'LIQUIDADO'
          │
          └──► NO (Pago insuficiente):
                1. monto_aplicado_interes = monto_abonado
                2. monto_aplicado_capital = 0.00
                3. interes_pendiente_acumulado = Interes_Total - monto_abonado
                4. (El saldo_capital se mantiene intacto y la deuda se extiende)


4. Matriz de Eventos y Escenarios Detallados

A continuación se detallan las respuestas del sistema ante diferentes situaciones reales utilizando como ejemplo base un préstamo de 1000.00 Soles al 15% mensual.

Escenario

Descripción y Estado Inicial

Procesamiento del Sistema

Reacción y Estado Final

A: Pago Mayor al Interés

Cliente paga S/. 575.00 en el Mes 1.





Inicial: saldo_capital = 1000.00, interes_pendiente = 0.00.



Interés del mes: S/. 150.00.

- Abono cubre 150.00 de interés.



- Sobrante: 575.00 - 150.00 = 425.00.



- Reducción capital: 1000.00 - 425.00 = 575.00.

Préstamo sigue ACTIVO. Nuevo saldo capital: S/. 575.00. El interés del siguiente mes se calcula sobre este nuevo saldo.

B: Liquidación Anticipada

Cliente en Mes 2 quiere cerrar deuda. (Viene de Escenario A).





Inicial: saldo_capital = 575.00.



Interés del mes: S/. 86.25.

- Cliente abona exacto: S/. 661.25 (575.00 + 86.25).



- Interés cubierto: 86.25.



- Capital amortizado: 575.00.

Nuevo saldo capital: S/. 0.00. El sistema cambia el estado a LIQUIDADO y detiene cálculos.

C: Pago Insuficiente

Abono menor al interés (ej: S/. 100.00 en Mes 1).





Inicial: saldo_capital = 1000.00.



Interés del mes: S/. 150.00.

- Todo el abono (100.00) va a interés.



- Capital amortizado = 0.00.



- Interés pendiente guardado: 150.00 - 100.00 = 50.00.

Préstamo ACTIVO. Saldo capital intacto (S/. 1000.00). Para el mes 2, deberá interés nuevo + S/. 50.00 pendientes.

D: Incumplimiento (S/. 0)

Cliente no paga al cierre de período.





Inicial: saldo_capital = 1000.00.



Interés del mes: S/. 150.00.

- Abono = 0.00.



- interes_pendiente se incrementa en S/. 150.00.

Préstamo ACTIVO. Saldo capital intacto. Se activan banderas de MORA para seguimiento.

5. Directrices Técnicas para el Desarrollo del Código (Prompt para la IA de Programación)

Cuando utilices este documento para codificar, la IA debe construir las funciones respetando rigurosamente las siguientes pautas de ingeniería de software:

Uso de Tipos de Datos de Alta Precisión: Prohibido usar flotantes (float o double) para manejar dinero. Se debe exigir el uso de tipos decimales fijos (ej. BigDecimal en Java/Kotlin, Decimal en Python, o enteros multiplicados por 100 para representar centavos en Node.js/Go/Firebase).

Idempotencia y Transaccionalidad: La función de procesamiento de pagos debe correr dentro de una transacción de base de datos (Batch Writes). Si algo falla durante la actualización del capital o el registro del historial, toda la operación debe hacer ROLLBACK.

Inmutabilidad del Historial: Los registros de la tabla Pago nunca se editan ni se eliminan. Si un pago fue erróneo, se procesa una transacción inversa de ajuste (crédito/débito) para mantener la auditoría limpia.

Desacoplamiento de Fechas: La aplicación debe calcular los períodos en base a días transcurridos o fechas de corte mensuales fijas acordadas, de forma independiente al día en que se procese el pago en el sistema.

