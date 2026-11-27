# Poner el dashboard en internet, para los dos

La base en la nube es Postgres. El código ya está listo; falta crear la base y publicar.

1. Entrá a vercel.com, abrí el proyecto **myb-digitals-dashboard** y andá a **Storage**.
2. **Create Database**, elegí **Neon (Postgres)**, plan gratis, y conectala al proyecto. Vercel carga sola la variable `DATABASE_URL`.
3. En **Settings, Environment Variables** agregá `SETUP_CODE` con un código inventado por vos (largo). Sirve una sola vez, para crear las dos contraseñas.
4. Avisá para publicar (subir la rama `mejora-dashboard` a `main`).
5. Abrí el link, poné el código y creá las dos contraseñas (10 caracteres o más).
6. En esta compu: Configuración, **Descargar**. En la nube: Configuración, **Restaurar archivo**. Pasa todo menos los archivos adjuntos.

Para que el dashboard de esta compu use la misma base, se abre con la variable `DATABASE_URL` puesta.
En la nube el PDF se guarda desde la ventana de imprimir; en la compu se descarga directo. Adjuntos de hasta 4 MB.

## La voz en internet
El micrófono y las reglas funcionan solos. Para que entienda lo difícil en la nube hace falta una clave de Claude (console.anthropic.com, con saldo): se carga en **Settings, Environment Variables** como `ANTHROPIC_API_KEY`. El modelo se cambia con `MYB_MODELO`. ChatGPT y Whisper sólo andan en la compu de Benjamín.
