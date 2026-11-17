// jogo.js · A "tela": desenha as grelhas e responde ao mouse e ao dedo.
// Quem decide se a jogada vale é sempre o regras.js. Aqui só mostramos.
//
// Etapa 2: além de "tocar e tocar", agora dá pra ARRASTAR.
// Usamos Pointer Events: um só jeito de ouvir mouse, dedo e caneta.
// (Antes existiam eventos separados: mouse* para o mouse e touch* para o dedo.)

(function () {
  const R = window.Regras;
  const mesa = document.getElementById("mesa");
  const aviso = document.getElementById("aviso");
  const contador = document.getElementById("contador");

  // Quanto o dedo precisa andar (em pixels) para contar como arrastar.
  // Menos que isso é um toque. Sem essa folga, um dedo que treme um
  // pouquinho viraria um "arrastar" sem querer.
  const FOLGA = 8;

  let grelhas;      // os dados do jogo (lista de grelhas)
  let escolhida;    // modo tocar: comida tocada, { g, l } ou null
  let jogadas;      // quantas jogadas já fez
  let ocupado;      // true durante a animação do trio (ignora tudo)
  let arraste;      // modo arrastar: informações do arraste em andamento, ou null
  let ignorarClique = false; // um arraste termina com um "click" falso: pulamos ele

  function novoJogo() {
    grelhas = R.criarFase();
    escolhida = null;
    jogadas = 0;
    ocupado = false;
    arraste = null;
    aviso.textContent = "Arraste uma comida até um lugar vazio (ou toque nela e depois no lugar).";
    desenhar();
  }

  // Desenha tudo do zero a partir dos dados: a tela é um "retrato" de `grelhas`.
  function desenhar() {
    mesa.innerHTML = "";
    grelhas.forEach((grelha, g) => {
      const div = document.createElement("div");
      div.className = "grelha";
      grelha.forEach((comida, l) => {
        const lugar = document.createElement("button");
        lugar.className = "lugar";
        lugar.dataset.g = g; // o endereço fica guardado no próprio botão,
        lugar.dataset.l = l; // para achar "onde o dedo soltou" depois
        if (comida) {
          lugar.textContent = R.COMIDAS[comida];
          lugar.setAttribute("aria-label", comida);
          lugar.addEventListener("pointerdown", (e) => comecarArraste(e, g, l));
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

  // ---------- MODO TOCAR (da etapa 1, continua valendo) ----------
  function tocar(g, l) {
    if (ignorarClique) { ignorarClique = false; return; }
    if (ocupado) return;
    if (grelhas[g][l] !== null) {          // tocou numa comida: escolhe (ou desescolhe)
      escolhida = escolhida && escolhida.g === g && escolhida.l === l ? null : { g, l };
      desenhar();
      return;
    }
    if (!escolhida) return;                // tocou num vazio sem ter escolhido nada
    const origem = escolhida;
    escolhida = null;
    jogar(origem, { g, l });
  }

  // ---------- MODO ARRASTAR (novo na etapa 2) ----------
  // As 3 fases de um arraste: APERTAR → MOVER → SOLTAR.

  // 1. APERTAR: só anotamos onde começou. Ainda não sabemos se é toque ou arraste.
  function comecarArraste(e, g, l) {
    if (ocupado || e.button > 0) return;   // só o botão principal do mouse
    arraste = { g, l, x0: e.clientX, y0: e.clientY, fantasma: null, alvo: null, botao: e.currentTarget };
    // "Captura": o navegador manda TODOS os movimentos deste dedo pra nós,
    // mesmo quando ele sai de cima do botão.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* navegador antigo: segue sem */ }
    e.currentTarget.addEventListener("pointermove", moverArraste);
    e.currentTarget.addEventListener("pointerup", soltarArraste);
    e.currentTarget.addEventListener("pointercancel", cancelarArraste);
  }

  // 2. MOVER: passou da folga? Então é arraste: cria o "fantasma" que segue o dedo.
  function moverArraste(e) {
    if (!arraste) return;
    const andou = Math.hypot(e.clientX - arraste.x0, e.clientY - arraste.y0);
    if (!arraste.fantasma) {
      if (andou < FOLGA) return;           // ainda é um toque
      arraste.fantasma = document.createElement("div");
      arraste.fantasma.className = "fantasma";
      arraste.fantasma.textContent = R.COMIDAS[grelhas[arraste.g][arraste.l]];
      document.body.appendChild(arraste.fantasma);
      arraste.botao.classList.add("saindo");
      escolhida = null;
      arraste.botao.classList.remove("escolhida");
    }
    arraste.fantasma.style.left = e.clientX + "px";
    arraste.fantasma.style.top = e.clientY + "px";

    // Qual lugar está debaixo do dedo? Se for vazio, acende como "alvo".
    const embaixo = lugarEm(e.clientX, e.clientY);
    if (arraste.alvo && arraste.alvo !== embaixo) arraste.alvo.classList.remove("alvo");
    arraste.alvo = embaixo && embaixo.classList.contains("vazio") ? embaixo : null;
    if (arraste.alvo) arraste.alvo.classList.add("alvo");
  }

  // 3. SOLTAR: se era arraste e soltou num vazio, faz a jogada.
  function soltarArraste(e) {
    if (!arraste) return;
    const era = arraste;
    limparArraste();
    if (!era.fantasma) return;             // não arrastou: o "click" cuida (modo tocar)
    ignorarClique = true;                  // pula o click falso que vem depois
    setTimeout(() => { ignorarClique = false; }, 0);
    const destino = lugarEm(e.clientX, e.clientY);
    if (destino && destino.classList.contains("vazio")) {
      jogar({ g: era.g, l: era.l }, { g: +destino.dataset.g, l: +destino.dataset.l });
    } else {
      desenhar();                          // soltou fora: a comida volta pro lugar
    }
  }

  function cancelarArraste() { limparArraste(); desenhar(); }

  function limparArraste() {
    if (!arraste) return;
    const b = arraste.botao;
    b.removeEventListener("pointermove", moverArraste);
    b.removeEventListener("pointerup", soltarArraste);
    b.removeEventListener("pointercancel", cancelarArraste);
    if (arraste.fantasma) arraste.fantasma.remove();
    if (arraste.alvo) arraste.alvo.classList.remove("alvo");
    b.classList.remove("saindo");
    arraste = null;
  }

  // Acha o botão de lugar que está na posição (x, y) da tela.
  // O fantasma tem "pointer-events: none" no CSS, por isso ele não atrapalha.
  function lugarEm(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest(".lugar") : null;
  }

  // ---------- A JOGADA (igual para tocar e arrastar) ----------
  // O ciclo: SOLTAR → CONFERIR → LIMPAR → FIM?
  function jogar(origem, destino) {
    if (!R.mover(grelhas, origem, destino)) { desenhar(); return; }
    jogadas++;
    desenhar();
    const g = destino.g;
    if (R.temTrio(grelhas[g])) {
      ocupado = true;
      mesa.children[g].classList.add("trio"); // brilho antes de sumir
      setTimeout(() => {
        R.limparSeTrio(grelhas, g);
        ocupado = false;
        desenhar();
        if (R.venceu(grelhas)) aviso.textContent = `🎉 Você venceu em ${jogadas} jogadas!`;
      }, 450);
    }
  }

  document.getElementById("recomecar").addEventListener("click", novoJogo);
  novoJogo();
})();
