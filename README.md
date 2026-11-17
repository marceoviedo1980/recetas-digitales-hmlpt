# Recetario Digital La Portada

PWA para llenar e imprimir recetarios hospitalarios oficiales del Hospital Municipal La Portada.

## Funciones principales

- Recetario ambulatorio, internado y UTI / UCIN.
- Medicamentos leidos en vivo desde **FarmaCheck**, con aviso de restriccion al elegirlos
  (solo en pantalla, no se imprime).
- Psicotropicos y estupefacientes: la cantidad se escribe sola en literal.
  Ej.: `Citrato de Fentanilo 0,05 mg/ml (ampolla de 10 ml) (tres ampollas)`.
- Diagnosticos leidos en vivo desde **cartera-servicios**; se buscan por nombre o por codigo y salen primero
  los del tipo de receta (ambulatorio / internado).
- Aviso cuando los medicamentos superan las filas del recetario (17 en hoja carta ambulatoria, 15 en internado,
  12 en dos copias, 20 en UTI / UCIN).
- Guardar, cargar, buscar, respaldar e importar recetas (solo en el navegador del equipo).
- Borrador automatico: si la app se recarga (p. ej. al actualizarse), se recupera la receta en curso.
- Logos institucionales (Gobierno Autonomo Municipal de La Paz y Hospital Humano La Portada) en la cabecera.
- Vista previa imprimible y PDF sin necesidad de internet.

## De donde salen los datos

| Dato | Se lee de | Respaldo dentro de la app |
|---|---|---|
| Medicamentos | `marceoviedo1980/FarmaCheck/medicamentos.json` | `data/medicamentos.json` |
| Diagnosticos | `marceoviedo1980/cartera-servicios/cartera_servicios.json` | `data/cartera_servicios.json` |

Para actualizar medicamentos o diagnosticos **no se toca esta app**: se actualiza FarmaCheck o
cartera-servicios y el recetario lo toma solo. Sin conexion usa la ultima copia descargada en el equipo y,
si no hay ninguna, la copia de `data/`. La linea "Medicamentos / Diagnosticos" de la pantalla dice cual usa.

Las direcciones y la lista de controlados estan al inicio de `app.js` (bloque "DATOS DEL ESTABLECIMIENTO").

## Publicar cambios de la app

Al cambiar cualquier archivo de la app, subir el numero `VERSION` en `sw.js` (es el unico lugar).
No hace falta cambiarlo cuando solo cambian los datos.

## Datos

No deben agregarse datos personales de pacientes al repositorio.
