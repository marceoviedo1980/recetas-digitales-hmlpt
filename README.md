# Recetario Digital La Portada

PWA para llenar e imprimir recetarios hospitalarios oficiales del Hospital Municipal La Portada.

## Funciones principales

- Recetario ambulatorio.
- Recetario internado.
- Recetario UTI / UCIN.
- Buscador de medicamentos desde `data/medicamentos.json`.
- Buscador de diagnosticos y autollenado CIE-10 desde `data/cartera_servicios.json`.
- Lista de servicios/especialidades.
- Vista previa imprimible.
- Instalacion como PWA en navegador compatible.
- Logos institucionales (Gobierno Autonomo Municipal de La Paz y Hospital Humano La Portada) en la cabecera de los tres recetarios, tomados de `img/`.

## Publicacion en GitHub Pages

Este proyecto puede publicarse como sitio estatico. Los archivos necesarios son:

```text
index.html
app.js
styles.css
manifest.webmanifest
sw.js
icons/
img/
data/
README.md
```

No es necesario publicar los PDF de prueba, plantillas extraidas ni scripts locales.

## Uso

Abre la app publicada desde GitHub Pages, llena el formulario, revisa la vista previa y usa `Imprimir` o `Generar PDF`.

## Datos

Los datos cargados actualmente son:

- `data/medicamentos.json`
- `data/cartera_servicios.json`

No deben agregarse datos personales de pacientes al repositorio.
