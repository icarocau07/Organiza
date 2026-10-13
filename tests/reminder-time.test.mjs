import test from "node:test";
import assert from "node:assert/strict";
import { decidirLembreteAntecipado as decidir } from "../netlify/lib/reminder-time.mjs";

const vencimento = Date.parse("2026-10-13T15:00:00Z");
const min = 60_000;
test("15 min antes: envia somente depois do instante agendado", () => {
  assert.equal(decidir(vencimento - 16 * min, vencimento, 15), null);
  assert.deepEqual(decidir(vencimento - 15 * min, vencimento, 15), { minutosRestantes: 15 });
  assert.deepEqual(decidir(vencimento - 13 * min, vencimento, 15), { minutosRestantes: 13 });
  assert.equal(decidir(vencimento - 8 * min, vencimento, 15), null);
});
test("nunca envia no horário ou depois", () => {
  for (const lead of [5, 15, 30, 60]) {
    assert.equal(decidir(vencimento, vencimento, lead), null);
    assert.equal(decidir(vencimento + min, vencimento, lead), null);
    assert.equal(decidir(vencimento + 6 * min, vencimento, lead), null);
  }
});
test("5 min antes funciona até imediatamente antes do vencimento", () => {
  assert.deepEqual(decidir(vencimento - 5 * min, vencimento, 5), { minutosRestantes: 5 });
  assert.deepEqual(decidir(vencimento - 20_000, vencimento, 5), { minutosRestantes: 1 });
});
test("datas inválidas ou antecedência inválida não disparam", () => {
  assert.equal(decidir(NaN, vencimento, 15), null);
  assert.equal(decidir(vencimento - 15 * min, vencimento, -1), null);
});
