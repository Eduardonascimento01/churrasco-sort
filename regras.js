// regras.js · O "manual" do jogo: só dados e regras, nada de tela.
//
// Por que separar? Porque assim dá pra testar as regras sem abrir o navegador
// (veja teste.js). É como conferir as regras do xadrez no papel antes de
// comprar o tabuleiro.

(function () {
  // Uma grelha é uma lista de 3 lugares. Cada lugar guarda o nome de uma
  // comida (ex: "milho") ou null, que quer dizer "lugar vazio".
  const LUGARES = 3;

  // As comidas, com o desenho (emoji) de cada uma.
  const COMIDAS = {
    pimentao: "🫑",
    coxa: "🍗",
    milho: "🌽",
    espeto: "🍢",
  };

  // Fase da etapa 1, montada à mão. São 4 grelhas e 3 tipos de comida,
  // 3 de cada (9 comidas), mais 3 lugares vazios para dar espaço de manobra.
  function criarFase() {
    return [
      ["milho", "coxa", "milho"],
      ["coxa", "espeto", null],
      ["espeto", "milho", "coxa"],
      [null, "espeto", null],
    ];
  }

  // O juiz: a grelha tem 3 comidas iguais?
  // "a !== null" impede que 3 lugares vazios contem como trio.
  function temTrio(grelha) {
    const [a, b, c] = grelha;
    return a !== null && a === b && b === c;
  }

  // Move a comida de um lugar para outro. "de" e "para" são endereços
  // no formato { g: número da grelha, l: número do lugar }.
  // Devolve true se a jogada valeu, false se não pode.
  function mover(grelhas, de, para) {
    const comida = grelhas[de.g][de.l];
    if (comida === null) return false;               // não há nada para pegar
    if (grelhas[para.g][para.l] !== null) return false; // destino ocupado
    grelhas[para.g][para.l] = comida;                // coloca no destino
    grelhas[de.g][de.l] = null;                      // esvazia a origem
    return true;
  }

  // Esvazia a grelha que formou trio. Devolve quantas comidas saíram (3 ou 0).
  function limparSeTrio(grelhas, g) {
    if (!temTrio(grelhas[g])) return 0;
    grelhas[g] = [null, null, null];
    return LUGARES;
  }

  // Vitória: nenhuma comida sobrou em nenhuma grelha.
  function venceu(grelhas) {
    return grelhas.every((grelha) => grelha.every((lugar) => lugar === null));
  }

  // A prova de que a fase tem solução: cada comida aparece um número de
  // vezes múltiplo de 3. Se sobrar uma comida sem par, a fase é impossível.
  function temSolucao(grelhas) {
    const conta = {};
    for (const grelha of grelhas)
      for (const lugar of grelha)
        if (lugar !== null) conta[lugar] = (conta[lugar] || 0) + 1;
    return Object.values(conta).every((n) => n % 3 === 0);
  }

  const Regras = { LUGARES, COMIDAS, criarFase, temTrio, mover, limparSeTrio, venceu, temSolucao };
  if (typeof module !== "undefined") module.exports = Regras; // Node (teste.js)
  else window.Regras = Regras;                                // navegador
})();
