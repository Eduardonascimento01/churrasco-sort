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

  const COMIDAS = {
    pimentao: "🫑",
    coxa: "🍗",
    milho: "🌽",
    espeto: "🍢",
  };

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

  const Regras = {
    LUGARES, COMIDAS, criarFase, frente, camadaVazia, temTrio,
    mover, limparSeTrio, venceu, contar, temSolucao, copiar,
  };
  if (typeof module !== "undefined") module.exports = Regras; // Node (teste.js)
  else window.Regras = Regras;                                // navegador
})();
