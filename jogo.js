// jogo.js · A "tela": desenha as grelhas e responde ao mouse e ao dedo.
// Quem decide se a jogada vale é sempre o regras.js. Aqui só mostramos.
//
// Etapa 6: pontos com combo, 3 poderes (congelar, martelo, juntar) e som.
// Etapa 5: cronômetro (pausa com a aba escondida) e 3 "desfazer" por fase.
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

  // ---------- Etapa 5: tempo e desfazer ----------
  const DESFAZER_POR_FASE = 3;
  const relogioTela = document.getElementById("relogio");
  const botaoDesfazer = document.getElementById("desfazer");
  let receitaAtual;   // a receita da fase (traz o tempo)
  let tempo;          // segundos que faltam
  let relogio = null; // o "despertador" que bate a cada 1 segundo (setInterval)
  let historico;      // pilha de fotografias das grelhas, uma por jogada
  let desfazeres;     // quantos "desfazer" ainda restam
  let terminou;       // true quando venceu ou o tempo acabou

  // ---------- Etapa 6: pontos, combo e poderes ----------
  const S = window.Som;
  const JANELA_COMBO = 6000; // trio até 6 s depois do anterior = combo
  const SEGUNDOS_GELO = 10;
  let pontos, combo, ultimoTrio;
  let poderes;          // quantos de cada poder ainda restam nesta fase
  let congelado = 0;    // segundos de gelo que faltam
  let modoMartelo = false;

  // Prepara a fase N. Gerar as fases grandes leva até ~2 segundos, então
  // primeiro mostramos "Preparando..." e só depois (setTimeout) geramos:
  // sem isso, o navegador congelaria antes de conseguir mostrar o aviso.
  function carregarFase(n) {
    fase = n;
    gravarFase(n);
    pararRelogio();
    titulo.textContent = `Fase ${n}`;
    botaoProxima.hidden = true;
    ocupado = true;
    aviso.textContent = "🔥 Preparando a fase...";
    setTimeout(() => {
      const gerada = R.gerarFase(n);
      inicio = gerada.grelhas;
      receitaAtual = gerada.receita;
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
    historico = [];
    desfazeres = DESFAZER_POR_FASE;
    terminou = false;
    tempo = receitaAtual.tempo;
    pontos = 0;
    combo = 0;
    ultimoTrio = 0;
    poderes = { congelar: 1, martelo: 1, juntar: 1 };
    congelado = 0;
    modoMartelo = false;
    mesa.classList.remove("gelo", "martelo");
    botaoProxima.hidden = true;
    aviso.textContent = "Arraste uma comida até um lugar vazio (ou toque nela e depois no lugar).";
    mesa.classList.toggle("tres", grelhas.length >= 6); // muitas grelhas: 3 por linha
    desenhar();
    mostrarTempo();
    iniciarRelogio();
  }

  // O cronômetro: a cada 1 segundo, tira 1 do tempo.
  // Se a aba estiver escondida (document.hidden), não conta: é injusto
  // perder porque foi atender o telefone em outro aplicativo.
  function iniciarRelogio() {
    pararRelogio();
    relogio = setInterval(() => {
      if (document.hidden || terminou) return;
      if (congelado > 0) {                 // poder do gelo: o tempo não anda
        congelado--;
        if (congelado === 0) mesa.classList.remove("gelo");
        mostrarTempo();
        return;
      }
      tempo--;
      mostrarTempo();
      if (tempo > 0 && tempo <= 10) S.tique(); // tique-taque nos últimos 10 s
      if (tempo <= 0) perder();
    }, 1000);
  }
  function pararRelogio() {
    if (relogio) clearInterval(relogio);
    relogio = null;
  }
  function mostrarTempo() {
    const m = Math.floor(Math.max(tempo, 0) / 60);
    const s = String(Math.max(tempo, 0) % 60).padStart(2, "0");
    relogioTela.textContent = (congelado > 0 ? `❄️ ${congelado}s · ` : "") + `⏱ ${m}:${s}`;
    relogioTela.classList.toggle("acabando", tempo <= 20); // últimos 20 s: vermelho
  }
  function perder() {
    terminou = true;
    pararRelogio();
    if (arraste) { limparArraste(); }
    escolhida = null;
    modoMartelo = false;
    mesa.classList.remove("martelo", "gelo");
    desenhar();
    S.derrota();
    aviso.textContent = "⏰ O tempo acabou! Toque em Recomeçar para tentar de novo.";
  }

  // Desfazer: tira a última fotografia da pilha e volta para ela.
  // Funciona porque, ANTES de cada jogada, guardamos uma cópia (R.copiar)
  // das grelhas. É o Ctrl+Z do jogo.
  function desfazer() {
    if (ocupado || terminou || historico.length === 0 || desfazeres === 0) return;
    const foto = historico.pop();
    grelhas = foto.grelhas;
    pontos = foto.pontos;   // os pontos voltam junto: senão dava pra "farmar"
    combo = foto.combo;     // fazendo e desfazendo o mesmo trio
    desfazeres--;
    S.soltar();
    escolhida = null;
    desenhar();
  }
  function atualizarBotoes() {
    botaoDesfazer.textContent = `↶ Desfazer (${desfazeres})`;
    botaoDesfazer.disabled = terminou || historico.length === 0 || desfazeres === 0;
    for (const nome of Object.keys(botoesPoder)) {
      botoesPoder[nome].querySelector("b").textContent = poderes[nome];
      botoesPoder[nome].disabled = terminou || poderes[nome] === 0;
    }
    botoesPoder.martelo.classList.toggle("ativo", modoMartelo);
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
    contador.textContent = `⭐ ${pontos} · Restam: ${restam}`;
    atualizarBotoes();
  }

  // ---------- MODO TOCAR (da etapa 1, continua valendo) ----------
  function tocar(g, l) {
    if (ignorarClique) { ignorarClique = false; return; }
    if (ocupado || terminou) return;
    if (modoMartelo) {                     // martelo armado: a comida tocada é o alvo
      const tipo = R.frente(grelhas[g])[l];
      if (tipo) usarMartelo(tipo);
      return;
    }
    if (R.frente(grelhas[g])[l] !== null) { // tocou numa comida: escolhe (ou desescolhe)
      escolhida = escolhida && escolhida.g === g && escolhida.l === l ? null : { g, l };
      if (escolhida) S.pegar();
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
    if (ocupado || terminou || modoMartelo || e.button > 0) return; // só o botão principal do mouse
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
      S.pegar();
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
    const foto = R.copiar(grelhas);           // fotografia ANTES da jogada (para desfazer)
    if (!R.mover(grelhas, origem, destino)) { S.erro(); desenhar(); return; }
    historico.push({ grelhas: foto, pontos, combo });
    S.soltar();
    jogadas++;
    // Se a origem perdeu uma camada, foi porque a bandeja subiu: anima ela.
    desenhar(grelhas[origem.g].length < camadasAntes ? [origem.g] : []);
    // Quem pode ter formado trio? O destino (recebeu comida) e também a
    // origem (se a bandeja que subiu já veio com 3 iguais).
    const comTrio = [destino.g, origem.g].filter((g, i, lista) => lista.indexOf(g) === i && R.temTrio(grelhas[g]));
    if (comTrio.length === 0) return;
    ocupado = true;
    comTrio.forEach((g) => mesa.children[g].querySelector(".grelha").classList.add("trio")); // brilho antes de sumir
    marcarTrio(comTrio.length);
    setTimeout(() => {
      const subiram = comTrio.filter((g) => grelhas[g].length > 1);
      comTrio.forEach((g) => R.limparSeTrio(grelhas, g));
      ocupado = false;
      desenhar(subiram);
      conferirVitoria();
    }, 450);
  }

  // Combo: se este trio veio até 6 s depois do anterior, o combo sobe
  // (x2, x3...). Se demorou, volta para x1. Cada trio vale 100 × combo.
  function marcarTrio(quantos) {
    const agora = performance.now();
    combo = agora - ultimoTrio <= JANELA_COMBO ? combo + 1 : 1;
    ultimoTrio = agora;
    const ganho = R.pontosDoTrio(combo) * quantos;
    pontos += ganho;
    S.trio(combo);
    mostrarFlutuante(combo > 1 ? `Combo x${combo}! +${ganho}` : `+${ganho}`);
  }

  // Um texto que sobe e some no meio da tela ("+200", "Combo x2!").
  function mostrarFlutuante(texto) {
    const f = document.createElement("div");
    f.className = "flutuante";
    f.textContent = texto;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  }

  function conferirVitoria() {
      if (R.venceu(grelhas) && !terminou) {
        terminou = true;
        pararRelogio();
        const bonus = R.bonusDeTempo(tempo);
        pontos += bonus;
        const recorde = lerRecorde(fase);
        const novo = pontos > recorde;
        if (novo) gravarRecorde(fase, pontos);
        desenhar();
        S.vitoria();
        const m = Math.floor(tempo / 60), s = String(tempo % 60).padStart(2, "0");
        aviso.textContent = `🎉 Fase ${fase} completa, sobrando ${m}:${s} (+${bonus} de bônus). ⭐ ${pontos}` +
          (novo ? " · NOVO RECORDE!" : ` · recorde: ${recorde}`);
        gravarFase(fase + 1);         // se fechar o navegador, continua na próxima
        botaoProxima.hidden = false;
        botaoProxima.focus();
      }
  }

  // ---------- Os 3 poderes (1 de cada por fase) ----------
  const botoesPoder = {
    congelar: document.getElementById("p-congelar"),
    martelo: document.getElementById("p-martelo"),
    juntar: document.getElementById("p-juntar"),
  };

  // Usar um poder apaga o histórico do desfazer: não dá pra "desfazer"
  // por cima de um poder (senão o poder sairia de graça).
  function gastar(nome) {
    poderes[nome]--;
    historico = [];
  }

  // ❄️ Congelar: o relógio para por 10 segundos.
  function usarCongelar() {
    if (ocupado || terminou || poderes.congelar === 0) return;
    gastar("congelar");
    congelado = SEGUNDOS_GELO;
    mesa.classList.add("gelo");
    S.gelo();
    mostrarTempo();
    desenhar();
  }

  // 🔨 Martelo: arma o martelo; o próximo toque numa comida quebra 3 dela.
  function armarMartelo() {
    if (ocupado || terminou || poderes.martelo === 0) return;
    modoMartelo = !modoMartelo;            // tocar de novo no botão desarma
    escolhida = null;
    mesa.classList.toggle("martelo", modoMartelo);
    aviso.textContent = modoMartelo ? "🔨 Toque na comida que o martelo vai quebrar (3 delas somem)." : "";
    desenhar();
  }
  function usarMartelo(tipo) {
    modoMartelo = false;
    mesa.classList.remove("martelo");
    gastar("martelo");
    S.martelo();
    aplicarRemocao(tipo, "🔨");
  }

  // ✨ Juntar: o jogo escolhe sozinho o tipo mais à vista e some com 3 dele.
  function usarJuntar() {
    if (ocupado || terminou || poderes.juntar === 0) return;
    const tipo = R.tipoMaisVisivel(grelhas);
    if (!tipo) return;
    gastar("juntar");
    S.poder();
    aplicarRemocao(tipo, "✨");
  }

  // Parte comum do martelo e do juntar: tira o trio, conta como trio
  // (pontos e combo) e confere se a fase acabou.
  function aplicarRemocao(tipo, icone) {
    const mudaram = R.removerTrio(grelhas, tipo) || [];
    const e = R.COMIDAS[tipo];
    aviso.textContent = `${icone} ${e}${e}${e} saíram!`;
    marcarTrio(1);
    desenhar(mudaram);
    conferirVitoria();
  }

  // Recorde de pontos por fase, guardado no navegador.
  function lerRecorde(n) {
    try { return parseInt(localStorage.getItem("churrasco:recorde:" + n), 10) || 0; } catch (_) { return 0; }
  }
  function gravarRecorde(n, p) {
    try { localStorage.setItem("churrasco:recorde:" + n, String(p)); } catch (_) { /* tudo bem */ }
  }

  document.getElementById("recomecar").addEventListener("click", () => { if (inicio) recomecar(); });
  botaoProxima.addEventListener("click", () => carregarFase(fase + 1));
  botaoDesfazer.addEventListener("click", desfazer);
  botoesPoder.congelar.addEventListener("click", usarCongelar);
  botoesPoder.martelo.addEventListener("click", armarMartelo);
  botoesPoder.juntar.addEventListener("click", usarJuntar);
  const botaoSom = document.getElementById("som");
  function mostrarSom() {
    botaoSom.textContent = S.estaLigado() ? "🔊" : "🔇";
    botaoSom.setAttribute("aria-label", S.estaLigado() ? "Desligar som" : "Ligar som");
  }
  botaoSom.addEventListener("click", () => { S.alternar(); mostrarSom(); });
  mostrarSom();

  // ?fase=N no endereço abre direto a fase N (útil para testar).
  const pedida = parseInt(new URLSearchParams(location.search).get("fase"), 10);
  carregarFase(pedida > 0 ? pedida : fase);
})();
