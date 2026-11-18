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
  confere(`fase ${n}: ${r.comidas} comidas`, total === r.comidas);
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

// ---- Etapa 5 (e níveis): toda fase mais difícil que a anterior, em cada nível ----
for (const nivel of Object.keys(R.NIVEIS)) {
  let tudoOk = true;
  for (let n = 1; n < 30; n++) {
    const a = R.receita(n, nivel), b = R.receita(n + 1, nivel);
    const pioraAlgo = b.tipos > a.tipos || b.comidas > a.comidas || b.vagas < a.vagas || b.tempo / b.comidas < a.tempo / a.comidas;
    const melhoraNada = b.tipos >= a.tipos && b.comidas >= a.comidas && b.vagas <= a.vagas && b.grelhas === 15;
    if (!(pioraAlgo && melhoraNada)) { tudoOk = false; console.error('  piorou errado:', nivel, n, '->', n + 1); }
  }
  confere(`${nivel}: fases 1 a 30 sempre mais difíceis`, tudoOk);
}
for (let n = 1; n <= 20; n++) {
  const f = R.receita(n, 'facil'), m = R.receita(n, 'medio'), d = R.receita(n, 'dificil');
  confere(`fase ${n}: fácil tem mais tempo por comida que médio, e médio mais que difícil`, f.tempo / f.comidas > m.tempo / m.comidas && m.tempo / m.comidas > d.tempo / d.comidas);
  confere(`fase ${n}: fácil tem mais vagas que difícil`, f.vagas > d.vagas);
}
confere('fases do fácil e do difícil são diferentes', JSON.stringify(R.gerarFase(3, 'facil').grelhas) !== JSON.stringify(R.gerarFase(3, 'dificil').grelhas));
console.log(`${ok} conferências ok no total`);

// ---- 15 grelhas, todas com comida ----
for (const nivel of Object.keys(R.NIVEIS)) {
  const f = R.gerarFase(1, nivel).grelhas;
  confere(`${nivel} fase 01: 15 grelhas`, f.length === 15);
  confere(`${nivel} fase 01: nenhuma grelha começa vazia`, f.every((p) => !R.camadaVazia(R.frente(p))));
}

// ---- Cardápio variado ----
{
  confere("40 comidas no cardápio", Object.keys(R.COMIDAS).length === 40);
  const grupoDe = {};
  for (const [g, itens] of Object.entries(R.GRUPOS)) for (const nome of Object.keys(itens)) grupoDe[nome] = g;
  let semRepetir = true, misturado = true, iguaisSeguidas = 0;
  for (const nivel of Object.keys(R.NIVEIS))
    for (let n = 1; n <= 20; n++) {
      const a = R.receita(n, nivel).nomes, b = R.receita(n + 1, nivel).nomes;
      if (new Set(a).size !== a.length) semRepetir = false;
      if (new Set(a.map((x) => grupoDe[x])).size < Math.min(5, a.length)) misturado = false;
      if (JSON.stringify(a) === JSON.stringify(b)) iguaisSeguidas++;
    }
  confere("nenhum cardápio repete comida", semRepetir);
  let semParecidas = true;
  for (const nivel of Object.keys(R.NIVEIS))
    for (let n = 1; n <= 40; n++) {
      const c = R.receita(n, nivel).nomes;
      if (R.PARECIDAS.some(([x, y]) => c.includes(x) && c.includes(y))) semParecidas = false;
      if (c.length !== R.receita(n, nivel).tipos) semParecidas = false;
    }
  confere("nenhuma fase junta comidas parecidas (ex.: 🍑 e 🍅), e o cardápio vem completo", semParecidas);
  confere("todo cardápio mistura os 5 grupos", misturado);
  confere("fases seguidas têm cardápios diferentes", iguaisSeguidas === 0);
  // Diversidade (pedido do Eduardo): cada comida só 3 vezes, e fases seguidas sem repetir.
  let cadaUmaTres = true, poucoEmComum = true;
  for (const nivel of Object.keys(R.NIVEIS))
    for (let n = 1; n <= 10; n++) {
      const r = R.receita(n, nivel), r2 = R.receita(n + 1, nivel);
      if (r.tipos === r.trios) {
        const conta = R.contar(R.gerarFase(n, nivel).grelhas);
        if (!Object.values(conta).every((q) => q === 3)) cadaUmaTres = false;
      }
      const comuns = r.nomes.filter((x) => r2.nomes.includes(x)).length;
      if (comuns > Math.max(0, r.tipos + r2.tipos - 33)) poucoEmComum = false; // 33 = comidas que podem ir juntas
    }
  confere("cada comida aparece só 3 vezes na fase (1 trio)", cadaUmaTres);
  confere("fases seguidas só repetem comida quando não tem como evitar", poucoEmComum);
  confere("o cardápio de uma fase é sempre o mesmo", JSON.stringify(R.receita(7, "medio").nomes) === JSON.stringify(R.receita(7, "medio").nomes));
}

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
