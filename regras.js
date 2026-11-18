// regras.js · O "manual" do jogo: só dados e regras, nada de tela.
//
// Por que separar? Porque assim dá pra testar as regras sem abrir o navegador
// (veja teste.js). É como conferir as regras do xadrez no papel antes de
// comprar o tabuleiro.
//
// ETAPA 3: CAMADAS
// Agora cada grelha é uma PILHA de camadas (a "fila do banco"):
//
//   grelha = [
//     ["milho", "coxa", "milho"],   // camada 0: a da FRENTE (a que você mexe)
//     ["pimentao", null, "espeto"], // camada 1: a bandeja, esperando
//   ]
//
// Só a camada da frente aceita e entrega comida. Quando ela fica vazia
// (porque formou trio ou porque você tirou tudo), ela sai da fila com
// shift() e a de trás SOBE sozinha.

(function () {
  const LUGARES = 3;
  const VAZIA = () => [null, null, null];

  // O CARDÁPIO: 40 comidas, em 5 grupos. Cada fase SORTEIA as suas
  // (veja `cardapio` mais abaixo), então cada fase tem uma mesa diferente.
  const GRUPOS = {
    carnes: {
      coxa: "🍗", costela: "🍖", picanha: "🥩", salsicha: "🌭", bacon: "🥓",
      espeto: "🍢", hamburguer: "🍔", ovo: "🥚",
    },
    marinhos: {
      camarao: "🍤", peixe: "🐟", lula: "🦑", lagosta: "🦞", caranguejo: "🦀", ostra: "🦪",
    },
    legumes: {
      milho: "🌽", pimentao: "🫑", cebola: "🧅", berinjela: "🍆", cogumelo: "🍄",
      tomate: "🍅", batata: "🥔", cenoura: "🥕", alho: "🧄", brocolis: "🥦",
      pepino: "🥒", pimenta: "🌶️", batatadoce: "🍠",
    },
    frutas: {
      abacaxi: "🍍", banana: "🍌", limao: "🍋", manga: "🥭", pessego: "🍑", coco: "🥥",
    },
    paes: {
      queijo: "🧀", pao: "🍞", baguete: "🥖", pretzel: "🥨", taco: "🌮",
      pizza: "🍕", sanduiche: "🥪",
    },
  };
  // Junta os grupos numa lista só: { coxa: "🍗", costela: "🍖", ... }
  const COMIDAS = Object.assign({}, ...Object.values(GRUPOS));

  // Fase da etapa 3, montada à mão: 4 tipos × 3 = 12 comidas em 4 grelhas,
  // algumas escondidas na bandeja. O teste.js prova que ela tem solução.
  function criarFase() {
    return [
      [["milho", "coxa", "milho"], ["pimentao", null, "espeto"]],
      [["coxa", "espeto", null], ["pimentao", "coxa", null]],
      [["espeto", "milho", "pimentao"]],
      [VAZIA()],
    ];
  }

  // A camada da frente de uma grelha. Grelha sem camada nenhuma = frente vazia.
  function frente(grelha) {
    return grelha.length > 0 ? grelha[0] : VAZIA();
  }

  // Uma camada está vazia quando os 3 lugares são null.
  function camadaVazia(camada) {
    return camada.every((lugar) => lugar === null);
  }

  // O juiz: a camada da frente tem 3 comidas iguais?
  function temTrio(grelha) {
    const [a, b, c] = frente(grelha);
    return a !== null && a === b && b === c;
  }

  // Se a frente ficou vazia e tem bandeja atrás, a frente sai e a bandeja sobe.
  // Devolve true se alguma camada subiu (a tela usa isso para animar).
  function subirSeVazia(grelha) {
    if (grelha.length > 1 && camadaVazia(grelha[0])) {
      grelha.shift(); // "tira o primeiro da fila"
      return true;
    }
    return false;
  }

  // Move a comida de um lugar da FRENTE para outro lugar da FRENTE.
  // "de" e "para" são endereços { g: grelha, l: lugar }.
  function mover(grelhas, de, para) {
    const origem = grelhas[de.g];
    const destino = grelhas[para.g];
    const comida = frente(origem)[de.l];
    if (comida === null) return false;                 // não há o que pegar
    if (frente(destino)[para.l] !== null) return false; // destino ocupado
    if (destino.length === 0) destino.push(VAZIA());   // grelha sem camada: cria a frente
    destino[0][para.l] = comida;                       // coloca no destino
    origem[0][de.l] = null;                            // esvazia a origem
    subirSeVazia(origem);                              // tirou a última? a bandeja sobe
    return true;
  }

  // Limpa a grelha que formou trio: a frente sai e a bandeja sobe.
  // Repete enquanto houver trio (a camada que subiu pode já vir pronta!).
  // Devolve quantas comidas saíram.
  function limparSeTrio(grelhas, g) {
    const grelha = grelhas[g];
    let saiu = 0;
    while (temTrio(grelha)) {
      grelha[0] = VAZIA();
      saiu += LUGARES;
      if (!subirSeVazia(grelha)) break; // era a última camada: fica a frente vazia
    }
    return saiu;
  }

  // Vitória: nenhuma comida em nenhuma camada de nenhuma grelha.
  function venceu(grelhas) {
    return grelhas.every((grelha) => grelha.every(camadaVazia));
  }

  // Conta as comidas de cada tipo em TODAS as camadas.
  function contar(grelhas) {
    const conta = {};
    for (const grelha of grelhas)
      for (const camada of grelha)
        for (const lugar of camada)
          if (lugar !== null) conta[lugar] = (conta[lugar] || 0) + 1;
    return conta;
  }

  // Condição necessária: cada comida aparece em múltiplo de 3.
  // (Necessária, mas não suficiente: o teste.js também RESOLVE a fase.)
  function temSolucao(grelhas) {
    return Object.values(contar(grelhas)).every((n) => n % 3 === 0);
  }

  // Cópia profunda: uma fotografia independente das grelhas.
  // Vai ser a base do "desfazer" na etapa 5.
  function copiar(grelhas) {
    return grelhas.map((grelha) => grelha.map((camada) => [...camada]));
  }

  // =====================================================================
  // ETAPA 4: O JOGO CRIA AS FASES SOZINHO
  // =====================================================================

  // Sorteio "com semente" (algoritmo mulberry32).
  // O Math.random() dá números diferentes a cada vez. Este aqui, a partir
  // do mesmo número inicial (a SEMENTE), dá SEMPRE a mesma sequência.
  // Assim a "fase 7" é igual para todo mundo e o "Recomeçar" repete a fase.
  function sorteador(semente) {
    let s = semente >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // número entre 0 e 1
    };
  }

  // Embaralha uma lista (algoritmo Fisher-Yates): do fim para o começo,
  // troca cada item com um sorteado entre os anteriores.
  function embaralhar(lista, sortear) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(sortear() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
  }

  // A "receita" de dificuldade de cada fase:
  //   tipos  = quantos tipos de comida diferentes
  //   trios  = quantos trios de cada tipo (3 comidas cada)
  //   grelhas = quantas grelhas
  //   vagas  = lugares vazios na frente, no MÍNIMO (espaço de manobra: menos = mais difícil)
  //   tempo  = segundos do cronômetro (etapa 5)
  //
  // Pedido do Eduardo (2026-11-17): SEMPRE 9 grelhas, e TODA fase mais
  // difícil que a anterior. Cada fase aperta pelo menos um parafuso:
  //   fase:   1   2   3   4   5   6   7   8   9  10  11  12 ...
  //   tipos:  5   5   6   6   7   7   8   8   9   9  10  10   (+1 a cada 2 fases)
  //   trios:  1   1   1   2   2   2   3   3   3   3   3   3   (+1 a cada 3 fases)
  //   vagas:  6   5   5   4   4   3   3   2   2   2   2   2   (−1 a cada 2 fases)
  //   e o tempo por comida encolhe um pouco em TODA fase.
  //
  // Atualização 2 (pedido do Eduardo, 2026-11-17): 15 GRELHAS (3 × 5) e
  // TODAS COM COMIDA desde a fase 01. Agora a receita parte do espaço:
  //   frente cheia = 45 lugares − vagas      (só as vagas ficam vazias)
  //   bandejas     = mais comidas escondidas atrás, crescendo a cada fase
  //   trios        = o total disso, arredondado para cima em trios
  // Os trios são distribuídos entre os tipos em rodízio (milho, coxa,
  // espeto, ..., milho, coxa...), então cada tipo continua múltiplo de 3.
  const GRELHAS = 15;
  const NIVEIS = {
    facil:   { nome: "Fácil",   tiposBase: 6, vagasBase: 9, vagasMin: 5, bandejaBase: 6,  bandejaPorFase: 3, tempoX: 1.6 },
    medio:   { nome: "Médio",   tiposBase: 7, vagasBase: 7, vagasMin: 3, bandejaBase: 9,  bandejaPorFase: 4, tempoX: 1.0 },
    dificil: { nome: "Difícil", tiposBase: 8, vagasBase: 5, vagasMin: 2, bandejaBase: 12, bandejaPorFase: 5, tempoX: 0.7 },
  };
  //   tiposBase   = tipos de comida na fase 1 (+1 a cada 2 fases, até 12)
  //   vagas       = vagas na fase 1, perdendo 1 a cada 2 fases, até o mínimo
  //   bandeja...  = comidas escondidas nas bandejas na fase 1, e quantas a mais por fase
  //   tempoX      = multiplica o cronômetro (1,6 = 60% mais tempo)
  const TETO_BANDEJA = 75; // acima disso o solucionador demora demais para provar a fase
  function receita(fase, nivel = "medio") {
    const n = NIVEIS[nivel] || NIVEIS.medio;
    // Teto de 12 tipos na mesma fase: mais que isso o solucionador demora e o olho cansa.
    const tipos = Math.min(n.tiposBase + Math.floor((fase - 1) / 2), 12);
    const nomes = cardapio(fase, nivel, tipos);
    const grelhas = GRELHAS;
    const vagas = Math.max(n.vagasMin, n.vagasBase - Math.floor(fase / 2));
    const naBandeja = Math.min(n.bandejaBase + (fase - 1) * n.bandejaPorFase, TETO_BANDEJA);
    const trios = Math.ceil((grelhas * 3 - vagas + naBandeja) / 3); // total de trios da fase
    const comidas = trios * 3;
    // Segundos por comida: começa em 6 e cai 7% (do que sobra acima de 1,5) a
    // cada fase. É uma curva que SEMPRE desce, mas nunca chega a 1,5:
    // fase 1 = 6 s, fase 10 ≈ 3,8 s, fase 20 ≈ 2,6 s, fase 40 ≈ 1,8 s.
    // (Um "piso" fixo faria as fases pararem de ficar difíceis: o teste pegou isso.)
    const porComida = 1.5 + 4.5 * Math.pow(0.93, fase - 1);
    const tempo = Math.round((comidas * porComida + 30) * n.tempoX);
    return { tipos, trios, grelhas, vagas, comidas, tempo, nivel, nomes };
  }

  // Sorteia o cardápio da fase: `tipos` comidas diferentes, misturando os
  // grupos (carnes, frutos do mar, legumes, frutas, pães). Usa o sorteador
  // COM SEMENTE, então a fase 7 do Médio tem sempre o mesmo cardápio.
  // Para variar de verdade, o sorteio "dá as cartas" passando pelos grupos
  // em rodízio: 1 carne, 1 marinho, 1 legume, 1 fruta, 1 pão, de novo...
  // Assim nunca sai uma fase só de legumes verdes parecidos.
  //
  // PARECIDAS: comidas que, pequenas na tela do celular, se confundem.
  // Elas nunca caem na mesma fase (o print do celular mostrou 🍑 e 🍅 juntos).
  const PARECIDAS = [
    ["tomate", "pessego"], ["coco", "ostra"], ["batatadoce", "baguete"],
    ["limao", "manga"], ["batata", "ovo"], ["coxa", "costela"], ["picanha", "bacon"],
  ];
  const conflita = (a, b) => PARECIDAS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  function cardapio(fase, nivel, tipos) {
    const sortear = sorteador(Object.keys(NIVEIS).indexOf(nivel) * 7777 + fase * 31 + 5);
    const filas = Object.values(GRUPOS).map((g) => embaralhar(Object.keys(g), sortear));
    embaralhar(filas, sortear);                 // qual grupo começa também é sorteado
    const escolhidas = [];
    for (let i = 0; escolhidas.length < tipos && i < 500; i++) {
      const fila = filas[i % filas.length];
      // Tira da fila até achar uma que não se pareça com nenhuma já escolhida.
      while (fila.length) {
        const nome = fila.pop();
        if (!escolhidas.some((e) => conflita(e, nome))) { escolhidas.push(nome); break; }
      }
    }
    return escolhidas;
  }

  // Monta uma fase com o sorteio: coloca as comidas na frente (deixando as
  // vagas) e o que sobra vai, de 3 em 3, para as bandejas das grelhas.
  function montar(r, sortear) {
    const comidas = [];
    for (let t = 0; t < r.trios; t++)                 // rodízio de tipos, 3 de cada vez
      for (let i = 0; i < 3; i++) comidas.push(r.nomes[t % r.tipos]);
    embaralhar(comidas, sortear);

    // Frente: escolhe quais lugares ficam vazios.
    const totalFrente = r.grelhas * 3;
    const vazios = new Set(embaralhar([...Array(totalFrente).keys()], sortear).slice(0, r.vagas));
    const grelhas = [];
    for (let g = 0; g < r.grelhas; g++) {
      const frente = [];
      for (let l = 0; l < 3; l++) {
        const pos = g * 3 + l;
        frente.push(vazios.has(pos) || comidas.length === 0 ? null : comidas.pop());
      }
      grelhas.push([frente]);
    }

    // Bandejas: o resto, em camadas de 3, sempre na grelha com MENOS camadas
    // (empate: sorteia). Assim nenhuma grelha fica com uma torre enorme.
    while (comidas.length > 0) {
      const camada = [comidas.pop() ?? null, comidas.pop() ?? null, comidas.pop() ?? null];
      const menor = Math.min(...grelhas.map((p) => p.length));
      const candidatas = grelhas.filter((p) => p.length === menor);
      candidatas[Math.floor(sortear() * candidatas.length)].push(embaralhar(camada, sortear));
    }

    // Arrumação: uma frente vazia com bandeja atrás não faz sentido; a bandeja sobe.
    for (const p of grelhas) while (p.length > 1 && camadaVazia(p[0])) p.shift();
    return grelhas;
  }

  // O solucionador (veio do teste.js para cá, porque agora o JOGO usa ele).
  // Busca em profundidade que tenta primeiro as jogadas promissoras e anota
  // as posições já vistas. Devolve a lista de jogadas, ou null se desistir.
  function resolver(inicio, limite = 20000) {
    const vistos = new Set();
    let visitas = 0;
    function pontos(antes, depois, a, b, comida) {
      const f = frente(depois[b]);
      const iguais = f.filter((x) => x === comida).length;
      let p = iguais === 3 ? 100 : iguais === 2 ? 20 : 0;              // fechou trio / formou par
      if (frente(antes[a]).filter((x) => x === comida).length === 2) p -= 15; // desfez um par
      if (depois[a].length < antes[a].length) p += 5;                 // a bandeja subiu
      return p;
    }
    function busca(gs, caminho) {
      if (venceu(gs)) return caminho;
      const k = JSON.stringify(gs);
      if (vistos.has(k) || ++visitas > limite || caminho.length > 200) return null;
      vistos.add(k);
      const opcoes = [];
      for (let a = 0; a < gs.length; a++)
        for (let la = 0; la < 3; la++) {
          const comida = frente(gs[a])[la];
          if (comida === null) continue;
          for (let b = 0; b < gs.length; b++) {
            if (a === b) continue;
            const lb = frente(gs[b]).indexOf(null);
            if (lb < 0) continue;
            const c = copiar(gs);
            mover(c, { g: a, l: la }, { g: b, l: lb });
            const p = pontos(gs, c, a, b, comida);
            limparSeTrio(c, b);
            limparSeTrio(c, a);
            opcoes.push({ c, p, jogada: [a, la, b, lb] });
          }
        }
      opcoes.sort((x, y) => y.p - x.p);
      for (const o of opcoes) {
        const r = busca(o.c, [...caminho, o.jogada]);
        if (r) return r;
      }
      return null;
    }
    return busca(copiar(inicio), []);
  }

  // Gera a fase N: sorteia, e o solucionador PROVA que tem saída.
  // Se não achar saída (ou se já começar com um trio pronto), tenta outro
  // sorteio. É o "montar o quebra-cabeça e conferir antes de entregar".
  function gerarFase(fase, nivel = "medio") {
    const r = receita(fase, nivel);
    const semNivel = Object.keys(NIVEIS).indexOf(r.nivel) + 1; // 1, 2 ou 3: cada nível tem as suas fases
    for (let tentativa = 0; tentativa < 60; tentativa++) {
      const grelhas = montar(r, sorteador(semNivel * 1000000 + fase * 1000 + tentativa));
      if (grelhas.some(temTrio)) continue;      // trio de graça não tem graça
      if (!temSolucao(grelhas)) continue;
      const solucao = resolver(grelhas);
      if (solucao) return { grelhas, solucao, tentativa, receita: r };
    }
    return { grelhas: criarFase(), solucao: null, tentativa: -1, receita: r }; // reserva
  }

  // =====================================================================
  // ETAPA 6: PODERES E PONTOS
  // =====================================================================

  // Tira 3 comidas de um tipo do jogo, de onde estiverem. Procura primeiro
  // na frente (o jogador vê sumir) e depois nas bandejas, da mais próxima
  // para a mais funda. Tirar SEMPRE 3 mantém a regra do "múltiplo de 3":
  // a fase continua tendo como terminar.
  // Devolve as grelhas que mudaram (para a tela animar), ou null se não deu.
  function removerTrio(grelhas, tipo) {
    if ((contar(grelhas)[tipo] || 0) < LUGARES) return null;
    let falta = LUGARES;
    const mudaram = new Set();
    const fundo = Math.max(...grelhas.map((p) => p.length));
    for (let camada = 0; camada < fundo && falta > 0; camada++)
      for (let g = 0; g < grelhas.length && falta > 0; g++) {
        const c = grelhas[g][camada];
        if (!c) continue;
        for (let l = 0; l < LUGARES && falta > 0; l++)
          if (c[l] === tipo) { c[l] = null; falta--; mudaram.add(g); }
      }
    // Arrumação: camadas que ficaram vazias saem da fila (a de trás sobe),
    // e alguma frente nova pode já ter vindo com trio.
    for (const p of grelhas) {
      for (let i = p.length - 1; i >= 1; i--) if (camadaVazia(p[i])) p.splice(i, 1);
      while (p.length > 1 && camadaVazia(p[0])) p.shift();
    }
    grelhas.forEach((_, g) => { if (limparSeTrio(grelhas, g)) mudaram.add(g); });
    return [...mudaram];
  }

  // Para o poder "Juntar": qual tipo aparece mais nas FRENTES?
  // (Empate: o que tem mais no total.) É o trio que o jogador mais "vê".
  function tipoMaisVisivel(grelhas) {
    const naFrente = {};
    for (const p of grelhas) for (const x of frente(p)) if (x) naFrente[x] = (naFrente[x] || 0) + 1;
    const total = contar(grelhas);
    const tipos = Object.keys(naFrente).filter((t) => total[t] >= LUGARES);
    tipos.sort((a, b) => naFrente[b] - naFrente[a] || total[b] - total[a]);
    return tipos[0] || null;
  }

  // Pontos: cada trio vale 100 × combo (trios seguidos valem mais).
  // No fim, cada segundo que sobrou vale 5 pontos.
  const pontosDoTrio = (combo) => 100 * combo;
  const bonusDeTempo = (segundos) => Math.max(0, segundos) * 5;

  const Regras = {
    removerTrio, tipoMaisVisivel, pontosDoTrio, bonusDeTempo,
    LUGARES, COMIDAS, GRUPOS, NIVEIS, PARECIDAS, cardapio, criarFase, frente, camadaVazia, temTrio,
    mover, limparSeTrio, venceu, contar, temSolucao, copiar,
    sorteador, embaralhar, receita, montar, resolver, gerarFase,
  };
  if (typeof module !== "undefined") module.exports = Regras; // Node (teste.js)
  else window.Regras = Regras;                                // navegador
})();
