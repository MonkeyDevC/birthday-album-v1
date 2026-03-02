# Despliegue en GitHub Pages — birthday-album-v2

## 1. Crear el repositorio en GitHub

1. Ve a **https://github.com/new**
2. **Repository name:** `birthday-album-v2`
3. **Public**
4. **No** marques "Add a README file"
5. **No** añadas .gitignore ni licencia
6. Clic en **Create repository**

## 2. Conectar y subir el proyecto

En la terminal, desde la carpeta del proyecto (`Regalo adriana`):

```powershell
cd "c:\Users\santy\OneDrive\Escritorio\Regalo adriana"

# Sustituye TU_USUARIO por tu nombre de usuario de GitHub
git remote add origin https://github.com/TU_USUARIO/birthday-album-v2.git

git push -u origin main
```

Si te pide usuario/contraseña, usa un **Personal Access Token** (Settings → Developer settings → Personal access tokens) en lugar de la contraseña.

## 3. Activar GitHub Pages

1. En el repo: **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` — **Folder:** `/ (root)**
4. **Save**

## 4. URL del sitio

Tras el primer despliegue (1–2 minutos):

**https://TU_USUARIO.github.io/birthday-album-v2/**

Sustituye `TU_USUARIO` por tu usuario de GitHub.

## 5. Comprobaciones

- Libro (Turn.js / flip) funciona
- Imágenes cargan (portada, contraportada, fotos)
- Modo Edición y panel se abren
- Consola del navegador sin 404

Propagación típica: 1–3 minutos. Si no carga, espera un poco y recarga.
