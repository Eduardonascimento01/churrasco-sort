// teste.js · Confere as regras sem abrir o navegador. Rode: node teste.js
const R = require("./regras.js");
let ok = 0;
function confere(nome, condicao) {
  if (!condicao) { console.error("FALHOU:", nome); process.exitCode = 1; return; }
  ok++;
}

confere("3 iguais é trio", R.temTrio(["milho", "milho", "milho"]));
confere("2 iguais + vazio não é trio", !R.temTrio(["milho", "milho", null]));
confere("3 vazios não é trio", !R.temTrio([null, null, null]));
confere("diferentes não é trio", !R.temTrio(["milho", "milho", "coxa"]));

const g = R.criarFase();
confere("fase inicial tem solução", R.temSolucao(g));
confere("não move para lugar ocupado", !R.mover(g, { g: 0, l: 0 }, { g: 0, l: 1 }));
confere("não move de lugar vazio", !R.mover(g, { g: 1, l: 2 }, { g: 3, l: 0 }));
confere("move para lugar vazio", R.mover(g, { g: 0, l: 1 }, { g: 1, l: 2 }) && g[1][2] === "coxa" && g[0][1] === null);

// Resolve a fase inteira, provando que ela tem saída.
const f = R.criarFase();
const passos = [
  [{ g: 0, l: 1 }, { g: 1, l: 2 }], // coxa sai da grelha 0
  [{ g: 2, l: 1 }, { g: 0, l: 1 }], // milho completa a grelha 0
  [{ g: 1, l: 1 }, { g: 3, l: 0 }], // espeto para a grelha 3
  [{ g: 2, l: 0 }, { g: 3, l: 2 }], // espeto completa a grelha 3
  [{ g: 2, l: 2 }, { g: 1, l: 1 }], // coxa completa a grelha 1
];
let limpas = 0;
for (const [de, para] of passos) {
  if (!R.mover(f, de, para)) { confere("passo válido", false); break; }
  limpas += R.limparSeTrio(f, para.g);
}
confere("resolvendo, limpa as 9 comidas", limpas === 9);
confere("e vence", R.venceu(f));

console.log(`${ok} conferências ok`);
