import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import Peer from 'peerjs';
import { Music, Volume2, Usb, Play, RotateCcw, BookOpen, X, Check, Keyboard, Sparkles, Pause, ChevronRight, AlertCircle, Target, Trophy, Zap, Radio, Users, Copy, PenLine, Trash2, Square } from 'lucide-react';

// ============================================================================
// MULTIPLAYER CONSTANTS & HELPERS
// ============================================================================
const MP_PREFIX = 'allegretto-live-';

function nameToColor(name) {
  const P = ['#9bd17e','#7bb3f0','#e07c5e','#c77ee0','#60d4c8','#f09050','#f5e050'];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return P[Math.abs(h) % P.length];
}
function lightenColor(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `#${Math.min(255,r+75).toString(16).padStart(2,'0')}${Math.min(255,g+75).toString(16).padStart(2,'0')}${Math.min(255,b+75).toString(16).padStart(2,'0')}`;
}

// ============================================================================
// TRAINING CONSTANTS
// ============================================================================
const FALL_BEATS = 3;   // beats for a note to travel from top to hit zone
const PERFECT_MS = 90;
const GOOD_MS = 180;
const MISS_Y = 112;     // y% at which an unhit note becomes a miss

// ============================================================================
// SHEET MUSIC (PARTITURA) CONSTANTS
// ============================================================================
const STAFF_LINE_SPACING = 14;   // px between adjacent staff lines
const STAFF_TOP          = 62;   // px from SVG top to top staff line (F5)
const STAFF_SVG_H        = 162;  // total SVG height in px
const SHEET_PLAYHEAD_X   = 180;  // px from left edge to the playhead
const SHEET_PX_PER_BEAT  = 105;  // scrolling speed: pixels per beat

// Diatonic step per note — Lines: E4=2 G4=4 B4=6 D5=8 F5=10 | Spaces between
const NOTE_STAFF_STEPS = {
  'C4':0,'C#4':0,'D4':1,'D#4':1,'E4':2,'F4':3,'F#4':3,'G4':4,'G#4':4,
  'A4':5,'A#4':5,'B4':6,'C5':7,'C#5':7,'D5':8,'D#5':8,'E5':9,'F5':10,
  'F#5':10,'G5':11,'G#5':11,'A5':12,'A#5':12,'B5':13,'C6':14,
};
// Y pixel of a note on the staff
function getNoteStaffY(name) {
  const s = NOTE_STAFF_STEPS[name] ?? 6;
  return STAFF_TOP + (10 - s) * (STAFF_LINE_SPACING / 2);
}

// ============================================================================
// INSTRUMENTS
// ============================================================================
const INSTRUMENTS = [
  { id: 'piano',   label: 'Piano',     opts: { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.4,  sustain: 0.15, release: 1.4  } } },
  { id: 'epiano',  label: 'Piano El.', opts: { oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.9,  sustain: 0.04, release: 1.8  } } },
  { id: 'organ',   label: 'Órgão',     opts: { oscillator: { type: 'square'   }, envelope: { attack: 0.01,  decay: 0.01, sustain: 1,    release: 0.12 } } },
  { id: 'strings', label: 'Cordas',    opts: { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.4,   decay: 0.1,  sustain: 0.9,  release: 1.6  } } },
  { id: 'flute',   label: 'Flauta',    opts: { oscillator: { type: 'sine'     }, envelope: { attack: 0.08,  decay: 0.1,  sustain: 0.85, release: 0.7  } } },
  { id: 'bells',   label: 'Sinos',     opts: { oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.6,  sustain: 0.02, release: 1.2  } } },
];

// ============================================================================
// NOTES
// ============================================================================
const NOTES = [
  { name: 'C4',  pt: 'Dó',  en: 'C',  isBlack: false, midi: 60, key: 'z' },
  { name: 'C#4', pt: 'Dó♯', en: 'C♯', isBlack: true,  midi: 61, key: 's' },
  { name: 'D4',  pt: 'Ré',  en: 'D',  isBlack: false, midi: 62, key: 'x' },
  { name: 'D#4', pt: 'Ré♯', en: 'D♯', isBlack: true,  midi: 63, key: 'd' },
  { name: 'E4',  pt: 'Mi',  en: 'E',  isBlack: false, midi: 64, key: 'c' },
  { name: 'F4',  pt: 'Fá',  en: 'F',  isBlack: false, midi: 65, key: 'v' },
  { name: 'F#4', pt: 'Fá♯', en: 'F♯', isBlack: true,  midi: 66, key: 'g' },
  { name: 'G4',  pt: 'Sol', en: 'G',  isBlack: false, midi: 67, key: 'b' },
  { name: 'G#4', pt: 'Sol♯',en: 'G♯', isBlack: true,  midi: 68, key: 'h' },
  { name: 'A4',  pt: 'Lá',  en: 'A',  isBlack: false, midi: 69, key: 'n' },
  { name: 'A#4', pt: 'Lá♯', en: 'A♯', isBlack: true,  midi: 70, key: 'j' },
  { name: 'B4',  pt: 'Si',  en: 'B',  isBlack: false, midi: 71, key: 'm' },
  { name: 'C5',  pt: 'Dó',  en: 'C',  isBlack: false, midi: 72, key: 'q' },
  { name: 'C#5', pt: 'Dó♯', en: 'C♯', isBlack: true,  midi: 73, key: '2' },
  { name: 'D5',  pt: 'Ré',  en: 'D',  isBlack: false, midi: 74, key: 'w' },
  { name: 'D#5', pt: 'Ré♯', en: 'D♯', isBlack: true,  midi: 75, key: '3' },
  { name: 'E5',  pt: 'Mi',  en: 'E',  isBlack: false, midi: 76, key: 'e' },
  { name: 'F5',  pt: 'Fá',  en: 'F',  isBlack: false, midi: 77, key: 'r' },
  { name: 'F#5', pt: 'Fá♯', en: 'F♯', isBlack: true,  midi: 78, key: '5' },
  { name: 'G5',  pt: 'Sol', en: 'G',  isBlack: false, midi: 79, key: 't' },
  { name: 'G#5', pt: 'Sol♯',en: 'G♯', isBlack: true,  midi: 80, key: '6' },
  { name: 'A5',  pt: 'Lá',  en: 'A',  isBlack: false, midi: 81, key: 'y' },
  { name: 'A#5', pt: 'Lá♯', en: 'A♯', isBlack: true,  midi: 82, key: '7' },
  { name: 'B5',  pt: 'Si',  en: 'B',  isBlack: false, midi: 83, key: 'u' },
  { name: 'C6',  pt: 'Dó',  en: 'C',  isBlack: false, midi: 84, key: 'i' },
];

const KEY_TO_NOTE    = new Map(NOTES.map(n => [n.key, n]));
const MIDI_TO_NOTE   = new Map(NOTES.map(n => [n.midi, n]));
const WHITE_KEYS     = NOTES.filter(n => !n.isBlack);
const BLACK_KEYS     = NOTES.filter(n => n.isBlack);
const WHITE_KEY_COUNT= WHITE_KEYS.length;
const WHITE_KEY_WIDTH= 100 / WHITE_KEY_COUNT;

const BLACK_KEY_LEFTS = new Map(BLACK_KEYS.map(note => {
  const idx = NOTES.indexOf(note);
  let wi = -1;
  for (let i = idx - 1; i >= 0; i--) {
    if (!NOTES[i].isBlack) { wi = WHITE_KEYS.indexOf(NOTES[i]); break; }
  }
  return [note.name, (wi + 1) * WHITE_KEY_WIDTH - WHITE_KEY_WIDTH * 0.30];
}));

function findNoteByMidi(m) {
  const n = MIDI_TO_NOTE.get(m);
  if (n) return n;
  while (m < 60) m += 12;
  while (m > 84) m -= 12;
  return MIDI_TO_NOTE.get(m);
}

function getNoteLayout(noteName) {
  const note = NOTES.find(n => n.name === noteName);
  if (!note) return { left: '0%', width: `${WHITE_KEY_WIDTH}%`, isBlack: false };
  if (note.isBlack) return { left: `${BLACK_KEY_LEFTS.get(noteName)}%`, width: `${WHITE_KEY_WIDTH * 0.6}%`, isBlack: true };
  return { left: `${(WHITE_KEYS.indexOf(note) / WHITE_KEY_COUNT) * 100}%`, width: `${WHITE_KEY_WIDTH}%`, isBlack: false };
}

// Parse note entry: string → {name, dur:1} | [name, dur] → {name, dur}
function parseNote(n) { return Array.isArray(n) ? { name: n[0], dur: n[1] } : { name: n, dur: 1 }; }

// Returns Portuguese note type name based on beat duration
function getNoteTypeName(dur) {
  if (dur >= 3.6)  return 'Semibreve';
  if (dur >= 1.8)  return 'Mínima';
  if (dur >= 0.85) return 'Semínima';
  if (dur >= 0.4)  return 'Colcheia';
  return 'Semicolcheia';
}

// Small SVG musical note icon
function NoteIcon({ dur, color = '#f0a830', size = 16 }) {
  const isWhole  = dur >= 3.6;
  const isHalf   = !isWhole  && dur >= 1.8;
  const is16th   = !isWhole  && !isHalf && dur < 0.4;
  const isEighth = !isWhole  && !isHalf && !is16th && dur < 0.85;
  const dotted   = [4, 2, 1, 0.5, 0.25].some(b => Math.abs(dur - b * 1.5) < 0.07);

  const cx = size * 0.42, cy = size * 0.72;
  const rx = size * 0.27, ry = size * 0.20;
  const sx = cx + rx * 0.85, st = size * 0.10;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display:'inline-block', verticalAlign:'middle', flexShrink:0 }}>
      {isWhole
        ? <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={color} strokeWidth="1.4" fill="none"/>
        : isHalf
        ? <><ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={color} strokeWidth="1.4" fill="none"/>
            <line x1={sx} y1={cy} x2={sx} y2={st} stroke={color} strokeWidth="1.3"/></>
        : <><ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color}/>
            <line x1={sx} y1={cy} x2={sx} y2={st} stroke={color} strokeWidth="1.3"/></>
      }
      {isEighth && <path d={`M${sx},${st} C${sx+5},${st+3} ${sx+5},${st+7} ${sx},${st+10}`} stroke={color} strokeWidth="1.3" fill="none"/>}
      {is16th && <>
        <path d={`M${sx},${st}   C${sx+5},${st+3}  ${sx+5},${st+7}  ${sx},${st+10}`} stroke={color} strokeWidth="1.3" fill="none"/>
        <path d={`M${sx},${st+4} C${sx+5},${st+7}  ${sx+5},${st+11} ${sx},${st+14}`} stroke={color} strokeWidth="1.3" fill="none"/>
      </>}
      {dotted && <circle cx={cx + rx + size * 0.22} cy={cy} r={size * 0.07} fill={color}/>}
    </svg>
  );
}

// ============================================================================
// SONGS
// Each entry: string (quarter note) or [name, beats] where 1=quarter, 0.5=eighth, 2=half, etc.
// ============================================================================
const SONGS = [
  {
    id: 'twinkle', title: 'Brilha Brilha Estrelinha', artist: 'Tradicional', difficulty: 1, bpm: 90, timeSignature: '4/4',
    notes: [
      ['C4',1],['C4',1],['G4',1],['G4',1],['A4',1],['A4',1],['G4',2],
      ['F4',1],['F4',1],['E4',1],['E4',1],['D4',1],['D4',1],['C4',2],
      ['G4',1],['G4',1],['F4',1],['F4',1],['E4',1],['E4',1],['D4',2],
      ['G4',1],['G4',1],['F4',1],['F4',1],['E4',1],['E4',1],['D4',2],
      ['C4',1],['C4',1],['G4',1],['G4',1],['A4',1],['A4',1],['G4',2],
      ['F4',1],['F4',1],['E4',1],['E4',1],['D4',1],['D4',1],['C4',2],
      // octava superior
      ['C5',1],['C5',1],['G5',1],['G5',1],['A5',1],['A5',1],['G5',2],
      ['F5',1],['F5',1],['E5',1],['E5',1],['D5',1],['D5',1],['C5',2],
      ['G5',1],['G5',1],['F5',1],['F5',1],['E5',1],['E5',1],['D5',2],
      ['G5',1],['G5',1],['F5',1],['F5',1],['E5',1],['E5',1],['D5',2],
      ['C5',1],['C5',1],['G5',1],['G5',1],['A5',1],['A5',1],['G5',2],
      ['F5',1],['F5',1],['E5',1],['E5',1],['D5',1],['D5',1],['C5',2],
    ]
  },
  {
    id: 'birthday', title: 'Parabéns pra Você', artist: 'Tradicional', difficulty: 1, bpm: 100, timeSignature: '3/4',
    notes: [
      ['G4',0.75],['G4',0.25],['A4',1],['G4',1],['C5',1],['B4',2],
      ['G4',0.75],['G4',0.25],['A4',1],['G4',1],['D5',1],['C5',2],
      ['G4',0.75],['G4',0.25],['G5',1],['E5',1],['C5',1],['B4',1],['A4',2],
      ['F5',0.75],['F5',0.25],['E5',1],['C5',1],['D5',1],['C5',2],
      // 2ª estrofe
      ['G4',0.75],['G4',0.25],['A4',1],['G4',1],['C5',1],['B4',2],
      ['G4',0.75],['G4',0.25],['A4',1],['G4',1],['D5',1],['C5',2],
      ['G4',0.75],['G4',0.25],['G5',1],['E5',1],['C5',1],['B4',1],['A4',2],
      ['F5',0.75],['F5',0.25],['E5',1],['C5',1],['D5',1],['C5',4],
    ]
  },
  {
    id: 'ode', title: 'Hino da Alegria', artist: 'Beethoven', difficulty: 1, bpm: 85, timeSignature: '4/4',
    notes: [
      // frase 1
      ['E4',1],['E4',1],['F4',1],['G4',1],
      ['G4',1],['F4',1],['E4',1],['D4',1],
      ['C4',1],['C4',1],['D4',1],['E4',1],
      ['E4',1.5],['D4',0.5],['D4',2],
      // frase 2
      ['E4',1],['E4',1],['F4',1],['G4',1],
      ['G4',1],['F4',1],['E4',1],['D4',1],
      ['C4',1],['C4',1],['D4',1],['E4',1],
      ['D4',1.5],['C4',0.5],['C4',2],
      // ponte
      ['D4',1],['D4',1],['E4',1],['C4',1],
      ['D4',1],['E4',0.5],['F4',0.5],['E4',1],['C4',1],
      ['D4',1],['E4',0.5],['F4',0.5],['E4',1],['D4',1],
      ['C4',1],['D4',1],['G4',2],
      // frase 1 recap
      ['E4',1],['E4',1],['F4',1],['G4',1],
      ['G4',1],['F4',1],['E4',1],['D4',1],
      ['C4',1],['C4',1],['D4',1],['E4',1],
      ['D4',1.5],['C4',0.5],['C4',2],
    ]
  },
  {
    id: 'jingle', title: 'Jingle Bells', artist: 'Tradicional', difficulty: 1, bpm: 110, timeSignature: '4/4',
    notes: [
      ['E4',1],['E4',1],['E4',2],
      ['E4',1],['E4',1],['E4',2],
      ['E4',1],['G4',1],['C4',1],['D4',1],['E4',4],
      ['F4',1],['F4',1],['F4',1.5],['F4',0.5],
      ['F4',1],['E4',1],['E4',1],['E4',1],
      ['G4',1],['G4',1],['F4',1],['D4',1],['C4',4],
      ['E4',1],['E4',1],['E4',2],
      ['E4',1],['E4',1],['E4',2],
      ['E4',1],['G4',1],['C4',1],['D4',1],['E4',4],
      ['F4',1],['F4',1],['F4',1.5],['F4',0.5],
      ['F4',1],['E4',1],['E4',1],['E4',0.5],['E4',0.5],
      ['E4',1],['D4',1],['D4',1],['E4',1],
      ['D4',2],['G4',2],
    ]
  },
  {
    id: 'mary', title: 'Mary Tinha um Carneirinho', artist: 'Tradicional', difficulty: 1, bpm: 90, timeSignature: '4/4',
    notes: [
      ['E4',1],['D4',1],['C4',1],['D4',1],
      ['E4',1],['E4',1],['E4',2],
      ['D4',1],['D4',1],['D4',2],
      ['E4',1],['G4',1],['G4',2],
      ['E4',1],['D4',1],['C4',1],['D4',1],
      ['E4',1],['E4',1],['E4',1],['E4',1],
      ['D4',1],['D4',1],['E4',1],['D4',1],
      ['C4',4],
      // 2ª estrofe
      ['E4',1],['D4',1],['C4',1],['D4',1],
      ['E4',1],['E4',1],['E4',2],
      ['D4',1],['D4',1],['D4',2],
      ['E4',1],['G4',1],['G4',2],
      ['E4',1],['D4',1],['C4',1],['D4',1],
      ['E4',1],['E4',1],['E4',1],['E4',1],
      ['D4',1],['D4',1],['E4',1],['D4',1],
      ['C4',4],
    ]
  },
  {
    id: 'asabranca', title: 'Asa Branca', artist: 'Luiz Gonzaga', difficulty: 2, bpm: 80, timeSignature: '4/4',
    notes: [
      ['G4',0.5],['C5',1],['E5',0.5],['C5',0.5],['E5',1],
      ['D5',0.5],['C5',1],['B4',0.5],['C5',1],
      ['D5',0.5],['C5',1],['B4',0.5],['A4',0.5],['G4',2],
      ['G4',0.5],['C5',1],['E5',0.5],['C5',0.5],['E5',1],
      ['D5',0.5],['C5',1],['B4',0.5],['C5',1],
      ['D5',0.5],['C5',1],['B4',0.5],['A4',0.5],['G4',2],
      ['G4',1],['A4',0.5],['A4',0.5],['G4',1],['E4',1],
      ['G4',1],['A4',0.5],['A4',0.5],['G4',1],['E4',1],
      ['G4',0.5],['C5',1],['E5',0.5],['C5',0.5],['E5',1],
      ['D5',0.5],['C5',1],['B4',0.5],['C5',1],
      ['D5',0.5],['C5',1],['B4',0.5],['A4',0.5],['G4',2],
    ]
  },
  {
    id: 'elise', title: 'Para Elisa', artist: 'Beethoven', difficulty: 2, bpm: 56, timeSignature: '3/8',
    notes: [
      // tema A
      ['E5',0.5],['D#5',0.5],['E5',0.5],['D#5',0.5],['E5',0.5],['B4',0.5],['D5',0.5],['C5',0.5],['A4',1.5],['C4',0.5],['E4',0.5],['A4',0.5],
      ['B4',1.5],['E4',0.5],['G#4',0.5],['B4',0.5],
      ['C5',1.5],['E4',0.5],['E5',0.5],['D#5',0.5],['E5',0.5],['D#5',0.5],['E5',0.5],['B4',0.5],['D5',0.5],['C5',0.5],
      ['A4',1.5],['C4',0.5],['E4',0.5],['A4',0.5],
      ['B4',1.5],['E4',0.5],['C5',0.5],['B4',0.5],['A4',3],
      // tema B
      ['B4',0.5],['C5',0.5],['D5',0.5],['E5',1.5],['G4',0.5],['F5',0.5],['E5',0.5],
      ['D5',1.5],['F4',0.5],['E5',0.5],['D5',0.5],
      ['C5',1.5],['E4',0.5],['D5',0.5],['C5',0.5],['B4',3],
      // tema A recap
      ['E5',0.5],['D#5',0.5],['E5',0.5],['D#5',0.5],['E5',0.5],['B4',0.5],['D5',0.5],['C5',0.5],['A4',1.5],['C4',0.5],['E4',0.5],['A4',0.5],
      ['B4',1.5],['E4',0.5],['G#4',0.5],['B4',0.5],
      ['C5',1.5],['E4',0.5],['E5',0.5],['D#5',0.5],['E5',0.5],['D#5',0.5],['E5',0.5],['B4',0.5],['D5',0.5],['C5',0.5],
      ['A4',1.5],['C4',0.5],['E4',0.5],['A4',0.5],
      ['B4',1.5],['E4',0.5],['C5',0.5],['B4',0.5],['A4',3],
    ]
  },
  {
    id: 'cai_cai', title: 'Cai Cai Balão', artist: 'Tradicional', difficulty: 1, bpm: 90, timeSignature: '4/4',
    notes: [
      ['G4',1],['E4',1],['E4',2],['F4',1],['D4',1],['D4',2],
      ['C4',1],['E4',1],['G4',2],['G4',1],['E4',1],['E4',2],
      ['F4',1],['D4',1],['D4',2],['C4',1],['E4',1],['C4',2],
      ['G4',1],['E4',1],['E4',2],['F4',1],['D4',1],['D4',2],
      ['C4',1],['E4',1],['G4',2],['G4',1],['E4',1],['E4',2],
      ['F4',1],['D4',1],['D4',2],['C4',1],['E4',1],['C4',4],
    ]
  },
  {
    id: 'atirei_pau', title: 'Atirei o Pau no Gato', artist: 'Tradicional', difficulty: 1, bpm: 90, timeSignature: '4/4',
    notes: [
      ['C4',1],['C4',1],['G4',1],['G4',1],['G4',1],['A4',1],['A4',1],['G4',2],
      ['F4',1],['F4',1],['E4',1],['E4',1],['D4',1],['D4',1],['C4',2],
      ['G4',1],['G4',1],['G4',1],['A4',1],['A4',1],['G4',1],
      ['F4',1],['F4',1],['E4',1],['E4',1],['D4',1],['D4',1],['C4',2],
      ['C4',1],['C4',1],['G4',1],['G4',1],['G4',1],['A4',1],['A4',1],['G4',2],
      ['F4',1],['F4',1],['E4',1],['E4',1],['D4',1],['D4',1],['C4',4],
    ]
  },
  {
    id: 'ciranda', title: 'Ciranda Cirandinha', artist: 'Tradicional', difficulty: 1, bpm: 85, timeSignature: '4/4',
    notes: [
      ['C4',1],['D4',1],['E4',1],['F4',1],['G4',1],['G4',1],['G4',2],
      ['A4',1],['G4',1],['F4',1],['E4',1],['D4',2],
      ['C4',1],['D4',1],['E4',1],['F4',1],['G4',1],['G4',1],['G4',2],
      ['A4',1],['G4',1],['F4',1],['E4',1],['D4',2],
      ['G4',1],['G4',1],['A4',1],['G4',1],['F4',1],['E4',1],['D4',1],['C4',1],
      ['C4',1],['D4',1],['E4',1],['F4',1],['G4',1],['G4',1],['G4',2],
      ['A4',1],['G4',1],['F4',1],['E4',1],['D4',2],['C4',4],
    ]
  },
  // ---- Músicas novas ----
  {
    id: 'greensleeves', title: 'Greensleeves', artist: 'Tradicional Inglês', difficulty: 2, bpm: 72, timeSignature: '3/4',
    notes: [
      // 3/4: 1=semínima, 0.5=colcheia, 1.5=semínima com ponto
      ['A4',1],['C5',1],['D5',0.5],
      ['E5',1.5],['F5',0.5],['E5',1],
      ['D5',1],['B4',1],['G4',0.5],
      ['A4',1.5],['B4',0.5],['A4',0.5],
      ['G#4',0.5],['A4',1],
      ['C5',1],['D5',0.5],
      ['E5',1.5],['F5',0.5],['G5',1],
      ['E5',3],
      ['C5',1],['B4',0.5],
      ['A4',1.5],['G#4',0.5],['A4',1],
      // refrão
      ['A4',1],['C5',1],['D5',0.5],
      ['E5',1.5],['F5',0.5],['E5',1],
      ['D5',1],['B4',1],['G4',0.5],
      ['A4',3],
      ['C5',1],['E5',0.5],
      ['E5',1.5],['F5',0.5],['E5',1],
      ['D5',1],['C5',0.5],
      ['B4',1.5],['A4',0.5],['A4',1],
      ['A4',3],
    ]
  },
  {
    id: 'amazing_grace', title: 'Amazing Grace', artist: 'John Newton', difficulty: 1, bpm: 65, timeSignature: '3/4',
    notes: [
      // 3/4
      ['G4',1],
      ['C5',1],['E5',1],['C5',1],
      ['E5',1.5],['D5',0.5],['C5',1],
      ['A4',1.5],['G4',0.5],['G4',1],
      ['C5',1],['E5',1],['C5',1],
      ['E5',1],['G5',2],
      ['E5',3],
      ['C5',1],['E5',1],['C5',1],
      ['D5',1.5],['C5',0.5],['A4',1],
      ['G4',1.5],['G4',0.5],['G4',1],
      ['C5',1],['E5',1],['C5',1],
      ['E5',1.5],['D5',0.5],['C5',1],
      ['A4',3],
      ['G4',1],
      ['C5',1],['E5',1],['G5',1],
      ['G5',1.5],['F5',0.5],['E5',1],
      ['C5',1],['E5',1],['C5',1],
      ['D5',1.5],['C5',0.5],['A4',1],
      ['C5',3],
    ]
  },
  {
    id: 'canon', title: 'Cânone em Ré', artist: 'Pachelbel', difficulty: 3, bpm: 72, timeSignature: '4/4',
    notes: [
      // 4/4, semicolcheias agrupadas, 1 beat = semínima
      ['F#5',0.5],['E5',0.5],['D5',0.5],['C#5',0.5],['B4',0.5],['A4',0.5],['B4',0.5],['C#5',0.5],
      ['D5',0.5],['E5',0.5],['F#5',0.5],['E5',0.5],['D5',0.5],['C#5',0.5],['B4',0.5],['A4',0.5],
      ['G4',0.5],['A4',0.5],['B4',0.5],['A4',0.5],['G4',0.5],['F#4',0.5],['E4',0.5],['D4',0.5],
      ['D4',0.5],['E4',0.5],['F#4',0.5],['G4',0.5],['A4',0.5],['B4',0.5],['C#5',0.5],['D5',0.5],
      ['E5',0.5],['F#5',0.5],['G5',0.5],['F#5',0.5],['E5',0.5],['D5',0.5],['C#5',0.5],['B4',0.5],
      ['A4',0.5],['B4',0.5],['C#5',0.5],['D5',0.5],['E5',0.5],['F#5',0.5],['G5',0.5],['A5',0.5],
      ['F#5',1],['D5',1],['E5',1],['C#5',1],
      ['D5',2],['A4',2],
    ]
  },
  {
    id: 'river_flows', title: 'River Flows in You', artist: 'Yiruma', difficulty: 3, bpm: 66, timeSignature: '4/4',
    notes: [
      // melodia principal: colcheias e semínimas
      ['A4',0.5],['B4',0.5],['C#5',0.5],['D5',0.5],['E5',1],['D5',0.5],['C#5',0.5],
      ['B4',0.5],['A4',1],['B4',0.5],['C#5',0.5],['E5',1],
      ['A5',0.5],['G#5',0.5],['F#5',0.5],['E5',1],['D5',0.5],['E5',0.5],
      ['F#5',0.5],['G#5',0.5],['A5',1],['G#5',0.5],['F#5',0.5],
      ['E5',0.5],['D5',0.5],['E5',0.5],['F#5',0.5],['E5',1],['D5',0.5],['C#5',0.5],
      ['B4',0.5],['A4',1.5],
      // repetição / variação
      ['A4',0.5],['B4',0.5],['C#5',0.5],['D5',0.5],['E5',1],['D5',0.5],['C#5',0.5],
      ['B4',0.5],['A4',1],['B4',0.5],['C#5',0.5],['E5',1],
      ['B5',0.5],['A5',0.5],['G#5',0.5],['F#5',0.5],['E5',1],['D5',0.5],['C#5',0.5],
      ['B4',0.5],['A4',2],
    ]
  },
  {
    id: 'bella_ciao', title: 'Bella Ciao', artist: 'Tradicional Italiano', difficulty: 2, bpm: 96, timeSignature: '3/4',
    notes: [
      // 3/4
      ['A4',0.5],
      ['A4',1],['A4',0.5],['B4',0.5],
      ['C5',1],['B4',0.5],['A4',0.5],
      ['E5',1],['E5',0.5],['D5',0.5],
      ['C5',1],['A4',2],
      ['A4',0.5],['A4',0.5],['B4',0.5],['A4',0.5],
      ['G4',1],['F4',0.5],['E4',0.5],
      ['D4',1],['E4',1],
      ['A4',3],
      // refrão
      ['A4',0.5],
      ['A4',1],['A4',0.5],['B4',0.5],
      ['C5',1],['B4',0.5],['A4',0.5],
      ['E5',1],['E5',0.5],['D5',0.5],
      ['C5',1],['A4',2],
      ['A4',0.5],['A4',0.5],['B4',0.5],['A4',0.5],
      ['G4',1],['F4',0.5],['E4',0.5],
      ['D4',1],['E4',1],['A4',3],
    ]
  },
  {
    id: 'moonlight', title: 'Sonata ao Luar', artist: 'Beethoven', difficulty: 3, bpm: 54, timeSignature: '4/4',
    notes: [
      // arpejos em tercinas: 3 notas por tempo (simplificado como colcheias)
      // compassos 1–4: Am
      ['G#4',0.33],['C5',0.33],['E5',0.33],['G#4',0.33],['C5',0.33],['E5',0.33],
      ['G#4',0.33],['C5',0.33],['E5',0.33],['G#4',0.33],['C5',0.33],['E5',0.33],
      ['A4',0.33],['C5',0.33],['E5',0.33],['A4',0.33],['C5',0.33],['E5',0.33],
      ['A4',0.33],['C5',0.33],['E5',0.33],['A4',0.33],['C5',0.33],['E5',0.33],
      // compassos 5–8
      ['G#4',0.33],['B4',0.33],['E5',0.33],['G#4',0.33],['B4',0.33],['E5',0.33],
      ['G#4',0.33],['B4',0.33],['E5',0.33],['G#4',0.33],['B4',0.33],['E5',0.33],
      ['F#4',0.33],['A4',0.33],['D#5',0.33],['F#4',0.33],['A4',0.33],['D#5',0.33],
      ['F#4',0.33],['A4',0.33],['D#5',0.33],['F#4',0.33],['A4',0.33],['D#5',0.33],
      // melodia
      ['G#4',0.33],['C5',0.33],['E5',0.33],['A4',0.33],['C5',0.33],['E5',0.33],
      ['A4',0.5],['G#4',0.5],['A4',0.5],['B4',0.5],
      ['C5',0.5],['D5',0.5],['E5',0.5],['F5',0.5],
      ['E5',1.5],['D5',0.5],['C5',0.5],['B4',0.5],['A4',0.5],
    ]
  },
  {
    id: 'scarborough', title: 'Scarborough Fair', artist: 'Tradicional Inglês', difficulty: 2, bpm: 68, timeSignature: '3/4',
    notes: [
      // 3/4
      ['A4',1],['C5',0.5],
      ['D5',2],['E5',1],
      ['A5',1.5],['G5',0.5],['E5',1],
      ['D5',3],
      ['E5',1],['D5',0.5],
      ['C5',2],['A4',1],
      ['E4',3],
      ['A4',1],['C5',0.5],
      ['D5',2],['E5',1],
      ['A5',1.5],['G5',0.5],['E5',1],
      ['D5',3],
      ['G4',1],['E4',0.5],
      ['G4',1],['A4',0.5],['C5',1],
      ['E5',1.5],['D5',0.5],['C5',1],
      ['A4',3],
      ['G4',1],['E4',0.5],
      ['G4',2],['A4',1],
      ['C5',1],['E5',0.5],['D5',0.5],['C5',0.5],['A4',0.5],
      ['A4',3],
    ]
  },
  {
    id: 'fur_elise_full', title: 'Para Elisa (Completa)', artist: 'Beethoven', difficulty: 3, bpm: 52, timeSignature: '3/8',
    notes: [
      // --- A ---
      ['E5',0.5],['D#5',0.5],['E5',0.5],['D#5',0.5],['E5',0.5],['B4',0.5],['D5',0.5],['C5',0.5],
      ['A4',1.5],['C4',0.5],['E4',0.5],['A4',0.5],
      ['B4',1.5],['E4',0.5],['G#4',0.5],['B4',0.5],
      ['C5',1.5],['E4',0.5],['E5',0.5],['D#5',0.5],
      ['E5',0.5],['D#5',0.5],['E5',0.5],['B4',0.5],['D5',0.5],['C5',0.5],
      ['A4',1.5],['C4',0.5],['E4',0.5],['A4',0.5],
      ['B4',1.5],['E4',0.5],['C5',0.5],['B4',0.5],['A4',3],
      // --- B ---
      ['B4',0.5],['C5',0.5],['D5',0.5],['E5',1.5],['G4',0.5],['F5',0.5],['E5',0.5],
      ['D5',1.5],['F4',0.5],['E5',0.5],['D5',0.5],
      ['C5',1.5],['E4',0.5],['D5',0.5],['C5',0.5],['B4',3],
      // --- C ---
      ['C4',0.5],['E4',0.5],['A4',0.5],['C5',0.5],['E5',0.5],['A5',0.5],
      ['G5',0.5],['E5',0.5],['C5',0.5],['E5',0.5],['G5',0.5],['B5',0.5],
      ['A5',0.5],['G5',0.5],['F5',0.5],['E5',0.5],['D5',0.5],['C5',0.5],
      ['B4',0.5],['D5',0.5],['F5',0.5],['A5',0.5],
      ['D5',1],['C5',0.5],['B4',0.5],['A4',2],
      // --- A recap ---
      ['E5',0.5],['D#5',0.5],['E5',0.5],['D#5',0.5],['E5',0.5],['B4',0.5],['D5',0.5],['C5',0.5],
      ['A4',1.5],['C4',0.5],['E4',0.5],['A4',0.5],
      ['B4',1.5],['E4',0.5],['G#4',0.5],['B4',0.5],
      ['C5',1.5],['E4',0.5],['E5',0.5],['D#5',0.5],
      ['E5',0.5],['D#5',0.5],['E5',0.5],['B4',0.5],['D5',0.5],['C5',0.5],
      ['A4',1.5],['C4',0.5],['E4',0.5],['A4',0.5],
      ['B4',1.5],['E4',0.5],['C5',0.5],['B4',0.5],['A4',4],
    ]
  },
];

// Compute total duration in beats for a song
function songBeats(song) {
  return song.notes.reduce((s, n) => s + parseNote(n).dur, 0);
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function PianoMidi() {
  const [activeNotes,    setActiveNotes]    = useState(new Set());
  const [midiStatus,     setMidiStatus]     = useState('idle');
  const [midiDeviceName, setMidiDeviceName] = useState('');
  const [audioReady,     setAudioReady]     = useState(false);
  const [volume,         setVolume]         = useState(0.7);

  // Lesson
  const [currentSong,      setCurrentSong]      = useState(null);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [showSongList,     setShowSongList]     = useState(false);
  const [songComplete,     setSongComplete]     = useState(false);
  const [showLabels,       setShowLabels]       = useState(true);
  const [showKeyboardHints,setShowKeyboardHints]= useState(true);
  const [labelLang,        setLabelLang]        = useState('pt');

  // Training
  const [trainingMode,    setTrainingMode]    = useState(false);
  const [trainingState,   setTrainingState]   = useState('idle'); // idle|countdown|playing|complete
  const [countdownNum,    setCountdownNum]    = useState(null);
  const [displayNotes,    setDisplayNotes]    = useState([]);
  const [trainingScore,   setTrainingScore]   = useState(0);
  const [trainingCombo,   setTrainingCombo]   = useState(0);
  const [trainingMaxCombo,setTrainingMaxCombo]= useState(0);
  const [trainingHits,    setTrainingHits]    = useState({ perfect:0, good:0, miss:0 });
  const [hitFeedback,     setHitFeedback]     = useState(null);
  const [trainingSpeed,   setTrainingSpeed]   = useState(1.0);
  const [demoPlaying,     setDemoPlaying]     = useState(false);

  // Sheet music (Partitura) mode
  const [sheetMode,     setSheetMode]     = useState(false);
  const [sheetState,    setSheetState]    = useState('idle'); // idle|countdown|playing|complete
  const [sheetCdown,    setSheetCdown]    = useState(null);
  const [sheetNotes,    setSheetNotes]    = useState([]);
  const [sheetScore,    setSheetScore]    = useState(0);
  const [sheetCombo,    setSheetCombo]    = useState(0);
  const [sheetMaxCombo, setSheetMaxCombo] = useState(0);
  const [sheetHits,     setSheetHits]     = useState({ perfect:0, good:0, miss:0 });
  const [sheetFeedback, setSheetFeedback] = useState(null);
  const [sheetSpeed,    setSheetSpeed]    = useState(1.0);

  // Multiplayer
  const [mpOpen,    setMpOpen]    = useState(false);
  const [mpInRoom,  setMpInRoom]  = useState(false);
  const [mpIsHost,  setMpIsHost]  = useState(false);
  const [mpName,    setMpName]    = useState(() => { try { return localStorage.getItem('mp-name') || ''; } catch(e) { return ''; } });
  const [mpCustomColor, setMpCustomColor] = useState(() => { try { return localStorage.getItem('mp-color') || ''; } catch(e) { return ''; } });
  const [mpCode,    setMpCode]    = useState('');
  const [mpMembers, setMpMembers] = useState([]);  // [{id, name, color, isMe, isHost}]
  const [mpStatus,  setMpStatus]  = useState('');
  const [mpLoading, setMpLoading] = useState(false);
  const [remoteNoteDisplay, setRemoteNoteDisplay] = useState(new Map()); // noteName → [{peerId,color}]
  const [freeMode,       setFreeMode]       = useState(false);
  const [keyClickCounts, setKeyClickCounts] = useState(() => new Map());
  const [freeFloats,     setFreeFloats]     = useState([]); // [{id, noteName}]
  const [risingBars,     setRisingBars]     = useState([]); // barras subindo no modo livre
  const [composerMode,   setComposerMode]   = useState(false);
  const [composerNotes,  setComposerNotes]  = useState([]); // [{id,name,dur}]
  const [composerBpm,    setComposerBpm]    = useState(90);
  const [composerTimeSig,setComposerTimeSig]= useState('4/4');
  const [composerSelDur, setComposerSelDur] = useState(1);
  const [composerPlaying,setComposerPlaying]= useState(false);
  const [composerPlayIdx,setComposerPlayIdx]= useState(-1);
  const [composerSaved,  setComposerSaved]  = useState(false);
  // Follow mode (partitura livre — notas caindo)
  const [followState,    setFollowState]    = useState('idle'); // idle|countdown|playing|complete
  const [followCdown,    setFollowCdown]    = useState(null);
  const [followDispNotes,setFollowDispNotes]= useState([]);
  const [followScore,    setFollowScore]    = useState(0);
  const [followCombo,    setFollowCombo]    = useState(0);
  const [followMaxCombo, setFollowMaxCombo] = useState(0);
  const [followHits,     setFollowHits]     = useState({ perfect:0, good:0, miss:0 });
  const [followFeedback, setFollowFeedback] = useState(null);
  // Custom songs (criadas no compositor e salvas no menu)
  const [customSongs,    setCustomSongs]    = useState(() => { try { return JSON.parse(localStorage.getItem('allegretto-custom-songs') || '[]'); } catch(e) { return []; } });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSongName,   setSaveSongName]   = useState('');
  const [instrumentId,   setInstrumentId]   = useState('piano');

  // Audio refs
  const synthRef       = useRef(null);
  const reverbRef      = useRef(null);
  const audioReadyRef  = useRef(false);

  // Input dedup
  const pressedKeysRef  = useRef(new Set());
  const midiPressedRef  = useRef(new Set());
  const pianoPointerRef  = useRef(new Map());
  const playNoteRef      = useRef(null);
  const releaseNoteRef   = useRef(null);

  // Multiplayer refs
  const peerRef          = useRef(null);
  const mpHostRef        = useRef(false);
  const mpInRoomRef      = useRef(false);
  const mpMeRef          = useRef({ name:'', color:'#f0a830', id:'' });
  const mpConnsRef       = useRef(new Map()); // peerId → { conn, name, color }
  const mpSynthsRef      = useRef(new Map()); // peerId → { synth, reverb }
  const mpMembersRef     = useRef([]);
  const remoteNotesRef   = useRef(new Map()); // noteName → [{peerId, color}]
  const broadcastNoteRef = useRef(null);       // always-fresh broadcast fn
  const freeModeRef           = useRef(false);
  const freeModePlayRef       = useRef(null);
  const freeFloatIdRef        = useRef(0);
  const risingBarsRef         = useRef([]);
  const risingBarIdRef        = useRef(0);
  const risingRafRef          = useRef(null);
  const risingUpdateRef       = useRef(null);
  const risingCanvasRef       = useRef(null);
  const createFreeModeBarRef  = useRef(null);
  const releaseFreeModeBarRef = useRef(null);
  const composerModeRef       = useRef(false);
  const composerSavedRef      = useRef(false);
  const composerNoteIdRef     = useRef(0);
  // Follow mode refs
  const followStateRef    = useRef('idle');
  const followStartRef    = useRef(0);
  const followBeatDurRef  = useRef(750);
  const followFallDurRef  = useRef(2250);
  const followPendingRef  = useRef([]);
  const followActiveRef   = useRef([]);
  const followRafRef      = useRef(null);
  const followCdownTimers = useRef([]);
  const followScoreRef    = useRef(0);
  const followComboRef    = useRef(0);
  const followMaxComboRef = useRef(0);
  const followHitsRef     = useRef({ perfect:0, good:0, miss:0 });
  const followFbTimerRef  = useRef(null);
  const followTotalMsRef  = useRef(0);
  const followLoopRef     = useRef(null);
  // Compositor — sync refs para multiplayer
  const composerNotesRef   = useRef([]);
  const composerBpmRef     = useRef(90);
  const composerTimeSigRef = useRef('4/4');
  const composerTimersRef     = useRef([]);
  const composerRailRef       = useRef(null);

  // Lesson refs
  const currentSongRef      = useRef(null);
  const currentNoteIndexRef = useRef(0);
  const songCompleteRef     = useRef(false);

  // Training refs
  const trainingStateRef    = useRef('idle');
  const songStartTimeRef    = useRef(0);
  const beatDurRef          = useRef(750);
  const fallDurRef          = useRef(2250);
  const pendingNotesRef     = useRef([]);
  const activeNotesListRef  = useRef([]);
  const rafRef              = useRef(null);
  const countdownTimersRef  = useRef([]);  // only countdown setTimeout handles
  const trainingScoreRef    = useRef(0);
  const trainingComboRef    = useRef(0);
  const trainingMaxComboRef = useRef(0);
  const trainingHitsRef     = useRef({ perfect:0, good:0, miss:0 });
  const hitFeedbackTimerRef = useRef(null);
  const totalSongMsRef      = useRef(0);   // total song duration in ms at chosen speed
  const trainingLoopRef     = useRef(null);
  const demoTimers          = useRef([]);

  // Sheet mode refs
  const sheetModeRef     = useRef(false);
  const startSheetRef    = useRef(null);
  const stopSheetRef     = useRef(null);
  const mpBroadStateRef  = useRef(null);
  const sheetStateRef    = useRef('idle');
  const sheetStartRef    = useRef(0);
  const sheetBeatDurRef  = useRef(750);
  const sheetNotesRef    = useRef([]);
  const sheetTotalMsRef  = useRef(0);
  const sheetRafRef      = useRef(null);
  const sheetCdownTimers = useRef([]);
  const sheetScoreRef    = useRef(0);
  const sheetComboRef    = useRef(0);
  const sheetMaxComboRef = useRef(0);
  const sheetHitsRef     = useRef({ perfect:0, good:0, miss:0 });
  const sheetLoopRef     = useRef(null);
  const sheetFbTimerRef  = useRef(null);

  // Sync lesson refs
  useEffect(() => { currentSongRef.current      = currentSong; },      [currentSong]);
  useEffect(() => { currentNoteIndexRef.current = currentNoteIndex; }, [currentNoteIndex]);
  useEffect(() => { songCompleteRef.current     = songComplete; },     [songComplete]);

  // ---------------------------------------------------------------
  // Audio setup
  // ---------------------------------------------------------------
  useEffect(() => {
    const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.2 }).toDestination();
    const synth  = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope:   { attack: 0.005, decay: 0.4, sustain: 0.15, release: 1.4 },
    }).connect(reverb);
    synth.volume.value = Tone.gainToDb(0.7);
    synthRef.current   = synth;
    reverbRef.current  = reverb;
    return () => { try { synth.dispose(); reverb.dispose(); } catch (e) {} };
  }, []);

  useEffect(() => {
    if (synthRef.current) synthRef.current.volume.value = Tone.gainToDb(Math.max(0.001, volume));
  }, [volume]);

  useEffect(() => { audioReadyRef.current = audioReady; }, [audioReady]);

  // Instrument change
  useEffect(() => {
    const inst = INSTRUMENTS.find(i => i.id === instrumentId);
    if (!inst || !synthRef.current) return;
    try { synthRef.current.set(inst.opts); } catch(e) {}
  }, [instrumentId]);

  const ensureAudio = useCallback(async () => {
    if (!audioReadyRef.current || Tone.context.state !== 'running') {
      try { await Tone.start(); audioReadyRef.current = true; setAudioReady(true); } catch (e) {}
    }
  }, []);

  // ---------------------------------------------------------------
  // Play note — called on every key press regardless of mode
  // ---------------------------------------------------------------
  const playNote = useCallback(async (noteName, isMidi = false) => {
    await ensureAudio();
    // Always play the sound the player triggers — sustain until key is released
    try { synthRef.current?.triggerAttack(noteName); } catch (e) {}
    setActiveNotes(prev => { const s = new Set(prev); s.add(noteName); return s; });
    broadcastNoteRef.current?.(noteName, 'on');
    freeModePlayRef.current?.(noteName);

    // Training mode: check if this press scores a hit
    if (trainingStateRef.current === 'playing') {
      const now     = performance.now();
      const elapsed = now - songStartTimeRef.current;
      let best = null, bestDelta = Infinity;

      activeNotesListRef.current.forEach(note => {
        if (note.hit || note.noteName !== noteName) return;
        const delta = Math.abs(elapsed - note.targetTime);
        if (delta < GOOD_MS && delta < bestDelta) { bestDelta = delta; best = note; }
      });

      if (best) {
        const hitType  = bestDelta <= PERFECT_MS ? 'perfect' : 'good';
        const newCombo = trainingComboRef.current + 1;
        const mult     = Math.min(4, Math.floor(newCombo / 10) + 1);
        const gain     = (hitType === 'perfect' ? 100 : 50) * mult;

        activeNotesListRef.current = activeNotesListRef.current.map(n =>
          n.id === best.id ? { ...n, hit: hitType, hitTime: now } : n
        );
        trainingComboRef.current    = newCombo;
        if (newCombo > trainingMaxComboRef.current) trainingMaxComboRef.current = newCombo;
        trainingScoreRef.current   += gain;
        trainingHitsRef.current     = { ...trainingHitsRef.current, [hitType]: trainingHitsRef.current[hitType] + 1 };

        setTrainingScore(trainingScoreRef.current);
        setTrainingCombo(newCombo);
        setTrainingMaxCombo(trainingMaxComboRef.current);
        setTrainingHits({ ...trainingHitsRef.current });

        clearTimeout(hitFeedbackTimerRef.current);
        setHitFeedback({ type: hitType });
        hitFeedbackTimerRef.current = setTimeout(() => setHitFeedback(null), 600);
        return; // don't advance lesson while in training
      }
    }

    // Sheet mode: check timing & pitch
    if (sheetStateRef.current === 'playing') {
      const now     = performance.now();
      const elapsed = now - sheetStartRef.current;
      let best = null, bestDelta = Infinity;

      sheetNotesRef.current.forEach(note => {
        if (note.hit || note.noteName !== noteName) return;
        const delta = Math.abs(elapsed - note.targetTime);
        if (delta < GOOD_MS && delta < bestDelta) { bestDelta = delta; best = note; }
      });

      if (best) {
        const hitType  = bestDelta <= PERFECT_MS ? 'perfect' : 'good';
        const newCombo = sheetComboRef.current + 1;
        const mult     = Math.min(4, Math.floor(newCombo / 10) + 1);
        const gain     = (hitType === 'perfect' ? 100 : 50) * mult;

        sheetNotesRef.current = sheetNotesRef.current.map(n =>
          n.id === best.id ? { ...n, hit: hitType, hitTime: now } : n
        );
        sheetComboRef.current    = newCombo;
        if (newCombo > sheetMaxComboRef.current) sheetMaxComboRef.current = newCombo;
        sheetScoreRef.current   += gain;
        sheetHitsRef.current     = { ...sheetHitsRef.current, [hitType]: sheetHitsRef.current[hitType] + 1 };

        setSheetScore(sheetScoreRef.current);
        setSheetCombo(newCombo);
        setSheetMaxCombo(sheetMaxComboRef.current);
        setSheetHits({ ...sheetHitsRef.current });

        clearTimeout(sheetFbTimerRef.current);
        setSheetFeedback({ type: hitType });
        sheetFbTimerRef.current = setTimeout(() => setSheetFeedback(null), 600);
        return;
      }
    }

    // Follow mode: check timing & pitch
    if (followStateRef.current === 'playing') {
      const now     = performance.now();
      const elapsed = now - followStartRef.current;
      let best = null, bestDelta = Infinity;

      followActiveRef.current.forEach(note => {
        if (note.hit || note.noteName !== noteName) return;
        const delta = Math.abs(elapsed - note.targetTime);
        if (delta < GOOD_MS && delta < bestDelta) { bestDelta = delta; best = note; }
      });

      if (best) {
        const hitType  = bestDelta <= PERFECT_MS ? 'perfect' : 'good';
        const newCombo = followComboRef.current + 1;
        const mult     = Math.min(4, Math.floor(newCombo / 10) + 1);
        const gain     = (hitType === 'perfect' ? 100 : 50) * mult;

        followActiveRef.current = followActiveRef.current.map(n =>
          n.id === best.id ? { ...n, hit: hitType, hitTime: now } : n
        );
        followComboRef.current    = newCombo;
        if (newCombo > followMaxComboRef.current) followMaxComboRef.current = newCombo;
        followScoreRef.current   += gain;
        followHitsRef.current     = { ...followHitsRef.current, [hitType]: followHitsRef.current[hitType] + 1 };

        setFollowScore(followScoreRef.current);
        setFollowCombo(newCombo);
        setFollowMaxCombo(followMaxComboRef.current);
        setFollowHits({ ...followHitsRef.current });

        clearTimeout(followFbTimerRef.current);
        setFollowFeedback({ type: hitType });
        followFbTimerRef.current = setTimeout(() => setFollowFeedback(null), 600);
        return;
      }
    }

    // Lesson mode advance
    if (!trainingMode && !sheetMode && currentSongRef.current && !songCompleteRef.current) {
      const parsed   = currentSongRef.current.notes.map(parseNote);
      const expected = parsed[currentNoteIndexRef.current]?.name;
      // MIDI keyboards may be in a different octave — match by pitch class (strip octave digit)
      const pitchOf  = n => n?.replace(/\d+$/, '');
      const matches  = isMidi ? pitchOf(noteName) === pitchOf(expected) : noteName === expected;
      if (matches) {
        const next = currentNoteIndexRef.current + 1;
        if (next >= parsed.length) setSongComplete(true);
        else setCurrentNoteIndex(next);
      }
    }
  }, [ensureAudio, trainingMode, sheetMode]);

  useEffect(() => { playNoteRef.current = playNote; }, [playNote]);

  // Release a note (stops sustain, dims key)
  const releaseNote = useCallback((noteName) => {
    try { synthRef.current?.triggerRelease(noteName); } catch (e) {}
    setActiveNotes(prev => { const s = new Set(prev); s.delete(noteName); return s; });
    broadcastNoteRef.current?.(noteName, 'off');
    releaseFreeModeBarRef.current?.(noteName);
  }, []);

  useEffect(() => { releaseNoteRef.current = releaseNote; }, [releaseNote]);
  useEffect(() => { freeModeRef.current    = freeMode; },    [freeMode]);
  useEffect(() => { composerModeRef.current  = composerMode; }, [composerMode]);
  useEffect(() => { composerSavedRef.current   = composerSaved;   }, [composerSaved]);
  useEffect(() => { followStateRef.current     = followState;     }, [followState]);
  useEffect(() => { composerNotesRef.current   = composerNotes;   }, [composerNotes]);
  useEffect(() => { composerBpmRef.current     = composerBpm;     }, [composerBpm]);
  useEffect(() => { composerTimeSigRef.current = composerTimeSig; }, [composerTimeSig]);
  useEffect(() => {
    freeModePlayRef.current = (noteName) => {
      if (!freeModeRef.current) return;
      if (composerModeRef.current && !composerSavedRef.current) return; // só bloqueia quando editando
      setKeyClickCounts(prev => { const n = new Map(prev); n.set(noteName, (n.get(noteName)||0)+1); return n; });
      const barColor = mpInRoomRef.current ? mpMeRef.current.color : '#ffffff';
      createFreeModeBarRef.current?.(noteName, barColor);
    };
  }); // no deps — always fresh

  useEffect(() => {
    risingUpdateRef.current = () => {
      const now = performance.now();
      const canvasH = risingCanvasRef.current?.offsetHeight || 600;
      const updated = risingBarsRef.current.map(bar => {
        if (!bar.released) return { ...bar, height: Math.max(40, (now - bar.startTime) * 0.16) };
        const el = now - bar.releaseTime;
        const floatY = el * 0.38;
        const fadeStart = Math.max(0, canvasH - bar.height - 40);
        const opacity = floatY < fadeStart ? 1 : Math.max(0, 1 - (floatY - fadeStart) / (canvasH - fadeStart + bar.height));
        return { ...bar, floatY, opacity };
      }).filter(b => !b.released || b.floatY <= b.height + (risingCanvasRef.current?.offsetHeight || 600));
      risingBarsRef.current = updated;
      setRisingBars([...updated]);
      if (updated.length) risingRafRef.current = setTimeout(risingUpdateRef.current, 16);
      else risingRafRef.current = null;
    };
    createFreeModeBarRef.current = (noteName, color) => {
      if (!freeModeRef.current) return;
      const note = NOTES.find(n => n.name === noteName);
      if (!note) return;
      const wIdx = WHITE_KEYS.findIndex(n => n.name === noteName);
      const barLeft = note.isBlack ? (BLACK_KEY_LEFTS.get(noteName) ?? 0) : wIdx * WHITE_KEY_WIDTH;
      const barW = note.isBlack ? WHITE_KEY_WIDTH * 0.55 : WHITE_KEY_WIDTH - 0.3;
      const id = ++risingBarIdRef.current;
      risingBarsRef.current = [...risingBarsRef.current,
        { id, noteName, startTime: performance.now(), height: 40, released: false, floatY: 0, opacity: 1, isBlack: note.isBlack, left: barLeft, width: barW, color }
      ];
      if (risingUpdateRef.current) {
        if (risingRafRef.current) clearTimeout(risingRafRef.current);
        risingRafRef.current = setTimeout(risingUpdateRef.current, 16);
      }
    };
    releaseFreeModeBarRef.current = (noteName) => {
      const now = performance.now();
      let found = false;
      risingBarsRef.current = risingBarsRef.current.map(bar => {
        if (!found && bar.noteName === noteName && !bar.released) { found = true; return { ...bar, released: true, releaseTime: now }; }
        return bar;
      });
    };
  }); // no deps — always fresh

  // ---------------------------------------------------------------
  // MULTIPLAYER (PeerJS peer-to-peer)
  // ---------------------------------------------------------------

  // Keeps broadcastNoteRef fresh every render (no stale closures)
  useEffect(() => {
    broadcastNoteRef.current = (noteName, type) => {
      if (!mpInRoomRef.current) return;
      const msg = type === 'on'
        ? { type: 'note_on', note: noteName }
        : { type: 'note_off', note: noteName };
      if (mpHostRef.current) {
        // Host: relay own notes to all clients
        mpConnsRef.current.forEach(({ conn }) => { try { conn.send({ ...msg, from: mpMeRef.current.id }); } catch(e) {} });
      } else {
        // Client: send to host for relay
        mpConnsRef.current.forEach(({ conn }) => { try { conn.send(msg); } catch(e) {} });
      }
    };
  }); // no deps — always fresh

  // Broadcast room-level state changes (song, sheet mode) — works host or client
  useEffect(() => {
    mpBroadStateRef.current = (msg) => {
      if (!mpInRoomRef.current) return;
      if (mpHostRef.current) {
        mpBroadcastAll(msg);
      } else {
        mpConnsRef.current.forEach(({ conn }) => { try { conn.send(msg); } catch(e) {} });
      }
    };
  }); // no deps — always fresh

  function mpCreateSynth(peerId) {
    if (mpSynthsRef.current.has(peerId)) return;
    try {
      const rev = new Tone.Reverb({ decay: 1.8, wet: 0.15 }).toDestination();
      const syn = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.4, sustain: 0.15, release: 1.4 },
      }).connect(rev);
      syn.volume.value = Tone.gainToDb(0.65);
      mpSynthsRef.current.set(peerId, { synth: syn, reverb: rev });
    } catch(e) {}
  }

  function mpDestroySynth(peerId) {
    const s = mpSynthsRef.current.get(peerId);
    if (s) { try { s.synth.dispose(); s.reverb.dispose(); } catch(e) {} mpSynthsRef.current.delete(peerId); }
  }

  function mpHandleRemoteNote(peerId, noteName, type) {
    const member = mpMembersRef.current.find(m => m.id === peerId);
    const color = member?.color || '#9bd17e';
    if (!mpSynthsRef.current.has(peerId)) mpCreateSynth(peerId);
    const s = mpSynthsRef.current.get(peerId);
    if (s) try { type === 'on' ? s.synth.triggerAttack(noteName) : s.synth.triggerRelease(noteName); } catch(e) {}
    const cur = remoteNotesRef.current.get(noteName) || [];
    if (type === 'on') {
      if (!cur.find(x => x.peerId === peerId)) remoteNotesRef.current.set(noteName, [...cur, { peerId, color }]);
    } else {
      remoteNotesRef.current.set(noteName, cur.filter(x => x.peerId !== peerId));
    }
    setRemoteNoteDisplay(new Map(remoteNotesRef.current));
    if (type === 'on') createFreeModeBarRef.current?.(noteName, color);
    else releaseFreeModeBarRef.current?.(noteName);
  }

  // ---------------------------------------------------------------
  // COMPOSER (Criar Partitura)
  // ---------------------------------------------------------------
  const stopComposer = useCallback(() => {
    composerTimersRef.current.forEach(clearTimeout);
    composerTimersRef.current = [];
    try { synthRef.current?.releaseAll(); } catch(e) {}
    setComposerPlaying(false);
    setComposerPlayIdx(-1);
  }, []);

  const playComposer = useCallback(async (notes, bpm) => {
    if (!notes.length) return;
    await ensureAudio();
    composerTimersRef.current.forEach(clearTimeout);
    composerTimersRef.current = [];
    try { synthRef.current?.releaseAll(); } catch(e) {}
    setComposerPlaying(true);
    const beatMs = 60000 / bpm;
    let t = 0;
    notes.forEach((note, i) => {
      const start = t;
      const durMs = note.dur * beatMs * 0.88;
      const t1 = setTimeout(() => {
        setComposerPlayIdx(i);
        if (note.name !== 'rest') {
          try { synthRef.current?.triggerAttack(note.name); } catch(e) {}
          setTimeout(() => { try { synthRef.current?.triggerRelease(note.name); } catch(e) {} }, durMs);
        }
      }, start);
      composerTimersRef.current.push(t1);
      t += note.dur * beatMs;
    });
    const done = setTimeout(() => { setComposerPlaying(false); setComposerPlayIdx(-1); }, t);
    composerTimersRef.current.push(done);
  }, [ensureAudio]);

  const addComposerNote = useCallback((noteName, dur) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const note = { id, name: noteName, dur };
    setComposerNotes(prev => [...prev, note]);
    mpBroadStateRef.current?.({ type: 'composer_note_add', note });
    requestAnimationFrame(() => {
      if (composerRailRef.current) composerRailRef.current.scrollLeft = composerRailRef.current.scrollWidth;
    });
  }, []);

  const deleteComposerNote = useCallback((noteId) => {
    setComposerNotes(p => p.filter(n => n.id !== noteId));
    mpBroadStateRef.current?.({ type: 'composer_note_delete', noteId });
  }, []);

  function mpBroadcastAll(msg, exceptId = null) {
    mpConnsRef.current.forEach(({ conn }, pid) => { if (pid !== exceptId) try { conn.send(msg); } catch(e) {} });
  }

  function mpSetupHostHandlers(conn) {
    conn.on('open', () => {
      conn.send({ type: 'members', list: mpMembersRef.current });
    });
    conn.on('data', (msg) => {
      if (msg.type === 'join') {
        const entry = { id: conn.peer, name: msg.name, color: msg.color, isMe: false };
        mpConnsRef.current.set(conn.peer, { conn, name: msg.name, color: msg.color });
        mpMembersRef.current = [...mpMembersRef.current, entry];
        setMpMembers([...mpMembersRef.current]);
        mpCreateSynth(conn.peer);
        mpBroadcastAll({ type: 'member_joined', id: conn.peer, name: msg.name, color: msg.color }, conn.peer);
        setTimeout(() => {
          mpBroadcastAll({ type: 'members', list: mpMembersRef.current });
          // Sync current song + sheet mode to the new member
          if (currentSongRef.current) try { conn.send({ type: 'song_select', songId: currentSongRef.current.id }); } catch(e) {}
          if (sheetModeRef.current) {
            try { conn.send({ type: 'sheet_mode', on: true }); } catch(e) {}
            if (sheetStateRef.current === 'playing' || sheetStateRef.current === 'countdown')
              try { conn.send({ type: 'sheet_start' }); } catch(e) {}
          }
          // Sync compositor state
          if (composerModeRef.current) {
            try { conn.send({ type: 'composer_sync', notes: composerNotesRef.current, bpm: composerBpmRef.current, timeSig: composerTimeSigRef.current, saved: composerSavedRef.current }); } catch(e) {}
          }
        }, 100);
      } else if (msg.type === 'note_on') {
        mpHandleRemoteNote(conn.peer, msg.note, 'on');
        mpBroadcastAll({ type: 'note_on', from: conn.peer, note: msg.note }, conn.peer);
      } else if (msg.type === 'note_off') {
        mpHandleRemoteNote(conn.peer, msg.note, 'off');
        mpBroadcastAll({ type: 'note_off', from: conn.peer, note: msg.note }, conn.peer);
      } else if (msg.type === 'color_change') {
        const c = mpConnsRef.current.get(conn.peer);
        if (c) mpConnsRef.current.set(conn.peer, { ...c, color: msg.color });
        mpMembersRef.current = mpMembersRef.current.map(m => m.id === conn.peer ? { ...m, color: msg.color } : m);
        setMpMembers([...mpMembersRef.current]);
        remoteNotesRef.current.forEach((list, note) => {
          remoteNotesRef.current.set(note, list.map(x => x.peerId === conn.peer ? { ...x, color: msg.color } : x));
        });
        setRemoteNoteDisplay(new Map(remoteNotesRef.current));
        mpBroadcastAll({ type: 'color_change', from: conn.peer, color: msg.color }, conn.peer);
      } else if (msg.type === 'song_select') {
        const song = SONGS.find(s => s.id === msg.songId);
        if (song) { setCurrentSong(song); setCurrentNoteIndex(0); setSongComplete(false); stopSheetRef.current?.(); setSheetMode(false); }
        mpBroadcastAll({ type: 'song_select', songId: msg.songId }, conn.peer);
      } else if (msg.type === 'sheet_mode') {
        if (msg.on) { setSheetMode(true); setTrainingMode(false); }
        else { setSheetMode(false); stopSheetRef.current?.(); }
        mpBroadcastAll({ type: 'sheet_mode', on: msg.on }, conn.peer);
      } else if (msg.type === 'sheet_start') {
        setTimeout(() => startSheetRef.current?.(), 0);
        mpBroadcastAll({ type: 'sheet_start' }, conn.peer);
      } else if (msg.type === 'sheet_stop') {
        stopSheetRef.current?.();
        mpBroadcastAll({ type: 'sheet_stop' }, conn.peer);
      } else if (msg.type === 'composer_enter') {
        if (!freeModeRef.current) setFreeMode(true);
        setComposerMode(true); setComposerSaved(false);
        mpBroadcastAll({ type: 'composer_enter' }, conn.peer);
      } else if (msg.type === 'composer_exit') {
        setComposerMode(false); setComposerSaved(false);
        mpBroadcastAll({ type: 'composer_exit' }, conn.peer);
      } else if (msg.type === 'composer_note_add') {
        setComposerNotes(p => [...p, msg.note]);
        mpBroadcastAll({ type: 'composer_note_add', note: msg.note }, conn.peer);
      } else if (msg.type === 'composer_note_delete') {
        setComposerNotes(p => p.filter(n => n.id !== msg.noteId));
        mpBroadcastAll({ type: 'composer_note_delete', noteId: msg.noteId }, conn.peer);
      } else if (msg.type === 'composer_clear') {
        setComposerNotes([]);
        mpBroadcastAll({ type: 'composer_clear' }, conn.peer);
      } else if (msg.type === 'composer_bpm') {
        setComposerBpm(msg.bpm);
        mpBroadcastAll({ type: 'composer_bpm', bpm: msg.bpm }, conn.peer);
      } else if (msg.type === 'composer_timesig') {
        setComposerTimeSig(msg.sig);
        mpBroadcastAll({ type: 'composer_timesig', sig: msg.sig }, conn.peer);
      } else if (msg.type === 'composer_saved') {
        setComposerNotes(msg.notes || []);
        if (msg.bpm) setComposerBpm(msg.bpm);
        if (msg.timeSig) setComposerTimeSig(msg.timeSig);
        setComposerSaved(true);
        mpBroadcastAll({ type: 'composer_saved', notes: msg.notes, bpm: msg.bpm, timeSig: msg.timeSig }, conn.peer);
      } else if (msg.type === 'composer_sync') {
        // sync-on-join: não relayar, só aplicar
        if (!freeModeRef.current) setFreeMode(true);
        setComposerMode(true);
        setComposerNotes(msg.notes || []);
        if (msg.bpm) setComposerBpm(msg.bpm);
        if (msg.timeSig) setComposerTimeSig(msg.timeSig);
        if (msg.saved) setComposerSaved(true);
      }
    });
    conn.on('close', () => {
      if (!mpConnsRef.current.has(conn.peer)) return;
      mpConnsRef.current.delete(conn.peer);
      mpDestroySynth(conn.peer);
      mpMembersRef.current = mpMembersRef.current.filter(m => m.id !== conn.peer);
      setMpMembers([...mpMembersRef.current]);
      mpBroadcastAll({ type: 'member_left', id: conn.peer });
    });
  }

  const joinRoom = useCallback(async () => {
    const name = mpName.trim(); const code = mpCode.trim().toUpperCase().replace(/\s/g,'');
    if (!name || !code) { setMpStatus('Preencha nome e código da sala.'); return; }
    setMpLoading(true); setMpStatus('Conectando...');
    try { localStorage.setItem('mp-name', name); } catch(e) {}
    await ensureAudio();

    const hostId = MP_PREFIX + code;
    const peer   = new Peer(hostId, { debug: 0 });
    peerRef.current = peer;

    peer.on('open', (id) => {
      // We got the host slot — we ARE the host
      mpHostRef.current  = true;
      mpInRoomRef.current = true;
      setMpIsHost(true); setMpInRoom(true); setMpOpen(false); setMpLoading(false); setMpStatus('');
      const color = mpCustomColor || nameToColor(name);
      mpMeRef.current = { name, color, id };
      const me = { id, name, color, isMe: true, isHost: true };
      mpMembersRef.current = [me];
      setMpMembers([me]);
      peer.on('connection', (conn) => mpSetupHostHandlers(conn));
      peer.on('error', (err) => setMpStatus('Erro: ' + (err.message || err.type)));
    });

    peer.on('error', async (err) => {
      if (err.type === 'unavailable-id') {
        // Host exists — join as client
        peer.destroy(); peerRef.current = null;
        const color   = mpCustomColor || nameToColor(name);
        const c2      = new Peer({ debug: 0 });
        peerRef.current = c2;
        c2.on('open', (myId) => {
          mpMeRef.current = { name, color, id: myId };
          const conn = c2.connect(hostId, { reliable: true });
          conn.on('open', () => {
            mpConnsRef.current.set(hostId, { conn, name: 'Host' });
            conn.send({ type: 'join', name, color });
          });
          conn.on('data', (msg) => {
            if (msg.type === 'members') {
              mpMembersRef.current = msg.list.map(m => ({ ...m, isMe: m.id === myId }));
              if (!mpMembersRef.current.find(m => m.id === myId))
                mpMembersRef.current.push({ id: myId, name, color, isMe: true });
              setMpMembers([...mpMembersRef.current]);
              msg.list.forEach(m => { if (m.id !== myId) mpCreateSynth(m.id); });
              mpHostRef.current  = false;
              mpInRoomRef.current = true;
              setMpIsHost(false); setMpInRoom(true); setMpOpen(false); setMpLoading(false); setMpStatus('');
            } else if (msg.type === 'member_joined') {
              if (!mpMembersRef.current.find(m => m.id === msg.id)) {
                mpMembersRef.current = [...mpMembersRef.current, { id: msg.id, name: msg.name, color: msg.color, isMe: false }];
                setMpMembers([...mpMembersRef.current]);
                mpCreateSynth(msg.id);
              }
            } else if (msg.type === 'member_left') {
              mpMembersRef.current = mpMembersRef.current.filter(m => m.id !== msg.id);
              setMpMembers([...mpMembersRef.current]);
              mpDestroySynth(msg.id);
            } else if (msg.type === 'note_on')  { mpHandleRemoteNote(msg.from, msg.note, 'on'); }
              else if (msg.type === 'note_off') { mpHandleRemoteNote(msg.from, msg.note, 'off'); }
              else if (msg.type === 'color_change') {
                mpMembersRef.current = mpMembersRef.current.map(m => m.id === msg.from ? { ...m, color: msg.color } : m);
                setMpMembers([...mpMembersRef.current]);
                remoteNotesRef.current.forEach((list, note) => {
                  remoteNotesRef.current.set(note, list.map(x => x.peerId === msg.from ? { ...x, color: msg.color } : x));
                });
                setRemoteNoteDisplay(new Map(remoteNotesRef.current));
              } else if (msg.type === 'song_select') {
                const song = SONGS.find(s => s.id === msg.songId);
                if (song) { setCurrentSong(song); setCurrentNoteIndex(0); setSongComplete(false); stopSheetRef.current?.(); setSheetMode(false); }
              } else if (msg.type === 'sheet_mode') {
                if (msg.on) { setSheetMode(true); setTrainingMode(false); }
                else { setSheetMode(false); stopSheetRef.current?.(); }
              } else if (msg.type === 'sheet_start') {
                setTimeout(() => startSheetRef.current?.(), 0);
              } else if (msg.type === 'sheet_stop') {
                stopSheetRef.current?.();
              } else if (msg.type === 'composer_enter') {
                if (!freeModeRef.current) setFreeMode(true);
                setComposerMode(true); setComposerSaved(false);
              } else if (msg.type === 'composer_exit') {
                setComposerMode(false); setComposerSaved(false);
              } else if (msg.type === 'composer_note_add') {
                setComposerNotes(p => [...p, msg.note]);
              } else if (msg.type === 'composer_note_delete') {
                setComposerNotes(p => p.filter(n => n.id !== msg.noteId));
              } else if (msg.type === 'composer_clear') {
                setComposerNotes([]);
              } else if (msg.type === 'composer_bpm') {
                setComposerBpm(msg.bpm);
              } else if (msg.type === 'composer_timesig') {
                setComposerTimeSig(msg.sig);
              } else if (msg.type === 'composer_saved') {
                setComposerNotes(msg.notes || []);
                if (msg.bpm) setComposerBpm(msg.bpm);
                if (msg.timeSig) setComposerTimeSig(msg.timeSig);
                setComposerSaved(true);
              } else if (msg.type === 'composer_sync') {
                if (!freeModeRef.current) setFreeMode(true);
                setComposerMode(true);
                setComposerNotes(msg.notes || []);
                if (msg.bpm) setComposerBpm(msg.bpm);
                if (msg.timeSig) setComposerTimeSig(msg.timeSig);
                if (msg.saved) setComposerSaved(true);
              }
          });
          conn.on('close', () => { setMpStatus('Host desconectou.'); leaveRoom(); });
          conn.on('error', () => { setMpStatus('Conexão com host perdida.'); setMpLoading(false); });
        });
        c2.on('error', () => { setMpStatus('Sala não encontrada ou inacessível.'); setMpLoading(false); });
      } else {
        setMpStatus('Erro: ' + (err.message || err.type)); setMpLoading(false);
      }
    });
  }, [mpName, mpCode, mpCustomColor, ensureAudio]);

  const leaveRoom = useCallback(() => {
    mpConnsRef.current.forEach(({ conn }) => { try { conn.close(); } catch(e) {} });
    mpConnsRef.current.clear();
    mpSynthsRef.current.forEach(s => { try { s.synth.dispose(); s.reverb.dispose(); } catch(e) {} });
    mpSynthsRef.current.clear();
    remoteNotesRef.current.clear(); setRemoteNoteDisplay(new Map());
    if (peerRef.current) { try { peerRef.current.destroy(); } catch(e) {} peerRef.current = null; }
    mpInRoomRef.current = false; mpHostRef.current = false; mpMembersRef.current = [];
    setMpInRoom(false); setMpIsHost(false); setMpMembers([]); setMpStatus('');
  }, []);

  const changeMyColor = useCallback((newColor) => {
    mpMeRef.current = { ...mpMeRef.current, color: newColor };
    setMpCustomColor(newColor);
    try { localStorage.setItem('mp-color', newColor); } catch(e) {}
    mpMembersRef.current = mpMembersRef.current.map(m => m.isMe ? { ...m, color: newColor } : m);
    setMpMembers([...mpMembersRef.current]);
    if (mpHostRef.current) {
      mpBroadcastAll({ type: 'color_change', from: mpMeRef.current.id, color: newColor });
    } else {
      mpConnsRef.current.forEach(({ conn }) => { try { conn.send({ type: 'color_change', color: newColor }); } catch(e) {} });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    leaveRoom();
    if (risingRafRef.current) clearTimeout(risingRafRef.current);
  }, []); // eslint-disable-line

  // ---------------------------------------------------------------
  // Training RAF loop — defined with no stale closures (all refs)
  // ---------------------------------------------------------------
  useEffect(() => {
    trainingLoopRef.current = () => {
      const state = trainingStateRef.current;
      if (state !== 'playing' && state !== 'countdown') return;

      const now     = performance.now();
      const elapsed = now - songStartTimeRef.current;
      const fallDur = fallDurRef.current;

      // Spawn notes whose spawn time has arrived
      const toSpawn = [], stillPending = [];
      pendingNotesRef.current.forEach(note => {
        (elapsed >= note.spawnTime ? toSpawn : stillPending).push(note);
      });
      pendingNotesRef.current = stillPending;

      let missCount = 0;
      const updated = [...activeNotesListRef.current, ...toSpawn].map(note => {
        if (note.hit) {
          if (now - note.hitTime > 380) return null;
          return note;
        }
        const y = ((elapsed - note.spawnTime) / fallDur) * 100;
        if (y >= MISS_Y) {
          missCount++;
          trainingHitsRef.current.miss++;
          trainingComboRef.current = 0;
          return { ...note, y: MISS_Y, hit: 'miss', hitTime: now };
        }
        return { ...note, y };
      }).filter(Boolean);

      activeNotesListRef.current = updated;
      setDisplayNotes([...updated]);

      if (missCount > 0) {
        setTrainingCombo(0);
        setTrainingHits({ ...trainingHitsRef.current });
        clearTimeout(hitFeedbackTimerRef.current);
        setHitFeedback({ type: 'miss' });
        hitFeedbackTimerRef.current = setTimeout(() => setHitFeedback(null), 500);
      }

      // Completion: all notes processed, nothing active, past song end
      const done = stillPending.length === 0
        && pendingNotesRef.current.length === 0
        && (activeNotesListRef.current.length === 0 || elapsed > totalSongMsRef.current + beatDurRef.current * 4);

      if (done) {
        trainingStateRef.current = 'complete';
        setTrainingState('complete');
        return;
      }

      rafRef.current = requestAnimationFrame(() => trainingLoopRef.current?.());
    };
  }); // runs every render — keeps loop function fresh without stale closures

  // Sync sheet state ref
  useEffect(() => { sheetStateRef.current = sheetState; }, [sheetState]);
  useEffect(() => { sheetModeRef.current  = sheetMode;  }, [sheetMode]);

  // ---------------------------------------------------------------
  // Sheet music RAF loop — no stale closures pattern
  // ---------------------------------------------------------------
  useEffect(() => {
    sheetLoopRef.current = () => {
      const st = sheetStateRef.current;
      if (st !== 'playing' && st !== 'countdown') return;

      const now     = performance.now();
      const elapsed = now - sheetStartRef.current;
      const beatDur = sheetBeatDurRef.current;

      let missCount = 0, unresolved = 0;
      const updated = sheetNotesRef.current.map(note => {
        const x = SHEET_PLAYHEAD_X + (note.targetTime - elapsed) / beatDur * SHEET_PX_PER_BEAT;
        if (note.hit) {
          // Linger briefly then remove
          if (elapsed > note.targetTime + beatDur * 1.6) return null;
          return { ...note, x };
        }
        // Miss: note passed playhead without being pressed
        if (elapsed > note.targetTime + GOOD_MS) {
          missCount++;
          sheetHitsRef.current = { ...sheetHitsRef.current, miss: sheetHitsRef.current.miss + 1 };
          sheetComboRef.current = 0;
          return { ...note, x, hit: 'miss', hitTime: now };
        }
        unresolved++;
        return { ...note, x };
      }).filter(Boolean);

      sheetNotesRef.current = updated;
      setSheetNotes([...updated]);

      if (missCount > 0) {
        setSheetCombo(0);
        setSheetHits({ ...sheetHitsRef.current });
        clearTimeout(sheetFbTimerRef.current);
        setSheetFeedback({ type: 'miss' });
        sheetFbTimerRef.current = setTimeout(() => setSheetFeedback(null), 500);
      }

      // Completion: no unresolved notes and past song end
      if (unresolved === 0 && elapsed > sheetTotalMsRef.current + beatDur * 3) {
        sheetStateRef.current = 'complete';
        setSheetState('complete');
        return;
      }

      sheetRafRef.current = requestAnimationFrame(() => sheetLoopRef.current?.());
    };
  }); // no deps — always fresh

  // ---------------------------------------------------------------
  // Follow mode RAF loop — notas caindo da partitura do compositor
  // ---------------------------------------------------------------
  useEffect(() => {
    followLoopRef.current = () => {
      const state = followStateRef.current;
      if (state !== 'playing' && state !== 'countdown') return;

      const now     = performance.now();
      const elapsed = now - followStartRef.current;
      const fallDur = followFallDurRef.current;

      const toSpawn = [], stillPending = [];
      followPendingRef.current.forEach(note => {
        (elapsed >= note.spawnTime ? toSpawn : stillPending).push(note);
      });
      followPendingRef.current = stillPending;

      let missCount = 0;
      const updated = [...followActiveRef.current, ...toSpawn].map(note => {
        if (note.hit) {
          if (now - note.hitTime > 380) return null;
          return note;
        }
        const y = ((elapsed - note.spawnTime) / fallDur) * 100;
        if (y >= MISS_Y) {
          missCount++;
          followHitsRef.current.miss++;
          followComboRef.current = 0;
          return { ...note, y: MISS_Y, hit: 'miss', hitTime: now };
        }
        return { ...note, y };
      }).filter(Boolean);

      followActiveRef.current = updated;
      setFollowDispNotes([...updated]);

      if (missCount > 0) {
        setFollowCombo(0);
        setFollowHits({ ...followHitsRef.current });
        clearTimeout(followFbTimerRef.current);
        setFollowFeedback({ type: 'miss' });
        followFbTimerRef.current = setTimeout(() => setFollowFeedback(null), 500);
      }

      const done = stillPending.length === 0
        && followPendingRef.current.length === 0
        && (followActiveRef.current.length === 0 || elapsed > followTotalMsRef.current + followBeatDurRef.current * 4);

      if (done) {
        followStateRef.current = 'complete';
        setFollowState('complete');
        return;
      }

      followRafRef.current = requestAnimationFrame(() => followLoopRef.current?.());
    };
  }); // no deps — always fresh

  // ---------------------------------------------------------------
  // Start training
  // ---------------------------------------------------------------
  const startTraining = useCallback(async () => {
    if (!currentSong) return;
    await ensureAudio();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];

    const bpm     = (currentSong.bpm || 80) * trainingSpeed;
    const beatDur = 60000 / bpm;
    const fallDur = FALL_BEATS * beatDur;

    beatDurRef.current = beatDur;
    fallDurRef.current = fallDur;

    // Reset scoring
    trainingScoreRef.current    = 0;
    trainingComboRef.current    = 0;
    trainingMaxComboRef.current = 0;
    trainingHitsRef.current     = { perfect:0, good:0, miss:0 };
    setTrainingScore(0); setTrainingCombo(0); setTrainingMaxCombo(0);
    setTrainingHits({ perfect:0, good:0, miss:0 });
    setDisplayNotes([]); setHitFeedback(null);
    activeNotesListRef.current = [];

    // Build note queue with CUMULATIVE timing from note durations
    const parsed = currentSong.notes.map(parseNote);
    let cumMs    = 0;
    totalSongMsRef.current = parsed.reduce((s, n) => s + n.dur * beatDur, 0);

    const COUNTDOWN_MS = 3000;
    // songStartTimeRef is set relative to performance.now() + countdown
    songStartTimeRef.current = performance.now() + COUNTDOWN_MS;

    pendingNotesRef.current = parsed.map((note, i) => {
      const targetTime = cumMs;       // ms after song start (t=0 at hit zone)
      cumMs += note.dur * beatDur;
      const layout = getNoteLayout(note.name);
      // height proportional to duration (min 4%, max 18% of container)
      const heightPct = Math.max(4, Math.min(18, (note.dur / FALL_BEATS) * 100));
      return {
        id: `n${i}-${Date.now()}`,
        noteName: note.name,
        dur: note.dur,
        targetTime,
        spawnTime: targetTime - fallDur,
        heightPct,
        ...layout,
        y: 0, hit: null, hitTime: null,
      };
    });

    // Countdown
    trainingStateRef.current = 'countdown';
    setTrainingState('countdown');
    setCountdownNum(3);

    const t1 = setTimeout(() => setCountdownNum(2), 1000);
    const t2 = setTimeout(() => setCountdownNum(1), 2000);
    const t3 = setTimeout(() => {
      setCountdownNum(null);
      trainingStateRef.current = 'playing';
      setTrainingState('playing');
    }, COUNTDOWN_MS);
    countdownTimersRef.current = [t1, t2, t3];

    rafRef.current = requestAnimationFrame(() => trainingLoopRef.current?.());
  }, [currentSong, trainingSpeed, ensureAudio]);

  const stopTraining = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];
    trainingStateRef.current = 'idle';
    setTrainingState('idle');
    setDisplayNotes([]);
    setCountdownNum(null);
    activeNotesListRef.current = [];
    pendingNotesRef.current    = [];
    try { synthRef.current?.releaseAll(); } catch(e) {}
    setActiveNotes(new Set());
  }, []);

  // ---------------------------------------------------------------
  // Start / stop sheet music mode
  // ---------------------------------------------------------------
  const startSheet = useCallback(async () => {
    if (!currentSong) return;
    await ensureAudio();

    if (sheetRafRef.current) cancelAnimationFrame(sheetRafRef.current);
    sheetCdownTimers.current.forEach(clearTimeout);
    sheetCdownTimers.current = [];

    const bpm     = (currentSong.bpm || 80) * sheetSpeed;
    const beatDur = 60000 / bpm;
    sheetBeatDurRef.current = beatDur;

    sheetScoreRef.current    = 0;
    sheetComboRef.current    = 0;
    sheetMaxComboRef.current = 0;
    sheetHitsRef.current     = { perfect:0, good:0, miss:0 };
    setSheetScore(0); setSheetCombo(0); setSheetMaxCombo(0);
    setSheetHits({ perfect:0, good:0, miss:0 });
    setSheetFeedback(null);

    const parsed = currentSong.notes.map(parseNote);
    let cumMs = 0;
    sheetTotalMsRef.current = parsed.reduce((s, n) => s + n.dur * beatDur, 0);

    const COUNTDOWN_MS = 3000;
    sheetStartRef.current = performance.now() + COUNTDOWN_MS;

    // Initial x: all notes start far to the right (elapsed = -3000ms during countdown)
    const notes = parsed.map((note, i) => {
      const targetTime = cumMs;
      cumMs += note.dur * beatDur;
      const x = SHEET_PLAYHEAD_X + (targetTime + COUNTDOWN_MS) / beatDur * SHEET_PX_PER_BEAT;
      return { id:`sh${i}-${Date.now()}`, noteName:note.name, targetTime, dur:note.dur, hit:null, hitTime:null, x };
    });
    sheetNotesRef.current = notes;
    setSheetNotes(notes);

    sheetStateRef.current = 'countdown';
    setSheetState('countdown');
    setSheetCdown(3);

    const t1 = setTimeout(() => setSheetCdown(2), 1000);
    const t2 = setTimeout(() => setSheetCdown(1), 2000);
    const t3 = setTimeout(() => {
      setSheetCdown(null);
      sheetStateRef.current = 'playing';
      setSheetState('playing');
    }, COUNTDOWN_MS);
    sheetCdownTimers.current = [t1, t2, t3];

    sheetRafRef.current = requestAnimationFrame(() => sheetLoopRef.current?.());
  }, [currentSong, sheetSpeed, ensureAudio]);
  useEffect(() => { startSheetRef.current = startSheet; }, [startSheet]);

  const stopSheet = useCallback(() => {
    if (sheetRafRef.current) cancelAnimationFrame(sheetRafRef.current);
    sheetCdownTimers.current.forEach(clearTimeout);
    sheetCdownTimers.current = [];
    sheetStateRef.current = 'idle';
    setSheetState('idle');
    setSheetNotes([]);
    try { synthRef.current?.releaseAll(); } catch(e) {}
    setActiveNotes(new Set());
    setSheetCdown(null);
    sheetNotesRef.current = [];
  }, []);
  useEffect(() => { stopSheetRef.current  = stopSheet;  }, [stopSheet]);

  // ---------------------------------------------------------------
  // Start / stop follow mode
  // ---------------------------------------------------------------
  const startFollow = useCallback(async (notes, bpm) => {
    if (!notes || !notes.length) return;
    await ensureAudio();

    if (followRafRef.current) cancelAnimationFrame(followRafRef.current);
    followCdownTimers.current.forEach(clearTimeout);
    followCdownTimers.current = [];

    const beatDur = 60000 / bpm;
    const fallDur = FALL_BEATS * beatDur;
    followBeatDurRef.current = beatDur;
    followFallDurRef.current = fallDur;

    followScoreRef.current    = 0;
    followComboRef.current    = 0;
    followMaxComboRef.current = 0;
    followHitsRef.current     = { perfect:0, good:0, miss:0 };
    setFollowScore(0); setFollowCombo(0); setFollowMaxCombo(0);
    setFollowHits({ perfect:0, good:0, miss:0 });
    setFollowDispNotes([]); setFollowFeedback(null);
    followActiveRef.current = [];

    const COUNTDOWN_MS = 3000;
    followStartRef.current = performance.now() + COUNTDOWN_MS;

    let cumMs = 0;
    followTotalMsRef.current = notes.reduce((s, n) => s + n.dur * beatDur, 0);

    followPendingRef.current = [];
    notes.forEach((note, i) => {
      const targetTime = cumMs;
      cumMs += note.dur * beatDur;
      if (note.name === 'rest') return;
      const layout = getNoteLayout(note.name);
      const heightPct = Math.max(4, Math.min(18, (note.dur / FALL_BEATS) * 100));
      followPendingRef.current.push({
        id: `f${i}-${Date.now()}`,
        noteName: note.name,
        dur: note.dur,
        targetTime,
        spawnTime: targetTime - fallDur,
        heightPct,
        ...layout,
        y: 0, hit: null, hitTime: null,
      });
    });

    followStateRef.current = 'countdown';
    setFollowState('countdown');
    setFollowCdown(3);

    const t1 = setTimeout(() => setFollowCdown(2), 1000);
    const t2 = setTimeout(() => setFollowCdown(1), 2000);
    const t3 = setTimeout(() => {
      setFollowCdown(null);
      followStateRef.current = 'playing';
      setFollowState('playing');
    }, COUNTDOWN_MS);
    followCdownTimers.current = [t1, t2, t3];

    followRafRef.current = requestAnimationFrame(() => followLoopRef.current?.());
  }, [ensureAudio]);

  const stopFollow = useCallback(() => {
    if (followRafRef.current) cancelAnimationFrame(followRafRef.current);
    followCdownTimers.current.forEach(clearTimeout);
    followCdownTimers.current = [];
    followStateRef.current = 'idle';
    setFollowState('idle');
    setFollowDispNotes([]);
    setFollowCdown(null);
    followActiveRef.current = [];
    followPendingRef.current = [];
    try { synthRef.current?.releaseAll(); } catch(e) {}
    setActiveNotes(new Set());
  }, []);

  useEffect(() => () => {
    if (rafRef.current)    cancelAnimationFrame(rafRef.current);
    if (sheetRafRef.current) cancelAnimationFrame(sheetRafRef.current);
    if (followRafRef.current) cancelAnimationFrame(followRafRef.current);
    countdownTimersRef.current.forEach(clearTimeout);
    sheetCdownTimers.current.forEach(clearTimeout);
    followCdownTimers.current.forEach(clearTimeout);
    demoTimers.current.forEach(clearTimeout);
  }, []);

  // ---------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------
  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (pressedKeysRef.current.has(key)) return;
      const note = KEY_TO_NOTE.get(key);
      if (note) { e.preventDefault(); pressedKeysRef.current.add(key); playNoteRef.current?.(note.name); }
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      pressedKeysRef.current.delete(k);
      const note = KEY_TO_NOTE.get(k);
      if (note) releaseNoteRef.current?.(note.name);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ---------------------------------------------------------------
  // MIDI
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!navigator?.requestMIDIAccess) { setMidiStatus('unsupported'); return; }
    let access = null, inputs = [];
    const onMsg = (event) => {
      const d = event.data; if (!d || d.length < 2) return;
      const cmd = d[0] & 0xf0, mn = d[1], vel = d[2] ?? 0;
      if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
        midiPressedRef.current.delete(mn);
        const offNote = findNoteByMidi(mn);
        if (offNote) releaseNoteRef.current?.(offNote.name);
        return;
      }
      if (cmd === 0x90 && vel > 0) {
        if (midiPressedRef.current.has(mn)) return;
        midiPressedRef.current.add(mn);
        const note = findNoteByMidi(mn);
        if (note) {
          if (!audioReadyRef.current) Tone.start().then(() => { audioReadyRef.current = true; setAudioReady(true); }).catch(() => {});
          playNoteRef.current?.(note.name, true); // isMidi=true: match lesson by pitch class
        }
      }
    };
    const attach = (a) => {
      inputs.forEach(i => { try { i.onmidimessage = null; } catch(e) {} });
      inputs = Array.from(a.inputs.values());
      if (inputs.length > 0) { inputs.forEach(i => { i.onmidimessage = onMsg; }); setMidiStatus('connected'); setMidiDeviceName(inputs.map(i=>i.name).filter(Boolean).join(', ') || 'Dispositivo MIDI'); }
      else { setMidiStatus('no-devices'); setMidiDeviceName(''); }
    };
    setMidiStatus('connecting');
    navigator.requestMIDIAccess({ sysex: false }).then(a => { access = a; attach(a); a.onstatechange = () => attach(a); }).catch(() => setMidiStatus('denied'));
    return () => { inputs.forEach(i => { try { i.onmidimessage = null; } catch(e) {} }); if (access) access.onstatechange = null; midiPressedRef.current.clear(); };
  }, []);

  // ---------------------------------------------------------------
  // Song controls
  // ---------------------------------------------------------------
  const selectSong = (song) => {
    setCurrentSong(song); setCurrentNoteIndex(0); setSongComplete(false); setShowSongList(false);
    stopTraining(); setTrainingMode(false); stopSheet(); setSheetMode(false);
    mpBroadStateRef.current?.({ type: 'song_select', songId: song.id });
  };
  const restartSong = () => { setCurrentNoteIndex(0); setSongComplete(false); };
  const closeSong   = () => { setCurrentSong(null); setCurrentNoteIndex(0); setSongComplete(false); stopTraining(); setTrainingMode(false); stopSheet(); setSheetMode(false); };

  const parsedSongNotes = currentSong ? currentSong.notes.map(parseNote) : [];
  const expectedNote    = !trainingMode && currentSong && !songComplete ? parsedSongNotes[currentNoteIndex]?.name : null;
  const upcomingNotes   = !trainingMode && currentSong ? parsedSongNotes.slice(currentNoteIndex, currentNoteIndex + 10) : [];

  // Demo
  const playDemo = async () => {
    if (!currentSong) return;
    await ensureAudio();
    setDemoPlaying(true);
    demoTimers.current.forEach(t => clearTimeout(t));
    demoTimers.current = [];
    const beatDur = 60000 / (currentSong.bpm || 90);
    let t = 0;
    parsedSongNotes.forEach((note, i) => {
      const delay = t;
      const durMs = Math.max(100, note.dur * beatDur * 0.88);
      const timer = setTimeout(() => {
        try {
          synthRef.current?.triggerAttackRelease(note.name, durMs / 1000);
          setActiveNotes(prev => { const s = new Set(prev); s.add(note.name); return s; });
          setTimeout(() => setActiveNotes(prev => { const s = new Set(prev); s.delete(note.name); return s; }), Math.min(durMs - 40, note.dur * beatDur * 0.85));
        } catch(e) {}
        if (i === parsedSongNotes.length - 1) setTimeout(() => setDemoPlaying(false), 500);
      }, delay);
      demoTimers.current.push(timer);
      t += note.dur * beatDur;
    });
  };
  const stopDemo = () => {
    demoTimers.current.forEach(t => clearTimeout(t));
    demoTimers.current = [];
    setDemoPlaying(false);
    try { synthRef.current?.releaseAll(); } catch(e) {}
    setActiveNotes(new Set());
  };

  // Piano pointer
  const handlePianoPointerDown = useCallback((noteName) => (e) => {
    if (pianoPointerRef.current.has(e.pointerId)) return;
    pianoPointerRef.current.set(e.pointerId, noteName);
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    playNote(noteName);
  }, [playNote]);
  const handlePianoPointerEnd = useCallback((e) => {
    const heldNote = pianoPointerRef.current.get(e.pointerId);
    pianoPointerRef.current.delete(e.pointerId);
    if (heldNote) releaseNoteRef.current?.(heldNote);
  }, []);

  // MIDI badge
  const midiBadge = () => {
    if (midiStatus==='connected') return { color:'#9bd17e', dot:'#7fcf52', label:'MIDI Conectado', sub:midiDeviceName };
    if (midiStatus==='connecting') return { color:'#e8c66a', dot:'#e8c66a', label:'Conectando MIDI', sub:'aguardando...' };
    if (midiStatus==='no-devices') return { color:'#e8c66a', dot:'#e8c66a', label:'MIDI Pronto', sub:'nenhum dispositivo' };
    if (midiStatus==='denied') return { color:'#e07c5e', dot:'#e07c5e', label:'MIDI negado', sub:'recarregue a página' };
    if (midiStatus==='unsupported') return { color:'#e07c5e', dot:'#e07c5e', label:'MIDI indisponível', sub:'use Chrome/Edge' };
    return { color:'#8a7d6c', dot:'#8a7d6c', label:'MIDI', sub:'...' };
  };
  const midiInfo = midiBadge();

  const totalHits  = trainingHits.perfect + trainingHits.good + trainingHits.miss;
  const accuracy   = totalHits > 0 ? Math.round(((trainingHits.perfect + trainingHits.good) / totalHits) * 100) : 0;
  const isTraining = trainingState !== 'idle';

  // Sheet derived
  const isSheet         = sheetState !== 'idle';
  const sheetTotalHits  = sheetHits.perfect + sheetHits.good + sheetHits.miss;
  const sheetAccuracy   = sheetTotalHits > 0 ? Math.round(((sheetHits.perfect + sheetHits.good) / sheetTotalHits) * 100) : 0;
  // Next unhit note sitting at or ahead of playhead — used for piano key glow
  const sheetExpectedNote = sheetMode && sheetState === 'playing'
    ? sheetNotes.find(n => !n.hit && n.x != null && n.x >= SHEET_PLAYHEAD_X - 8)?.noteName
    : null;

  // ---------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------
  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ background:'radial-gradient(ellipse at top,#1f1815 0%,#0d0a08 60%,#050403 100%)', fontFamily:'"Inter",ui-sans-serif,system-ui,sans-serif', color:'#e8dfd0' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..900,0..100&family=Inter:wght@300;400;500;600;700&display=swap');
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 0 0 rgba(240,168,48,.7),0 0 30px 4px rgba(240,168,48,.55);}50%{box-shadow:0 0 0 12px rgba(240,168,48,0),0 0 50px 10px rgba(240,168,48,.85);} }
        @keyframes shimmerIn { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);} }
        @keyframes celebrate { 0%{transform:scale(.9);opacity:0;}50%{transform:scale(1.05);}100%{transform:scale(1);opacity:1;} }
        @keyframes feedbackPop { 0%{transform:translateX(-50%) scale(.8);opacity:0;}30%{transform:translateX(-50%) scale(1.2);opacity:1;}80%{opacity:1;}100%{transform:translateX(-50%) translateY(-20px) scale(1);opacity:0;} }
        @keyframes cdPulse { 0%{transform:translate(-50%,-50%) scale(1.4);opacity:0;}40%{opacity:1;}100%{transform:translate(-50%,-50%) scale(1);opacity:1;} }
        @keyframes hzPulse { 0%,100%{box-shadow:0 0 0 0 rgba(240,168,48,.3),0 -2px 20px rgba(240,168,48,.15);}50%{box-shadow:0 0 0 6px rgba(240,168,48,0),0 -2px 28px rgba(240,168,48,.35);} }
        .display-font{font-family:'Fraunces',Georgia,serif;font-optical-sizing:auto;}
        .key-press-anim{transition:transform 60ms ease-out,background 100ms;}
        .lesson-glow{animation:pulseGlow 1.6s ease-in-out infinite;}
        .fade-in{animation:shimmerIn .5s ease-out both;}
        .celebrate-anim{animation:celebrate .6s ease-out;}
        .feedback-pop{animation:feedbackPop .65s ease-out forwards;position:absolute;top:18%;left:50%;pointer-events:none;z-index:30;white-space:nowrap;}
        .cd-num{animation:cdPulse .4s ease-out;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);}
        .hz-bar{animation:hzPulse 2s ease-in-out infinite;}
        @keyframes floatUp{0%{transform:translateX(-50%) translateY(0);opacity:1;}100%{transform:translateX(-50%) translateY(-58px);opacity:0;}}
        .free-float{animation:floatUp .85s ease-out forwards;position:absolute;left:50%;bottom:105%;pointer-events:none;z-index:30;font-weight:800;white-space:nowrap;}
        button:focus-visible{outline:2px solid #f0a830;outline-offset:3px;}
      `}</style>

      {/* HEADER */}
      <header className="px-6 md:px-10 pt-8 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#f0a830,#c97e1a)', boxShadow:'0 8px 24px -8px rgba(240,168,48,.5),inset 0 1px 0 rgba(255,255,255,.2)' }}>
            <Music size={22} strokeWidth={2.4} style={{ color:'#1a1108' }} />
          </div>
          <div>
            <h1 className="display-font text-2xl md:text-3xl tracking-tight leading-none" style={{ color:'#f5efe6', fontWeight:500, fontStyle:'italic' }}>Allegretto</h1>
            <p className="text-xs tracking-[.18em] uppercase mt-1" style={{ color:'#8a7d6c' }}>Piano · MIDI · Lições · Treino · Partitura</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Live Room badge / button */}
          {mpInRoom ? (
            <button onClick={() => setMpOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all hover:scale-105" style={{ background:'rgba(155,209,126,.12)', border:'1px solid rgba(155,209,126,.35)', color:'#9bd17e' }}>
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{background:'#9bd17e'}}/><span className="relative inline-flex rounded-full h-2 w-2" style={{background:'#9bd17e'}}/></span>
              <Users size={13}/> {mpCode} · {mpMembers.length} {mpMembers.length === 1 ? 'músico' : 'músicos'}
            </button>
          ) : (
            <button onClick={() => setMpOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all hover:scale-105" style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', color:'#a89a87' }}>
              <Radio size={13}/> Ao Vivo
            </button>
          )}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)' }}>
            <Usb size={16} style={{ color:midiInfo.color }} />
            <span className="relative flex h-2 w-2">
              {midiStatus==='connected' && <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background:midiInfo.dot }}/>}
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background:midiInfo.dot }}/>
            </span>
            <div className="text-[11px] leading-tight">
              <div style={{ color:midiInfo.color, fontWeight:600 }}>{midiInfo.label}</div>
              {midiInfo.sub && <div style={{ color:'#6b6052', fontSize:10 }} className="truncate max-w-[180px]">{midiInfo.sub}</div>}
            </div>
          </div>
          {!audioReady && (
            <button onClick={ensureAudio} className="px-4 py-2 rounded-full text-sm flex items-center gap-2 transition-all hover:scale-105" style={{ background:'linear-gradient(135deg,#f0a830,#c97e1a)', color:'#1a1108', fontWeight:600 }}>
              <Sparkles size={14}/> Ativar Som
            </button>
          )}
        </div>
      </header>

      <main className="px-6 md:px-10 pb-32">

        {/* HERO */}
        <section className="max-w-6xl mx-auto mb-10 mt-2 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 fade-in">
            <p className="text-xs tracking-[.25em] uppercase mb-3" style={{ color:'#c97e1a' }}>Aprenda tocando</p>
            <h2 className="display-font text-4xl md:text-5xl leading-[1.05] tracking-tight mb-4" style={{ color:'#f5efe6', fontWeight:400 }}>
              Toque <span style={{ fontStyle:'italic', color:'#f0a830' }}>músicas conhecidas</span><br/>
              ou entre no <span style={{ fontStyle:'italic' }}>modo treino</span>.
            </h2>
            <p className="text-sm md:text-base max-w-2xl leading-relaxed" style={{ color:'#a89a87' }}>
              Três modos: <strong style={{color:'#f0a830'}}>Aprender</strong> guia nota a nota, <strong style={{color:'#f0a830'}}>Treino</strong> lança notas como Guitar Hero, e <strong style={{color:'#f0a830'}}>Partitura</strong> rola a pauta musical em tempo real para você tocar no ritmo exato.
            </p>
          </div>
          <div className="fade-in" style={{ animationDelay:'.15s' }}>
            <button onClick={() => setShowSongList(true)} className="w-full p-5 rounded-2xl text-left transition-all hover:scale-[1.02] group" style={{ background:'linear-gradient(135deg,rgba(240,168,48,.12),rgba(240,168,48,.04))', border:'1px solid rgba(240,168,48,.25)' }}>
              <div className="flex items-center justify-between mb-2">
                <BookOpen size={20} style={{ color:'#f0a830' }}/>
                <ChevronRight size={18} style={{ color:'#f0a830' }} className="group-hover:translate-x-1 transition-transform"/>
              </div>
              <div className="display-font text-2xl leading-tight mb-1" style={{ color:'#f5efe6' }}>{currentSong ? currentSong.title : 'Escolher música'}</div>
              <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color:'#a89a87' }}>
                <span>{currentSong ? `${currentSong.artist} · clique para trocar` : `${SONGS.length} músicas disponíveis`}</span>
                {currentSong?.timeSignature && (
                  <span className="display-font" style={{ fontSize:11, color:'#f0a830', background:'rgba(240,168,48,.1)', border:'1px solid rgba(240,168,48,.2)', borderRadius:4, padding:'1px 6px' }}>{currentSong.timeSignature}</span>
                )}
              </div>
            </button>
          </div>
        </section>

        {/* SONG PANEL */}
        {currentSong && (
          <section className="max-w-6xl mx-auto mb-4 fade-in">
            <div className="rounded-2xl p-5 md:p-6" style={{ background:'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))', border:'1px solid rgba(255,255,255,.08)' }}>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs tracking-[.2em] uppercase mb-1" style={{ color:'#c97e1a' }}>
                    {trainingMode ? '🎮 Modo Treino' : sheetMode ? '🎼 Partitura' : (songComplete ? '✦ Completa' : 'Aprendendo')}
                  </div>
                  <div className="display-font text-2xl md:text-3xl" style={{ color:'#f5efe6' }}>{currentSong.title}</div>
                  <div className="text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color:'#8a7d6c' }}>
                    <span>{currentSong.artist} · {parsedSongNotes.length} notas · ~{Math.round(songBeats(currentSong) / (currentSong.bpm/60))}s</span>
                    {currentSong.timeSignature && (
                      <span className="display-font" style={{ fontSize:11, color:'#f0a830', background:'rgba(240,168,48,.1)', border:'1px solid rgba(240,168,48,.2)', borderRadius:4, padding:'1px 6px' }}>{currentSong.timeSignature}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Mode toggle */}
                  <div className="flex rounded-full overflow-hidden" style={{ border:'1px solid rgba(255,255,255,.1)' }}>
                    <button onClick={() => { setTrainingMode(false); stopTraining(); setSheetMode(false); stopSheet(); }} className="px-3 py-1.5 text-xs font-medium transition-colors" style={{ background:!trainingMode&&!sheetMode?'rgba(240,168,48,.2)':'transparent', color:!trainingMode&&!sheetMode?'#f0a830':'#8a7d6c' }}>🎓 Aprender</button>
                    <button onClick={() => { setTrainingMode(true); setSheetMode(false); stopSheet(); }} className="px-3 py-1.5 text-xs font-medium transition-colors" style={{ background:trainingMode?'rgba(240,168,48,.2)':'transparent', color:trainingMode?'#f0a830':'#8a7d6c' }}>🎮 Treinar</button>
                    <button onClick={() => { setSheetMode(true); setTrainingMode(false); stopTraining(); mpBroadStateRef.current?.({ type: 'sheet_mode', on: true }); }} className="px-3 py-1.5 text-xs font-medium transition-colors" style={{ background:sheetMode?'rgba(240,168,48,.2)':'transparent', color:sheetMode?'#f0a830':'#8a7d6c' }}>🎼 Partitura</button>
                  </div>

                  {!trainingMode && !sheetMode && <>
                    <button onClick={demoPlaying ? stopDemo : playDemo} className="px-4 py-2 rounded-full text-sm flex items-center gap-2" style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'#e8dfd0' }}>
                      {demoPlaying ? <Pause size={14}/> : <Play size={14}/>} {demoPlaying?'Parar':'Ouvir'}
                    </button>
                    <button onClick={restartSong} className="px-4 py-2 rounded-full text-sm flex items-center gap-2" style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'#e8dfd0' }}>
                      <RotateCcw size={14}/> Recomeçar
                    </button>
                  </>}

                  {trainingMode && trainingState==='idle' && (
                    <div className="flex items-center gap-2">
                      <select value={trainingSpeed} onChange={e => setTrainingSpeed(Number(e.target.value))} className="px-2 py-1.5 rounded-lg text-xs" style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', color:'#e8dfd0' }}>
                        <option value={0.5}>Velocidade 50%</option>
                        <option value={0.75}>Velocidade 75%</option>
                        <option value={1.0}>Velocidade 100%</option>
                        <option value={1.25}>Velocidade 125%</option>
                      </select>
                      <button onClick={startTraining} className="px-4 py-2 rounded-full text-sm flex items-center gap-2 transition-all hover:scale-105" style={{ background:'linear-gradient(135deg,#f0a830,#c97e1a)', color:'#1a1108', fontWeight:600, boxShadow:'0 8px 20px -6px rgba(240,168,48,.5)' }}>
                        <Target size={14}/> Iniciar
                      </button>
                    </div>
                  )}
                  {trainingMode && trainingState==='playing' && (
                    <button onClick={stopTraining} className="px-4 py-2 rounded-full text-sm flex items-center gap-2" style={{ background:'rgba(224,124,94,.15)', border:'1px solid rgba(224,124,94,.3)', color:'#e07c5e' }}>
                      <X size={14}/> Parar
                    </button>
                  )}
                  {trainingMode && trainingState==='complete' && (
                    <button onClick={startTraining} className="px-4 py-2 rounded-full text-sm flex items-center gap-2 hover:scale-105 transition-all" style={{ background:'linear-gradient(135deg,#f0a830,#c97e1a)', color:'#1a1108', fontWeight:600 }}>
                      <RotateCcw size={14}/> Jogar de novo
                    </button>
                  )}

                  {/* Sheet mode controls */}
                  {sheetMode && sheetState==='idle' && (
                    <div className="flex items-center gap-2">
                      <select value={sheetSpeed} onChange={e => setSheetSpeed(Number(e.target.value))} className="px-2 py-1.5 rounded-lg text-xs" style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', color:'#e8dfd0' }}>
                        <option value={0.5}>Velocidade 50%</option>
                        <option value={0.75}>Velocidade 75%</option>
                        <option value={1.0}>Velocidade 100%</option>
                        <option value={1.25}>Velocidade 125%</option>
                      </select>
                      <button onClick={async () => { await startSheet(); mpBroadStateRef.current?.({ type: 'sheet_start' }); }} className="px-4 py-2 rounded-full text-sm flex items-center gap-2 transition-all hover:scale-105" style={{ background:'linear-gradient(135deg,#f0a830,#c97e1a)', color:'#1a1108', fontWeight:600, boxShadow:'0 8px 20px -6px rgba(240,168,48,.5)' }}>
                        <Play size={14}/> Tocar
                      </button>
                    </div>
                  )}
                  {sheetMode && (sheetState==='playing'||sheetState==='countdown') && (
                    <button onClick={() => { stopSheet(); mpBroadStateRef.current?.({ type: 'sheet_stop' }); }} className="px-4 py-2 rounded-full text-sm flex items-center gap-2" style={{ background:'rgba(224,124,94,.15)', border:'1px solid rgba(224,124,94,.3)', color:'#e07c5e' }}>
                      <X size={14}/> Parar
                    </button>
                  )}
                  {sheetMode && sheetState==='complete' && (
                    <button onClick={async () => { await startSheet(); mpBroadStateRef.current?.({ type: 'sheet_start' }); }} className="px-4 py-2 rounded-full text-sm flex items-center gap-2 hover:scale-105 transition-all" style={{ background:'linear-gradient(135deg,#f0a830,#c97e1a)', color:'#1a1108', fontWeight:600 }}>
                      <RotateCcw size={14}/> Tocar de novo
                    </button>
                  )}

                  <button onClick={closeSong} className="px-3 py-2 rounded-full text-sm" style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)', color:'#8a7d6c' }}><X size={14}/></button>
                </div>
              </div>

              {/* Training HUD — score during play */}
              {trainingMode && trainingState==='playing' && (
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="text-center"><div className="text-2xl font-bold font-mono" style={{ color:'#f0a830' }}>{trainingScore.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider" style={{ color:'#6b6052' }}>Pontos</div></div>
                  <div className="text-center"><div className="text-2xl font-bold font-mono" style={{ color:trainingCombo>=10?'#9bd17e':'#e8dfd0' }}>×{trainingCombo}</div><div className="text-[10px] uppercase tracking-wider" style={{ color:'#6b6052' }}>Combo</div></div>
                  <div className="flex gap-4 text-sm flex-wrap">
                    <span style={{ color:'#9bd17e' }}>● {trainingHits.perfect} perfeito</span>
                    <span style={{ color:'#f0d060' }}>● {trainingHits.good} bom</span>
                    <span style={{ color:'#e07c5e' }}>● {trainingHits.miss} erro</span>
                  </div>
                </div>
              )}

              {/* Training Results */}
              {trainingMode && trainingState==='complete' && (
                <div className="mt-2 p-4 rounded-xl celebrate-anim" style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)' }}>
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background:accuracy>=80?'linear-gradient(135deg,#9bd17e,#5a9d3e)':'linear-gradient(135deg,#f0a830,#c97e1a)', boxShadow:'0 8px 24px -6px rgba(155,209,126,.4)' }}>
                        {accuracy>=80 ? <Trophy size={28} style={{ color:'#0d2a07' }}/> : <Target size={28} style={{ color:'#1a1108' }}/>}
                      </div>
                      <div>
                        <div className="display-font text-2xl" style={{ color:'#f5efe6' }}>{accuracy>=95?'Perfeito!':accuracy>=80?'Muito Bem!':accuracy>=60?'Bom!':'Continue Praticando!'}</div>
                        <div className="text-sm" style={{ color:'#8a7d6c' }}>Precisão: {accuracy}%</div>
                      </div>
                    </div>
                    <div className="flex gap-5 flex-wrap">
                      {[['Pontos', trainingScoreRef.current.toLocaleString(), '#f0a830'],['Combo Máx', trainingMaxCombo, '#9bd17e'],['Perfeitos', trainingHits.perfect, '#9bd17e'],['Bons', trainingHits.good, '#f0d060'],['Erros', trainingHits.miss, '#e07c5e']].map(([label,val,clr]) => (
                        <div key={label} className="text-center"><div className="text-xl font-bold font-mono" style={{ color:clr }}>{val}</div><div className="text-[10px] uppercase tracking-wider" style={{ color:'#6b6052' }}>{label}</div></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Sheet HUD */}
              {sheetMode && sheetState==='playing' && (
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="text-center"><div className="text-2xl font-bold font-mono" style={{ color:'#f0a830' }}>{sheetScore.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider" style={{ color:'#6b6052' }}>Pontos</div></div>
                  <div className="text-center"><div className="text-2xl font-bold font-mono" style={{ color:sheetCombo>=10?'#9bd17e':'#e8dfd0' }}>×{sheetCombo}</div><div className="text-[10px] uppercase tracking-wider" style={{ color:'#6b6052' }}>Combo</div></div>
                  <div className="flex gap-4 text-sm flex-wrap">
                    <span style={{ color:'#9bd17e' }}>● {sheetHits.perfect} perfeito</span>
                    <span style={{ color:'#f0d060' }}>● {sheetHits.good} bom</span>
                    <span style={{ color:'#e07c5e' }}>● {sheetHits.miss} erro</span>
                  </div>
                </div>
              )}

              {/* Sheet Results */}
              {sheetMode && sheetState==='complete' && (
                <div className="mt-2 p-4 rounded-xl celebrate-anim" style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)' }}>
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background:sheetAccuracy>=80?'linear-gradient(135deg,#9bd17e,#5a9d3e)':'linear-gradient(135deg,#f0a830,#c97e1a)', boxShadow:'0 8px 24px -6px rgba(155,209,126,.4)' }}>
                        {sheetAccuracy>=80 ? <Trophy size={28} style={{ color:'#0d2a07' }}/> : <Target size={28} style={{ color:'#1a1108' }}/>}
                      </div>
                      <div>
                        <div className="display-font text-2xl" style={{ color:'#f5efe6' }}>{sheetAccuracy>=95?'Perfeito!':sheetAccuracy>=80?'Muito Bem!':sheetAccuracy>=60?'Bom!':'Continue Praticando!'}</div>
                        <div className="text-sm" style={{ color:'#8a7d6c' }}>Precisão na partitura: {sheetAccuracy}%</div>
                      </div>
                    </div>
                    <div className="flex gap-5 flex-wrap">
                      {[['Pontos', sheetScoreRef.current.toLocaleString(), '#f0a830'],['Combo Máx', sheetMaxCombo, '#9bd17e'],['Perfeitos', sheetHits.perfect, '#9bd17e'],['Bons', sheetHits.good, '#f0d060'],['Erros', sheetHits.miss, '#e07c5e']].map(([label,val,clr]) => (
                        <div key={label} className="text-center"><div className="text-xl font-bold font-mono" style={{ color:clr }}>{val}</div><div className="text-[10px] uppercase tracking-wider" style={{ color:'#6b6052' }}>{label}</div></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Lesson upcoming notes */}
              {!trainingMode && !sheetMode && !songComplete && (
                <>
                  <div className="h-1.5 rounded-full overflow-hidden mb-4" style={{ background:'rgba(255,255,255,.06)' }}>
                    <div className="h-full transition-all duration-500" style={{ width:`${(currentNoteIndex/parsedSongNotes.length)*100}%`, background:'linear-gradient(90deg,#c97e1a,#f0a830)', boxShadow:'0 0 12px rgba(240,168,48,.5)' }}/>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {(() => {
                      // Check if the song uses the same note display name in multiple octaves
                      const displayToOctaves = new Map();
                      parsedSongNotes.forEach(n => {
                        const nd2 = NOTES.find(x => x.name === n.name);
                        if (!nd2) return;
                        const disp = labelLang==='pt' ? nd2.pt : nd2.en;
                        const oct = n.name.slice(-1);
                        if (!displayToOctaves.has(disp)) displayToOctaves.set(disp, new Set());
                        displayToOctaves.get(disp).add(oct);
                      });
                      const octaveSuper = { '4':'⁴', '5':'⁵', '6':'⁶', '3':'³' };
                      return upcomingNotes.map((noteObj, i) => {
                        const nd = NOTES.find(x => x.name === noteObj.name);
                        if (!nd) return null;
                        const isNext = i === 0;
                        const typeName = getNoteTypeName(noteObj.dur);
                        const noteColor = isNext ? '#1a1108' : '#a89a87';
                        const dispName = labelLang==='pt' ? nd.pt : nd.en;
                        const oct = noteObj.name.slice(-1);
                        const showOct = (displayToOctaves.get(dispName)?.size ?? 0) > 1;
                        return (
                          <div key={`${noteObj.name}-${i}-${currentNoteIndex}`} className={`flex-shrink-0 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${isNext?'celebrate-anim':''}`} style={{ width:isNext?80:60, height:isNext?84:64, background:isNext?'linear-gradient(135deg,#f0a830,#c97e1a)':'rgba(255,255,255,.04)', border:isNext?'none':'1px solid rgba(255,255,255,.08)', color:noteColor, boxShadow:isNext?'0 8px 30px -6px rgba(240,168,48,.55)':'none', opacity:1-(i*.07) }}>
                            <NoteIcon dur={noteObj.dur} color={noteColor} size={isNext?16:12}/>
                            <div className={`display-font font-medium ${isNext?'text-lg':'text-sm'} leading-tight`}>
                              {dispName}{showOct && <sup style={{ fontSize:'0.6em', opacity:0.75 }}>{octaveSuper[oct]||oct}</sup>}
                            </div>
                            <div className="text-[9px] opacity-60 leading-none">{typeName}</div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              )}

              {!trainingMode && !sheetMode && songComplete && (
                <div className="text-center py-6 celebrate-anim">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3" style={{ background:'linear-gradient(135deg,#9bd17e,#5a9d3e)', boxShadow:'0 8px 28px -6px rgba(155,209,126,.5)' }}>
                    <Check size={32} style={{ color:'#0d2a07' }} strokeWidth={3}/>
                  </div>
                  <div className="display-font text-2xl mb-1" style={{ color:'#f5efe6' }}>Parabéns!</div>
                  <div className="text-sm" style={{ color:'#a89a87' }}>Você completou a música.</div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* PIANO */}
        <section className="max-w-6xl mx-auto">
          <div className="rounded-2xl p-3 md:p-5" style={{ background:'linear-gradient(180deg,#2a1f17 0%,#1a130d 100%)', border:'1px solid rgba(255,255,255,.08)', boxShadow:'0 30px 80px -20px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.04)' }}>
            <div className="h-2 rounded-full mb-3" style={{ background:'linear-gradient(180deg,#4a2418,#2a140d)', boxShadow:'inset 0 1px 2px rgba(0,0,0,.6)' }}/>

            {/* SHEET MUSIC STAFF */}
            {sheetMode && isSheet && (() => {
              const SL = STAFF_LINE_SPACING;
              const ST = STAFF_TOP;
              const PX = SHEET_PLAYHEAD_X;
              // Staff line y positions
              const lineYs = [ST, ST+SL, ST+SL*2, ST+SL*3, ST+SL*4];
              // Ledger line y constants
              const ledgerBelow = ST + SL*5;   // C4 ledger
              const ledger1Above = ST - SL;    // A5 ledger (1st above)
              const ledger2Above = ST - SL*2;  // C6 ledger (2nd above)

              return (
                <div className="relative w-full mb-1 overflow-hidden rounded-lg" style={{ height: STAFF_SVG_H + 8, background:'#0d0a07' }}>
                  <svg width="100%" height={STAFF_SVG_H} style={{ position:'absolute', top:4, left:0, overflow:'visible', userSelect:'none' }}>
                    {/* Staff lines */}
                    {lineYs.map((y, i) => (
                      <line key={i} x1={45} y1={y} x2="5000" y2={y} stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
                    ))}

                    {/* Treble clef */}
                    <text x="4" y={ST + SL*4 + 6} fill="rgba(240,168,48,0.75)"
                      fontSize={SL * 5.8} fontFamily="serif" style={{ userSelect:'none', pointerEvents:'none' }}>𝄞</text>

                    {/* Playhead — vertical amber line */}
                    <line x1={PX} y1={ST - 20} x2={PX} y2={ST + SL*4 + 20} stroke="#f0a830" strokeWidth="2" opacity="0.9"/>
                    <line x1={PX} y1={ST - 20} x2={PX} y2={ST + SL*4 + 20} stroke="#f0a830" strokeWidth="10" opacity="0.08"/>
                    {/* Playhead tick at bottom */}
                    <polygon points={`${PX-5},${ST+SL*4+20} ${PX+5},${ST+SL*4+20} ${PX},${ST+SL*4+28}`} fill="#f0a830" opacity="0.7"/>

                    {/* Notes */}
                    {sheetNotes.map(note => {
                      const x = note.x;
                      if (x == null || x < -80 || x > 4000) return null;
                      const step      = NOTE_STAFF_STEPS[note.noteName] ?? 6;
                      const ny        = ST + (10 - step) * (SL / 2);
                      const stemDn    = step > 6;  // above center line B4 → stem down
                      const isWhole   = note.dur >= 3.6;
                      const isHalf    = !isWhole && note.dur >= 1.8;
                      const is16th    = !isWhole && !isHalf && note.dur < 0.4;
                      const isEighth  = !isWhole && !isHalf && !is16th && note.dur < 0.85;
                      const isDotted  = [4,2,1,0.5,0.25].some(b => Math.abs(note.dur - b * 1.5) < 0.07);
                      const hasSharp  = note.noteName.includes('#');

                      const clr = note.hit === 'perfect' ? '#9bd17e'
                                : note.hit === 'good'    ? '#f0d060'
                                : note.hit === 'miss'    ? '#e07c5e66'
                                : x < PX - 4            ? '#f0a830'  // passed playhead (unhit = approaching miss)
                                :                         '#f5efe8';  // upcoming

                      const stemX  = stemDn ? x - 5.5 : x + 5.5;
                      const stemY2 = stemDn ? ny + 30  : ny - 30;

                      return (
                        <g key={note.id}>
                          {/* Hit glow */}
                          {note.hit && note.hit !== 'miss' && (
                            <circle cx={x} cy={ny} r={13} fill={clr} opacity="0.18"/>
                          )}
                          {/* Ledger lines */}
                          {step <= 0 && <line x1={x-10} y1={ledgerBelow} x2={x+10} y2={ledgerBelow} stroke={clr} strokeWidth="1.5"/>}
                          {step >= 12 && <line x1={x-10} y1={ledger1Above} x2={x+10} y2={ledger1Above} stroke={clr} strokeWidth="1.5"/>}
                          {step >= 14 && <line x1={x-10} y1={ledger2Above} x2={x+10} y2={ledger2Above} stroke={clr} strokeWidth="1.5"/>}

                          {/* Accidental */}
                          {hasSharp && (
                            <text x={x-15} y={ny+5} fill={clr} fontSize="12" fontFamily="serif" style={{pointerEvents:'none'}}>♯</text>
                          )}

                          {/* Note head */}
                          {isWhole
                            ? <ellipse cx={x} cy={ny} rx={7.5} ry={5.5} stroke={clr} strokeWidth="2" fill="none"/>
                            : isHalf
                            ? <ellipse cx={x} cy={ny} rx={6.5} ry={5} stroke={clr} strokeWidth="1.8" fill="none"/>
                            : <ellipse cx={x} cy={ny} rx={6.5} ry={5} fill={clr}/>
                          }

                          {/* Dotted note dot */}
                          {isDotted && <circle cx={x + 11} cy={ny - 2} r={2} fill={clr}/>}

                          {/* Stem */}
                          {!isWhole && (
                            <line x1={stemX} y1={ny} x2={stemX} y2={stemY2} stroke={clr} strokeWidth="1.5"/>
                          )}

                          {/* Eighth note flag */}
                          {isEighth && (stemDn
                            ? <path d={`M${stemX},${stemY2} C${stemX+14},${stemY2-8} ${stemX+15},${stemY2-16} ${stemX+2},${stemY2-22}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                            : <path d={`M${stemX},${stemY2} C${stemX+14},${stemY2+8} ${stemX+15},${stemY2+16} ${stemX+2},${stemY2+22}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                          )}

                          {/* Sixteenth note flags (two flags) */}
                          {is16th && (stemDn ? <>
                            <path d={`M${stemX},${stemY2}   C${stemX+14},${stemY2-8}  ${stemX+15},${stemY2-16} ${stemX+2},${stemY2-22}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                            <path d={`M${stemX},${stemY2-7} C${stemX+14},${stemY2-15} ${stemX+15},${stemY2-23} ${stemX+2},${stemY2-29}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                          </> : <>
                            <path d={`M${stemX},${stemY2}   C${stemX+14},${stemY2+8}  ${stemX+15},${stemY2+16} ${stemX+2},${stemY2+22}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                            <path d={`M${stemX},${stemY2+7} C${stemX+14},${stemY2+15} ${stemX+15},${stemY2+23} ${stemX+2},${stemY2+29}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                          </>)}

                        </g>
                      );
                    })}

                    {/* Score & combo overlay */}
                    {sheetState === 'playing' && <>
                      <text x="50" y={ST - 8} fill="#f0a830" fontSize="13" fontFamily="monospace" fontWeight="bold">{sheetScore.toLocaleString()}</text>
                      {sheetCombo >= 5 && <text x={PX + 16} y={ST - 8} fill={sheetCombo>=20?'#9bd17e':'#f0a830'} fontSize="12" fontFamily="monospace" fontWeight="bold">×{sheetCombo} combo</text>}
                    </>}
                  </svg>

                  {/* Hit feedback */}
                  {sheetFeedback && (
                    <div className="feedback-pop" style={{ fontSize:22, fontWeight:800, letterSpacing:'.06em', color:sheetFeedback.type==='perfect'?'#9bd17e':sheetFeedback.type==='good'?'#f0d060':'#e07c5e', textShadow:'0 0 20px currentColor' }}>
                      {sheetFeedback.type==='perfect'?'✦ PERFEITO!':sheetFeedback.type==='good'?'● BOM!':'✕ ERRO'}
                    </div>
                  )}

                  {/* Countdown */}
                  {sheetState === 'countdown' && sheetCdown != null && (
                    <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.65)', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <div key={sheetCdown} className="cd-num display-font" style={{ fontSize:72, color:'#f0a830', fontWeight:700, textShadow:'0 0 40px rgba(240,168,48,.9)' }}>{sheetCdown}</div>
                    </div>
                  )}

                  {/* Label bar at bottom */}
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, height:8, background:'linear-gradient(to top,rgba(240,168,48,.05),transparent)', pointerEvents:'none' }}/>
                </div>
              );
            })()}

            {/* FALLING LANES */}
            {trainingMode && isTraining && (
              <div className="relative w-full mb-1 overflow-hidden rounded-lg" style={{ height:300, background:'#0a0706' }}>

                {/* White key lane backgrounds */}
                {WHITE_KEYS.map((note,i) => (
                  <div key={note.name} style={{ position:'absolute', top:0, bottom:0, left:`${(i/WHITE_KEY_COUNT)*100}%`, width:`${WHITE_KEY_WIDTH}%`, background:i%2===0?'rgba(255,255,255,.016)':'rgba(255,255,255,.008)', borderRight:'1px solid rgba(255,255,255,.04)' }}/>
                ))}
                {/* Black key lane backgrounds */}
                {BLACK_KEYS.map(note => (
                  <div key={note.name} style={{ position:'absolute', top:0, bottom:0, left:`${BLACK_KEY_LEFTS.get(note.name)}%`, width:`${WHITE_KEY_WIDTH*0.6}%`, background:'rgba(0,0,0,.4)', zIndex:1 }}/>
                ))}

                {/* Note blocks — no auto-sound, only player touch triggers sound */}
                {displayNotes.map(note => {
                  const hitClr = note.hit==='perfect'?'#9bd17e':note.hit==='good'?'#f0d060':note.hit==='miss'?'#e07c5e':null;
                  const base   = note.isBlack?'#c97e1a':'#f0a830';
                  const clr    = hitClr || base;
                  const iconColor = note.isBlack ? '#1a1108' : '#1a1108';
                  return (
                    <div key={note.id} style={{
                      position:'absolute',
                      left:note.left,
                      width:note.width,
                      bottom:`${100-note.y}%`,
                      height:`${note.heightPct}%`,
                      background:`linear-gradient(180deg,${clr}ee,${clr}88)`,
                      borderRadius:'4px 4px 3px 3px',
                      zIndex:note.isBlack?4:3,
                      boxShadow:hitClr?`0 0 14px 3px ${clr}80`:`0 2px 6px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.25)`,
                      opacity:note.hit?(note.hit==='miss'?0.2:0.35):1,
                      border:`1px solid ${clr}66`,
                      transition:note.hit?'opacity .25s':undefined,
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', overflow:'hidden',
                    }}>
                      {!note.hit && note.heightPct >= 6 && (
                        <NoteIcon dur={note.dur} color={iconColor} size={Math.min(note.heightPct * 1.8, 14)}/>
                      )}
                    </div>
                  );
                })}

                {/* Hit zone glow bar */}
                <div className="hz-bar" style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:'linear-gradient(90deg,transparent,#f0a830 20%,#f0a830 80%,transparent)', zIndex:10 }}/>
                <div style={{ position:'absolute', bottom:0, left:0, right:0, height:40, background:'linear-gradient(to top,rgba(240,168,48,.07),transparent)', zIndex:9, pointerEvents:'none' }}/>

                {/* Score + combo overlay */}
                {trainingState==='playing' && <>
                  <div style={{ position:'absolute', top:10, left:12, zIndex:15, fontFamily:'monospace', fontSize:18, fontWeight:700, color:'#f0a830', textShadow:'0 0 12px rgba(240,168,48,.6)' }}>{trainingScore.toLocaleString()}</div>
                  {trainingCombo>=5 && <div style={{ position:'absolute', top:10, right:12, zIndex:15, fontSize:13, fontWeight:700, color:trainingCombo>=20?'#9bd17e':'#f0a830', textShadow:'0 0 10px currentColor' }}><Zap size={12} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }}/>×{trainingCombo} combo</div>}
                </>}

                {/* Hit feedback */}
                {hitFeedback && (
                  <div className="feedback-pop" style={{ fontSize:24, fontWeight:800, letterSpacing:'.06em', color:hitFeedback.type==='perfect'?'#9bd17e':hitFeedback.type==='good'?'#f0d060':'#e07c5e', textShadow:`0 0 20px currentColor` }}>
                    {hitFeedback.type==='perfect'?'✦ PERFEITO!':hitFeedback.type==='good'?'● BOM!':'✕ ERRO'}
                  </div>
                )}

                {/* Countdown */}
                {trainingState==='countdown' && countdownNum!=null && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.65)', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div key={countdownNum} className="cd-num display-font" style={{ fontSize:100, color:'#f0a830', fontWeight:700, textShadow:'0 0 40px rgba(240,168,48,.9)' }}>{countdownNum}</div>
                  </div>
                )}
              </div>
            )}

            {/* PIANO KEYBOARD */}
            <div className="relative w-full select-none" style={{ height:220 }}>
              <div className="absolute inset-0 flex gap-[2px]">
                {WHITE_KEYS.map(note => {
                  const isActive   = activeNotes.has(note.name);
                  const isExpected = sheetMode ? (sheetExpectedNote===note.name) : (expectedNote===note.name);
                  const remotePressing = remoteNoteDisplay.get(note.name) || [];
                  const pressColor = (isActive && mpInRoom) ? mpMeRef.current.color : (remotePressing.length > 0 ? remotePressing[0].color : null);
                  const pressGrad  = pressColor ? `linear-gradient(180deg,${lightenColor(pressColor)},${pressColor})` : null;
                  const isPressed  = isActive || remotePressing.length > 0;
                  return (
                    <button key={note.name} onPointerDown={handlePianoPointerDown(note.name)} onPointerUp={handlePianoPointerEnd} onPointerCancel={handlePianoPointerEnd} onPointerLeave={handlePianoPointerEnd}
                      className={`flex-1 relative rounded-b-md key-press-anim flex flex-col items-center justify-end pb-3 ${isExpected?'lesson-glow':''}`}
                      style={{ overflow:'visible', background:pressGrad??(isActive?'linear-gradient(180deg,#ffd991,#f0a830)':isExpected?'linear-gradient(180deg,#fff7e0,#f5d98a)':'linear-gradient(180deg,#f8f2e6,#e8ddc8)'), boxShadow:pressColor?`inset 0 4px 8px rgba(0,0,0,.15),0 0 14px ${pressColor}66`:(isPressed?'inset 0 4px 8px rgba(0,0,0,.15),0 1px 0 rgba(255,255,255,.5)':'0 2px 0 rgba(0,0,0,.4),inset 0 -2px 8px rgba(0,0,0,.08)'), transform:isActive?'translateY(2px)':'translateY(0)', cursor:'pointer', border:'none', touchAction:'none' }}>
                      {/* Free mode: floating label */}
                      {freeMode && freeFloats.filter(f => f.noteName===note.name).map(f => (
                        <span key={f.id} className="free-float" style={{ fontSize:13, color:pressColor||'#f0a830', textShadow:`0 0 10px currentColor` }}>
                          {labelLang==='pt'?note.pt:note.en}
                        </span>
                      ))}
                      {/* Free mode: click count */}
                      {freeMode && (keyClickCounts.get(note.name)||0)>0 && (
                        <div style={{ position:'absolute', top:6, right:3, background:'rgba(0,0,0,.6)', color:'#f0a830', borderRadius:8, fontSize:9, padding:'1px 4px', fontWeight:700, zIndex:10, lineHeight:1.4, pointerEvents:'none' }}>
                          {keyClickCounts.get(note.name)}
                        </div>
                      )}
                      {showLabels && <span className="display-font text-xs md:text-sm font-medium pointer-events-none" style={{ color:pressColor?'#fff':(isActive||isExpected?'#5a3a0a':'#7a6850') }}>{labelLang==='pt'?note.pt:note.en}</span>}
                      {showKeyboardHints && <span className="text-[9px] mt-1 px-1.5 py-0.5 rounded font-mono pointer-events-none" style={{ background:isPressed?'rgba(255,255,255,.5)':'rgba(0,0,0,.06)', color:isPressed?'#5a3a0a':'#9a8870' }}>{note.key.toUpperCase()}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="absolute inset-0 pointer-events-none">
                {BLACK_KEYS.map(note => {
                  const isActive   = activeNotes.has(note.name);
                  const isExpected = sheetMode ? (sheetExpectedNote===note.name) : (expectedNote===note.name);
                  const remotePressing = remoteNoteDisplay.get(note.name) || [];
                  const pressColor = (isActive && mpInRoom) ? mpMeRef.current.color : (remotePressing.length > 0 ? remotePressing[0].color : null);
                  const pressGrad  = pressColor ? `linear-gradient(180deg,${lightenColor(pressColor)},${pressColor})` : null;
                  const isPressed  = isActive || remotePressing.length > 0;
                  return (
                    <button key={note.name} onPointerDown={handlePianoPointerDown(note.name)} onPointerUp={handlePianoPointerEnd} onPointerCancel={handlePianoPointerEnd} onPointerLeave={handlePianoPointerEnd}
                      className={`absolute rounded-b-md key-press-anim flex flex-col items-center justify-end pb-2 pointer-events-auto ${isExpected?'lesson-glow':''}`}
                      style={{ left:`${BLACK_KEY_LEFTS.get(note.name)}%`, width:`${WHITE_KEY_WIDTH*.6}%`, height:'62%', top:0, overflow:'visible', background:pressGrad??(isActive?'linear-gradient(180deg,#f0a830,#c97e1a)':isExpected?'linear-gradient(180deg,#d4a04a,#8a5a14)':'linear-gradient(180deg,#2a201a,#14100c)'), boxShadow:pressColor?`inset 0 4px 8px rgba(0,0,0,.3),0 0 14px ${pressColor}88`:(isPressed?'inset 0 4px 8px rgba(0,0,0,.3)':'0 3px 0 rgba(0,0,0,.7),inset 0 -3px 4px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1)'), transform:isActive?'translateY(2px)':'translateY(0)', cursor:'pointer', border:'none', zIndex:2, touchAction:'none' }}>
                      {/* Free mode: floating label */}
                      {freeMode && freeFloats.filter(f => f.noteName===note.name).map(f => (
                        <span key={f.id} className="free-float" style={{ fontSize:11, color:pressColor||'#f0a830', textShadow:`0 0 10px currentColor` }}>
                          {labelLang==='pt'?note.pt:note.en}
                        </span>
                      ))}
                      {/* Free mode: click count */}
                      {freeMode && (keyClickCounts.get(note.name)||0)>0 && (
                        <div style={{ position:'absolute', top:4, right:2, background:'rgba(0,0,0,.75)', color:'#f0a830', borderRadius:6, fontSize:8, padding:'0 3px', fontWeight:700, zIndex:10, lineHeight:1.5, pointerEvents:'none' }}>
                          {keyClickCounts.get(note.name)}
                        </div>
                      )}
                      {showLabels && <span className="display-font text-[10px] font-medium pointer-events-none" style={{ color:pressColor?'#fff':(isPressed?'#1a1108':'#a89a87') }}>{labelLang==='pt'?note.pt:note.en}</span>}
                      {showKeyboardHints && <span className="text-[8px] mt-0.5 px-1 py-0 rounded font-mono pointer-events-none" style={{ background:'rgba(255,255,255,.1)', color:isPressed?'#1a1108':'#c9b89a' }}>{note.key.toUpperCase()}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CONTROLS */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3 px-4 py-2 rounded-full" style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)' }}>
                <Volume2 size={16} style={{ color:'#a89a87' }}/>
                <input type="range" min="0" max="100" value={volume*100} onChange={e => setVolume(e.target.value/100)} className="w-24" style={{ accentColor:'#f0a830' }}/>
                <span className="text-xs font-mono w-8" style={{ color:'#8a7d6c' }}>{Math.round(volume*100)}</span>
              </div>
              {/* Instrument selector */}
              <div className="flex items-center gap-1 px-2 py-1 rounded-full overflow-x-auto" style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', scrollbarWidth:'none', flexShrink:0 }}>
                {INSTRUMENTS.map(inst => (
                  <button key={inst.id} onClick={async () => { await ensureAudio(); setInstrumentId(inst.id); }}
                    className="px-2 py-0.5 rounded-full text-xs whitespace-nowrap transition-colors"
                    style={{ background:instrumentId===inst.id?'rgba(240,168,48,.2)':'transparent', color:instrumentId===inst.id?'#f0a830':'#8a7d6c', fontWeight:instrumentId===inst.id?600:400, border:'none', cursor:'pointer' }}>
                    {inst.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowLabels(!showLabels)} className="px-3 py-2 rounded-full text-xs flex items-center gap-2 transition-colors" style={{ background:showLabels?'rgba(240,168,48,.15)':'rgba(255,255,255,.03)', border:`1px solid ${showLabels?'rgba(240,168,48,.3)':'rgba(255,255,255,.06)'}`, color:showLabels?'#f0a830':'#a89a87' }}>
                <Music size={12}/> Notas
              </button>
              <button onClick={() => setShowKeyboardHints(!showKeyboardHints)} className="px-3 py-2 rounded-full text-xs flex items-center gap-2 transition-colors" style={{ background:showKeyboardHints?'rgba(240,168,48,.15)':'rgba(255,255,255,.03)', border:`1px solid ${showKeyboardHints?'rgba(240,168,48,.3)':'rgba(255,255,255,.06)'}`, color:showKeyboardHints?'#f0a830':'#a89a87' }}>
                <Keyboard size={12}/> Teclas PC
              </button>
              <button onClick={() => setLabelLang(labelLang==='pt'?'en':'pt')} className="px-3 py-2 rounded-full text-xs transition-colors" style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', color:'#a89a87' }}>
                {labelLang==='pt'?'Dó Ré Mi':'C D E'}
              </button>
              <button onClick={() => { setFreeMode(true); }} className="px-3 py-2 rounded-full text-xs flex items-center gap-2 transition-colors" style={{ background:'rgba(155,209,126,.15)', border:'1px solid rgba(155,209,126,.3)', color:'#9bd17e' }}>
                <Sparkles size={12}/> Modo Livre
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color:'#8a7d6c' }}>
              <span className="hidden md:inline">Entrada:</span>
              <span className="flex items-center gap-1.5"><Usb size={12}/> MIDI</span>
              <span className="opacity-30">·</span>
              <span className="flex items-center gap-1.5"><Keyboard size={12}/> Teclado</span>
              <span className="opacity-30">·</span>
              <span>👆 Toque</span>
            </div>
          </div>
        </section>

        {/* MIDI notice */}
        {(midiStatus==='no-devices'||midiStatus==='denied'||midiStatus==='unsupported') && (
          <section className="max-w-6xl mx-auto mt-8 fade-in">
            <div className="rounded-2xl p-5 flex items-start gap-3" style={{ background:'rgba(224,124,94,.06)', border:'1px solid rgba(224,124,94,.2)' }}>
              <AlertCircle size={18} style={{ color:'#e8a06a', flexShrink:0, marginTop:2 }}/>
              <div className="text-sm" style={{ color:'#d4b89a' }}>
                {midiStatus==='no-devices' && <><strong style={{ color:'#f5efe6' }}>Nenhum teclado MIDI detectado.</strong> Conecte via USB; o navegador detecta automaticamente.</>}
                {midiStatus==='denied'     && <><strong style={{ color:'#f5efe6' }}>Permissão MIDI negada.</strong> Recarregue e permita o acesso.</>}
                {midiStatus==='unsupported'&& <><strong style={{ color:'#f5efe6' }}>MIDI indisponível neste navegador.</strong> Use Chrome, Edge ou Opera. O teclado do computador e o clique nas teclas funcionam normalmente.</>}
              </div>
            </div>
          </section>
        )}

        {/* HOW IT WORKS */}
        <section className="max-w-6xl mx-auto mt-12 grid md:grid-cols-5 gap-4">
          {[
            { icon:Usb,      title:'Teclado MIDI',  desc:'Conecte qualquer teclado MIDI USB. Detectado automaticamente pelo navegador.' },
            { icon:Keyboard, title:'Teclado do PC',  desc:'Z X C V B N M (graves) e Q W E R T Y U I (agudas). Pretas: S D G H J / 2 3 5 6 7.' },
            { icon:BookOpen, title:'Modo Aprender',  desc:'A próxima nota brilha em âmbar até você acertar. Progressão sem pressão de tempo.' },
            { icon:Target,   title:'Modo Treino',    desc:'Notas caem como Guitar Hero. Pressione na hora certa — o som vem só do SEU toque.' },
            { icon:Music,    title:'Modo Partitura', desc:'Pauta musical rola em tempo real. Toque cada nota quando cruzar a linha dourada — valida nota e ritmo.' },
          ].map((item,i) => (
            <div key={i} className="rounded-2xl p-5 fade-in" style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.05)', animationDelay:`${.1*(i+1)}s` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background:'rgba(240,168,48,.12)', border:'1px solid rgba(240,168,48,.2)' }}>
                <item.icon size={18} style={{ color:'#f0a830' }}/>
              </div>
              <div className="display-font text-lg mb-1" style={{ color:'#f5efe6' }}>{item.title}</div>
              <div className="text-sm leading-relaxed" style={{ color:'#a89a87' }}>{item.desc}</div>
            </div>
          ))}
        </section>
      </main>

      {/* SONG LIST MODAL */}
      {showSongList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,.7)', backdropFilter:'blur(12px)' }} onClick={() => setShowSongList(false)}>
          <div className="w-full max-w-2xl rounded-2xl p-6 fade-in max-h-[85vh] overflow-y-auto" style={{ background:'linear-gradient(180deg,#1a1410,#0f0c08)', border:'1px solid rgba(255,255,255,.1)', boxShadow:'0 40px 100px -20px rgba(0,0,0,.8)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-xs tracking-[.2em] uppercase mb-1" style={{ color:'#c97e1a' }}>Repertório</div>
                <h3 className="display-font text-2xl" style={{ color:'#f5efe6' }}>Escolha uma música</h3>
              </div>
              <button onClick={() => setShowSongList(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', color:'#a89a87' }}><X size={16}/></button>
            </div>
            <div className="space-y-2">
              {/* Músicas criadas pelo usuário */}
              {customSongs.length > 0 && (
                <>
                  <div className="text-xs uppercase tracking-[.18em] px-1 pb-1 pt-2 flex items-center justify-between" style={{ color:'#9bd17e' }}>
                    <span>✏️ Suas criações ({customSongs.length})</span>
                    <button onClick={() => { if (window.confirm('Remover todas as músicas criadas?')) { setCustomSongs([]); try { localStorage.removeItem('allegretto-custom-songs'); } catch(e2) {} } }} style={{ color:'rgba(224,124,94,.6)', fontSize:10, background:'none', border:'none', cursor:'pointer' }}>Remover todas</button>
                  </div>
                  {customSongs.map(song => {
                    const beats = song.notes.reduce((s,n)=>s+(Array.isArray(n)?n[1]:1),0);
                    const secs  = Math.round(beats / (song.bpm / 60));
                    return (
                      <button key={song.id} onClick={() => selectSong(song)} className="w-full p-4 rounded-xl text-left transition-all hover:scale-[1.01] flex items-center justify-between group" style={{ background:currentSong?.id===song.id?'rgba(155,209,126,.1)':'rgba(155,209,126,.03)', border:`1px solid ${currentSong?.id===song.id?'rgba(155,209,126,.35)':'rgba(155,209,126,.12)'}` }}>
                        <div>
                          <div className="display-font text-lg" style={{ color:'#f5efe6' }}>{song.title}</div>
                          <div className="text-xs mt-0.5" style={{ color:'#8a7d6c' }}>{song.artist} · {song.notes.length} notas · ~{secs}s</div>
                        </div>
                        <div className="flex items-center gap-3">
                          {song.timeSignature && <span className="display-font" style={{ fontSize:11, color:'#9bd17e', background:'rgba(155,209,126,.1)', border:'1px solid rgba(155,209,126,.2)', borderRadius:4, padding:'1px 6px' }}>{song.timeSignature}</span>}
                          <span style={{ fontSize:10, color:'#9bd17e', opacity:.7 }}>✏️</span>
                          <ChevronRight size={16} style={{ color:'#8a7d6c' }} className="group-hover:translate-x-1 transition-transform"/>
                        </div>
                      </button>
                    );
                  })}
                  <div className="border-b my-2" style={{ borderColor:'rgba(255,255,255,.06)' }}/>
                </>
              )}
              {/* Repertório padrão */}
              {SONGS.map(song => {
                const beats = songBeats(song);
                const secs  = Math.round(beats / (song.bpm / 60));
                return (
                  <button key={song.id} onClick={() => selectSong(song)} className="w-full p-4 rounded-xl text-left transition-all hover:scale-[1.01] flex items-center justify-between group" style={{ background:currentSong?.id===song.id?'rgba(240,168,48,.1)':'rgba(255,255,255,.03)', border:`1px solid ${currentSong?.id===song.id?'rgba(240,168,48,.3)':'rgba(255,255,255,.06)'}` }}>
                    <div>
                      <div className="display-font text-lg" style={{ color:'#f5efe6' }}>{song.title}</div>
                      <div className="text-xs mt-0.5" style={{ color:'#8a7d6c' }}>{song.artist} · {song.notes.length} notas · ~{secs}s</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {song.timeSignature && (
                        <span className="display-font" style={{ fontSize:11, color:'#f0a830', background:'rgba(240,168,48,.1)', border:'1px solid rgba(240,168,48,.2)', borderRadius:4, padding:'1px 6px', letterSpacing:0 }}>{song.timeSignature}</span>
                      )}
                      <div className="flex gap-0.5">{[1,2,3].map(l => <div key={l} className="w-1.5 h-1.5 rounded-full" style={{ background:l<=song.difficulty?'#f0a830':'rgba(255,255,255,.1)' }}/>)}</div>
                      <ChevronRight size={16} style={{ color:'#8a7d6c' }} className="group-hover:translate-x-1 transition-transform"/>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <footer className="px-6 md:px-10 py-6 text-center text-xs" style={{ color:'#6b6052', borderTop:'1px solid rgba(255,255,255,.04)' }}>
        Allegretto · Piano virtual com Web MIDI API · {SONGS.length} músicas · Aprender · Treino · Partitura · Multiplayer
      </footer>

      {/* ── MODO LIVRE — tela dedicada ── */}
      {freeMode && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background:'#06060e' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom:'1px solid rgba(255,255,255,.06)' }}>
            <div className="flex items-center gap-3">
              <button onClick={() => {
                if (composerMode) { stopComposer(); setComposerSaved(false); setComposerMode(false); mpBroadStateRef.current?.({ type: 'composer_exit' }); }
                else { setFreeMode(false); if(risingRafRef.current){clearTimeout(risingRafRef.current);risingRafRef.current=null;} risingBarsRef.current=[]; setRisingBars([]); setKeyClickCounts(new Map()); }
              }} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:scale-105" style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'#a89a87' }}>
                <X size={14}/>
              </button>
              <span className="display-font text-xl" style={{ color:'#f5efe6' }}>
                {composerSaved ? '🎼 Partitura' : composerMode ? 'Criar Partitura' : 'Modo Livre'}
              </span>
              {!composerMode && mpInRoom && (
                <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5" style={{ background:'rgba(155,209,126,.12)', color:'#9bd17e', border:'1px solid rgba(155,209,126,.25)' }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block animate-ping" style={{background:'#9bd17e'}}/>
                  {mpCode} · {mpMembers.length} músicos
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {composerMode && !composerSaved ? (
                <>
                  {/* BPM */}
                  <div className="flex items-center gap-1.5" style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, padding:'4px 8px' }}>
                    <span style={{ color:'#6b6052', fontSize:10 }}>BPM</span>
                    <input type="number" min={40} max={240} value={composerBpm} onChange={e => { const b=Math.max(40,Math.min(240,Number(e.target.value))); setComposerBpm(b); mpBroadStateRef.current?.({ type:'composer_bpm', bpm:b }); }}
                      style={{ width:40, background:'transparent', border:'none', outline:'none', color:'#f0a830', fontSize:13, fontWeight:700, textAlign:'center' }}/>
                  </div>
                  {/* Time signature */}
                  <select value={composerTimeSig} onChange={e => { setComposerTimeSig(e.target.value); mpBroadStateRef.current?.({ type:'composer_timesig', sig:e.target.value }); }}
                    style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, padding:'4px 8px', color:'#f0a830', fontSize:12, fontWeight:700, outline:'none' }}>
                    {['4/4','3/4','2/4','6/8','3/8'].map(ts => <option key={ts} value={ts} style={{background:'#1a1410'}}>{ts}</option>)}
                  </select>
                  {/* Play / Stop */}
                  <button onClick={() => composerPlaying ? stopComposer() : playComposer(composerNotes, composerBpm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors"
                    style={{ background:composerPlaying?'rgba(224,124,94,.15)':'linear-gradient(135deg,#f0a830,#c97e1a)', border:composerPlaying?'1px solid rgba(224,124,94,.35)':'none', color:composerPlaying?'#e07c5e':'#1a1108', fontWeight:600 }}>
                    {composerPlaying ? <><Square size={11}/> Parar</> : <><Play size={11}/> Ouvir</>}
                  </button>
                  {/* Clear */}
                  <button onClick={() => { stopComposer(); setComposerNotes([]); mpBroadStateRef.current?.({ type:'composer_clear' }); }} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors" style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', color:'#6b6052' }}>
                    <Trash2 size={11}/> Limpar
                  </button>
                  {/* Salvar partitura → abre dialog */}
                  {composerNotes.length > 0 && (
                    <button onClick={() => { stopComposer(); setSaveSongName(''); setShowSaveDialog(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors"
                      style={{ background:'rgba(155,209,126,.18)', border:'1px solid rgba(155,209,126,.4)', color:'#9bd17e', fontWeight:600 }}>
                      <Check size={11}/> Salvar
                    </button>
                  )}
                </>
              ) : composerSaved ? (
                <>
                  {/* Ouvir partitura salva */}
                  <button onClick={() => composerPlaying ? stopComposer() : playComposer(composerNotes, composerBpm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors"
                    style={{ background:composerPlaying?'rgba(224,124,94,.15)':'linear-gradient(135deg,#f0a830,#c97e1a)', border:composerPlaying?'1px solid rgba(224,124,94,.35)':'none', color:composerPlaying?'#e07c5e':'#1a1108', fontWeight:600 }}>
                    {composerPlaying ? <><Square size={11}/> Parar</> : <><Play size={11}/> Ouvir</>}
                  </button>
                  {/* Acompanhar — notas caindo */}
                  <button
                    onClick={() => followState !== 'idle' ? stopFollow() : startFollow(composerNotes, composerBpm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors"
                    style={{ background:followState!=='idle'?'rgba(224,124,94,.15)':'rgba(155,209,126,.18)', border:followState!=='idle'?'1px solid rgba(224,124,94,.35)':'1px solid rgba(155,209,126,.4)', color:followState!=='idle'?'#e07c5e':'#9bd17e', fontWeight:600 }}>
                    {followState !== 'idle' ? <><X size={11}/> Parar</> : <><Target size={11}/> Acompanhar</>}
                  </button>
                  {/* Editar */}
                  <button onClick={() => { stopComposer(); stopFollow(); setComposerSaved(false); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors"
                    style={{ background:'rgba(240,168,48,.08)', border:'1px solid rgba(240,168,48,.2)', color:'#f0a830' }}>
                    <PenLine size={11}/> Editar
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setComposerMode(true); mpBroadStateRef.current?.({ type: 'composer_enter' }); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors" style={{ background:'rgba(240,168,48,.08)', border:'1px solid rgba(240,168,48,.2)', color:'#f0a830' }}>
                    <PenLine size={11}/> Criar Partitura
                  </button>
                  <button onClick={() => setMpOpen(true)} className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors" style={{ background:mpInRoom?'rgba(155,209,126,.1)':'rgba(255,255,255,.05)', border:`1px solid ${mpInRoom?'rgba(155,209,126,.25)':'rgba(255,255,255,.08)'}`, color:mpInRoom?'#9bd17e':'#8a7d6c' }}>
                    <Radio size={11}/>{mpInRoom ? mpCode : 'Ao Vivo'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── PARTITURA: altura fixa no topo, só quando composerMode ── */}
          {composerMode && (() => {
            const [sigNum, sigDen] = composerTimeSig.split('/').map(Number);
            const beatsPerMeasure = sigNum * (4 / sigDen);
            const PX = 68;
            const LEFT = 84;
            const SL = STAFF_LINE_SPACING;
            const ST = STAFF_TOP;
            const lineYs = [ST, ST+SL, ST+SL*2, ST+SL*3, ST+SL*4];
            const ledgerBelow  = ST + SL*5;
            const ledger1Above = ST - SL;
            const ledger2Above = ST - SL*2;
            const totalBeats = composerNotes.reduce((s, n) => s + n.dur, 0);
            const noteEls = [];
            let cum = 0;
            let gapAcc = 0;
            const BARLINE_PAD = 20;
            composerNotes.forEach((note, i) => {
              const nx  = LEFT + cum * PX + gapAcc;
              const isPlay = composerPlayIdx === i;
              const isRest = note.name === 'rest';
              const clr = isPlay ? '#f0a830' : '#e8dfd0';
              const dur = note.dur;
              if (!isRest) {
                const step   = NOTE_STAFF_STEPS[note.name] ?? 6;
                const ny     = ST + (10 - step) * (SL / 2);
                const stemDn = step > 6;
                const isWhole   = dur >= 3.6;
                const isHalf    = !isWhole && dur >= 1.8;
                const is16th    = !isWhole && !isHalf && dur < 0.4;
                const isEighth  = !isWhole && !isHalf && !is16th && dur < 0.85;
                const hasSharp  = note.name.includes('#');
                const stemX  = stemDn ? nx - 5.5 : nx + 5.5;
                const stemY2 = stemDn ? ny + 30  : ny - 30;
                noteEls.push(
                  <g key={note.id} onClick={() => { if (!composerPlaying && !composerSaved) deleteComposerNote(note.id); }} style={{ cursor:(composerPlaying||composerSaved)?'default':'pointer' }}>
                    <rect x={nx-14} y={Math.min(ny,stemY2)-4} width={28} height={Math.abs(stemY2-ny)+30} fill="transparent"/>
                    {isPlay && <circle cx={nx} cy={ny} r={14} fill="#f0a830" opacity="0.18"/>}
                    {step <= 0  && <line x1={nx-10} y1={ledgerBelow}  x2={nx+10} y2={ledgerBelow}  stroke={clr} strokeWidth="1.5"/>}
                    {step >= 12 && <line x1={nx-10} y1={ledger1Above} x2={nx+10} y2={ledger1Above} stroke={clr} strokeWidth="1.5"/>}
                    {step >= 14 && <line x1={nx-10} y1={ledger2Above} x2={nx+10} y2={ledger2Above} stroke={clr} strokeWidth="1.5"/>}
                    {hasSharp && <text x={nx-17} y={ny+5} fill={clr} fontSize="12" fontFamily="serif" style={{pointerEvents:'none'}}>♯</text>}
                    {isWhole
                      ? <ellipse cx={nx} cy={ny} rx={7.5} ry={5.5} stroke={clr} strokeWidth="2"   fill="none"/>
                      : isHalf
                      ? <ellipse cx={nx} cy={ny} rx={6.5} ry={5}   stroke={clr} strokeWidth="1.8" fill="none"/>
                      : <ellipse cx={nx} cy={ny} rx={6.5} ry={5}   fill={clr}/>
                    }
                    {!composerPlaying && !composerSaved && !isPlay && <text x={nx+9} y={ny-9} fill="rgba(224,124,94,0.6)" fontSize="9" fontWeight="bold" style={{pointerEvents:'none'}}>×</text>}
                    {!isWhole && <line x1={stemX} y1={ny} x2={stemX} y2={stemY2} stroke={clr} strokeWidth="1.5"/>}
                    {isEighth && (stemDn
                      ? <path d={`M${stemX},${stemY2} C${stemX+14},${stemY2-8} ${stemX+15},${stemY2-16} ${stemX+2},${stemY2-22}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                      : <path d={`M${stemX},${stemY2} C${stemX+14},${stemY2+8} ${stemX+15},${stemY2+16} ${stemX+2},${stemY2+22}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                    )}
                    {is16th && (stemDn ? <>
                      <path d={`M${stemX},${stemY2}   C${stemX+14},${stemY2-8}  ${stemX+15},${stemY2-16} ${stemX+2},${stemY2-22}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                      <path d={`M${stemX},${stemY2-7} C${stemX+14},${stemY2-15} ${stemX+15},${stemY2-23} ${stemX+2},${stemY2-29}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                    </> : <>
                      <path d={`M${stemX},${stemY2}   C${stemX+14},${stemY2+8}  ${stemX+15},${stemY2+16} ${stemX+2},${stemY2+22}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                      <path d={`M${stemX},${stemY2+7} C${stemX+14},${stemY2+15} ${stemX+15},${stemY2+23} ${stemX+2},${stemY2+29}`} stroke={clr} strokeWidth="1.5" fill="none"/>
                    </>)}
                  </g>
                );
              } else {
                const rc = isPlay ? '#f0a830' : '#a89a87';
                const ry = ST + SL*2;
                noteEls.push(
                  <g key={note.id} onClick={() => { if (!composerPlaying && !composerSaved) deleteComposerNote(note.id); }} style={{ cursor:(composerPlaying||composerSaved)?'default':'pointer' }}>
                    <rect x={nx-12} y={ry-10} width={24} height={28} fill="transparent"/>
                    {dur >= 3.6 && <rect x={nx-7} y={ST+SL} width={14} height={5} fill={rc}/>}
                    {dur >= 1.8 && dur < 3.6 && <rect x={nx-7} y={ST+SL*2-5} width={14} height={5} fill={rc}/>}
                    {dur >= 0.85 && dur < 1.8 && <text x={nx-5} y={ST+SL*2+10} fill={rc} fontSize="20" fontFamily="serif" style={{pointerEvents:'none'}}>𝄽</text>}
                    {dur >= 0.4  && dur < 0.85 && <text x={nx-4} y={ST+SL*2+8}  fill={rc} fontSize="16" fontFamily="serif" style={{pointerEvents:'none'}}>𝄾</text>}
                    {dur <  0.4  && <text x={nx-4} y={ST+SL*2+10} fill={rc} fontSize="18" fontFamily="serif" style={{pointerEvents:'none'}}>𝄿</text>}
                    {!composerPlaying && !composerSaved && !isPlay && <text x={nx+11} y={ry-1} fill="rgba(224,124,94,0.6)" fontSize="9" fontWeight="bold" style={{pointerEvents:'none'}}>×</text>}
                  </g>
                );
              }
              cum += dur;
              if (Math.abs(cum % beatsPerMeasure) < 0.01 && i < composerNotes.length - 1) {
                const bx = LEFT + cum * PX + gapAcc + 8;
                noteEls.push(<line key={`bl-${i}`} x1={bx} y1={ST-4} x2={bx} y2={ST+SL*4+4} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>);
                gapAcc += BARLINE_PAD;
              }
            });
            const svgW = Math.max(560, LEFT + totalBeats * PX + gapAcc + 80);

            return (
              <div className="flex-shrink-0" style={{ background:'#0d0a07', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
                {/* SVG rolável horizontalmente com altura fixa */}
                <div ref={composerRailRef} style={{ overflowX:'auto', height: STAFF_SVG_H + 16, scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,.1) transparent' }}>
                  {composerNotes.length === 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100%', height: STAFF_SVG_H + 16, color:'#3a2e22', userSelect:'none' }}>
                      <Music size={36} style={{ opacity:.25, marginBottom:8 }}/>
                      <p style={{ fontSize:13 }}>Toque as teclas para adicionar notas</p>
                    </div>
                  ) : (
                    <svg width={svgW} height={STAFF_SVG_H+8} style={{ display:'block' }}>
                      {lineYs.map((y, idx) => (
                        <line key={idx} x1={42} y1={y} x2={svgW-14} y2={y} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                      ))}
                      <line x1={svgW-14} y1={ST} x2={svgW-14} y2={ST+SL*4} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
                      <line x1={svgW-11} y1={ST} x2={svgW-11} y2={ST+SL*4} stroke="rgba(255,255,255,0.5)"  strokeWidth="3"/>
                      <text x="2" y={ST+SL*4+6} fill="rgba(240,168,48,0.8)" fontSize={SL*5.8} fontFamily="serif" style={{ userSelect:'none', pointerEvents:'none' }}>𝄞</text>
                      <text x="49" y={ST+SL*1.5+6} fill="rgba(240,168,48,0.65)" fontSize={SL*2} fontFamily="serif" fontWeight="bold" textAnchor="middle" style={{ userSelect:'none', pointerEvents:'none' }}>{sigNum}</text>
                      <text x="49" y={ST+SL*3.5+6} fill="rgba(240,168,48,0.65)" fontSize={SL*2} fontFamily="serif" fontWeight="bold" textAnchor="middle" style={{ userSelect:'none', pointerEvents:'none' }}>{sigDen}</text>
                      {noteEls}
                    </svg>
                  )}
                </div>
                {/* Seletor de duração — só no modo de edição (não salvo) */}
                {!composerSaved && (
                  <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto" style={{ borderTop:'1px solid rgba(255,255,255,.06)', scrollbarWidth:'none' }}>
                    <span style={{ fontSize:10, color:'#6b6052', flexShrink:0 }}>Duração:</span>
                    {[{d:4,l:'Semibreve'},{d:2,l:'Mínima'},{d:1,l:'Semínima'},{d:0.5,l:'Colcheia'},{d:0.25,l:'Semicolcheia'}].map(({d,l}) => (
                      <button key={d} onClick={() => setComposerSelDur(d)}
                        style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:7, fontSize:11, cursor:'pointer',
                          background:composerSelDur===d?'rgba(240,168,48,.18)':'rgba(255,255,255,.04)',
                          border:`1px solid ${composerSelDur===d?'rgba(240,168,48,.45)':'rgba(255,255,255,.08)'}`,
                          color:composerSelDur===d?'#f0a830':'#8a7d6c' }}>
                        <NoteIcon dur={d} color={composerSelDur===d?'#f0a830':'#6b6052'} size={13}/>{l}
                      </button>
                    ))}
                    <button onClick={() => addComposerNote('rest', composerSelDur)}
                      style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:7, fontSize:11, cursor:'pointer',
                        background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', color:'#8a7d6c' }}>
                      𝄽 Pausa
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── CANVAS — barras livres OU notas caindo (follow mode) ── */}
          <div ref={risingCanvasRef} className="flex-1 relative overflow-hidden" style={{ background: followState !== 'idle' ? '#0a0706' : undefined }}>
            {followState !== 'idle' ? (
              <>
                {/* Fundo das colunas */}
                {WHITE_KEYS.map((note,i) => (
                  <div key={note.name} style={{ position:'absolute', top:0, bottom:0, left:`${(i/WHITE_KEY_COUNT)*100}%`, width:`${WHITE_KEY_WIDTH}%`, background:i%2===0?'rgba(255,255,255,.016)':'rgba(255,255,255,.008)', borderRight:'1px solid rgba(255,255,255,.04)' }}/>
                ))}
                {BLACK_KEYS.map(note => (
                  <div key={note.name} style={{ position:'absolute', top:0, bottom:0, left:`${BLACK_KEY_LEFTS.get(note.name)}%`, width:`${WHITE_KEY_WIDTH*0.6}%`, background:'rgba(0,0,0,.4)', zIndex:1 }}/>
                ))}

                {/* Blocos de notas caindo */}
                {followDispNotes.map(note => {
                  const hitClr = note.hit==='perfect'?'#9bd17e':note.hit==='good'?'#f0d060':note.hit==='miss'?'#e07c5e':null;
                  const base   = note.isBlack?'#c97e1a':'#f0a830';
                  const clr    = hitClr || base;
                  return (
                    <div key={note.id} style={{
                      position:'absolute',
                      left:note.left,
                      width:note.width,
                      bottom:`${100-note.y}%`,
                      height:`${note.heightPct}%`,
                      background:`linear-gradient(180deg,${clr}ee,${clr}88)`,
                      borderRadius:'4px 4px 3px 3px',
                      zIndex:note.isBlack?4:3,
                      boxShadow:hitClr?`0 0 14px 3px ${clr}80`:`0 2px 6px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.25)`,
                      opacity:note.hit?(note.hit==='miss'?0.2:0.35):1,
                      border:`1px solid ${clr}66`,
                      transition:note.hit?'opacity .25s':undefined,
                    }}/>
                  );
                })}

                {/* Barra de hit zone */}
                <div className="hz-bar" style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:'linear-gradient(90deg,transparent,#f0a830 20%,#f0a830 80%,transparent)', zIndex:10 }}/>
                <div style={{ position:'absolute', bottom:0, left:0, right:0, height:40, background:'linear-gradient(to top,rgba(240,168,48,.07),transparent)', zIndex:9, pointerEvents:'none' }}/>

                {/* Score + combo */}
                {followState === 'playing' && <>
                  <div style={{ position:'absolute', top:10, left:12, zIndex:15, fontFamily:'monospace', fontSize:18, fontWeight:700, color:'#f0a830', textShadow:'0 0 12px rgba(240,168,48,.6)' }}>{followScore.toLocaleString()}</div>
                  {followCombo>=5 && <div style={{ position:'absolute', top:10, right:12, zIndex:15, fontSize:13, fontWeight:700, color:followCombo>=20?'#9bd17e':'#f0a830', textShadow:'0 0 10px currentColor' }}><Zap size={12} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }}/>×{followCombo} combo</div>}
                </>}

                {/* Feedback de acerto */}
                {followFeedback && (
                  <div className="feedback-pop" style={{ fontSize:24, fontWeight:800, letterSpacing:'.06em', color:followFeedback.type==='perfect'?'#9bd17e':followFeedback.type==='good'?'#f0d060':'#e07c5e', textShadow:'0 0 20px currentColor' }}>
                    {followFeedback.type==='perfect'?'✦ PERFEITO!':followFeedback.type==='good'?'● BOM!':'✕ ERRO'}
                  </div>
                )}

                {/* Countdown */}
                {followState === 'countdown' && followCdown != null && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.65)', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div key={followCdown} className="cd-num display-font" style={{ fontSize:100, color:'#f0a830', fontWeight:700, textShadow:'0 0 40px rgba(240,168,48,.9)' }}>{followCdown}</div>
                  </div>
                )}

                {/* Resultado final */}
                {followState === 'complete' && (() => {
                  const tot = followHits.perfect + followHits.good + followHits.miss;
                  const acc = tot > 0 ? Math.round(((followHits.perfect + followHits.good) / tot) * 100) : 0;
                  return (
                    <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.78)', zIndex:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
                      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background:acc>=80?'linear-gradient(135deg,#9bd17e,#5a9d3e)':'linear-gradient(135deg,#f0a830,#c97e1a)', boxShadow:'0 8px 28px -6px rgba(155,209,126,.4)' }}>
                        {acc>=80 ? <Trophy size={28} style={{ color:'#0d2a07' }}/> : <Target size={28} style={{ color:'#1a1108' }}/>}
                      </div>
                      <div className="display-font text-2xl celebrate-anim" style={{ color:'#f5efe6' }}>{acc>=95?'Perfeito!':acc>=80?'Muito Bem!':acc>=60?'Bom!':'Continue Praticando!'}</div>
                      <div className="text-sm" style={{ color:'#8a7d6c' }}>Precisão: {acc}%</div>
                      <div className="flex gap-5">
                        {[['Pontos', followScoreRef.current.toLocaleString(), '#f0a830'],['Combo Máx', followMaxCombo, '#9bd17e'],['Perfeitos', followHits.perfect, '#9bd17e'],['Bons', followHits.good, '#f0d060'],['Erros', followHits.miss, '#e07c5e']].map(([label,val,clr]) => (
                          <div key={label} className="text-center"><div className="text-xl font-bold font-mono" style={{ color:clr }}>{val}</div><div className="text-[10px] uppercase tracking-wider" style={{ color:'#6b6052' }}>{label}</div></div>
                        ))}
                      </div>
                      <button onClick={() => startFollow(composerNotes, composerBpm)}
                        className="px-5 py-2 rounded-full text-sm flex items-center gap-2 hover:scale-105 transition-all"
                        style={{ background:'linear-gradient(135deg,#f0a830,#c97e1a)', color:'#1a1108', fontWeight:600 }}>
                        <RotateCcw size={14}/> Tentar de novo
                      </button>
                    </div>
                  );
                })()}
              </>
            ) : (
              /* Barras do modo livre */
              risingBars.map(bar => (
                <div key={bar.id} style={{
                  position:'absolute', bottom:0,
                  left:`${bar.left}%`, width:`${bar.width}%`,
                  height: Math.max(40, bar.height),
                  transform:`translateY(-${bar.floatY}px)`,
                  opacity: bar.opacity,
                  background: bar.color === '#ffffff'
                    ? 'linear-gradient(0deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.9) 40%,#ffffff 100%)'
                    : `linear-gradient(0deg,${bar.color}22 0%,${bar.color}bb 40%,${bar.color} 100%)`,
                  boxShadow: bar.color === '#ffffff'
                    ? '0 0 18px rgba(255,255,255,.5), 0 0 40px rgba(255,255,255,.15)'
                    : `0 0 18px ${bar.color}88, 0 0 40px ${bar.color}33`,
                  borderRadius:'3px 3px 0 0',
                }}/>
              ))
            )}
          </div>

          {/* Piano */}
          <div className="relative select-none w-full flex-shrink-0" style={{ height:200, background:'#0e0a06' }}>
            <div className="absolute inset-0 flex gap-[2px] px-[2px]">
              {WHITE_KEYS.map(note => {
                const isActive = activeNotes.has(note.name);
                const remotePressing = remoteNoteDisplay.get(note.name) || [];
                const pressColor = (isActive && mpInRoom) ? mpMeRef.current.color : (remotePressing.length > 0 ? remotePressing[0].color : null);
                const pressGrad = pressColor ? `linear-gradient(180deg,${lightenColor(pressColor)},${pressColor})` : null;
                const cnt = keyClickCounts.get(note.name) || 0;
                const isEditing = composerMode && !composerSaved;
                return (
                  <button key={note.name}
                    onPointerDown={isEditing
                      ? (e) => { e.preventDefault(); try{e.currentTarget.setPointerCapture(e.pointerId);}catch{} addComposerNote(note.name, composerSelDur); playNote(note.name); }
                      : handlePianoPointerDown(note.name)}
                    onPointerUp={isEditing ? () => releaseNote(note.name) : handlePianoPointerEnd}
                    onPointerCancel={isEditing ? () => releaseNote(note.name) : handlePianoPointerEnd}
                    onPointerLeave={isEditing ? undefined : handlePianoPointerEnd}
                    className="flex-1 relative rounded-b-md key-press-anim flex flex-col items-center justify-end pb-2"
                    style={{ overflow:'visible', background:pressGrad??(isActive?'linear-gradient(180deg,#ffd991,#f0a830)':'linear-gradient(180deg,#f0eade,#d8ceba)'), boxShadow:pressColor?`inset 0 4px 8px rgba(0,0,0,.15),0 0 16px ${pressColor}77`:(isActive?'inset 0 4px 8px rgba(0,0,0,.15)':'0 2px 0 rgba(0,0,0,.5),inset 0 -2px 6px rgba(0,0,0,.1)'), transform:isActive?'translateY(2px)':'translateY(0)', cursor:'pointer', border:'none', touchAction:'none' }}>
                    {!isEditing && cnt > 0 && <div style={{ position:'absolute', top:5, right:2, background:'rgba(0,0,0,.55)', color:pressColor||'#f0a830', borderRadius:7, fontSize:9, padding:'1px 4px', fontWeight:700, zIndex:10, lineHeight:1.4, pointerEvents:'none' }}>{cnt}</div>}
                    <span className="display-font text-xs font-medium pointer-events-none" style={{ color:pressColor?'#fff':(isActive?'#5a3a0a':'#7a6850') }}>{labelLang==='pt'?note.pt:note.en}</span>
                  </button>
                );
              })}
            </div>
            <div className="absolute inset-0 pointer-events-none">
              {BLACK_KEYS.map(note => {
                const isActive = activeNotes.has(note.name);
                const remotePressing = remoteNoteDisplay.get(note.name) || [];
                const pressColor = (isActive && mpInRoom) ? mpMeRef.current.color : (remotePressing.length > 0 ? remotePressing[0].color : null);
                const pressGrad = pressColor ? `linear-gradient(180deg,${lightenColor(pressColor)},${pressColor})` : null;
                const isEditing = composerMode && !composerSaved;
                return (
                  <button key={note.name}
                    onPointerDown={isEditing
                      ? (e) => { e.preventDefault(); try{e.currentTarget.setPointerCapture(e.pointerId);}catch{} addComposerNote(note.name, composerSelDur); playNote(note.name); }
                      : handlePianoPointerDown(note.name)}
                    onPointerUp={isEditing ? () => releaseNote(note.name) : handlePianoPointerEnd}
                    onPointerCancel={isEditing ? () => releaseNote(note.name) : handlePianoPointerEnd}
                    onPointerLeave={isEditing ? undefined : handlePianoPointerEnd}
                    className="absolute rounded-b-md key-press-anim flex flex-col items-center justify-end pb-1 pointer-events-auto"
                    style={{ left:`${BLACK_KEY_LEFTS.get(note.name)}%`, width:`${WHITE_KEY_WIDTH*.6}%`, height:'62%', top:0, overflow:'visible', background:pressGrad??(isActive?'linear-gradient(180deg,#f0a830,#c97e1a)':'linear-gradient(180deg,#1e1510,#0a0806)'), boxShadow:pressColor?`inset 0 4px 8px rgba(0,0,0,.3),0 0 16px ${pressColor}99`:(isActive?'inset 0 4px 8px rgba(0,0,0,.3)':'0 3px 0 rgba(0,0,0,.8),inset 0 -2px 4px rgba(0,0,0,.6)'), transform:isActive?'translateY(2px)':'translateY(0)', cursor:'pointer', border:'none', zIndex:2, touchAction:'none' }}>
                    <span className="display-font text-[9px] font-medium pointer-events-none" style={{ color:pressColor?'#fff':(isActive?'#1a1108':'#6a5a4a') }}>{labelLang==='pt'?note.pt:note.en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SALVAR PARTITURA ── */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,.75)', backdropFilter:'blur(12px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 fade-in" style={{ background:'linear-gradient(180deg,#1a1410,#0f0c08)', border:'1px solid rgba(255,255,255,.1)', boxShadow:'0 40px 100px -20px rgba(0,0,0,.9)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#9bd17e,#5a9d3e)' }}>
                <Music size={18} style={{ color:'#0d2a07' }}/>
              </div>
              <div>
                <div className="display-font text-xl" style={{ color:'#f5efe6' }}>Salvar Partitura</div>
                <div className="text-xs" style={{ color:'#8a7d6c' }}>Dê um nome para adicionar ao repertório</div>
              </div>
            </div>
            <input
              value={saveSongName}
              onChange={e => setSaveSongName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && saveSongName.trim()) {
                  const newSong = { id:`custom-${Date.now()}`, title:saveSongName.trim(), artist: mpInRoom ? (mpName||'Sala') : 'Modo Livre', difficulty:1, bpm:composerBpmRef.current, timeSignature:composerTimeSigRef.current, notes:composerNotesRef.current.map(n=>[n.name,n.dur]), isCustom:true };
                  const upd = [...customSongs, newSong];
                  setCustomSongs(upd); try { localStorage.setItem('allegretto-custom-songs', JSON.stringify(upd)); } catch(e2) {}
                  setComposerSaved(true); setShowSaveDialog(false); setSaveSongName('');
                  mpBroadStateRef.current?.({ type:'composer_saved', notes:composerNotesRef.current, bpm:composerBpmRef.current, timeSig:composerTimeSigRef.current });
                }
              }}
              placeholder="Ex: Minha Música"
              autoFocus
              maxLength={40}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3"
              style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', color:'#f5efe6' }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!saveSongName.trim()) return;
                  const newSong = { id:`custom-${Date.now()}`, title:saveSongName.trim(), artist: mpInRoom ? (mpName||'Sala') : 'Modo Livre', difficulty:1, bpm:composerBpmRef.current, timeSignature:composerTimeSigRef.current, notes:composerNotesRef.current.map(n=>[n.name,n.dur]), isCustom:true };
                  const upd = [...customSongs, newSong];
                  setCustomSongs(upd); try { localStorage.setItem('allegretto-custom-songs', JSON.stringify(upd)); } catch(e2) {}
                  setComposerSaved(true); setShowSaveDialog(false); setSaveSongName('');
                  mpBroadStateRef.current?.({ type:'composer_saved', notes:composerNotesRef.current, bpm:composerBpmRef.current, timeSig:composerTimeSigRef.current });
                }}
                disabled={!saveSongName.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-all hover:scale-[1.02] disabled:cursor-not-allowed"
                style={{ background:'linear-gradient(135deg,#9bd17e,#5a9d3e)', color:'#0d2a07' }}>
                <Check size={14}/> Salvar e Adicionar ao Menu
              </button>
            </div>
            <button
              onClick={() => {
                setComposerSaved(true); setShowSaveDialog(false); setSaveSongName('');
                mpBroadStateRef.current?.({ type:'composer_saved', notes:composerNotesRef.current, bpm:composerBpmRef.current, timeSig:composerTimeSigRef.current });
              }}
              className="w-full mt-2 py-2 rounded-xl text-sm text-center transition-colors hover:scale-[1.01]"
              style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', color:'#6b6052' }}>
              Apenas salvar (sem adicionar ao menu)
            </button>
          </div>
        </div>
      )}

      {/* ── MULTIPLAYER MODAL (lobby + room panel) ── */}
      {mpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,.75)', backdropFilter:'blur(16px)' }} onClick={() => { if (!mpLoading) setMpOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl p-6 fade-in" style={{ background:'linear-gradient(180deg,#1a1410,#0f0c08)', border:'1px solid rgba(255,255,255,.1)', boxShadow:'0 40px 100px -20px rgba(0,0,0,.9)' }} onClick={e => e.stopPropagation()}>
            {!mpInRoom ? (
              /* ── Lobby ── */
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#9bd17e,#5a9d3e)' }}>
                    <Radio size={18} style={{ color:'#0d2a07' }}/>
                  </div>
                  <div>
                    <div className="display-font text-xl" style={{ color:'#f5efe6' }}>Sala Ao Vivo</div>
                    <div className="text-xs" style={{ color:'#8a7d6c' }}>Crie ou entre em uma sala — sem conta</div>
                  </div>
                </div>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color:'#8a7d6c' }}>Seu nome</label>
                    <input value={mpName} onChange={e => setMpName(e.target.value)} onKeyDown={e => e.key==='Enter' && joinRoom()}
                      placeholder="Ex: João" maxLength={20} className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', color:'#f5efe6' }}/>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color:'#8a7d6c' }}>Sua cor</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {['#9bd17e','#7bb3f0','#e07c5e','#c77ee0','#60d4c8','#f09050','#f5e050'].map(c => {
                        const selected = (mpCustomColor||nameToColor(mpName||'_'))===c;
                        return <button key={c} onClick={() => setMpCustomColor(c)} className="w-7 h-7 rounded-full transition-all hover:scale-110" style={{ background:c, outline:selected?`2px solid #fff`:undefined, outlineOffset:2 }}/>;
                      })}
                      <label style={{ cursor:'pointer', position:'relative' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: mpCustomColor || nameToColor(mpName||'_'), border:'2px solid rgba(255,255,255,.2)' }}>🎨</div>
                        <input type="color" value={mpCustomColor||nameToColor(mpName||'_')} onChange={e => setMpCustomColor(e.target.value)} style={{ position:'absolute', opacity:0, width:0, height:0, pointerEvents:'none' }}/>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color:'#8a7d6c' }}>Código da sala</label>
                    <input value={mpCode} onChange={e => setMpCode(e.target.value.toUpperCase().replace(/\s/g,''))} onKeyDown={e => e.key==='Enter' && joinRoom()}
                      placeholder="Ex: JAZZ42" maxLength={16} className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono tracking-widest"
                      style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', color:'#f5efe6' }}/>
                  </div>
                </div>
                {mpStatus && <p className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ background:'rgba(224,124,94,.1)', color:'#e07c5e', border:'1px solid rgba(224,124,94,.2)' }}>{mpStatus}</p>}
                <div className="flex gap-3">
                  <button onClick={joinRoom} disabled={mpLoading} className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background:'linear-gradient(135deg,#9bd17e,#5a9d3e)', color:'#0d2a07' }}>
                    {mpLoading ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"/>Conectando...</> : <><Radio size={15}/>Entrar na Sala</>}
                  </button>
                  <button onClick={() => setMpOpen(false)} className="px-4 py-3 rounded-xl text-sm transition-colors hover:scale-[1.02]" style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', color:'#a89a87' }}>
                    <X size={15}/>
                  </button>
                </div>
                <p className="text-xs mt-4 text-center" style={{ color:'#6b6052' }}>
                  Primeiro a entrar com o código vira o host. Outros conectam automaticamente.<br/>
                  Cada um ouve os demais em tempo real via WebRTC peer-to-peer.
                </p>
              </>
            ) : (
              /* ── Room panel (when in room) ── */
              <>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#9bd17e,#5a9d3e)' }}>
                      <Users size={18} style={{ color:'#0d2a07' }}/>
                    </div>
                    <div>
                      <div className="display-font text-xl" style={{ color:'#f5efe6' }}>Sala {mpCode}</div>
                      <div className="text-xs" style={{ color:'#8a7d6c' }}>{mpIsHost ? '👑 Você é o host' : 'Conectado'} · {mpMembers.length} músico{mpMembers.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <button onClick={() => setMpOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', color:'#a89a87' }}><X size={14}/></button>
                </div>

                {/* Copy code */}
                <button onClick={() => { try { navigator.clipboard.writeText(mpCode); } catch(e) {} }} className="w-full mb-4 py-2 px-4 rounded-xl text-sm font-mono tracking-widest flex items-center justify-between transition-colors hover:scale-[1.01]" style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', color:'#f0a830' }}>
                  <span>{mpCode}</span>
                  <div className="flex items-center gap-1.5 text-xs" style={{ color:'#8a7d6c' }}><Copy size={12}/> copiar código</div>
                </button>

                {/* Members list */}
                <div className="space-y-2 mb-5">
                  {mpMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.05)' }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:m.color, boxShadow:`0 0 8px ${m.color}`, flexShrink:0 }}/>
                      <span className="text-sm flex-1" style={{ color:'#f5efe6' }}>{m.name}</span>
                      {m.isMe   && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background:'rgba(255,255,255,.06)', color:'#8a7d6c' }}>você</span>}
                      {m.isHost && <span className="text-[10px]">👑</span>}
                    </div>
                  ))}
                </div>

                {/* Color picker */}
                <div className="mb-4 px-3 py-3 rounded-xl" style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.05)' }}>
                  <div className="text-xs mb-2" style={{ color:'#8a7d6c' }}>Sua cor</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['#9bd17e','#7bb3f0','#e07c5e','#c77ee0','#60d4c8','#f09050','#f5e050'].map(c => {
                      const myColor = mpMembers.find(m => m.isMe)?.color;
                      return <button key={c} onClick={() => changeMyColor(c)} className="w-7 h-7 rounded-full transition-all hover:scale-110" style={{ background:c, outline:myColor===c?`2px solid #fff`:undefined, outlineOffset:2 }}/>;
                    })}
                    <label style={{ cursor:'pointer', position:'relative' }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: mpMembers.find(m => m.isMe)?.color || '#9bd17e', border:'2px solid rgba(255,255,255,.2)' }}>🎨</div>
                      <input type="color" value={mpMembers.find(m => m.isMe)?.color || '#9bd17e'} onChange={e => changeMyColor(e.target.value)} style={{ position:'absolute', opacity:0, width:0, height:0, pointerEvents:'none' }}/>
                    </label>
                  </div>
                </div>

                {mpStatus && <p className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ background:'rgba(224,124,94,.1)', color:'#e07c5e', border:'1px solid rgba(224,124,94,.2)' }}>{mpStatus}</p>}

                <button onClick={() => { leaveRoom(); setMpOpen(false); }} className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]" style={{ background:'rgba(224,124,94,.1)', border:'1px solid rgba(224,124,94,.2)', color:'#e07c5e' }}>
                  Sair da Sala
                </button>
                <p className="text-xs mt-3 text-center" style={{ color:'#6b6052' }}>
                  As teclas ficam da cor do músico que as pressiona.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
