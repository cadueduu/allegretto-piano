# Allegretto Piano

Piano virtual com Web MIDI API, 18 músicas, 4 modos de jogo e multiplayer WebRTC peer-to-peer. Tudo em um único componente React.

## Stack

- **React 18** + **Vite** — sem TypeScript
- **Tone.js** — síntese de áudio (PolySynth + Reverb)
- **PeerJS** — WebRTC peer-to-peer (multiplayer)
- **TailwindCSS** — estilização via classes utilitárias
- **Lucide React** — ícones

## Rodar / Build

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

Deploy automático via GitHub Actions (`.github/workflows/deploy.yml`) para GitHub Pages quando faz push em `main`.

---

## Arquitetura

Todo o código fica em **`src/PianoMidi.jsx`** (~2150 linhas). Não há outros componentes. O `src/index.css` só tem as diretivas do Tailwind.

### Notas e teclas (linhas 49–100)

```js
const NOTES = [
  { name:'C4', pt:'Dó', en:'C', isBlack:false, midi:60, key:'z' },
  // ... 25 notas de C4 a C6
];
const WHITE_KEYS  = NOTES.filter(n => !n.isBlack);  // 15 teclas brancas
const BLACK_KEYS  = NOTES.filter(n => n.isBlack);   // 10 teclas pretas
const KEY_TO_NOTE = new Map(NOTES.map(n => [n.key, n]));   // teclado PC
const MIDI_TO_NOTE= new Map(NOTES.map(n => [n.midi, n]));  // MIDI
```

Posição das teclas pretas: calculada em `BLACK_KEY_LEFTS` (Map de noteName → % left).
`WHITE_KEY_WIDTH = 100 / WHITE_KEY_COUNT` em %.

### Músicas (linhas 155–510)

```js
const SONGS = [
  { id:'twinkle', title:'...', artist:'...', bpm:120, difficulty:1,
    notes: ['C4q', 'C4q', 'G4q', ...] }
];
```

Cada nota é uma string: `NotaOitavaDuração` — ex: `C4q` (dó 4ª oitava, semínima).
Durações: `w`=4, `h`=2, `q`=1, `e`=0.5, `s`=0.25, + ponto `d` multiplica × 1.5.
`parseNote(str)` → `{ name, dur }`. `songBeats(song)` soma todos os beats.

---

## Modos de jogo

### 1. Aprender (`!trainingMode && !sheetMode`)

- Destaca a próxima nota em âmbar (classe CSS `lesson-glow` com `pulseGlow`)
- `expectedNote` = nota atual da música
- Ao pressionar a nota correta: avança `currentNoteIndex`
- Sem pressão de tempo — espera o acerto
- Botões: Ouvir (demo automático), Recomeçar

### 2. Treino / Guitar Hero (`trainingMode`)

Estados: `idle → countdown → playing → complete`

- Notas caem de cima via RAF loop (`trainingLoopRef.current`)
- `FALL_BEATS=3` beats para cair; `beatDur` calculado pelo BPM da música
- Janelas de acerto: `PERFECT_MS=90ms`, `GOOD_MS=180ms`, `MISS_Y=112%`
- Score: Perfeito=100pts, Bom=50pts × multiplicador de combo (1–4×)
- `pendingNotesRef` → notas aguardando spawn; `activeNotesListRef` → notas em queda
- Countdown usa `setTimeout` (3, 2, 1)
- Velocidade ajustável: 50%, 75%, 100%, 125%

### 3. Partitura (`sheetMode`)

Estados: `idle → countdown → playing → complete`

- Pauta musical SVG rolando horizontalmente
- `SHEET_PX_PER_BEAT=105px` por beat; `SHEET_PLAYHEAD_X=180px`
- Notas têm `x` calculado continuamente pelo `sheetRafRef` loop
- `NOTE_STAFF_STEPS` mapeia nota → posição diatônica na pauta
- Detecta: clave de sol, linhas suplementares, alterações (♯), caudas, pontos
- Valida nota + timing (mesmas janelas do Treino)
- `sheetExpectedNote` = próxima nota ainda não acertada na região da playhead

### 4. Modo Livre (`freeMode`)

- Toggle no painel de controles abaixo do piano
- Ao pressionar qualquer tecla: etiqueta com nome da nota flutua pra cima (animação CSS `floatUp`)
- Contador de cliques exibido no canto da tecla (`keyClickCounts` Map)
- Botão "Zerar" reseta contadores
- Funciona em paralelo com todos os outros modos

---

## Piano — renderização das teclas (linhas ~1900–1960)

### Lógica de cores

```js
// Dentro do .map() de cada tecla:
const pressColor = (isActive && mpInRoom) ? mpMeRef.current.color
                 : remotePressing.length > 0 ? remotePressing[0].color
                 : null;
const pressGrad  = pressColor
  ? `linear-gradient(180deg,${lightenColor(pressColor)},${pressColor})`
  : null;
```

Prioridade de background:
1. `pressGrad` — multiplayer: cor total do jogador
2. `isActive` → gradiente âmbar (jogo solo)
3. `isExpected` → gradiente âmbar claro (lição)
4. Default → branco (teclas brancas) / preto (teclas pretas)

`lightenColor(hex)` adiciona +75 a cada canal RGB para clarear o topo do gradiente.

### Estados de tecla relevantes

| Estado | Tipo | Descrição |
|--------|------|-----------|
| `activeNotes` | `Set<string>` | Notas que o jogador LOCAL está segurando |
| `remoteNoteDisplay` | `Map<noteName, [{peerId, color}]>` | Notas que remotos estão pressionando |
| `freeFloats` | `[{id, noteName}]` | Animações de float ativas |
| `keyClickCounts` | `Map<noteName, number>` | Contadores do Modo Livre |

---

## Multiplayer (WebRTC via PeerJS)

### Arquitetura host-relay

- Primeiro a entrar com o código vira **host** (PeerID = `allegretto-live-CÓDIGO`)
- Se o ID já existe → entra como **cliente** (conecta ao host)
- Host retransmite todas as mensagens entre clientes (não há P2P direto entre clientes)
- Cada jogador tem seu próprio `Tone.PolySynth` local para ouvir os outros

### Protocolo de mensagens WebRTC

| Tipo | Direção | Payload |
|------|---------|---------|
| `join` | cliente→host | `{ name, color }` |
| `members` | host→cliente | `{ list: [{id, name, color}] }` |
| `member_joined` | host→todos | `{ id, name, color }` |
| `member_left` | host→todos | `{ id }` |
| `note_on` | qualquer→host→todos | `{ note, from? }` |
| `note_off` | qualquer→host→todos | `{ note, from? }` |
| `color_change` | qualquer→host→todos | `{ color, from? }` |

### Refs principais do multiplayer

```js
peerRef        // instância PeerJS
mpHostRef      // bool: sou o host?
mpInRoomRef    // bool: estou numa sala?
mpMeRef        // { name, color, id }
mpConnsRef     // Map<peerId, { conn, name, color }>
mpSynthsRef    // Map<peerId, { synth, reverb }>
mpMembersRef   // [{id, name, color, isMe, isHost}]
remoteNotesRef // Map<noteName, [{peerId, color}]>
broadcastNoteRef // fn(noteName, 'on'|'off') — ref sempre fresco via useEffect sem deps
```

### Cores no multiplayer

- `nameToColor(name)` → hash do nome → 1 de 7 cores predefinidas
- `mpCustomColor` → cor escolhida pelo usuário (salva em `localStorage` como `mp-color`)
- Ao entrar na sala: `color = mpCustomColor || nameToColor(name)`
- `changeMyColor(newColor)` → atualiza `mpMeRef`, `mpMembersRef`, broadcast `color_change`
- Seletor de cor: 7 swatches + picker livre, no lobby e dentro da sala

---

## Entrada de notas

Três fontes, todas chamam `playNote(noteName)` / `releaseNote(noteName)`:

1. **Web MIDI API** — `onmidimessage` (144=noteOn, 128=noteOff); dedup em `midiPressedRef`
2. **Teclado do PC** — `keydown`/`keyup` via `KEY_TO_NOTE`; dedup em `pressedKeysRef`
3. **Toque/clique** — `onPointerDown`/`onPointerUp` nas teclas; dedup em `pianoPointerRef`

`playNote` sempre: toca som + atualiza `activeNotes` + broadcast MP + trigger free mode.

---

## Animações CSS (definidas em `<style>` inline no render)

| Classe/keyframe | Uso |
|-----------------|-----|
| `pulseGlow` | Tecla esperada na lição (`lesson-glow`) |
| `shimmerIn` | Fade-in de seções (`fade-in`) |
| `celebrate` | Próxima nota no painel de lição |
| `feedbackPop` | "PERFEITO / BOM / ERRO" no Treino e Partitura |
| `cdPulse` | Números da contagem regressiva |
| `hzPulse` | Barra de progresso da partitura |
| `floatUp` | Etiqueta subindo no Modo Livre |
| `key-press-anim` | Transição suave das teclas (60ms) |

---

## Estado completo do componente (resumo)

```
UI geral:    volume, audioReady, midiStatus, showLabels, showKeyboardHints, labelLang
Música:      currentSong, currentNoteIndex, expectedNote, songComplete, parsedSongNotes
Treino:      trainingMode, trainingState, displayNotes, trainingScore/Combo/Hits, trainingSpeed
Partitura:   sheetMode, sheetState, sheetNotes, sheetScore/Combo/Hits, sheetSpeed
Modo Livre:  freeMode, keyClickCounts, freeFloats
Multiplayer: mpOpen, mpInRoom, mpIsHost, mpName, mpCustomColor, mpCode, mpMembers,
             mpStatus, mpLoading, remoteNoteDisplay
```

---

## Histórico de versões

| Versão | Features |
|--------|----------|
| v1 | Piano MIDI, 3 modos (Aprender/Treino/Partitura), 18 músicas, multiplayer WebRTC básico com pontinhos coloridos |
| v2 | Modo Livre (animação float + contador por tecla), cor total da tecla no multiplayer, seletor de cor no multiplayer (lobby + sala + broadcast em tempo real) |
