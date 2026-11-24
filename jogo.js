// jogo.js · A "tela" do Trio na Grelha (ex-Churrasco Sort): desenha as grelhas
// e responde ao mouse e ao dedo.
//
// 2026-11-24: nível escolhido no painel (seletor "Nível", igual aos outros
//           jogos da Jogoteca) em vez do menu por cima; celular deitado em
//           2 colunas (controles | grelhas), com o nº de colunas de grelhas
//           escolhido para as comidas ficarem do maior tamanho possível.
// Quem decide se a jogada vale é sempre o regras.js. Aqui só mostramos.
//
// Etapa 6+: 12 grelhas que se ajustam ao tamanho da tela, arrasto mais
//           suave (solta na grelha toda, não só no lugar exato) e menu de
//           níveis (Fácil, Médio, Difícil), cada um começando na fase 01.
// Etapa 6: pontos com combo, 3 poderes (congelar, martelo, juntar) e som.
// Etapa 5: cronômetro (pausa com a aba escondida) e 3 "desfazer" por fase.
// Etapa 4: fases geradas sozinhas (com saída garantida) e progresso salvo.
// Etapa 3: cada grelha mostra a bandeja (próxima camada) embaixo.
// Etapa 2: tocar-e-tocar OU arrastar, com Pointer Events (mouse, dedo e caneta).

(function () {
  const R = window.Regras;
  const S = window.Som;
  const $ = (id) => document.getElementById(id);

  const mesa = $("mesa");
  const aviso = $("aviso");
  const contador = $("contador");
  const titulo = $("fase");
  const seletorNivel = $("nivel");
  const relogioTela = $("relogio");
  const botaoProxima = $("proxima");
  const botaoDesfazer = $("desfazer");
  const botoesPoder = { congelar: $("p-congelar"), martelo: $("p-martelo"), juntar: $("p-juntar") };

  const DESFAZER_POR_FASE = 3;
  const JANELA_COMBO = 6000; // trio até 6 s depois do anterior = combo
  const SEGUNDOS_GELO = 10;

  // ---------- Guardar no navegador (localStorage) ----------
  // O try/catch protege navegadores que bloqueiam o armazenamento (aba anônima).
  function ler(chave, padrao) {
    try { const v = localStorage.getItem("churrasco:" + chave); return v === null ? padrao : v; } catch (_) { return padrao; }
  }
  function gravar(chave, valor) {
    try { localStorage.setItem("churrasco:" + chave, String(valor)); } catch (_) { /* sem problema */ }
  }
  // Cada nível tem o seu progresso e os seus recordes.
  const faseSalva = (nv) => Math.max(1, parseInt(ler("fase:" + nv, "1"), 10) || 1);

  // ---------- Estado do jogo ----------
  let nivel = ler("nivel", "medio");
  let fase = 1;
  let inicio, receitaAtual, grelhas;
  let escolhida, jogadas, ocupado, arraste, ignorarClique = false;
  let tempo, relogio = null, historico, desfazeres, terminou;
  let pontos, combo, ultimoTrio, poderes, congelado = 0, modoMartelo = false;
  const menuAberto = false; // (o menu de níveis saiu; o nível agora fica no painel)

  const doisDigitos = (n) => String(n).padStart(2, "0"); // 1 → "01"

  // =====================================================================
  // FASES
  // =====================================================================

  // Gerar as fases grandes leva até ~2 s, então primeiro mostramos
  // "Preparando..." e só depois (setTimeout) geramos: sem isso, o navegador
  // congelaria antes de conseguir mostrar o aviso.
  function carregarFase(n) {
    fase = n;
    gravar("fase:" + nivel, n);
    pararRelogio();
    titulo.textContent = `Fase ${doisDigitos(n)}`;
    seletorNivel.value = nivel;
    botaoProxima.hidden = true;
    ocupado = true;
    aviso.textContent = "🔥 Preparando a fase...";
    setTimeout(() => {
      const gerada = R.gerarFase(n, nivel);
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
    limparArraste();
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
    aviso.textContent = "Arraste uma comida até uma grelha com espaço.";
    desenhar();
    ajustarTamanho();
    mostrarTempo();
    iniciarRelogio();
  }

  // =====================================================================
  // TAMANHO: as 12 grelhas cabem na tela, seja qual for a tela
  // =====================================================================
  // Tudo no CSS é medido em "--lado" (o tamanho de 1 lugar). Aqui fazemos a
  // conta de quanto o --lado pode ter para a mesa caber na LARGURA e na
  // ALTURA que sobram, e ficamos com o MENOR dos dois (senão vaza em um).
  // As contas (3,32 · 10,32 · 1,62...) vêm das medidas do estilo.css:
  //   1 grelha de largura = 3 lugares + 2 vãos (0,06) + 2 margens (0,1) = 3,32 lados
  //   a mesa de largura   = 3 grelhas + 2 vãos (0,18)                  = 10,32 lados
  //   1 bloco de altura   = lugar + margens + bandeja ≈ 1,62 lado + 8 px
  // Celular DEITADO (tela baixa e larga): a coluna da esquerda (.lateral) tem
  // os controles e a mesa fica à direita. Aí testamos de 3 a 6 colunas de
  // grelhas e ficamos com a que deixa o --lado MAIOR (comidas maiores).
  const telaDeitada = () => window.matchMedia("(orientation: landscape) and (max-height: 560px)").matches;
  function ladoPara(colunas, larguraLivre, alturaLivre) {
    const linhas = Math.ceil(grelhas.length / colunas);
    const pelaLargura = larguraLivre / (colunas * 3.32 + (colunas - 1) * 0.18);
    const pelaAltura = (alturaLivre - linhas * 8) / (linhas * 1.62 + (linhas - 1) * 0.14);
    return Math.floor(Math.min(pelaLargura, pelaAltura));
  }
  function ajustarTamanho() {
    if (!grelhas) return;
    const estilo = getComputedStyle(document.body);
    let colunas = 3, lado;
    if (telaDeitada()) {
      const alturaLivre = window.innerHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom) - 6;
      const larguraLivre = document.documentElement.clientWidth - $("lateral").offsetWidth
        - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight) - parseFloat(estilo.columnGap || 16) - 6;
      lado = 0;
      for (let c = 3; c <= 6; c++) {
        const l = ladoPara(c, larguraLivre, alturaLivre);
        if (l > lado) { lado = l; colunas = c; }
      }
    } else {
      const folgaVertical = parseFloat(estilo.paddingTop) + parseFloat(estilo.paddingBottom) + parseFloat(estilo.rowGap || 8) * 4;
      const outros = ["topo", "poderes", "aviso", "botoes"].reduce((soma, id) => soma + $(id).offsetHeight, 0);
      const alturaLivre = window.innerHeight - outros - folgaVertical - 4;
      const larguraLivre = Math.min(document.documentElement.clientWidth - 24, 820);
      lado = ladoPara(colunas, larguraLivre, alturaLivre);
    }
    mesa.style.gridTemplateColumns = "repeat(" + colunas + ", auto)";
    mesa.style.setProperty("--lado", Math.max(26, Math.min(88, lado)) + "px");
  }
  window.addEventListener("resize", ajustarTamanho);
  window.addEventListener("orientationchange", () => setTimeout(ajustarTamanho, 200));

  // =====================================================================
  // RELÓGIO
  // =====================================================================
  // A cada 1 segundo, tira 1 do tempo. Não conta com a aba escondida
  // (document.hidden), com o menu aberto ou durante o gelo.
  function iniciarRelogio() {
    pararRelogio();
    relogio = setInterval(() => {
      if (document.hidden || terminou || menuAberto) return;
      if (congelado > 0) {
        congelado--;
        if (congelado === 0) mesa.classList.remove("gelo");
        mostrarTempo();
        return;
      }
      tempo--;
      mostrarTempo();
      if (tempo > 0 && tempo <= 10) S.tique();
      if (tempo <= 0) perder();
    }, 1000);
  }
  function pararRelogio() {
    if (relogio) clearInterval(relogio);
    relogio = null;
  }
  function mostrarTempo() {
    const t = Math.max(tempo, 0);
    relogioTela.textContent = (congelado > 0 ? `❄️ ${congelado}s · ` : "") + `⏱ ${Math.floor(t / 60)}:${doisDigitos(t % 60)}`;
    relogioTela.classList.toggle("acabando", tempo <= 20);
  }
  function perder() {
    terminou = true;
    pararRelogio();
    limparArraste();
    escolhida = null;
    modoMartelo = false;
    mesa.classList.remove("martelo", "gelo");
    desenhar();
    S.derrota();
    aviso.textContent = "⏰ O tempo acabou! Toque em Recomeçar para tentar de novo.";
  }

  // =====================================================================
  // DESENHAR (a tela é um "retrato" de `grelhas`)
  // =====================================================================
  function desenhar(animar = [], pousou = null) {
    mesa.innerHTML = "";
    grelhas.forEach((pilha, g) => {
      const bloco = document.createElement("div");
      bloco.className = "bloco";
      bloco.dataset.g = g;
      const div = document.createElement("div");
      div.className = "grelha";
      if (animar.includes(g)) div.classList.add("subiu");
      R.frente(pilha).forEach((comida, l) => {
        const lugar = document.createElement("button");
        lugar.className = "lugar";
        lugar.dataset.g = g;
        lugar.dataset.l = l;
        if (comida) {
          lugar.textContent = R.COMIDAS[comida];
          lugar.setAttribute("aria-label", comida);
          lugar.addEventListener("pointerdown", (e) => comecarArraste(e, g, l));
        } else {
          lugar.classList.add("vazio");
          lugar.setAttribute("aria-label", "lugar vazio");
        }
        if (escolhida && escolhida.g === g && escolhida.l === l) lugar.classList.add("escolhida");
        if (pousou && pousou.g === g && pousou.l === l) lugar.classList.add("pousou");
        lugar.addEventListener("click", () => tocar(g, l));
        div.appendChild(lugar);
      });
      bloco.appendChild(div);

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

  function atualizarBotoes() {
    botaoDesfazer.textContent = `↶ Desfazer (${desfazeres})`;
    botaoDesfazer.disabled = terminou || historico.length === 0 || desfazeres === 0;
    for (const nome of Object.keys(botoesPoder)) {
      botoesPoder[nome].querySelector("b").textContent = poderes[nome];
      botoesPoder[nome].disabled = terminou || poderes[nome] === 0;
    }
    botoesPoder.martelo.classList.toggle("ativo", modoMartelo);
  }

  // =====================================================================
  // ONDE A COMIDA VAI CAIR
  // =====================================================================
  // Melhoria do arrasto: não precisa acertar o lugar vazio exato. Basta
  // soltar EM CIMA DA GRELHA (ou da bandeja dela): o jogo escolhe o lugar
  // vazio mais perto do dedo. É como jogar uma bola na cesta: o aro
  // inteiro vale, não só o centro.
  function destinoEm(x, y) {
    const el = document.elementFromPoint(x, y);
    const bloco = el && el.closest(".bloco");
    if (!bloco) return null;
    const g = +bloco.dataset.g;
    const lugares = [...bloco.querySelectorAll(".lugar")];
    let melhor = null, menorDist = Infinity;
    lugares.forEach((b, l) => {
      if (R.frente(grelhas[g])[l] !== null) return;     // ocupado
      const r = b.getBoundingClientRect();
      const d = Math.abs(x - (r.left + r.width / 2));   // distância na horizontal
      if (d < menorDist) { menorDist = d; melhor = { g, l, botao: b }; }
    });
    return melhor || { g, l: -1, cheia: true, bloco };
  }

  // =====================================================================
  // MODO TOCAR (tocar na comida e depois na grelha)
  // =====================================================================
  function tocar(g, l) {
    if (ignorarClique) { ignorarClique = false; return; }
    if (ocupado || terminou) return;
    if (modoMartelo) {
      const tipo = R.frente(grelhas[g])[l];
      if (tipo) usarMartelo(tipo);
      return;
    }
    const comida = R.frente(grelhas[g])[l];
    if (comida !== null && !(escolhida && escolhida.g !== g && R.frente(grelhas[g]).includes(null))) {
      // Tocou numa comida: escolhe (ou desescolhe).
      escolhida = escolhida && escolhida.g === g && escolhida.l === l ? null : { g, l };
      if (escolhida) S.pegar();
      desenhar();
      return;
    }
    if (!escolhida) return;
    // Tocou num lugar vazio, ou numa grelha com espaço: vai para o vazio mais perto.
    const vazio = comida === null ? l : R.frente(grelhas[g]).indexOf(null);
    const origem = escolhida;
    escolhida = null;
    jogar(origem, { g, l: vazio });
  }

  // =====================================================================
  // MODO ARRASTAR: APERTAR → MOVER → SOLTAR
  // =====================================================================
  function comecarArraste(e, g, l) {
    if (ocupado || terminou || modoMartelo || menuAberto || e.button > 0) return;
    const botao = e.currentTarget;
    const r = botao.getBoundingClientRect();
    arraste = {
      g, l, botao,
      x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
      // Onde o dedo pegou DENTRO da comida: o fantasma mantém esse ponto
      // debaixo do dedo (sem "pular" para o centro), como pegar um objeto de verdade.
      dx: e.clientX - r.left, dy: e.clientY - r.top, tam: r.width,
      folga: e.pointerType === "mouse" ? 4 : 7, // o dedo treme mais que o mouse
      fantasma: null, alvo: null, quadro: 0,
    };
    try { botao.setPointerCapture(e.pointerId); } catch (_) { /* navegador antigo: segue sem */ }
    botao.addEventListener("pointermove", moverArraste);
    botao.addEventListener("pointerup", soltarArraste);
    botao.addEventListener("pointercancel", cancelarArraste);
  }

  function moverArraste(e) {
    if (!arraste) return;
    arraste.x = e.clientX;
    arraste.y = e.clientY;
    if (!arraste.fantasma) {
      if (Math.hypot(e.clientX - arraste.x0, e.clientY - arraste.y0) < arraste.folga) return; // ainda é toque
      const f = document.createElement("div");
      f.className = "fantasma";
      f.textContent = R.COMIDAS[R.frente(grelhas[arraste.g])[arraste.l]];
      f.style.width = f.style.height = arraste.tam + "px";
      f.style.fontSize = arraste.tam * 0.62 + "px";
      document.body.appendChild(f);
      arraste.fantasma = f;
      arraste.botao.classList.add("saindo");
      arraste.botao.classList.remove("escolhida");
      escolhida = null;
      S.pegar();
    }
    // Em vez de mexer no fantasma a CADA evento (podem ser 200 por segundo),
    // pedimos ao navegador para mexer uma vez por quadro da tela
    // (requestAnimationFrame, ~60 vezes por segundo): fica liso e leve.
    if (!arraste.quadro) arraste.quadro = requestAnimationFrame(desenharArraste);
  }

  function desenharArraste() {
    if (!arraste || !arraste.fantasma) return;
    arraste.quadro = 0;
    const { x, y, dx, dy } = arraste;
    arraste.fantasma.style.transform = `translate3d(${x - dx}px, ${y - dy - 10}px, 0) scale(1.15)`;

    // Acende o lugar onde a comida vai cair (ou a grelha cheia, em vermelho).
    const d = destinoEm(x, y);
    document.querySelectorAll(".alvo, .mira, .cheia").forEach((el) => el.classList.remove("alvo", "mira", "cheia"));
    if (d && d.cheia) d.bloco.querySelector(".grelha").classList.add("cheia");
    else if (d && d.g !== arraste.g) {
      d.botao.classList.add("alvo");
      d.botao.parentElement.classList.add("mira");
    }
    arraste.alvo = d && !d.cheia && d.g !== arraste.g ? d : null;
  }

  function soltarArraste(e) {
    if (!arraste) return;
    arraste.x = e.clientX;
    arraste.y = e.clientY;
    if (!arraste.fantasma) { limparArraste(); return; } // não arrastou: o "click" cuida (modo tocar)
    ignorarClique = true;
    setTimeout(() => { ignorarClique = false; }, 0);
    desenharArraste();
    const era = arraste;
    const alvo = era.alvo;
    if (alvo) {
      limparArraste();
      jogar({ g: era.g, l: era.l }, { g: alvo.g, l: alvo.l });
    } else {
      // Soltou fora (ou numa grelha cheia): a comida VOLTA deslizando pro lugar.
      if (destinoEm(era.x, era.y)?.cheia) S.erro();
      const r = era.botao.getBoundingClientRect();
      era.fantasma.classList.add("voltando");
      era.fantasma.style.transform = `translate3d(${r.left}px, ${r.top}px, 0) scale(1)`;
      ocupado = true;
      setTimeout(() => { ocupado = false; limparArraste(); desenhar(); }, 170);
    }
  }

  function cancelarArraste() { limparArraste(); desenhar(); }

  function limparArraste() {
    if (!arraste) return;
    const b = arraste.botao;
    b.removeEventListener("pointermove", moverArraste);
    b.removeEventListener("pointerup", soltarArraste);
    b.removeEventListener("pointercancel", cancelarArraste);
    if (arraste.quadro) cancelAnimationFrame(arraste.quadro);
    if (arraste.fantasma) arraste.fantasma.remove();
    document.querySelectorAll(".alvo, .mira, .cheia").forEach((el) => el.classList.remove("alvo", "mira", "cheia"));
    b.classList.remove("saindo");
    arraste = null;
  }

  // =====================================================================
  // A JOGADA (igual para tocar e arrastar): SOLTAR → CONFERIR → LIMPAR → FIM?
  // =====================================================================
  function jogar(origem, destino) {
    const camadasAntes = grelhas[origem.g].length;
    const foto = R.copiar(grelhas);
    if (!R.mover(grelhas, origem, destino)) { S.erro(); desenhar(); return; }
    historico.push({ grelhas: foto, pontos, combo });
    S.soltar();
    jogadas++;
    desenhar(grelhas[origem.g].length < camadasAntes ? [origem.g] : [], destino);
    const comTrio = [destino.g, origem.g].filter((g, i, lista) => lista.indexOf(g) === i && R.temTrio(grelhas[g]));
    if (comTrio.length === 0) return;
    ocupado = true;
    comTrio.forEach((g) => mesa.children[g].querySelector(".grelha").classList.add("trio"));
    marcarTrio(comTrio.length);
    setTimeout(() => {
      const subiram = comTrio.filter((g) => grelhas[g].length > 1);
      comTrio.forEach((g) => R.limparSeTrio(grelhas, g));
      ocupado = false;
      desenhar(subiram);
      conferirVitoria();
    }, 420);
  }

  function marcarTrio(quantos) {
    const agora = performance.now();
    combo = agora - ultimoTrio <= JANELA_COMBO ? combo + 1 : 1;
    ultimoTrio = agora;
    const ganho = R.pontosDoTrio(combo) * quantos;
    pontos += ganho;
    S.trio(combo);
    mostrarFlutuante(combo > 1 ? `Combo x${combo}! +${ganho}` : `+${ganho}`);
  }

  function mostrarFlutuante(texto) {
    const f = document.createElement("div");
    f.className = "flutuante";
    f.textContent = texto;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  }

  function conferirVitoria() {
    if (!R.venceu(grelhas) || terminou) return;
    terminou = true;
    pararRelogio();
    const bonus = R.bonusDeTempo(tempo);
    pontos += bonus;
    const chave = `recorde:${nivel}:${fase}`;
    const recorde = parseInt(ler(chave, "0"), 10) || 0;
    const novo = pontos > recorde;
    if (novo) gravar(chave, pontos);
    desenhar();
    S.vitoria();
    const t = Math.max(tempo, 0);
    aviso.textContent = `🎉 Fase ${doisDigitos(fase)} completa, sobrando ${Math.floor(t / 60)}:${doisDigitos(t % 60)} (+${bonus}). ⭐ ${pontos}` +
      (novo ? " · NOVO RECORDE!" : ` · recorde: ${recorde}`);
    gravar("fase:" + nivel, fase + 1);
    botaoProxima.hidden = false;
    ajustarTamanho();
    botaoProxima.focus();
  }

  // =====================================================================
  // DESFAZER E PODERES
  // =====================================================================
  function desfazer() {
    if (ocupado || terminou || historico.length === 0 || desfazeres === 0) return;
    const foto = historico.pop();
    grelhas = foto.grelhas;
    pontos = foto.pontos;   // os pontos voltam junto: senão dava pra "farmar"
    combo = foto.combo;
    desfazeres--;
    escolhida = null;
    S.soltar();
    desenhar();
  }

  function gastar(nome) {   // usar poder apaga o desfazer (senão o poder sairia de graça)
    poderes[nome]--;
    historico = [];
  }
  function usarCongelar() {
    if (ocupado || terminou || poderes.congelar === 0) return;
    gastar("congelar");
    congelado = SEGUNDOS_GELO;
    mesa.classList.add("gelo");
    S.gelo();
    mostrarTempo();
    desenhar();
  }
  function armarMartelo() {
    if (ocupado || terminou || poderes.martelo === 0) return;
    modoMartelo = !modoMartelo;
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
  function usarJuntar() {
    if (ocupado || terminou || poderes.juntar === 0) return;
    const tipo = R.escolherParaJuntar(grelhas); // a mais à vista que NÃO trava a fase
    if (!tipo) return;
    gastar("juntar");
    S.poder();
    aplicarRemocao(tipo, "✨");
  }
  function aplicarRemocao(tipo, icone) {
    const mudaram = R.removerTrio(grelhas, tipo) || [];
    const e = R.COMIDAS[tipo];
    aviso.textContent = `${icone} ${e}${e}${e} saíram!`;
    marcarTrio(1);
    desenhar(mudaram);
    conferirVitoria();
  }

  // =====================================================================
  // NÍVEL (seletor no painel, igual aos outros jogos da Jogoteca)
  // =====================================================================
  // Trocar o nível continua da fase em que você parou NAQUELE nível
  // (cada nível guarda o seu progresso e os seus recordes).
  seletorNivel.addEventListener("change", () => {
    const nv = seletorNivel.value;
    if (!R.NIVEIS[nv]) return;
    nivel = nv;
    gravar("nivel", nv);
    limparArraste();
    carregarFase(faseSalva(nv));
  });

  // =====================================================================
  // BOTÕES E INÍCIO
  // =====================================================================
  $("recomecar").addEventListener("click", () => { if (inicio) recomecar(); });
  botaoProxima.addEventListener("click", () => carregarFase(fase + 1));
  botaoDesfazer.addEventListener("click", desfazer);
  botoesPoder.congelar.addEventListener("click", usarCongelar);
  botoesPoder.martelo.addEventListener("click", armarMartelo);
  botoesPoder.juntar.addEventListener("click", usarJuntar);
  const botaoSom = $("som");
  function mostrarSom() {
    botaoSom.textContent = S.estaLigado() ? "🔊" : "🔇";
    botaoSom.setAttribute("aria-label", S.estaLigado() ? "Desligar som" : "Ligar som");
  }
  botaoSom.addEventListener("click", () => { S.alternar(); mostrarSom(); });
  mostrarSom();

  // ?fase=N&nivel=facil no endereço abre direto (útil para testar).
  // Sem isso, o jogo abre direto no último nível usado, na fase em que parou.
  const pedido = new URLSearchParams(location.search);
  const pedida = parseInt(pedido.get("fase"), 10);
  if (R.NIVEIS[pedido.get("nivel")]) nivel = pedido.get("nivel");
  if (!R.NIVEIS[nivel]) nivel = "medio";
  seletorNivel.value = nivel;
  carregarFase(pedida > 0 ? pedida : faseSalva(nivel));
})();
