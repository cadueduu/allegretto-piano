# Allegretto Piano — Roadmap de Melhorias

## #1 · Compasso por música + seletor de fórmula de compasso

**O quê:** Adicionar o campo `timeSignature` (ex: `'4/4'`, `'3/4'`, `'6/8'`) em cada música do array `SONGS`. Exibir o compasso no card de seleção de música, no cabeçalho do modo Aprender e na barra de informações da Partitura.

**Detalhes técnicos:**
- Campo novo em cada música: `timeSignature: '4/4'`
- Exibido como badge (ex: **4/4**) ao lado do BPM no card de música
- No modo Aprender e Treino, indicado no topo da tela
- Na Partitura, colocado no início da pauta como notação musical real

**Impacto:** Contexto musical real para o aluno; ajuda na leitura rítmica.

---

## #2 · Metrônomo visual com pulsação de compasso

**O quê:** Indicador de pulso visível sincronizado ao BPM de cada música. O beat 1 de cada compasso recebe um acento visual maior (círculo/flash maior ou mais brilhante). Os demais beats pulsam de forma mais suave.

**Detalhes técnicos:**
- Usar `Tone.Transport` já disponível no projeto para sincronizar o pulso
- Exibir 2–4 pontos no topo do canvas (um por beat do compasso)
- Beat 1: animação maior + cor de destaque
- Beats 2–4: animação menor + cor neutra
- Pode ser ativado/desativado independentemente

**Impacto:** Ajuda o aluno a internalizar o tempo e a acentuação rítmica sem precisar de um metrônomo externo.

---

## #3 · Velocidade ajustável por música (% do BPM)

**O quê:** Slider de 50% a 150% do BPM original de cada música, disponível nos modos Aprender, Treino e Partitura. Permite começar devagar e acelerar gradualmente — técnica clássica de estudo.

**Detalhes técnicos:**
- Slider com marcações: 50% / 75% / 100% / 125% / 150%
- BPM efetivo = `bpm * (percentage / 100)`
- O slider reseta para 100% ao trocar de música
- Exibir o BPM resultante ao lado do slider (ex: "80 bpm")

**Impacto:** Remove a barreira de entrada para músicas difíceis; aluno pode dominar o ritmo antes de acelerar.

---

## #4 · Histórico de progresso por música

**O quê:** Salvar no `localStorage` métricas de prática por música: melhor porcentagem de acertos, maior sequência perfeita (combo), total de sessões e data da última prática.

**Detalhes técnicos:**
- Chave no localStorage: `allegretto_progress_<song_id>`
- Dados: `{ bestScore, bestCombo, sessions, lastPlayed }`
- Atualizado ao fim de cada sessão no modo Treino
- Exibido no card da música como badge de progresso (ex: "Melhor: 94%")
- Pequena barra de progresso visual no card

**Impacto:** Motivação e gamificação; o aluno vê a evolução ao longo do tempo.

---

## #5 · Modo Partitura com destaque de compasso

**O quê:** Na partitura que rola, colorir com um retângulo de fundo suave o compasso inteiro que está sendo tocado no momento, em vez de destacar apenas a nota individual.

**Detalhes técnicos:**
- Calcular as fronteiras de cada compasso com base no `timeSignature` e nas durações das notas
- Renderizar um `<rect>` de fundo (cor suave, ~10% opacidade) no compasso atual
- Animação de transição suave ao avançar para o próximo compasso

**Impacto:** Aproxima a interface de uma partitura real; melhora a leitura musical contextual.

---

## #6 · Identificação de acordes no Modo Livre

**O quê:** Quando 3 ou mais notas são tocadas simultaneamente no Modo Livre, detectar o acorde formado (ex: Dó maior, Lá menor, Sol7) e exibir o nome no centro do canvas com animação de fade.

**Detalhes técnicos:**
- Algoritmo de detecção: normalizar notas para uma oitava, verificar intervalos contra um dicionário de acordes comuns (tríades maiores/menores, dominante 7ª, diminuto)
- Exibir nome em PT-BR e sigla (ex: "Dó maior — C")
- Fade in ao detectar, fade out 2s após todas as notas serem liberadas

**Impacto:** Educacional; conecta a exploração livre com teoria musical; surpreende e engaja o usuário.

---

## #7 · Teclado com oitavas expansíveis

**O quê:** Botões `−` e `+` para reduzir ou expandir o alcance do piano exibido: de 1 oitava (mobile) até 3–4 oitavas (desktop). A região exibida pode ser deslocada (scroll de oitava).

**Detalhes técnicos:**
- Estado `visibleOctaves: number` (padrão: 2 no mobile, 3 no desktop)
- Botões de navegação (`‹` `›`) para deslizar a janela de oitavas
- Teclas de PC e MIDI continuam funcionando independentemente do trecho visível

**Impacto:** Resolve a limitação principal no mobile; permite explorar registros graves/agudos.

---

## #8 · Modo Dueto (mão esquerda / mão direita)

**O quê:** No multiplayer, permitir que dois músicos toquem a mesma música dividida por regiões: um cuida das notas graves (mão esquerda) e o outro das notas agudas (mão direita). Cada participante vê sua parte destacada.

**Detalhes técnicos:**
- Na sala multiplayer, opção "Modo Dueto" ao lado do código da sala
- Host escolhe o ponto de divisão (padrão: Dó4 = divisão clássica)
- Cada participante vê as notas esperadas apenas da sua metade
- Ambos veem a partitura completa mas com regiões coloridas diferentemente

**Impacto:** Experiência social única; transforma o multiplayer de "tocar junto" em "tocar em conjunto com papéis definidos".

---

## #9 · Exportar gravação do Modo Livre como MIDI

**O quê:** Durante uma sessão no Modo Livre, gravar todas as notas tocadas (nota + timestamp de início + duração). Ao encerrar, oferecer download de um arquivo `.mid` padrão.

**Detalhes técnicos:**
- Gravar eventos em um array: `{ note, startTime, duration, velocity }`
- Ao fechar o Modo Livre (ou via botão "Exportar"), gerar o binário MIDI usando uma biblioteca leve (ex: `midi-writer-js`) ou implementação manual do formato MIDI 0
- Nome do arquivo: `allegretto-livre-<timestamp>.mid`

**Impacto:** Transforma a brincadeira em algo concreto; usuário pode importar no DAW ou compartilhar.

---

## #10 · Dificuldade dinâmica no Modo Treino

**O quê:** O BPM se ajusta automaticamente com base na performance em tempo real. Acertos consecutivos aumentam a velocidade; erros consecutivos reduzem.

**Detalhes técnicos:**
- A cada 5 acertos seguidos: BPM +5% (máximo: 150% do original)
- A cada 3 erros seguidos: BPM −10% (mínimo: 60% do original)
- Indicador visual de "velocidade atual" com seta para cima/baixo
- Opção de desativar o ajuste automático nas configurações do modo

**Impacto:** Mantém o aluno na "zona de desafio ideal" (nem fácil demais, nem impossível); reduz a frustração.

---

## #11 · Sons alternativos (timbre do instrumento)

**O quê:** Seletor de instrumento no painel de controle com 4–5 opções de timbre, todas geradas via `Tone.js` (já presente no projeto).

**Opções planejadas:**
- 🎹 Piano (padrão atual — PolySynth triangle)
- 🎹 Piano de Cauda (AMSynth + reverb longo)
- 🎸 Guitarra (PluckSynth)
- 🎵 Flauta (FMSynth com envelope suave)
- 🎺 Órgão (FMSynth sustain infinito)

**Detalhes técnicos:**
- Estado `instrument: 'piano' | 'guitar' | 'flute' | 'organ'`
- Troca o preset do `synthRef` ao mudar
- Persiste no `localStorage`

**Impacto:** Muda completamente o clima sem alterar nenhuma lógica de notas; custo de implementação baixo, impacto alto.

---

## #12 · Página de músicas com filtro e busca

**O quê:** Substituir a lista simples de músicas por uma grade com busca por texto e filtros por dificuldade (⭐ 1–3), compasso (4/4, 3/4, 6/8) e artista.

**Detalhes técnicos:**
- Campo de busca com debounce (300ms)
- Chips de filtro clicáveis: `[Fácil] [Médio] [Difícil] [4/4] [3/4]`
- Ordenação: por dificuldade, título A–Z ou "último tocado"
- Animação de entrada/saída das músicas filtradas (fade + scale)

**Impacto:** Com 18+ músicas (e crescendo), a navegação sem filtro já começa a ficar lenta; essencial para escalar o catálogo.

---

*Documento gerado em 2026-05-29. Prioridades discutidas com o desenvolvedor.*
