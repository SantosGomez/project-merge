// Semilla única de la maqueta: cuentas, contadores y casos de ejemplo.
// Todos los datos son ficticios (no hay personas reales del equipo) y viven solo en memoria.
// El contenido cumple el mínimo de RF-45 y lo verifica test/exampleData.test.js.

/**
 * Cuentas de ejemplo. El perfil se resuelve por la cuenta con la que se inicia sesión,
 * nunca eligiéndolo a mano. La cuenta contador apunta al contador del equipo que la usa.
 */
export const exampleAccounts = [
  { username: 'admin', password: 'admin123', profile: 'administrador', counterId: null },
  { username: 'contador', password: 'contador123', profile: 'contador', counterId: 'c-01' },
]

/**
 * Contadores del equipo. Siempre incluye al contador de la cuenta `contador` (c-01).
 * El nombre de `c-06` es largo y lleva caracteres especiales a propósito (RNF-9).
 */
export const exampleCounters = [
  { id: 'c-01', name: 'contador' },
  { id: 'c-02', name: 'Ana Lucía Bermúdez' },
  { id: 'c-03', name: 'Carlos Andrés Peña' },
  { id: 'c-04', name: 'Diana Marcela Ortega' },
  { id: 'c-05', name: 'Eduardo Ramírez' },
  { id: 'c-06', name: 'José Ramón Álvarez de la Peña y Cía.' },
  { id: 'c-07', name: 'Fernanda Quintero' },
  { id: 'c-08', name: 'Gabriel Esteban Muñoz' },
  { id: 'c-09', name: 'Héctor Iván Salazar' },
  { id: 'c-10', name: 'Isabel Cristina Duarte' },
  { id: 'c-11', name: 'Julián Camilo Restrepo' },
  { id: 'c-12', name: 'Karla Sofía Méndez' },
  { id: 'c-13', name: 'Luis Fernando Aguilar' },
  { id: 'c-14', name: 'Mónica Patricia Vega' },
  { id: 'c-15', name: 'Néstor Alejandro Cifuentes' },
]

/**
 * Casos de ejemplo. `c-01` (la cuenta `contador`) empieza sin casos, para poder ver
 * los conteos en "0" y los estados vacíos. `c-02` acumula los tres estados y filas
 * suficientes para que las listas exijan desplazamiento vertical. El caso `case-15`
 * tiene cliente de nombre largo con caracteres especiales.
 */
export const exampleCases = [
  {
    id: 'case-01',
    client: 'Panadería La Espiga',
    status: 'pendiente',
    priority: 'alta',
    counterId: 'c-02',
  },
  {
    id: 'case-02',
    client: 'Ferretería Los Pinos',
    status: 'en_proceso',
    priority: 'media',
    counterId: 'c-02',
  },
  {
    id: 'case-03',
    client: 'Clínica Santa Elena',
    status: 'finalizado',
    priority: 'baja',
    counterId: 'c-02',
  },
  {
    id: 'case-04',
    client: 'Transportes Rápido Andino',
    status: 'pendiente',
    priority: 'media',
    counterId: 'c-02',
  },
  {
    id: 'case-05',
    client: 'Cafetería El Aromo',
    status: 'en_proceso',
    priority: 'alta',
    counterId: 'c-02',
  },
  {
    id: 'case-06',
    client: 'Constructora Valle Verde',
    status: 'finalizado',
    priority: 'media',
    counterId: 'c-02',
  },
  {
    id: 'case-07',
    client: 'Boutique Azalea',
    status: 'pendiente',
    priority: 'baja',
    counterId: 'c-02',
  },
  {
    id: 'case-08',
    client: 'Hotel Mirador del Lago',
    status: 'en_proceso',
    priority: 'baja',
    counterId: 'c-02',
  },
  {
    id: 'case-09',
    client: 'Distribuidora AgroSur',
    status: 'finalizado',
    priority: 'alta',
    counterId: 'c-02',
  },
  {
    id: 'case-10',
    client: 'Estudio Jurídico Peña & Asociados',
    status: 'pendiente',
    priority: 'alta',
    counterId: 'c-02',
  },
  {
    id: 'case-11',
    client: 'Óptica Visión Clara',
    status: 'en_proceso',
    priority: 'media',
    counterId: 'c-02',
  },
  {
    id: 'case-12',
    client: 'Restaurante Sabor Criollo',
    status: 'finalizado',
    priority: 'baja',
    counterId: 'c-02',
  },
  {
    id: 'case-13',
    client: 'Mueblería Casa Nueva',
    status: 'pendiente',
    priority: 'media',
    counterId: 'c-02',
  },
  {
    id: 'case-14',
    client: 'Imprenta Gráfica Aurora',
    status: 'en_proceso',
    priority: 'alta',
    counterId: 'c-02',
  },
  {
    id: 'case-15',
    client: 'Asociación de Comerciantes Nueva Esperanza — Sección Ñaña & Cía. Ltda.',
    status: 'finalizado',
    priority: 'media',
    counterId: 'c-02',
  },
  {
    id: 'case-16',
    client: 'Textiles del Norte S.A.',
    status: 'pendiente',
    priority: 'alta',
    counterId: 'c-03',
  },
  {
    id: 'case-17',
    client: 'Floristería Jardín Andino',
    status: 'en_proceso',
    priority: 'media',
    counterId: 'c-03',
  },
  {
    id: 'case-18',
    client: 'Supermercado El Trigal',
    status: 'finalizado',
    priority: 'baja',
    counterId: 'c-04',
  },
  {
    id: 'case-19',
    client: 'Taller Mecánico Rueda Libre',
    status: 'pendiente',
    priority: 'media',
    counterId: 'c-04',
  },
  {
    id: 'case-20',
    client: 'Veterinaria Patitas Felices',
    status: 'en_proceso',
    priority: 'alta',
    counterId: 'c-04',
  },
  {
    id: 'case-21',
    client: 'Papelería El Lápiz Rojo',
    status: 'pendiente',
    priority: 'baja',
    counterId: 'c-05',
  },
  {
    id: 'case-22',
    client: 'Gimnasio Fuerza Vital',
    status: 'en_proceso',
    priority: 'media',
    counterId: 'c-05',
  },
  {
    id: 'case-23',
    client: 'Farmacia San Martín',
    status: 'finalizado',
    priority: 'alta',
    counterId: 'c-06',
  },
  {
    id: 'case-24',
    client: 'Joyería Brillo de Plata',
    status: 'pendiente',
    priority: 'media',
    counterId: 'c-06',
  },
  {
    id: 'case-25',
    client: 'Dulcería La Colmena',
    status: 'en_proceso',
    priority: 'baja',
    counterId: 'c-07',
  },
  {
    id: 'case-26',
    client: 'Constructora Camino Real',
    status: 'pendiente',
    priority: 'alta',
    counterId: 'c-08',
  },
  {
    id: 'case-27',
    client: 'Seguros Confianza Total',
    status: 'finalizado',
    priority: 'media',
    counterId: 'c-08',
  },
  {
    id: 'case-28',
    client: 'Pescadería Mar Abierto',
    status: 'en_proceso',
    priority: 'alta',
    counterId: 'c-09',
  },
  {
    id: 'case-29',
    client: 'Librería Página Viva',
    status: 'pendiente',
    priority: 'baja',
    counterId: 'c-10',
  },
  {
    id: 'case-30',
    client: 'Salón de Belleza Luz de Luna',
    status: 'finalizado',
    priority: 'media',
    counterId: 'c-10',
  },
  {
    id: 'case-31',
    client: 'Transportes Carga Pesada',
    status: 'en_proceso',
    priority: 'media',
    counterId: 'c-11',
  },
  {
    id: 'case-32',
    client: 'Boutique Hilo Dorado',
    status: 'pendiente',
    priority: 'alta',
    counterId: 'c-12',
  },
  {
    id: 'case-33',
    client: 'Heladería Frío Delicioso',
    status: 'finalizado',
    priority: 'baja',
    counterId: 'c-12',
  },
  {
    id: 'case-34',
    client: 'Panadería Trigo de Oro',
    status: 'en_proceso',
    priority: 'baja',
    counterId: 'c-13',
  },
  {
    id: 'case-35',
    client: 'Clínica Dental Sonrisa Sana',
    status: 'pendiente',
    priority: 'media',
    counterId: 'c-14',
  },
  {
    id: 'case-36',
    client: 'Agropecuaria Campo Fértil',
    status: 'finalizado',
    priority: 'alta',
    counterId: 'c-15',
  },
  {
    id: 'case-37',
    client: 'Marmolería Piedra Firme',
    status: 'en_proceso',
    priority: 'media',
    counterId: 'c-15',
  },
]
