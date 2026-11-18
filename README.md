# 🔥 Churrasco Sort

Jogo de juntar 3 comidas iguais na mesma grelha. Feito do zero, em HTML e JavaScript puro, responsivo (PC e celular), uma etapa por vez, para aprender como esse tipo de jogo funciona por dentro.

**Jogar:** https://eduardonascimento01.github.io/churrasco-sort/

## Como jogar
1. Toque numa comida (ela sobe).
2. Toque num lugar vazio para levá-la até lá, ou simplesmente **arraste** a comida até ele (mouse ou dedo).
3. Quando 3 comidas iguais ficam na mesma grelha, elas saem e a **bandeja** de baixo sobe (a próxima camada).
4. Limpe todas as grelhas para vencer e passe para a próxima fase. O jogo lembra em que fase você parou. Para abrir uma fase direto, use `?fase=N` no endereço.

## Como o código está organizado
| Arquivo | O que faz |
|---|---|
| `regras.js` | Dados e regras, sem tela: `temTrio`, `mover`, `limparSeTrio`, `venceu`; gerador de fases (`receita`, `montar`, `gerarFase`) e o solucionador (`resolver`) |
| `jogo.js` | Tela: desenha as grelhas e responde aos cliques |
| `som.js` | Efeitos sonoros sintetizados na hora (Web Audio API), sem arquivos de áudio |
| `estilo.css` | Visual (madeira, grelhas e brilho do trio) |
| `teste.js` | Confere as regras sem navegador e RESOLVE a fase sozinho, provando que ela tem saída: `node teste.js` |

## Etapas
- [x] 1. Dados e regra do trio
- [x] 2. Arrastar com mouse e dedo
- [x] 3. Camadas (a bandeja sobe quando a grelha limpa)
- [x] 4. Gerar fases que sempre têm solução (fases infinitas, dificuldade crescente, progresso salvo)
- [x] 5. Tempo (pausa com a aba escondida) e 3 "desfazer" por fase; sempre 9 grelhas e toda fase mais difícil que a anterior
- [x] 6. Poderes (❄️ congelar 10 s, 🔨 martelo, ✨ juntar; 1 de cada por fase), pontos com combo, recorde por fase e som sintetizado (Web Audio, botão 🔊)
- [ ] 7. Ranking online
