// teste.js · Confere as regras sem abrir o navegador. Rode: node teste.js
const R = require("./regras.js");
let ok = 0;
function confere(nome, condicao) {
  if (!condicao) { console.error("FALHOU:", nome); process.exitCode = 1; return; }
  ok++;
}

// ---- O juiz do trio ----
confere("3 iguais é trio", R.temTrio([["milho", "milho", "milho"]]));
confere("2 iguais + vazio não é trio", !R.temTrio([["milho", "milho", null]]));
confere("3 vazios não é trio", !R.temTrio([[null, null, null]]));
confere("diferentes não é trio", !R.temTrio([["milho", "milho", "coxa"]]));
confere("trio só conta na frente", !R.temTrio([["coxa", null, null], ["milho", "milho", "milho"]]));

// ---- Mover ----
let g = R.criarFase();
confere("fase inicial: múltiplo de 3", R.temSolucao(g));
confere("não move para lugar ocupado", !R.mover(g, { g: 0, l: 0 }, { g: 0, l: 1 }));
confere("não move de lugar vazio", !R.mover(g, { g: 1, l: 2 }, { g: 3, l: 0 }));
confere("move para lugar vazio", R.mover(g, { g: 0, l: 1 }, { g: 1, l: 2 }) && g[1][0][2] === "coxa");

// ---- Camadas ----
g = [[["milho", null, null], ["coxa", "coxa", "coxa"]], [[null, null, null]]];
R.mover(g, { g: 0, l: 0 }, { g: 1, l: 0 });
confere("tirar a última da frente faz a bandeja subir", g[0].length === 1 && g[0][0][0] === "coxa");

g = [[["milho", "milho", null], ["coxa", "coxa", "coxa"], ["ovo", null, null]], [["milho", null, null]]];
R.mover(g, { g: 1, l: 0 }, { g: 0, l: 2 });
const saiu = R.limparSeTrio(g, 0);
confere("trio que sobe já pronto também limpa (em cadeia)", saiu === 6 && R.frente(g[0])[0] === "ovo");

// ---- Etapa 4: sorteio com semente e fases geradas ----
const s1 = R.sorteador(42), s2 = R.sorteador(42);
confere("mesma semente, mesmos números", s1() === s2() && s1() === s2());
confere("fase gerada é sempre a mesma", JSON.stringify(R.gerarFase(5).grelhas) === JSON.stringify(R.gerarFase(5).grelhas));

const t0 = Date.now();
const linhas = [];
for (let n = 1; n <= 15; n++) {
  const t = Date.now();
  const f = R.gerarFase(n);
  const total = Object.values(R.contar(f.grelhas)).reduce((a, b) => a + b, 0);
  const r = f.receita;
  confere(`fase ${n}: tem solução`, f.solucao !== null);
  confere(`fase ${n}: múltiplo de 3`, R.temSolucao(f.grelhas));
  confere(`fase ${n}: ${r.tipos * r.trios * 3} comidas`, total === r.tipos * r.trios * 3);
  confere(`fase ${n}: não começa com trio pronto`, !f.grelhas.some(R.temTrio));
  if (f.solucao) {
    const jogo = R.copiar(f.grelhas);
    for (const [a, la, b, lb] of f.solucao) { R.mover(jogo, { g: a, l: la }, { g: b, l: lb }); R.limparSeTrio(jogo, b); R.limparSeTrio(jogo, a); }
    confere(`fase ${n}: jogando a solução, vence`, R.venceu(jogo));
  }
  linhas.push(`  fase ${String(n).padStart(2)}: ${r.tipos} tipos, ${total} comidas, ${r.grelhas} grelhas, ${r.vagas} vagas, ${Math.floor(r.tempo / 60)}:${String(r.tempo % 60).padStart(2, "0")} · solução em ${f.solucao ? f.solucao.length : "?"} jogadas · sorteio nº ${f.tentativa} · ${Date.now() - t} ms`);
}
console.log(linhas.join("\n"));
console.log(`  (15 fases geradas em ${Date.now() - t0} ms)`);

// ---- O solucionador: prova que a fase TEM saída ----
// Testar TODAS as jogadas em ordem é lento demais (são milhões de posições).
// Então fazemos como um jogador esperto: "busca em profundidade" que tenta
// PRIMEIRO as jogadas mais promissoras (fechar trio, juntar par, esvaziar a
// frente para a bandeja subir) e anota as posições já vistas para não
// andar em círculos. Devolve a lista de jogadas, ou null se não achar.
function resolver(inicio, limite = 200000) {
  const vistos = new Set();
  let visitas = 0;
  function nota(c, b) {
    const f = R.frente(c[b]);
    const iguais = Math.max(...f.filter(Boolean).map((x) => f.filter((y) => y === x).length), 0);
    return iguais * 10;
  }
  function busca(gs, caminho) {
    if (R.venceu(gs)) return caminho;
    const k = JSON.stringify(gs);
    if (vistos.has(k) || ++visitas > limite || caminho.length > 40) return null;
    vistos.add(k);
    const opcoes = [];
    for (let a = 0; a < gs.length; a++)
      for (let la = 0; la < 3; la++)
        for (let b = 0; b < gs.length; b++) {
          if (a === b) continue;                // mudar de lugar na mesma grelha não ajuda
          const lb = R.frente(gs[b]).indexOf(null);
          if (lb < 0) continue;                 // destino sem vaga
          const c = R.copiar(gs);
          if (!R.mover(c, { g: a, l: la }, { g: b, l: lb })) continue;
          const pontos = nota(c, b) + (c[a].length < gs[a].length ? 5 : 0);
          R.limparSeTrio(c, b);
          opcoes.push({ c, pontos, jogada: [a, la, b, lb] });
        }
    opcoes.sort((x, y) => y.pontos - x.pontos);
    for (const o of opcoes) {
      const r = busca(o.c, [...caminho, o.jogada]);
      if (r) return r;
    }
    return null;
  }
  return busca(inicio, []);
}

const solucao = resolver(R.criarFase());
confere("a fase da etapa 3 tem solução", solucao !== null);

// Confere a solução achada jogando-a de verdade, do zero.
if (solucao) {
  const f = R.criarFase();
  for (const [a, la, b, lb] of solucao) { R.mover(f, { g: a, l: la }, { g: b, l: lb }); R.limparSeTrio(f, b); }
  confere("jogando a solução, vence", R.venceu(f));
}

console.log(`${ok} conferências ok · solução encontrada: ${solucao ? solucao.length + " jogadas" : "nenhuma"}`);

// ---- Etapa 5: toda fase mais difícil que a anterior ----
for (let n = 1; n < 30; n++) {
  const a = R.receita(n), b = R.receita(n + 1);
  const pioraAlgo = b.tipos > a.tipos || b.trios > a.trios || b.vagas < a.vagas || b.tempo / b.comidas < a.tempo / a.comidas;
  const melhoraNada = b.tipos >= a.tipos && b.trios >= a.trios && b.vagas <= a.vagas && b.grelhas === 9;
  confere(`fase ${n + 1} é mais difícil que a ${n}`, pioraAlgo && melhoraNada);
}
console.log(`${ok} conferências ok no total`);

// ---- Etapa 6: poderes ----
{
  let g = [[["milho", "coxa", null], ["milho", "milho", "coxa"]], [["coxa", null, null]]];
  const mudaram = R.removerTrio(g, "milho");
  confere("martelo tira 3 milhos (frente e bandeja)", !JSON.stringify(g).includes("milho") && mudaram.includes(0));
  confere("depois do martelo, o resto continua múltiplo de 3", R.temSolucao(g));
  confere("martelo não tira se tiver menos de 3", R.removerTrio([[["coxa", null, null]]], "coxa") === null);

  g = [[["milho", "milho", "coxa"]], [["coxa", "milho", null]], [["coxa", null, null]]];
  confere("juntar escolhe o tipo mais visível na frente", R.tipoMaisVisivel(g) === "milho" || R.tipoMaisVisivel(g) === "coxa");

  // Martelo em todas as fases geradas: a fase continua com solução?
  let todasOk = true;
  for (let n = 1; n <= 6; n++) {
    const f = R.gerarFase(n).grelhas;
    R.removerTrio(f, R.tipoMaisVisivel(f));
    if (!R.temSolucao(f) || !R.resolver(f, 50000)) todasOk = false;
  }
  confere("depois de usar o poder, as fases 1 a 6 continuam com saída", todasOk);
  confere("combo x3 vale 300", R.pontosDoTrio(3) === 300);
  confere("bônus de 10 s vale 50", R.bonusDeTempo(10) === 50);
}
console.log(`${ok} conferências ok no total (com os poderes)`);
