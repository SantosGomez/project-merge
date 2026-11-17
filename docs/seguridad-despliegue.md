# Seguridad del despliegue

Guía breve para quien publica o mantiene «Seguimiento de Proyectos». Ningún comando de aquí imprime secretos.

## 1. Proteger el túnel de Cloudflare

El `docker-compose.yml` usa un **Quick Tunnel** (`*.trycloudflare.com`): la URL es pública, cambia en cada reinicio y no tiene control de acceso. Cualquiera que conozca la URL llega al login. Dos formas de mejorarlo:

- **Túnel con nombre + Cloudflare Access (recomendado):** crea un túnel con nombre en Cloudflare Zero Trust (Networks → Tunnels), apunta su ruta pública a `http://frontend:8081`, y crea una aplicación de Access para ese dominio con una política que permita solo los correos del despacho (código por correo o inicio de sesión de la empresa). Así nadie ve siquiera la pantalla de login sin autenticarse antes. En el compose se cambia el comando del servicio `tunnel` por `tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}` (el token va en el `.env`, nunca en el repositorio).
- **Mantener el Quick Tunnel** solo para pruebas cortas, y no compartir su URL.

Mientras no haya Access, la defensa es el login con límite de intentos y las cabeceras de seguridad del backend y nginx.

## 2. `Backend/.env` de desarrollo (usuario `root` sin contraseña)

El `Backend/.env` local usa `root` sin contraseña de MariaDB (XAMPP). Es **solo para esta PC**: el puerto 3306 de XAMPP no debe abrirse a la red. Para trabajar con un usuario con menos poder:

```sql
CREATE DATABASE IF NOT EXISTS seguimiento_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'seguimiento_dev'@'localhost' IDENTIFIED BY '<clave larga generada>';
GRANT ALL PRIVILEGES ON seguimiento_dev.* TO 'seguimiento_dev'@'localhost';
FLUSH PRIVILEGES;
```

Después pon `DB_USER`, `DB_PASSWORD` y `DB_NAME` en `Backend/.env`.

**Permisos de esquema:** al arrancar, el seed (`Backend/src/utils/seed.js`) ejecuta migraciones DDL (`CREATE TABLE`, `ALTER TABLE`, índices). Por eso el usuario de la app necesita permisos de esquema (`CREATE`, `ALTER`, `INDEX`, `DROP` sobre su base) además de `SELECT/INSERT/UPDATE/DELETE`. En producción el compose lo crea con `MARIADB_USER`, que ya es dueño de su base. Si algún día se separan las migraciones, la app podría usar un usuario solo con lectura y escritura de datos.

## 3. Activar el hook que busca secretos

El hook `.githooks/pre-commit` rechaza commits que incluyan `.env*` (menos `.env.example`), `*.sql`, `*.sql.cifrado`, `*.local.json`, llaves privadas, o líneas con `JWT_SECRET=`, `…PASSWORD=` o `RESPALDO_FRASE=` con valor real. No usa dependencias; solo necesita Node. Se activa una vez por clon:

```bash
git config core.hooksPath .githooks
```

Si una línea es un dato de prueba evidente, añade `hook:permitir-secreto` en esa misma línea. Los patrones están en `.githooks/detectarSecretos.js` y se prueban en `Backend/test/detectorSecretos.test.js`.

## 4. Respaldos cifrados

```bash
RESPALDO_FRASE="una frase larga y secreta" node Backend/soporte-pruebas/respaldarBd.js
RESPALDO_FRASE="la misma frase" node Backend/soporte-pruebas/restaurarBd.js <archivo.sql.cifrado> [--restaurar]
```

Hace el volcado dentro del contenedor `db` (la contraseña no aparece en argumentos), lo cifra con AES-256-GCM (clave derivada con scrypt) y lo guarda **fuera del proyecto**, en `~/respaldos-seguimiento-proyectos` o en `RESPALDO_CARPETA`. Guarda la frase en un gestor de contraseñas: sin ella el respaldo no se puede abrir. Sin `--restaurar` solo escribe el `.sql` descifrado (bórralo al terminar); con `--restaurar` **sobrescribe** la base.

Los `respaldo-*.sql` que ya existen en la raíz del proyecto están sin cifrar y tienen hashes de contraseñas: muévelos a una carpeta fuera del proyecto o cífralos y bórralos.

## 5. Rotar secretos

```bash
node Backend/src/utils/rotarSecretos.js [ruta-del-.env] [carpeta-de-salida]
```

Lee el `.env` de la raíz (o el que indiques), genera contraseñas nuevas y un `JWT_SECRET` nuevo, y escribe **fuera del proyecto** (por omisión en `~/rotacion-secretos-AAAA-MM-DD`) un `.env.nuevo` y un `rotar-claves.sql`. No muestra claves ni toca tu `.env`. Pasos: corre el SQL como `root`, reemplaza el `.env` por `.env.nuevo`, reinicia (`docker compose up -d`) y borra la carpeta de salida. Rotar `JWT_SECRET` cierra todas las sesiones.

## 6. Contenedores

El compose ya aplica `no-new-privileges`, `cap_drop: ALL`, sistema de archivos de solo lectura (con `tmpfs` en `/tmp` y, en nginx, `/var/cache/nginx` y `/var/run`), y topes de memoria, CPU y procesos. nginx conserva solo `CHOWN`, `SETGID`, `SETUID` y `NET_BIND_SERVICE`, que necesita para abrir el puerto 80 y cambiar a su usuario. Si cambias el puerto publicado o la imagen, vuelve a probar con `docker compose -p zz-test up -d --build` y bájalo con `docker compose -p zz-test down -v`.
