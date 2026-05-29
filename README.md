# 🎹 Allegretto — Piano Virtual com MIDI

Piano virtual com suporte a teclado MIDI físico, teclado do computador e toque,
com lições interativas para aprender músicas conhecidas.

## Pré-requisitos

- **Node.js 18+** instalado — baixe em https://nodejs.org se ainda não tiver.
- Navegador **Chrome, Edge ou Opera** (para suporte ao Web MIDI API).

Para verificar se já tem Node:
```bash
node --version
```

## Como rodar

Abra um terminal **dentro desta pasta** (`allegretto-piano/`) e execute:

```bash
npm install
```

Aguarde a instalação das dependências (pode demorar 1–2 minutos na primeira vez).
Depois:

```bash
npm run dev
```

O navegador abrirá automaticamente em **http://localhost:5173**.

Quando o navegador perguntar sobre **permissão de MIDI**, clique em "Permitir".
Conecte seu teclado MIDI via USB — o indicador no topo direito fica verde com o nome do dispositivo.

## Comandos disponíveis

- `npm run dev` — modo desenvolvimento (com hot reload)
- `npm run build` — gera versão de produção em `dist/`
- `npm run preview` — visualiza a versão de produção localmente

## Como usar

- **Teclado MIDI**: conecte via USB e toque — funciona automaticamente.
- **Teclado do computador**:
  - Oitava grave (brancas): `Z X C V B N M`
  - Oitava aguda (brancas): `Q W E R T Y U I`
  - Pretas oitava grave: `S D G H J`
  - Pretas oitava aguda: `2 3 5 6 7`
- **Mouse/toque**: clique nas teclas.

Para aprender uma música, clique em **"Escolher música"** e siga o brilho âmbar
na tecla — a próxima nota fica destacada até você acertar.

## Problemas comuns

**"Permissão MIDI negada"** — recarregue a página e autorize no popup do navegador.

**"Nenhum dispositivo detectado"** — verifique o cabo USB e se o teclado está ligado.
Em alguns sistemas, é preciso conectar o MIDI **antes** de abrir o navegador.

**Firefox/Safari** — não têm suporte ao Web MIDI API. Use Chrome, Edge ou Opera.
Você ainda pode tocar pelo teclado do computador ou clicando.

**"npm não é reconhecido"** — instale o Node.js de https://nodejs.org
