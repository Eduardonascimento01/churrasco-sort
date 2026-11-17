// jogo.js · A "tela": desenha as grelhas e responde ao mouse e ao dedo.
// Quem decide se a jogada vale é sempre o regras.js. Aqui só mostramos.
//
// Etapa 4: fases geradas sozinhas (com saída garantida), "Próxima fase" e progresso salvo.
// Etapa 3: cada grelha mostra a bandeja (próxima camada) embaixo.
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

  const botaoProxima = document.getElementById("proxima");
  const titulo = document.getElementById("fase");

  // Etapa 4: em que fase o jogador está. Fica guardado no navegador
  // (localStorage) para continuar de onde parou. O try/catch protege
  // navegadores que bloqueiam o armazenamento (ex: aba anônima).
  function lerFase() {
    try { return Math.max(1, parseInt(localStorage.getItem("churrasco:fase"), 10) || 1); } catch (_) { return 1; }
  }
  function gravarFase(n) {
    try { localStorage.setItem("churrasco:fase", String(n)); } catch (_) { /* sem problema */ }
  }

  let fase = lerFase();
  let inicio;       // a fase como ela começou (para o "Recomeçar")
  let grelhas;      // os dados do jogo (lista de grelhas)
  let escolhida;    // modo tocar: comida tocada, { g, l } ou null
  let jogadas;      // quantas jogadas já fez
  let ocupado;      // true durante a animação do trio (ignora tudo)
  let arraste;      // modo arrastar: informações do arraste em andamento, ou null
  let ignorarClique = false; // um arraste termina com um "click" falso: pulamos ele

  // Prepara a fase N. Gerar as fases grandes leva até ~2 segundos, então
  // primeiro mostramos "Preparando..." e só depois (setTimeout) geramos:
  // sem isso, o navegador congelaria antes de conseguir mostrar o aviso.
  function carregarFase(n) {
    fase = n;
    gravarFase(n);
    titulo.textContent = `Fase ${n}`;
    botaoProxima.hidden = true;
    ocupado = true;
    aviso.textContent = "🔥 Preparando a fase...";
    setTimeout(() => {
      inicio = R.gerarFase(n).grelhas;
      recomecar();
    }, 30);
  }

  // Volta a fase atual ao começo, igualzinha (usa a cópia guardada em `inicio`).
  function recomecar() {
    grelhas = R.copiar(inicio);
    escolhida = null;
    jogadas = 0;
    ocupado = false;
    arraste = null;
    aviso.textContent = "Arraste uma comida até um lugar vazio (ou toque nela e depois no lugar).";
    mesa.classList.toggle("tres", grelhas.length >= 6); // muitas grelhas: 3 por linha
    desenhar();
  }

  // Desenha tudo do zero a partir dos dados: a tela é um "retrato" de `grelhas`.
  // Etapa 3: cada grelha vira um "bloco" = grelha (camada da frente)
  // + bandeja embaixo (a próxima camada, pequena e apagada).
  function desenhar(animar = []) {
    mesa.innerHTML = "";
    grelhas.forEach((pilha, g) => {
      const bloco = document.createElement("div");
      bloco.className = "bloco";
      const div = document.createElement("div");
      div.className = "grelha";
      if (animar.includes(g)) div.classList.add("subiu"); // a bandeja acabou de subir
      R.frente(pilha).forEach((comida, l) => {
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
      bloco.appendChild(div);

      // A bandeja: mostra a camada de trás (pilha[1]). Se houver mais
      // camadas escondidas além dela, um selo "+N" avisa quantas.
      const bandeja = document.createElement("div");
      bandeja.className = "bandeja";
      if (pilha.length > 1) {
        pilha[1].forEach((comida) => {
          const s = document.createElement("span");
          s.textContent = comida ? R.COMIDAS[comida] : "";
          bandeja.appendChild(s);
        });
        if (pilha.length > 2) {
          const selo = document.createElement("b");
          selo.className = "selo";
          selo.textContent = "+" + (pilha.length - 2);
          bandeja.appendChild(selo);
        }
        bandeja.setAttribute("aria-label", "próxima camada: " + pilha[1].filter(Boolean).join(", "));
      } else {
        bandeja.classList.add("vazia");
      }
      bloco.appendChild(bandeja);
      mesa.appendChild(bloco);
    });
    const restam = Object.values(R.contar(grelhas)).reduce((a, b) => a + b, 0);
    contador.textContent = `Jogadas: ${jogadas} · Restam: ${restam}`;
  }

  // ---------- MODO TOCAR (da etapa 1, continua valendo) ----------
  function tocar(g, l) {
    if (ignorarClique) { ignorarClique = false; return; }
    if (ocupado) return;
    if (R.frente(grelhas[g])[l] !== null) { // tocou numa comida: escolhe (ou desescolhe)
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
      arraste.fantasma.textContent = R.COMIDAS[R.frente(grelhas[arraste.g])[arraste.l]];
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
    const camadasAntes = grelhas[origem.g].length;
    if (!R.mover(grelhas, origem, destino)) { desenhar(); return; }
    jogadas++;
    // Se a origem perdeu uma camada, foi porque a bandeja subiu: anima ela.
    desenhar(grelhas[origem.g].length < camadasAntes ? [origem.g] : []);
    // Quem pode ter formado trio? O destino (recebeu comida) e também a
    // origem (se a bandeja que subiu já veio com 3 iguais).
    const comTrio = [destino.g, origem.g].filter((g, i, lista) => lista.indexOf(g) === i && R.temTrio(grelhas[g]));
    if (comTrio.length === 0) return;
    ocupado = true;
    comTrio.forEach((g) => mesa.children[g].querySelector(".grelha").classList.add("trio")); // brilho antes de sumir
    setTimeout(() => {
      const subiram = comTrio.filter((g) => grelhas[g].length > 1);
      comTrio.forEach((g) => R.limparSeTrio(grelhas, g));
      ocupado = false;
      desenhar(subiram);
      if (R.venceu(grelhas)) {
        aviso.textContent = `🎉 Fase ${fase} completa em ${jogadas} jogadas!`;
        gravarFase(fase + 1);         // se fechar o navegador, continua na próxima
        botaoProxima.hidden = false;
        botaoProxima.focus();
      }
    }, 450);
  }

  document.getElementById("recomecar").addEventListener("click", () => { if (inicio) recomecar(); });
  botaoProxima.addEventListener("click", () => carregarFase(fase + 1));

  // ?fase=N no endereço abre direto a fase N (útil para testar).
  const pedida = parseInt(new URLSearchParams(location.search).get("fase"), 10);
  carregarFase(pedida > 0 ? pedida : fase);
})();
