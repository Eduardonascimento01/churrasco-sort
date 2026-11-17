# 🔥 Churrasco Sort

Jogo de juntar 3 comidas iguais na mesma grelha. Feito do zero, em HTML e JavaScript puro, responsivo (PC e celular), uma etapa por vez, para aprender como esse tipo de jogo funciona por dentro.

**Jogar:** https://eduardonascimento01.github.io/churrasco-sort/

## Como jogar
1. Toque numa comida (ela sobe).
2. Toque num lugar vazio para levá-la até lá, ou simplesmente **arraste** a comida até ele (mouse ou dedo).
3. Quando 3 comidas iguais ficam na mesma grelha, elas saem.
4. Limpe todas as grelhas para vencer.

## Como o código está organizado
| Arquivo | O que faz |
|---|---|
| `regras.js` | Dados e regras, sem tela: `temTrio`, `mover`, `limparSeTrio`, `venceu`, `temSolucao` |
| `jogo.js` | Tela: desenha as grelhas e responde aos cliques |
| `estilo.css` | Visual (madeira, grelhas e brilho do trio) |
| `teste.js` | Confere as regras sem navegador: `node teste.js` |

## Etapas
- [x] 1. Dados e regra do trio
- [x] 2. Arrastar com mouse e dedo
- [ ] 3. Camadas (a bandeja sobe quando a grelha limpa)
- [ ] 4. Gerar fases que sempre têm solução
- [ ] 5. Tempo e "desfazer"
- [ ] 6. Poderes, combo e som
- [ ] 7. Ranking online
