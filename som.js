// som.js · Efeitos sonoros feitos pelo próprio navegador (Web Audio API).
// Nenhum arquivo de áudio é baixado: o som é "sintetizado" na hora.
//
// Como funciona, em 3 peças:
//   OSCILADOR → gera uma onda (o "tom"), numa frequência em Hz.
//               440 Hz = a nota Lá. Frequência maior = som mais agudo.
//   GANHO     → controla o volume; fazemos ele sumir aos poucos ("fade").
//   DESTINO   → os alto-falantes.
// Analogia: o oscilador é a corda do violão, o ganho é a mão que abafa a
// corda, e o destino é a caixa de som.

(function () {
  let ctx = null; // o "estúdio" de áudio. Só pode nascer depois de um toque do jogador.
  let ligado = true;
  try { ligado = localStorage.getItem("churrasco:som") !== "off"; } catch (_) { /* segue ligado */ }

  // Os navegadores proíbem som antes do primeiro toque/clique (para sites
  // não gritarem sozinhos). Por isso o estúdio é criado "preguiçosamente".
  function estudio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Toca uma nota: frequência (Hz), quando começa (s), duração (s), forma da onda.
  function nota(freq, inicio = 0, dur = 0.12, forma = "sine", volume = 0.18) {
    if (!ligado) return;
    const a = estudio();
    if (!a) return;
    const t = a.currentTime + inicio;
    const osc = a.createOscillator();
    const ganho = a.createGain();
    osc.type = forma; // "sine" (suave), "square" (videogame), "triangle", "sawtooth"
    osc.frequency.setValueAtTime(freq, t);
    ganho.gain.setValueAtTime(volume, t);
    ganho.gain.exponentialRampToValueAtTime(0.001, t + dur); // some aos poucos
    osc.connect(ganho).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  const Som = {
    pegar: () => nota(660, 0, 0.06, "triangle", 0.12),
    soltar: () => nota(440, 0, 0.08, "triangle", 0.14),
    erro: () => { nota(160, 0, 0.12, "square", 0.08); nota(120, 0.08, 0.16, "square", 0.08); },
    // Trio: 3 notas subindo. Com combo, começa mais agudo (sobe 2 semitons por combo).
    trio: (combo = 1) => {
      const base = 523 * Math.pow(2, (2 * (combo - 1)) / 12); // 523 Hz = Dó
      [1, 1.25, 1.5].forEach((m, i) => nota(base * m, i * 0.07, 0.16, "sine", 0.2));
    },
    poder: () => [880, 1175, 1568].forEach((f, i) => nota(f, i * 0.05, 0.12, "triangle", 0.14)),
    gelo: () => [1568, 1319, 1047, 1319, 1568].forEach((f, i) => nota(f, i * 0.06, 0.1, "sine", 0.12)),
    martelo: () => { nota(110, 0, 0.18, "square", 0.16); nota(70, 0.05, 0.25, "sawtooth", 0.1); },
    tique: () => nota(1000, 0, 0.03, "square", 0.05),
    vitoria: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => nota(f, i * 0.11, 0.22, "triangle", 0.18)),
    derrota: () => [392, 330, 262, 196].forEach((f, i) => nota(f, i * 0.16, 0.3, "sine", 0.16)),

    estaLigado: () => ligado,
    alternar() {
      ligado = !ligado;
      try { localStorage.setItem("churrasco:som", ligado ? "on" : "off"); } catch (_) { /* tudo bem */ }
      if (ligado) Som.soltar();
      return ligado;
    },
  };

  window.Som = Som;
})();
