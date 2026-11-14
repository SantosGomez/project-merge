const { query } = require('../config/db');
const { formatearFechaISO, calcularFechaVencimiento } = require('../utils/dateUtils');
const { hashPassword } = require('../utils/passwordUtils');
const UserModel = require('../models/UserModel');

// Cuentas demo del seed, solo para desarrollo y pruebas: se crean únicamente con SEED_CUENTAS_DEMO=true.
// Sus contraseñas están en el código, así que nunca deben existir en un servidor real.
// Las cuentas del seed se reconocen por su correo (rebanada 5c); el nombre es el mismo de siempre.
const ADMIN_NOMBRE = 'admin_seed';
const ADMIN_CORREO = 'admin_seed@prueba.local';
const ADMIN_PASSWORD = 'Admin1234';
const CONTADOR_NOMBRE = 'contador_seed';
const CONTADOR_CORREO = 'contador_seed@prueba.local';
const CONTADOR_PASSWORD = 'Contador1234';

/**
 * Crea las tablas de la base de datos si no existen: usuarios, casos y sesiones.
 * RF-27.
 */
async function crearTablasSiNoExisten() {
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      correo VARCHAR(150) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      rol ENUM('administrador', 'contador', 'usuarios_de_sistema', 'auxiliar') NOT NULL,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NULL,
      ultimo_acceso_en DATETIME NULL,
      debe_cambiar_contrasena TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY uq_usuarios_correo (correo)
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS casos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contador_id INT NOT NULL,
      cliente VARCHAR(200) NOT NULL,
      estado ENUM('Pendiente', 'En proceso', 'Finalizado') NOT NULL DEFAULT 'Pendiente',
      prioridad ENUM('Alta', 'Media', 'Baja') NOT NULL,
      importante TINYINT(1) NOT NULL DEFAULT 0,
      fecha_inicio DATE NOT NULL,
      fecha_vencimiento DATE NOT NULL,
      descripcion TEXT NULL,
      observaciones TEXT NULL,
      creado_en DATETIME NOT NULL,
      en_proceso_en DATETIME NULL,
      actualizado_en DATETIME NOT NULL,
      FOREIGN KEY (contador_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sesiones (
      jti VARCHAR(255) PRIMARY KEY,
      usuario_id INT NOT NULL,
      ultima_actividad DATETIME NOT NULL,
      revocado TINYINT(1) NOT NULL DEFAULT 0,
      persistente TINYINT(1) NOT NULL DEFAULT 0,
      creado_en DATETIME NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB
  `);

  // Avisos dentro de la app (p. ej. el administrador cambió la prioridad de un caso).
  // Se borran solos con su cuenta o su caso para no bloquear esos borrados.
  await query(`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      caso_id INT NULL,
      mensaje VARCHAR(500) NOT NULL,
      leida TINYINT(1) NOT NULL DEFAULT 0,
      creado_en DATETIME NOT NULL,
      INDEX idx_notificaciones_usuario (usuario_id, leida),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (caso_id) REFERENCES casos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
}

/** Indica si la tabla usuarios todavía tiene la columna `usuario` (bases anteriores a la 5c). */
async function columnaUsuarioExiste() {
  return (await query("SHOW COLUMNS FROM usuarios LIKE 'usuario'")).length > 0;
}

/**
 * Migración de la tabla usuarios al formato con nombre y correo (login por correo).
 * Se puede correr varias veces: solo agrega lo que falta y conserva los datos.
 * En una base anterior, las cuentas sin correo reciben uno de prueba (`usuario@prueba.local`)
 * y después se borra la columna `usuario`, no sin antes copiar la tabla a `usuarios_respaldo_5c`.
 */
async function migrarUsuarios() {
  await query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS nombre VARCHAR(150) NULL AFTER id,
      ADD COLUMN IF NOT EXISTS correo VARCHAR(150) NULL AFTER nombre,
      ADD COLUMN IF NOT EXISTS actualizado_en DATETIME NULL AFTER creado_en,
      ADD COLUMN IF NOT EXISTS ultimo_acceso_en DATETIME NULL AFTER actualizado_en,
      ADD COLUMN IF NOT EXISTS debe_cambiar_contrasena TINYINT(1) NOT NULL DEFAULT 0 AFTER ultimo_acceso_en
  `);

  if (await columnaUsuarioExiste()) {
    await query(`
      UPDATE usuarios
      SET correo = IF(usuario LIKE '%@%', LOWER(usuario), CONCAT(LOWER(usuario), '@prueba.local'))
      WHERE correo IS NULL
    `);
    await query('UPDATE usuarios SET nombre = usuario WHERE nombre IS NULL');

    // El respaldo se toma una sola vez y antes de borrar: si ya existe, se conserva el primero.
    await query('CREATE TABLE IF NOT EXISTS usuarios_respaldo_5c AS SELECT * FROM usuarios');
    await query('ALTER TABLE usuarios DROP COLUMN usuario');
  }

  await query('UPDATE usuarios SET actualizado_en = creado_en WHERE actualizado_en IS NULL');

  await query('CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_correo ON usuarios (correo)');

  // Rol auxiliar (2026-11-10): en minúscula como los demás; también corrige un 'Auxiliar'
  // agregado a mano (la comparación de ENUM no distingue mayúsculas y conserva los datos).
  await query(
    "ALTER TABLE usuarios MODIFY rol ENUM('administrador', 'contador', 'usuarios_de_sistema', 'auxiliar') NOT NULL"
  );
}

/**
 * Verifica si ya existe una cuenta con el correo dado.
 * @param {string} correo - Correo de acceso.
 * @returns {Promise<boolean>} true si existe.
 */
async function cuentaExiste(correo) {
  return (await UserModel.findByCorreo(correo)) !== null;
}

/**
 * Inserta una cuenta con contraseña hasheada usando Argon2id (RNF-1).
 * @param {string} nombre - Nombre visible de la cuenta.
 * @param {string} correo - Correo de acceso.
 * @param {string} password - Contraseña en texto plano.
 * @param {string} rol - Rol de la cuenta.
 */
async function insertarCuenta(nombre, correo, password, rol) {
  // Mismo alta que la API: la cuenta nace con nombre, correo y actualizado_en.
  await UserModel.create({ nombre, correo, passwordHash: await hashPassword(password), rol });
}

/**
 * Indica si se deben sembrar las cuentas demo: solo con SEED_CUENTAS_DEMO igual a 'true' (apagada por defecto).
 * @param {Object} env - Variables de entorno (process.env).
 * @returns {boolean} true si hay que crear admin_seed y contador_seed.
 */
function debeSembrarCuentasDemo(env) {
  return env.SEED_CUENTAS_DEMO === 'true';
}

/**
 * Seed de datos maestros: crea las tablas y migra la de usuarios. Las cuentas demo (un administrador y un
 * contador con contraseñas hasheadas) solo se crean si se piden; si ya existen no hace nada (idempotente). RF-27.
 * @param {{ cuentasDemo?: boolean }} [opciones] - cuentasDemo: por defecto sale de SEED_CUENTAS_DEMO.
 */
async function seedDatabase({ cuentasDemo = debeSembrarCuentasDemo(process.env) } = {}) {
  await crearTablasSiNoExisten();
  await migrarUsuarios();
  await migrarCasos();
  await migrarSesiones();
  await migrarAuditorias();
  await migrarContadorAuxiliar();
  await migrarClientesYTiposActividad();
  await migrarCarteraYActividadesMes();
  await migrarVencimientoDeTipos();
  await migrarRegistrosTiempo();

  if (!cuentasDemo) return;

  if (!(await cuentaExiste(ADMIN_CORREO))) {
    await insertarCuenta(ADMIN_NOMBRE, ADMIN_CORREO, ADMIN_PASSWORD, 'administrador');
  }

  if (!(await cuentaExiste(CONTADOR_CORREO))) {
    await insertarCuenta(CONTADOR_NOMBRE, CONTADOR_CORREO, CONTADOR_PASSWORD, 'contador');
  }
}

/**
 * Migra los casos anteriores a las columnas de fechas, descripción y observaciones.
 * Corre siempre al arrancar (no depende de las cuentas demo) y es idempotente:
 * - sin fecha de inicio: se usa el día en que se creó el caso;
 * - sin vencimiento: se calcula desde la fecha de inicio según la prioridad (días hábiles);
 * - un caso con ambas fechas no se toca.
 * Al final las dos fechas quedan obligatorias, como en una base nueva.
 */
async function migrarCasos() {
  // Añade las columnas si la tabla vieja no las tiene (sin NOT NULL todavía)
  await query('ALTER TABLE casos ADD IF NOT EXISTS fecha_inicio DATE DEFAULT NULL AFTER prioridad');
  await query('ALTER TABLE casos ADD IF NOT EXISTS fecha_vencimiento DATE DEFAULT NULL AFTER fecha_inicio');
  await query('ALTER TABLE casos ADD IF NOT EXISTS descripcion TEXT NULL AFTER fecha_vencimiento');
  await query('ALTER TABLE casos ADD IF NOT EXISTS observaciones TEXT NULL AFTER descripcion');

  const pendientes = await query(
    'SELECT id, prioridad, creado_en, fecha_inicio FROM casos WHERE fecha_inicio IS NULL OR fecha_vencimiento IS NULL'
  );
  for (const caso of pendientes) {
    // mysql2 entrega DATE y DATETIME como fechas locales: se toma el día sin desplazarlo
    const inicio = caso.fecha_inicio ?? caso.creado_en;
    await query('UPDATE casos SET fecha_inicio = ?, fecha_vencimiento = ? WHERE id = ?', [
      formatearFechaISO(inicio),
      calcularFechaVencimiento(inicio, caso.prioridad),
      caso.id,
    ]);
  }

  // Solo se vuelven obligatorias si aún aceptan vacío y ya no queda ninguna vacía:
  // MariaDB sin modo estricto convertiría un NULL en una fecha 0000-00-00.
  const [{ opcionales }] = await query(
    "SELECT COUNT(*) AS opcionales FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'casos' AND COLUMN_NAME IN ('fecha_inicio', 'fecha_vencimiento') AND IS_NULLABLE = 'YES'"
  );
  const [{ vacias }] = await query(
    'SELECT COUNT(*) AS vacias FROM casos WHERE fecha_inicio IS NULL OR fecha_vencimiento IS NULL'
  );
  if (Number(opcionales) > 0 && Number(vacias) === 0) {
    await query('ALTER TABLE casos MODIFY fecha_inicio DATE NOT NULL, MODIFY fecha_vencimiento DATE NOT NULL');
  }

  await migrarImportanteYEnProceso();
}

/**
 * Deja las columnas `importante` y `en_proceso_en` de la tabla casos. Es idempotente.
 * - `Importante` (agregada a mano, sin valor por defecto) pasa a `importante` con 0 por defecto.
 * - `en_proceso_at` (TIMESTAMP con ON UPDATE: cambiaba con cualquier edición) pasa a
 *   `en_proceso_en` DATETIME vacía; los casos que ya están «En proceso» toman su
 *   `actualizado_en` como mejor aproximación y los demás quedan vacíos.
 */
async function migrarImportanteYEnProceso() {
  await query('ALTER TABLE casos ADD IF NOT EXISTS importante TINYINT(1) NOT NULL DEFAULT 0 AFTER prioridad');
  const [importante] = await query("SHOW COLUMNS FROM casos WHERE Field = 'importante'");
  if (importante.Field !== 'importante' || importante.Default !== '0') {
    await query('ALTER TABLE casos CHANGE importante importante TINYINT(1) NOT NULL DEFAULT 0');
  }

  const [anterior] = await query("SHOW COLUMNS FROM casos WHERE Field = 'en_proceso_at'");
  if (anterior) {
    await query('ALTER TABLE casos CHANGE en_proceso_at en_proceso_en DATETIME NULL DEFAULT NULL');
    await query("UPDATE casos SET en_proceso_en = IF(estado = 'En proceso', actualizado_en, NULL)");
  }
  await query('ALTER TABLE casos ADD IF NOT EXISTS en_proceso_en DATETIME NULL AFTER creado_en');
}

/**
 * Sesión persistente («Mantener sesión iniciada»): las sesiones que ya existían quedan
 * como no persistentes (30 min de inactividad). Idempotente.
 */
async function migrarSesiones() {
  await query(
    'ALTER TABLE sesiones ADD COLUMN IF NOT EXISTS persistente TINYINT(1) NOT NULL DEFAULT 0 AFTER revocado'
  );
}

// Las 6 fases del boceto de auditorías (iguales para todos los tipos de auditoría).
const FASES_AUDITORIA = [
  [1, 'Fase 1 · Notificación / inicio', 'La autoridad notifica la orden, el oficio de requerimiento o la resolución provisional.'],
  [2, 'Fase 2 · Requerimientos y desarrollo', 'Se piden y entregan información y documentos; actas parciales y requerimientos adicionales.'],
  [3, 'Fase 3 · Observaciones', 'Última acta parcial u oficio de observaciones con los hechos u omisiones detectados.'],
  [4, 'Fase 4 · Aclaración / desvirtuar', 'Escritos y pruebas, autocorrección o acuerdo conclusivo.'],
  [5, 'Fase 5 · Conclusión / resolución', 'Acta final, oficio de conclusión o resolución determinante.'],
  [6, 'Fase 6 · Post-resolución (pago o defensa)', 'Pago o garantía del crédito, recurso de revocación o juicio de nulidad.'],
];

async function tablaExiste(nombre) {
  const [{ total }] = await query(
    'SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [nombre]
  );
  return Number(total) > 0;
}

async function columnaExiste(tabla, columna) {
  const [{ total }] = await query(
    'SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [tabla, columna]
  );
  return Number(total) > 0;
}

/**
 * Retira una tabla de la beta de auditorías con el esquema anterior: si está vacía se borra;
 * si tiene datos se renombra a `<tabla>_respaldo_beta` para no perderlos.
 */
async function retirarTablaBeta(nombre) {
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM \`${nombre}\``);
  if (Number(total) === 0) {
    await query(`DROP TABLE \`${nombre}\``);
  } else {
    await query(`RENAME TABLE \`${nombre}\` TO \`${nombre}_respaldo_beta\``);
  }
}

/**
 * Tablas del módulo de auditorías (rebanada 1). Idempotente:
 * - una base con el esquema de la beta (sin CreadoPor / CreadoEn, o con `aud-conta`) lo retira primero;
 * - crea `fases_aud`, `auditorias`, `auditoria_dtl` (bitácora) y `aud_conta` (contadores asignados);
 * - siembra las 6 fases sin tocar las que ya existan.
 */
async function migrarAuditorias() {
  if (await tablaExiste('aud-conta')) await retirarTablaBeta('aud-conta');
  if ((await tablaExiste('auditoria_dtl')) && !(await columnaExiste('auditoria_dtl', 'CreadoEn'))) {
    await retirarTablaBeta('auditoria_dtl');
  }
  if ((await tablaExiste('auditorias')) && !(await columnaExiste('auditorias', 'CreadoPor'))) {
    await retirarTablaBeta('auditorias');
  }

  await query(`
    CREATE TABLE IF NOT EXISTS fases_aud (
      IdFase INT AUTO_INCREMENT PRIMARY KEY,
      Fase VARCHAR(50) NOT NULL,
      Descripcion VARCHAR(200) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS auditorias (
      IdAuditoria INT AUTO_INCREMENT PRIMARY KEY,
      Cliente VARCHAR(100) NOT NULL,
      No_Expediente VARCHAR(100) NOT NULL,
      Dependencia VARCHAR(200) NOT NULL,
      TipoAud VARCHAR(200) NOT NULL,
      Estatal TINYINT(1) NOT NULL DEFAULT 0,
      FechaPeriodo_inicio DATE NOT NULL,
      FechaPeriodo_final DATE NOT NULL,
      Estado ENUM('Pendiente', 'En Proceso', 'Completado', 'Aplazado por acta') NOT NULL DEFAULT 'Pendiente',
      FechaInicio DATE NOT NULL,
      FechaVencimiento DATE NOT NULL,
      Descripcion TEXT NULL,
      Observacion TEXT NULL,
      CreadoPor INT NOT NULL,
      CreadoEn DATETIME NOT NULL,
      ActualizadoEn DATETIME NOT NULL,
      CONSTRAINT fk_auditorias_creado_por FOREIGN KEY (CreadoPor) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Bitácora de la auditoría: cada oficio, requerimiento o acta es un renglón.
  await query(`
    CREATE TABLE IF NOT EXISTS auditoria_dtl (
      Id_AudDtl INT AUTO_INCREMENT PRIMARY KEY,
      AudHdr_Id INT NOT NULL,
      Contador_id INT NOT NULL,
      Folio_Actas VARCHAR(200) NULL,
      Evento VARCHAR(200) NOT NULL,
      Fecha DATE NOT NULL,
      FechaLimite DATE NULL,
      FechaEntrega DATE NULL,
      Descripcion TEXT NULL,
      Fase_Id INT NOT NULL,
      Estado ENUM('Pendiente', 'Revision', 'En Proceso', 'Rechazado', 'Completado') NOT NULL DEFAULT 'Pendiente',
      Observaciones TEXT NULL,
      CreadoEn DATETIME NOT NULL,
      INDEX idx_auditoria_dtl_auditoria (AudHdr_Id, Fecha),
      CONSTRAINT fk_auditoria_dtl_auditoria FOREIGN KEY (AudHdr_Id) REFERENCES auditorias(IdAuditoria) ON DELETE CASCADE,
      CONSTRAINT fk_auditoria_dtl_contador FOREIGN KEY (Contador_id) REFERENCES usuarios(id),
      CONSTRAINT fk_auditoria_dtl_fase FOREIGN KEY (Fase_Id) REFERENCES fases_aud(IdFase)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS aud_conta (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      IdAuditoria INT NOT NULL,
      IdContador INT NOT NULL,
      AsignadoEn DATETIME NOT NULL,
      UNIQUE KEY uq_aud_conta (IdAuditoria, IdContador),
      CONSTRAINT fk_aud_conta_auditoria FOREIGN KEY (IdAuditoria) REFERENCES auditorias(IdAuditoria) ON DELETE CASCADE,
      CONSTRAINT fk_aud_conta_contador FOREIGN KEY (IdContador) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Chat de la auditoría: mensajes entre el administrador y los contadores asignados.
  await query(`
    CREATE TABLE IF NOT EXISTS auditoria_mensajes (
      IdMensaje INT AUTO_INCREMENT PRIMARY KEY,
      IdAuditoria INT NOT NULL,
      IdUsuario INT NOT NULL,
      Mensaje VARCHAR(1000) NOT NULL,
      CreadoEn DATETIME NOT NULL,
      INDEX idx_auditoria_mensajes_auditoria (IdAuditoria, IdMensaje),
      CONSTRAINT fk_auditoria_mensajes_auditoria FOREIGN KEY (IdAuditoria) REFERENCES auditorias(IdAuditoria) ON DELETE CASCADE,
      CONSTRAINT fk_auditoria_mensajes_usuario FOREIGN KEY (IdUsuario) REFERENCES usuarios(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  for (const [id, fase, descripcion] of FASES_AUDITORIA) {
    await query('INSERT IGNORE INTO fases_aud (IdFase, Fase, Descripcion) VALUES (?, ?, ?)', [id, fase, descripcion]);
  }
}

/**
 * Tabla de unión contador ↔ auxiliares (muchos a muchos entre contadores).
 * Un contador puede tener varios auxiliares; cada auxiliar también es contador.
 * Idempotente: se puede correr varias veces sin fallar.
 */
async function migrarContadorAuxiliar() {
  await query(`
    CREATE TABLE IF NOT EXISTS contador_auxiliar (
      contador_id INT NOT NULL,
      auxiliar_id INT NOT NULL,
      asignado_en DATETIME NOT NULL,
      PRIMARY KEY (contador_id, auxiliar_id),
      CONSTRAINT fk_ca_contador FOREIGN KEY (contador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      CONSTRAINT fk_ca_auxiliar FOREIGN KEY (auxiliar_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
}

/**
 * Tablas de «Mi trabajo > Mis actividades» (rebanada 10): los clientes y los tipos de actividad
 * son propios de cada contador o auxiliar. El nombre es único por usuario y, con la colación
 * `_ci`, sin distinguir mayúsculas ni acentos. Se borran en cascada con su cuenta. Idempotente.
 */
async function migrarClientesYTiposActividad() {
  await query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      rfc VARCHAR(13) NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en DATETIME NOT NULL,
      UNIQUE KEY uq_clientes_usuario_nombre (usuario_id, nombre),
      CONSTRAINT fk_clientes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tipos_actividad (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      nombre VARCHAR(120) NOT NULL,
      cobrable TINYINT(1) NOT NULL DEFAULT 0,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en DATETIME NOT NULL,
      UNIQUE KEY uq_tipos_actividad_usuario_nombre (usuario_id, nombre),
      CONSTRAINT fk_tipos_actividad_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
}

/**
 * Tablas de la cartera por tipo y la lista del mes (rebanada 11). `cartera_actividad` dice qué clientes
 * lleva cada usuario en cada tipo de actividad; `actividades_mes` guarda solo los renglones marcados como
 * hechos (lo pendiente no ocupa filas). Se borran en cascada con la cuenta, el cliente o el tipo. Idempotente.
 */
async function migrarCarteraYActividadesMes() {
  await query(`
    CREATE TABLE IF NOT EXISTS cartera_actividad (
      usuario_id INT NOT NULL,
      cliente_id INT NOT NULL,
      tipo_id INT NOT NULL,
      creado_en DATETIME NOT NULL,
      PRIMARY KEY (cliente_id, tipo_id),
      KEY idx_cartera_tipo (tipo_id),
      KEY idx_cartera_usuario (usuario_id),
      CONSTRAINT fk_cartera_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      CONSTRAINT fk_cartera_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
      CONSTRAINT fk_cartera_tipo FOREIGN KEY (tipo_id) REFERENCES tipos_actividad(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS actividades_mes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      cliente_id INT NOT NULL,
      tipo_id INT NOT NULL,
      mes CHAR(7) NOT NULL,
      estado ENUM('pendiente', 'hecha') NOT NULL DEFAULT 'pendiente',
      hecha_en DATETIME NULL,
      UNIQUE KEY uq_actividades_mes (cliente_id, tipo_id, mes),
      KEY idx_actividades_usuario_mes (usuario_id, mes),
      CONSTRAINT fk_actividades_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      CONSTRAINT fk_actividades_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
      CONSTRAINT fk_actividades_tipo FOREIGN KEY (tipo_id) REFERENCES tipos_actividad(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
}

/**
 * Regla de vencimiento de cada tipo de actividad (rebanada 12). Los tipos que ya existían quedan en
 * `ninguna` (sin fecha). `dia_del_mes` solo se llena con la regla `dia_del_mes`. Idempotente.
 */
async function migrarVencimientoDeTipos() {
  await query(
    "ALTER TABLE tipos_actividad ADD COLUMN IF NOT EXISTS regla_vencimiento ENUM('ninguna', 'dia_del_mes', 'fin_de_mes', 'dia_17_rfc') NOT NULL DEFAULT 'ninguna'"
  );
  await query('ALTER TABLE tipos_actividad ADD COLUMN IF NOT EXISTS dia_del_mes TINYINT NULL');
}

/**
 * Bloques de tiempo del cronómetro (rebanada 14). `fin` NULL significa cronómetro en marcha (a lo más uno
 * por usuario, lo garantiza el modelo con transacción). `cobrable` es copia del tipo al crear el bloque.
 * Se borran en cascada con la cuenta, el cliente o el tipo. Idempotente.
 */
async function migrarRegistrosTiempo() {
  await query(`
    CREATE TABLE IF NOT EXISTS registros_tiempo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      cliente_id INT NOT NULL,
      tipo_id INT NOT NULL,
      mes CHAR(7) NOT NULL,
      inicio DATETIME NOT NULL,
      fin DATETIME NULL,
      minutos INT NULL,
      cobrable TINYINT(1) NOT NULL DEFAULT 0,
      manual TINYINT(1) NOT NULL DEFAULT 0,
      KEY idx_registros_usuario_mes (usuario_id, mes),
      KEY idx_registros_renglon (cliente_id, tipo_id, mes),
      CONSTRAINT fk_registros_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      CONSTRAINT fk_registros_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
      CONSTRAINT fk_registros_tipo FOREIGN KEY (tipo_id) REFERENCES tipos_actividad(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
}

module.exports = { seedDatabase, debeSembrarCuentasDemo };