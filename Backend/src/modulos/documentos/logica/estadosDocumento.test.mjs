// Pruebas de las reglas para cambiar el estado de un documento (2026-11-04).
// Reglas acordadas con el usuario:
//   · «En proceso» desde «Recepcionado» solo por Direccionamiento (entrega firmada).
//   · Cambia el estado el contador asignado al documento, o Administrador/Sistemas.
//   · Se puede reabrir un completado y reactivar un cancelado (vuelven a En proceso).
//   · Nada vuelve a «Recepcionado».

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  esResponsable,
  motivoTransicionInvalida,
  estadosPermitidos,
} from './estadosDocumento.mjs';

const ASIGNADO = { id: 9, rol: 'Contador' };
const OTRO_CONTADOR = { id: 4, rol: 'Contador' };
const ADMIN = { id: 1, rol: 'Administrador' };
const SISTEMAS = { id: 2, rol: 'Sistemas' };
const PRACTICANTE = { id: 5, rol: 'Practicante' };

const doc = (estado, contadorId = 9) => ({ estado, contadorId });

describe('esResponsable', () => {
  test('el contador asignado al documento sí', () => {
    assert.equal(esResponsable(doc('EN_PROCESO'), ASIGNADO), true);
  });

  test('⚠️ otro contador no, aunque tenga el permiso general de cambiar estados', () => {
    assert.equal(esResponsable(doc('EN_PROCESO'), OTRO_CONTADOR), false);
  });

  test('Administrador y Sistemas sí, sin estar asignados', () => {
    assert.equal(esResponsable(doc('EN_PROCESO'), ADMIN), true);
    assert.equal(esResponsable(doc('EN_PROCESO'), SISTEMAS), true);
  });

  test('un documento sin contador solo lo cambia Administrador o Sistemas', () => {
    assert.equal(esResponsable(doc('EN_PROCESO', null), ASIGNADO), false);
    assert.equal(esResponsable(doc('EN_PROCESO', null), ADMIN), true);
  });

  test('un rol sin permiso no, aunque su id coincida con el del contador', () => {
    assert.equal(esResponsable(doc('EN_PROCESO', 5), PRACTICANTE), false);
  });

  test('el id se compara como número: la sesión y la base pueden traerlo distinto', () => {
    assert.equal(esResponsable(doc('EN_PROCESO', '9'), ASIGNADO), true);
  });
});

describe('motivoTransicionInvalida', () => {
  const permitidas = [
    ['EN_PROCESO', 'PENDIENTE_CLIENTE'],
    ['EN_PROCESO', 'COMPLETADO'],
    ['EN_PROCESO', 'CANCELADO'],
    ['PENDIENTE_CLIENTE', 'EN_PROCESO'],
    ['PENDIENTE_CLIENTE', 'COMPLETADO'],
    ['PENDIENTE_CLIENTE', 'CANCELADO'],
    ['COMPLETADO', 'EN_PROCESO'],
    ['COMPLETADO', 'CANCELADO'],
    ['CANCELADO', 'EN_PROCESO'],
  ];

  test('los cambios acordados están permitidos', () => {
    for (const [desde, hacia] of permitidas) {
      assert.equal(motivoTransicionInvalida(desde, hacia), null, `${desde} → ${hacia}`);
    }
  });

  test('⚠️ de Recepcionado no se sale desde aquí: la entrega es en Direccionamiento', () => {
    for (const hacia of ['EN_PROCESO', 'PENDIENTE_CLIENTE', 'COMPLETADO', 'CANCELADO']) {
      assert.match(motivoTransicionInvalida('RECEPCIONADO', hacia), /Direccionamiento/, hacia);
    }
  });

  test('nada vuelve a Recepcionado', () => {
    for (const desde of ['EN_PROCESO', 'PENDIENTE_CLIENTE', 'COMPLETADO', 'CANCELADO']) {
      assert.match(motivoTransicionInvalida(desde, 'RECEPCIONADO'), /Recepcionado/, desde);
    }
  });

  test('lo que no está en la lista se rechaza con un motivo legible', () => {
    for (const [desde, hacia] of [
      ['CANCELADO', 'COMPLETADO'],
      ['CANCELADO', 'PENDIENTE_CLIENTE'],
      ['COMPLETADO', 'PENDIENTE_CLIENTE'],
    ]) {
      assert.equal(typeof motivoTransicionInvalida(desde, hacia), 'string', `${desde} → ${hacia}`);
    }
  });

  test('el mismo estado no es un cambio', () => {
    assert.match(motivoTransicionInvalida('EN_PROCESO', 'EN_PROCESO'), /ya tiene ese estado/);
  });
});

describe('estadosPermitidos (lo que el Dashboard ofrece en la lista)', () => {
  test('al contador asignado le ofrece los cambios de su estado', () => {
    assert.deepEqual(estadosPermitidos(doc('EN_PROCESO'), ASIGNADO), [
      'PENDIENTE_CLIENTE',
      'COMPLETADO',
      'CANCELADO',
    ]);
    assert.deepEqual(estadosPermitidos(doc('CANCELADO'), ADMIN), ['EN_PROCESO']);
  });

  test('a quien no es responsable no le ofrece nada', () => {
    assert.deepEqual(estadosPermitidos(doc('EN_PROCESO'), OTRO_CONTADOR), []);
  });

  test('un recepcionado no ofrece nada, ni al Administrador', () => {
    assert.deepEqual(estadosPermitidos(doc('RECEPCIONADO', null), ADMIN), []);
  });

  test('no devuelve la lista interna: quien llame no puede cambiar la regla', () => {
    const lista = estadosPermitidos(doc('EN_PROCESO'), ASIGNADO);
    lista.push('RECEPCIONADO');
    assert.ok(!estadosPermitidos(doc('EN_PROCESO'), ASIGNADO).includes('RECEPCIONADO'));
  });
});

test('el módulo no importa nada: el Frontend lo carga tal cual', async () => {
  const fuente = await readFile(new URL('./estadosDocumento.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /^\s*import\s/m);
});
