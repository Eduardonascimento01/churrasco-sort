// jogo.js · A "tela": desenha as grelhas e responde aos cliques.
// Quem decide se a jogada vale é sempre o regras.js. Aqui só mostramos.

(function () {
  const R = window.Regras;
  const mesa = document.getElementById("mesa");
  const aviso = document.getElementById("aviso");
  const contador = document.getElementById("contador");

  let grelhas;      // os dados do jogo (lista de grelhas)
  let escolhida;    // comida que o jogador tocou: { g, l } ou null
  let jogadas;      // quantas jogadas já fez
  let ocupado;      // true durante a animação do trio (ignora cliques)

  function novoJogo() {
    grelhas = R.criarFase();
    escolhida = null;
    jogadas = 0;
    ocupado = false;
    aviso.textContent = "Toque numa comida e depois num lugar vazio.";
    desenhar();
  }

  // Desenha tudo do zero a partir dos dados. Simples e sem erro:
  // a tela é sempre um "retrato" fiel do que está em `grelhas`.
  function desenhar() {
    mesa.innerHTML = "";
    grelhas.forEach((grelha, g) => {
      const div = document.createElement("div");
      div.className = "grelha";
      grelha.forEach((comida, l) => {
        const lugar = document.createElement("button");
        lugar.className = "lugar";
        if (comida) {
          lugar.textContent = R.COMIDAS[comida];
          lugar.setAttribute("aria-label", comida);
        } else {
          lugar.classList.add("vazio");
          lugar.setAttribute("aria-label", "lugar vazio");
        }
        if (escolhida && escolhida.g === g && escolhida.l === l) lugar.classList.add("escolhida");
        lugar.addEventListener("click", () => tocar(g, l));
        div.appendChild(lugar);
      });
      mesa.appendChild(div);
    });
    const restam = grelhas.flat().filter((c) => c !== null).length;
    contador.textContent = `Jogadas: ${jogadas} · Restam: ${restam}`;
  }

  // O ciclo da jogada: PEGAR → SOLTAR → CONFERIR → LIMPAR → FIM?
  function tocar(g, l) {
    if (ocupado) return;
    const comida = grelhas[g][l];

    // 1. PEGAR: ainda não tem nada escolhido, ou tocou noutra comida.
    if (comida !== null) {
      escolhida = escolhida && escolhida.g === g && escolhida.l === l ? null : { g, l };
      desenhar();
      return;
    }
    if (!escolhida) return; // tocou num vazio sem ter escolhido nada

    // 2. SOLTAR: pede ao regras.js para mover.
    const origem = escolhida;
    escolhida = null;
    if (!R.mover(grelhas, origem, { g, l })) { desenhar(); return; }
    jogadas++;
    desenhar();

    // 3. CONFERIR: formou trio na grelha de destino?
    if (R.temTrio(grelhas[g])) {
      ocupado = true;
      mesa.children[g].classList.add("trio"); // brilho antes de sumir
      setTimeout(() => {
        R.limparSeTrio(grelhas, g);           // 4. LIMPAR
        ocupado = false;
        desenhar();
        if (R.venceu(grelhas)) aviso.textContent = `🎉 Você venceu em ${jogadas} jogadas!`; // 5. FIM?
      }, 450);
    }
  }

  document.getElementById("recomecar").addEventListener("click", novoJogo);
  novoJogo();
})();
