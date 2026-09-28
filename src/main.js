// ============================================================================
//  AHERYN — O HINO DO GELO  ·  minigame do Capítulo I de As Quatro Vontades
//  Runas de luz (pensamentos Lúmae) surgem pela tela; a dificuldade segue a barra.
//  Three.js (ortho 2.5D) + chroma key em shader + Web Audio
// ============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import BEATS from './beats.json';

// ---------------------------------------------------------------------------
//  CONFIG — ajuste fino sem mexer no resto
//  A dificuldade segue a BARRA, não o relógio: vazia é calma, cheia é caos.
// ---------------------------------------------------------------------------
const CONFIG = {
  TIME_LIMIT: 180,          // s até os Tacets alcançarem Aheryn
  // curva de dificuldade (c = carga 0..1)
  LIFE: [2.9, 1.9, 1.15, 0.85],        // s de vida da runa em c = 0 / 0.5 / 0.85 / 1
  INTERVAL: [1.35, 0.8, 0.42, 0.3],    // s entre runas
  MAX_ON: [2, 3, 5, 7],                // runas simultâneas
  TRAP: [0, 0.12, 0.22, 0.3],          // chance de runa de bronze
  SIX_KEYS_AT: 0.35,                   // a partir daqui entram Q e E
  CHAINS_AT: 0.5,                      // a partir daqui surgem constelações (runas em ordem)
  FRENZY_AT: 0.85,                     // "a luz resiste": runas se movem
  GAIN: [3.4, 1.35],                   // % por acerto em c = 0 e c = 1
  MISS: [1.0, 4.5],                    // % perdida quando uma runa se apaga sozinha
  WRONG: [1.0, 2.5],                   // % perdida ao apertar tecla sem runa
  CHAIN_BONUS: 3,
  // pontuação: vencer rápido vale mais do que sofrer muito
  HIT_POINTS: 50,            // por runa (× multiplicador)
  WIN_BONUS: 15000,          // por vencer
  TIME_BONUS_PER_S: 600,     // por segundo que sobrou no relógio
  ACC_BONUS_PER_PCT: 150,    // por ponto de precisão
  RESET_PENALTY: 2000,       // por hino recomeçado
  SPOTTED_AT: 0.4,
  RESTART_PAUSE: 1.6,
  SUPABASE_URL: 'https://qoxvlgscpljsrybywivf.supabase.co',
  SUPABASE_KEY: 'sb_publishable_XvoczGgXZGAezAmabNUBrQ_r25L-7ga', // chave pública (pode ficar no código)
  AUDIO_OFFSET: 0,          // compensação de latência do áudio (s)
  MUSIC_VOL: 0.34, MUSIC_DUCK: 0.14, VOICE_VOL: 1.0,
  KEY_AHERYN: [14, 34], KEY_TACET: [20, 60],
  VOICE_TRAP_COOLDOWN: 25,
};
const curve = (arr, c) => {
  const xs = [0, 0.5, 0.85, 1];
  for (let i = 0; i < 3; i++) if (c <= xs[i + 1]) return lerp(arr[i], arr[i + 1], (c - xs[i]) / (xs[i + 1] - xs[i]));
  return arr[3];
};

// ---------------------------------------------------------------------------
//  TEXTOS
// ---------------------------------------------------------------------------
const IS_TOUCH_T = matchMedia('(pointer: coarse)').matches;
const TXT = {
  pt: {
    book: 'Capítulo I de As Quatro Vontades', title: 'Aheryn', sub: 'O hino do gelo',
    lede: 'Três Tacets sobem a encosta. Nos Lúmae, pensar acende a pele. Junte os pensamentos em luz e abra o gelo sob eles.',
    how1: IS_TOUCH_T ? 'Runas douradas surgem pela tela. Toque, nos cantos, o símbolo igual ao da runa antes que ela se apague.' : 'Runas douradas surgem pela tela: aperte a letra delas (Q W E A S D) antes que se apaguem.',
    how2: 'Runas de bronze vêm dos Tacets. Tocar uma apaga toda a luz e o hino recomeça.',
    start: 'Conjurar', loading: 'Carregando o gelo', again: 'Cantar de novo', back: 'Voltar ao início', skip: 'Pular',
    c_start: 'Senti-os antes de ouvi-los.', c_three: 'Tacets. Três.',
    c_spotted: 'O primeiro me viu. O ritmo quebrou, de três tempos para quatro.',
    c_half: 'A luz subiu pela garganta, oferecida.', c_close: 'Perto. Perto demais.',
    c_wrong: 'A luz se apagou.', frenzy: 'A luz resiste',
    win_line: 'Pedi ao gelo, e o gelo teve a cortesia de obedecer.',
    lose_line: 'O ritmo chegou até mim antes da luz chegar ao chão.',
    lose_tip: 'Quando a barra enche, o gelo resiste. Se as runas ficarem demais, deixe algumas se apagarem: perder uma custa pouco, tocar o bronze custa tudo.',
    s_score: 'Pontos', s_time: 'Tempo', s_dark: 'Hino recomeçado', s_streak: 'Maior sequência', s_acc: 'Precisão', s_best: 'Recorde', s_title: 'O hino te chama de',
    times: (n) => n === 0 ? 'nenhuma vez' : n === 1 ? '1 vez' : `${n} vezes`,
    miss: 'apagou', trap: 'Bronze!', chain: 'Constelação',
    ranks: ['Velho sem história', 'Voz do hino', 'Herói do seu povo', 'O que viu mais longe'],
    restart: 'O hino recomeça', rotate: 'Gire o celular para jogar deitado',
    kp_hint: 'Toque o símbolo igual ao da runa', bronze_save: 'O caco no bolso esquentou. Reconheci o bronze a tempo.', book_cta: 'Pôr a mão no chão', book_go: 'Continuar a história', book_retry: 'Tentar de novo', book_skip: 'Seguir a história', book_lede: 'Toque para pedir ao gelo.', s_time_bonus: 'Bônus de tempo', s_total: 'Total',
    lb_ph: 'Seu nome', lb_send: 'Gravar no placar', lb_title: 'Os que cantaram mais alto', lb_saved: 'Gravado. O hino lembra de você.', lb_err: 'Não consegui falar com o placar agora. Tente de novo.', lb_empty: 'Ninguém cantou ainda. Seja o primeiro.', lb_need: 'Escreva um nome de até 16 letras.',
  },
  en: {
    book: 'Chapter I of The Four Wills', title: 'Aheryn', sub: 'The hymn of the ice',
    lede: 'Three Tacets climb the slope. In the Lúmae, thinking lights the skin. Gather your thoughts into light and open the ice beneath them.',
    how1: IS_TOUCH_T ? 'Golden runes appear across the screen. Tap the matching symbol in the corners before the rune fades.' : 'Golden runes appear across the screen: press their letter (Q W E A S D) before they fade.',
    how2: 'Bronze runes come from the Tacets. Touching one puts out all the light and the hymn starts over.',
    start: 'Cast', loading: 'Loading the ice', again: 'Sing again', back: 'Back to start', skip: 'Skip',
    c_start: 'I felt them before I heard them.', c_three: 'Tacets. Three.',
    c_spotted: 'The first one saw me. The rhythm broke, from three counts to four.',
    c_half: 'The light rose up my throat, offered.', c_close: 'Close. Too close.',
    c_wrong: 'The light went out.', frenzy: 'The light resists',
    win_line: 'I asked the ice, and the ice did me the courtesy of obeying.',
    lose_line: 'The rhythm reached me before the light reached the ground.',
    lose_tip: 'As the bar fills, the ice resists. If there are too many runes, let some fade: missing one costs little, touching bronze costs everything.',
    s_score: 'Score', s_time: 'Time', s_dark: 'Hymn restarted', s_streak: 'Longest streak', s_acc: 'Accuracy', s_best: 'Record', s_title: 'The hymn calls you',
    times: (n) => n === 0 ? 'never' : n === 1 ? 'once' : `${n} times`,
    miss: 'faded', trap: 'Bronze!', chain: 'Constellation',
    ranks: ['Old man with no story', 'Voice of the hymn', 'Hero of his people', 'The one who saw farthest'],
    restart: 'The hymn starts over', rotate: 'Turn your phone sideways to play',
    kp_hint: 'Tap the symbol that matches the rune', bronze_save: 'The shard in my pocket grew warm. I recognized the bronze in time.', book_cta: 'Put my hand on the ground', book_go: 'Continue the story', book_retry: 'Try again', book_skip: 'Let the story go on', book_lede: 'Tap to ask the ice.', s_time_bonus: 'Time bonus', s_total: 'Total',
    lb_ph: 'Your name', lb_send: 'Save score', lb_title: 'Those who sang the loudest', lb_saved: 'Saved. The hymn remembers you.', lb_err: 'Could not reach the leaderboard right now. Try again.', lb_empty: 'No one has sung yet. Be the first.', lb_need: 'Write a name up to 16 letters.',
  },
};
let LANG = 'pt';
try { const sv = localStorage.getItem('aheryn_lang'); LANG = sv || ((navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en'); } catch (e) {}
const T = (k) => TXT[LANG][k];

// ---------------------------------------------------------------------------
//  MUNDO (pixels da pintura 1619×971, y para baixo). Chão em perspectiva.
// ---------------------------------------------------------------------------
const PW = 1619, PH = 971;
const HORIZON = 215, F = 785, PPU = 255, ORIGIN_X = 810;
const groundY = (Z) => HORIZON + F / Z;
const groundX = (X, Z) => ORIGIN_X + X * PPU / Z;
const W3 = (x, y, z = 0) => new THREE.Vector3(x, -y, z);
const AHERYN = { X: 0, Z: 1.09, H: 1.8 };
const TACET_H = 2.1;
const Z_FAR = 15, Z_NEAR = 1.46, Z_LOSE = 1.2;
const TACETS_DEF = [
  { x0: 5.0, x1: 0.8, zMul: 1.0, phase: 0.0 },
  { x0: 3.4, x1: -1.35, zMul: 1.12, phase: 0.17 },
  { x0: 6.7, x1: 2.1, zMul: 1.12, phase: 0.33 },
];
const KEYS = ['Q', 'W', 'E', 'A', 'S', 'D'];
const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
// modo livro: o jogo roda dentro do livro interativo e recebe o estado da história
const _cl = (v, a, b) => Math.max(a, Math.min(b, v));
const QS = new URLSearchParams(location.search);
const BOOK = QS.get('livro') === '1' ? {
  luz: _cl(parseFloat(QS.get('luz') || '0') || 0, 0, 100),
  bronze: QS.get('bronze') === '1',
  ferido: QS.get('ferido') === '1',
} : null;
if (QS.get('lang')) LANG = QS.get('lang') === 'pt' ? 'pt' : 'en';
if (BOOK) CONFIG.TIME_LIMIT = Math.round(180 - BOOK.luz * 0.5); // muita Luz atrai os Tacets mais depressa


// ---------------------------------------------------------------------------
//  UTIL
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function lerp(a, b, t) { return a + (b - a) * t; }
const smooth = (t) => t * t * (3 - 2 * t);
const rand = (a, b) => a + Math.random() * (b - a);
const $ = (s) => document.querySelector(s);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

//  RENDER
// ---------------------------------------------------------------------------
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_TOUCH ? 1.25 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0c1820);
const sceneB = new THREE.Scene(); sceneB.background = new THREE.Color(0x0c1820);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
const cameraB = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// transição "câmera girando em volta de Aheryn"
const rtA = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
const WhipShader = {
  uniforms: { tDiffuse: { value: null }, tA: { value: null }, uT: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse, tA; uniform float uT; varying vec2 vUv;
    vec3 blurS(sampler2D t, vec2 uv, float k){ vec3 c=vec3(0.); for(int i=0;i<12;i++){ float o=(float(i)/11.0-0.5)*k; c+=texture2D(t, clamp(uv+vec2(o,0.0),0.001,0.999)).rgb; } return c/12.0; }
    void main(){
      float e = uT*uT*(3.0-2.0*uT);
      float k = sin(3.14159*uT)*0.16;
      float sc = 1.0 + sin(3.14159*uT)*0.12;
      vec2 uv = (vUv-0.5)/sc+0.5;
      float gap = 0.22;
      float xa = uv.x + e*(1.0+gap);
      float xb = xa - (1.0+gap);
      vec3 a = blurS(tA, vec2(xa, uv.y), k);
      vec3 b = blurS(tDiffuse, vec2(xb, uv.y), k);
      float wa = smoothstep(1.0+gap*0.5, 1.0-0.02, xa);
      float wb = smoothstep(-gap*0.5, 0.02, xb);
      vec3 mist = mix(blurS(tA, vec2(0.5, uv.y), 0.6), blurS(tDiffuse, vec2(0.5, uv.y), 0.6), e)*0.8 + vec3(0.08,0.1,0.12);
      vec3 c = mist;
      c = mix(c, a, wa); c = mix(c, b, wb);
      gl_FragColor = vec4(c,1.0);
    }`,
};
const whip = new ShaderPass(WhipShader); whip.uniforms.tA.value = rtA.texture; whip.enabled = false; composer.addPass(whip);
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.25, 0.5, 0.86);
composer.addPass(bloom);
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.9 }, uFlash: { value: new THREE.Vector3() },
    uDesat: { value: 0 }, uAberr: { value: 0 }, uGold: { value: 0 }, uDark: { value: 0 }, uPulse: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uVig,uDesat,uAberr,uGold,uDark,uPulse; uniform vec3 uFlash; uniform vec2 uRes;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 d = vUv-0.5; float r = length(d);
      vec2 off = d*uAberr*0.012;
      vec3 c; c.r = texture2D(tDiffuse, vUv+off).r; c.g = texture2D(tDiffuse, vUv).g; c.b = texture2D(tDiffuse, vUv-off).b;
      c = mix(c, c*vec3(0.92,1.0,1.07), 0.55);
      c += vec3(1.0,0.72,0.3)*uGold*0.05*(1.0-r);
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(c, vec3(l)*vec3(0.95,0.98,1.05), uDesat);
      float vig = smoothstep(0.85, 0.2, r*uVig*(1.0+uPulse*0.25));
      c *= mix(0.35, 1.0, vig);
      c += vec3(0.55,0.12,0.02)*uPulse*0.06*smoothstep(0.3,0.8,r);
      c += uFlash; c *= 1.0-uDark;
      c += (h(vUv*uRes+fract(uTime)*91.7)-0.5)*0.035;
      gl_FragColor = vec4(c,1.0);
    }`,
};
const grade = new ShaderPass(GradeShader); composer.addPass(grade);
composer.addPass(new OutputPass());

const NOISE = `
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.03; a*=.5; } return v; }
`;
const VERT = `varying vec2 vUv; varying vec2 vW;
  void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xy; gl_Position=projectionMatrix*viewMatrix*w; }`;

// ---------------------------------------------------------------------------
//  CARREGAMENTO
// ---------------------------------------------------------------------------
const canH264 = !!document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"');
const vsrc = (name) => `assets/video/${name}.${canH264 ? 'mp4' : 'webm'}`;
function makeVideo(name, loop) {
  const v = document.createElement('video');
  v.src = vsrc(name); v.crossOrigin = 'anonymous'; v.playsInline = true;
  v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
  v.muted = true; v.loop = loop; v.preload = 'auto'; v.load();
  return v;
}
const vids = { cast: makeVideo('aheryncastingspell', true), tacet: makeVideo('tacetwalkingcamera', true), win: makeVideo('win', false) };
function waitVideo(v) {
  return new Promise((res) => {
    if (v.readyState >= 3) return res();
    const done = () => res();
    v.addEventListener('canplaythrough', done, { once: true });
    v.addEventListener('loadeddata', () => setTimeout(done, 300), { once: true });
    v.addEventListener('error', done, { once: true });
    setTimeout(done, 15000);
  });
}
// cinematics (tela cheia, DOM)
const cine = $('#cine'), cineV = $('#cineVideo');
const CINE = { intro: vsrc('jogoaherynintro'), win: vsrc('jogoaherynwin'), over: vsrc('jogoaheryngameover') };
const cineCache = {};
for (const [k, src] of Object.entries(CINE)) { const v = document.createElement('video'); v.src = src; v.preload = 'auto'; v.playsInline = true; v.setAttribute('playsinline', ''); v.muted = true; v.load(); cineCache[k] = v; }

const texLoader = new THREE.TextureLoader();
const loadTex = (u) => new Promise((res) => texLoader.load(u, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; res(t); }, undefined, () => res(null)));
const [bgTex, plateTex] = await Promise.all([loadTex('assets/cenario.jpg'), loadTex('assets/wingame_plate.jpg')]);
function vtex(v) { const t = new THREE.VideoTexture(v); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; }
const tex = { cast: vtex(vids.cast), tacet: vtex(vids.tacet), win: vtex(vids.win) };

// ---------------------------------------------------------------------------
//  ÁUDIO (Web Audio)
// ---------------------------------------------------------------------------
const AUDIO_FILES = {
  music: 'musica', steps: 'tacet_passos',
  v_senti: 'v_senti', v_tres: 'v_tres', v_viu: 'v_viu', v_luz: 'v_luz_subiu', v_perto: 'v_perto', v_apagou: 'v_apagou', v_win: 'v_vitoria', v_lose: 'v_derrota',
};
const AC = window.AudioContext || window.webkitAudioContext;
const Audio = {
  ctx: null, buf: {}, muted: false, songSrc: null, songStart: 0, voiceUntil: 0,
  async init() {
    if (this.ctx) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.musicG = ctx.createGain(); this.musicG.gain.value = CONFIG.MUSIC_VOL; this.musicG.connect(this.master);
    this.voiceG = ctx.createGain(); this.voiceG.gain.value = CONFIG.VOICE_VOL; this.voiceG.connect(this.master);
    this.sfxG = ctx.createGain(); this.sfxG.gain.value = 0.8; this.sfxG.connect(this.master);
    this.stepsG = ctx.createGain(); this.stepsG.gain.value = 0; this.stepsG.connect(this.master);
    // ruído p/ efeitos
    const len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    // vento
    const wsrc = ctx.createBufferSource(); wsrc.buffer = nb; wsrc.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.5;
    this.windG = ctx.createGain(); this.windG.gain.value = 0.05;
    wsrc.connect(bp); bp.connect(this.windG); this.windG.connect(this.master); wsrc.start(); this.windF = bp;
  },
  async loadAll(onProgress) {
    await this.init(); const tmp = this.ctx;
    const keys = Object.keys(AUDIO_FILES); let n = 0;
    await Promise.all(keys.map(async (k) => {
      try {
        const r = await fetch(`assets/audio/${AUDIO_FILES[k]}.mp3`); const ab = await r.arrayBuffer();
        this.buf[k] = await new Promise((res, rej) => tmp.decodeAudioData(ab, res, rej));
      } catch (e) { console.warn('audio', k, e); }
      onProgress && onProgress(++n / keys.length);
    }));
    this._tmp = tmp;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
  latency() { return this.ctx ? (this.ctx.outputLatency || this.ctx.baseLatency || 0) : 0; },
  songTime() { return this.now() - this.songStart - this.latency() - CONFIG.AUDIO_OFFSET; },
  startSong(delay = 0) {
    this.stopSong(0);
    const s = this.ctx.createBufferSource(); s.buffer = this.buf.music; s.connect(this.musicG);
    this.songStart = this.now() + delay; s.start(this.songStart); this.songSrc = s;
    this.musicG.gain.cancelScheduledValues(this.now()); this.musicG.gain.setValueAtTime(this.musicLevel(), this.now());
  },
  musicLevel() { return this.now() < this.voiceUntil ? CONFIG.MUSIC_DUCK : CONFIG.MUSIC_VOL; },
  tapeStop(dur = 0.7) {
    const s = this.songSrc; if (!s) return; const t = this.now();
    s.playbackRate.cancelScheduledValues(t); s.playbackRate.setValueAtTime(1, t); s.playbackRate.linearRampToValueAtTime(0.15, t + dur);
    this.musicG.gain.cancelScheduledValues(t); this.musicG.gain.setValueAtTime(this.musicG.gain.value, t); this.musicG.gain.linearRampToValueAtTime(0, t + dur);
    try { s.stop(t + dur + 0.05); } catch (e) {}
    this.songSrc = null;
  },
  stopSong(fade = 0.5) {
    const s = this.songSrc; if (!s) return; const t = this.now();
    this.musicG.gain.cancelScheduledValues(t); this.musicG.gain.setValueAtTime(this.musicG.gain.value, t); this.musicG.gain.linearRampToValueAtTime(0, t + fade + 0.01);
    try { s.stop(t + fade + 0.05); } catch (e) {}
    this.songSrc = null;
  },
  fadeMusic(to, dur) { const t = this.now(); this.musicG.gain.cancelScheduledValues(t); this.musicG.gain.setValueAtTime(this.musicG.gain.value, t); this.musicG.gain.linearRampToValueAtTime(to, t + dur); },
  voice(key, when = 0) {
    const b = this.buf[key]; if (!this.ctx || !b) return;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.voiceG);
    const t = this.now() + when; s.start(t);
    // duck
    this.voiceUntil = t + b.duration + 0.2;
    if (this.songSrc) {
      const g = this.musicG.gain; g.cancelScheduledValues(t); g.setTargetAtTime(CONFIG.MUSIC_DUCK, t, 0.08);
      g.setTargetAtTime(CONFIG.MUSIC_VOL, t + b.duration + 0.1, 0.35);
    }
    return b.duration;
  },
  startSteps() {
    if (this.stepsSrc || !this.buf.steps) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.buf.steps; s.loop = true; s.connect(this.stepsG); s.start(); this.stepsSrc = s;
  },
  stopSteps(fade = 0.6) { if (!this.stepsSrc) return; const t = this.now(); this.stepsG.gain.cancelScheduledValues(t); this.stepsG.gain.setTargetAtTime(0, t, fade / 3); const s = this.stepsSrc; setTimeout(() => { try { s.stop(); } catch (e) {} }, fade * 1000 + 100); this.stepsSrc = null; },
  setSteps(vol, rate) { if (!this.stepsSrc) return; const t = this.now(); this.stepsG.gain.setTargetAtTime(vol, t, 0.15); this.stepsSrc.playbackRate.setTargetAtTime(rate, t, 0.3); },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.now(), 0.05); cineV.muted = m; },
  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, bend = 0) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, freq, q, vol, when = 0, type = 'bandpass') {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(t, rand(0, 1.5)); s.stop(t + dur + 0.05);
  },
  hit(lane, perfect) { const f = [587.33, 659.25, 783.99, 880][lane] * (perfect ? 2 : 1); this.tone(f, 0.35, 'sine', perfect ? 0.07 : 0.05); this.tone(f * 2.01, 0.18, 'triangle', 0.02); },
  miss() { this.noise(0.12, 700, 3, 0.07); },
  empty() { this.tone(160, 0.12, 'square', 0.03, 0, 0.6); },
  trap() { this.noise(0.6, 1600, 0.7, 0.55); this.tone(140, 0.9, 'sawtooth', 0.14, 0, 0.3); this.tone(70, 1.2, 'sine', 0.3, 0.02, 0.5); },
  mult() { this.tone(1046.5, 0.5, 'sine', 0.06); this.tone(1318.5, 0.6, 'sine', 0.05, 0.06); this.tone(1568, 0.8, 'sine', 0.05, 0.12); },
  boom() { this.noise(2.2, 220, 0.5, 0.7, 0, 'lowpass'); this.noise(1.0, 3000, 0.5, 0.25); this.tone(55, 2.2, 'sine', 0.4, 0, 0.5); },
  whoosh() { this.noise(1.1, 900, 0.4, 0.35, 0, 'bandpass'); this.noise(0.9, 3500, 0.6, 0.12, 0.15); },
  tick() { this.tone(1400, 0.05, 'square', 0.02); },
};

// ---------------------------------------------------------------------------
//  CENÁRIO (cena A)
// ---------------------------------------------------------------------------
const bgMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: bgTex }, uTime: { value: 0 } }, vertexShader: VERT,
  fragmentShader: `uniform sampler2D map; uniform float uTime; varying vec2 vUv;
    void main(){ vec2 uv=vUv; float sh=(1.0-smoothstep(0.55,0.75,1.0-uv.y))*0.0009; uv.x+=sin(uv.y*140.0+uTime*1.3)*sh; gl_FragColor=vec4(texture2D(map,uv).rgb,1.0); }`,
  depthTest: false, depthWrite: false,
});
const bg = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), bgMat); bg.position.copy(W3(PW / 2, PH / 2)); bg.renderOrder = 0; scene.add(bg);

const smokeMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false, vertexShader: VERT,
  fragmentShader: `uniform float uTime; varying vec2 vUv; ${NOISE}
    void main(){ vec2 p=vUv; float n=fbm(vec2(p.x*3.0 - uTime*0.12 + p.y*1.2, p.y*2.5 - uTime*0.35));
      float col = smoothstep(0.18,0.0,abs(p.x-0.25-p.y*0.45 - (n-0.5)*0.35));
      float a = col*smoothstep(0.0,0.12,p.y)*smoothstep(1.0,0.35,p.y)*smoothstep(0.35,0.7,n);
      gl_FragColor=vec4(vec3(0.82,0.86,0.9), a*0.32); }`,
});
const smoke = new THREE.Mesh(new THREE.PlaneGeometry(170, 230), smokeMat); smoke.position.copy(W3(296, 100)); smoke.renderOrder = 1; scene.add(smoke);

function fogLayer(y, h, alpha, speed, scale, order, target = scene, width = PW) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: alpha }, uS: { value: speed }, uSc: { value: scale } },
    transparent: true, depthTest: false, depthWrite: false, vertexShader: VERT,
    fragmentShader: `uniform float uTime,uA,uS,uSc; varying vec2 vUv; ${NOISE}
      void main(){ vec2 p=vUv*vec2(uSc*1.7,uSc*0.5); p.x+=uTime*uS; float n=fbm(p+fbm(p*0.7+uTime*0.03));
        float band = smoothstep(0.0,0.4,vUv.y)*smoothstep(1.0,0.5,vUv.y);
        gl_FragColor=vec4(vec3(0.84,0.9,0.95), smoothstep(0.42,0.85,n)*band*uA); }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.3, h), m); mesh.position.copy(W3(width / 2, y)); mesh.renderOrder = order; target.add(mesh);
  return m;
}
const fogs = [fogLayer(270, 200, 0.5, 0.025, 3.0, 2), fogLayer(420, 260, 0.22, 0.04, 2.2, 7), fogLayer(920, 240, 0.3, 0.06, 1.6, 30)];

// ---------------------------------------------------------------------------
//  RACHADURAS DE LUZ NO CHÃO (canvas 2D → textura)
// ---------------------------------------------------------------------------
const CK = 0.64; // escala do canvas
const crackCanvas = document.createElement('canvas');
crackCanvas.width = Math.round(PW * CK); crackCanvas.height = Math.round(PH * CK);
const cctx = crackCanvas.getContext('2d');
const crackTex = new THREE.CanvasTexture(crackCanvas); crackTex.colorSpace = THREE.SRGBColorSpace;
const crackMat = new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
const crackMesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), crackMat);
crackMesh.position.copy(W3(PW / 2, PH / 2)); crackMesh.renderOrder = 3; scene.add(crackMesh);

let crackSegs = [], crackTotal = 1;
function buildCracks() {
  crackSegs = [];
  const segs = [];
  const zA = AHERYN.Z + 0.02, zB = 13;
  const N = 70;
  let prev = null, L = 0;
  const trunk = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const Z = Math.exp(lerp(Math.log(zA), Math.log(zB), s));
    const X = lerp(0.05, 4.6, Math.pow(s, 1.25)) + Math.sin(s * 23 + Math.random()) * 0.06 * (1 + s * 3) + rand(-0.05, 0.05) * (1 + s * 4);
    const p = { x: groundX(X, Z), y: groundY(Z), Z };
    if (prev) { L += Math.hypot(p.x - prev.x, p.y - prev.y) * 0 + 1; segs.push({ a: prev, b: p, L0: L - 1, L1: L, w: 5.5 / Math.pow(Z, 0.8), lvl: 0 }); }
    trunk.push({ X, Z, L });
    prev = p;
  }
  // ramos
  function branch(X, Z, L, dir, depth, len) {
    let x = X, z = Z, l = L, p = { x: groundX(x, z), y: groundY(z) };
    const steps = Math.round(len);
    let ang = dir;
    for (let k = 0; k < steps; k++) {
      ang += rand(-0.35, 0.35);
      x += Math.cos(ang) * 0.09 * z * 0.6;
      z *= 1 + Math.sin(ang) * 0.03 + 0.01;
      const q = { x: groundX(x, z), y: groundY(z) };
      segs.push({ a: p, b: q, L0: l, L1: l + 0.8, w: (3.2 - depth) / Math.pow(z, 0.8), lvl: depth });
      l += 0.8; p = q;
      if (depth < 2 && Math.random() < 0.08) branch(x, z, l, ang + rand(-1.2, 1.2), depth + 1, len * 0.5);
    }
  }
  for (let i = 3; i < trunk.length - 4; i += 2) {
    if (Math.random() < 0.55) {
      const t = trunk[i];
      branch(t.X, t.Z, t.L, Math.random() < 0.5 ? rand(-0.3, 0.6) : Math.PI + rand(-0.6, 0.3), 1, rand(5, 13) * (1 - i / trunk.length * 0.5));
    }
  }
  crackSegs = segs; crackTotal = N;
}
let crackShown = -1;
function drawCracks(amount, t) {
  const grow = amount * crackTotal * 1.02;
  if (Math.abs(grow - crackShown) < 0.02 && Math.floor(t * 12) === drawCracks._f) return;
  drawCracks._f = Math.floor(t * 12);
  crackShown = grow;
  const c = cctx; c.setTransform(CK, 0, 0, CK, 0, 0);
  c.clearRect(0, 0, PW, PH);
  if (grow <= 0.01) { crackTex.needsUpdate = true; return; }
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round'; c.lineJoin = 'round';
  const flick = 0.85 + 0.15 * Math.sin(t * 9.0);
  const passes = [
    { mul: 4.2, col: `rgba(255,170,60,${0.10 * flick})` },
    { mul: 2.2, col: `rgba(255,196,100,${0.28 * flick})` },
    { mul: 1.0, col: `rgba(255,236,190,${0.85})` },
  ];
  for (const ps of passes) {
    c.strokeStyle = ps.col;
    for (const s of crackSegs) {
      if (s.L0 >= grow) continue;
      const f = clamp((grow - s.L0) / (s.L1 - s.L0), 0, 1);
      c.lineWidth = Math.max(0.6, s.w * ps.mul * (s.lvl ? 0.8 : 1));
      c.beginPath(); c.moveTo(s.a.x, s.a.y); c.lineTo(lerp(s.a.x, s.b.x, f), lerp(s.a.y, s.b.y, f)); c.stroke();
    }
  }
  // brilho na ponta
  const tip = crackSegs.filter((s) => s.lvl === 0 && s.L0 < grow).pop();
  if (tip) {
    const g = c.createRadialGradient(tip.b.x, tip.b.y, 0, tip.b.x, tip.b.y, 40 * tip.w / 3);
    g.addColorStop(0, 'rgba(255,230,170,0.9)'); g.addColorStop(1, 'rgba(255,160,60,0)');
    c.fillStyle = g; c.beginPath(); c.arc(tip.b.x, tip.b.y, 40 * tip.w / 3, 0, Math.PI * 2); c.fill();
  }
  crackTex.needsUpdate = true;
}

function radialTex(inner, outer, size = 128) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d'); const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(1, outer); c.fillStyle = g; c.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const shadowTex = radialTex('rgba(10,18,26,0.55)', 'rgba(10,18,26,0)');
const glowTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

//  TACETS
// ---------------------------------------------------------------------------
const tacetMat = () => new THREE.ShaderMaterial({
  uniforms: { map: { value: tex.tacet }, uKey: { value: new THREE.Vector2(...CONFIG.KEY_TACET) }, uHaze: { value: 0 }, uOpacity: { value: 1 }, uFlash: { value: 0 } },
  vertexShader: VERT, transparent: true, depthTest: false, depthWrite: false,
  fragmentShader: `uniform sampler2D map; uniform vec2 uKey; uniform float uHaze,uOpacity,uFlash; varying vec2 vUv;
    void main(){ vec4 c=texture2D(map,vUv); float s=min(c.g-c.r,c.g-c.b)*255.0; float a=1.0-smoothstep(uKey.x,uKey.y,s);
      a*=smoothstep(0.30,0.34,vUv.x)*smoothstep(0.66,0.62,vUv.x);
      vec3 col=c.rgb; col.g=min(col.g,max(col.r,col.b)*1.02);
      float tl=dot(col,vec3(0.3,0.59,0.11)); col=mix(col,vec3(tl),0.7)*vec3(0.88,0.74,0.56)*0.72;
      col=mix(col,vec3(0.80,0.86,0.92),uHaze); col+=vec3(1.0,0.75,0.4)*uFlash;
      if(a<0.02) discard; gl_FragColor=vec4(col,a*uOpacity); }`,
});
const TAC_FRAME_H = 360 / 335, TAC_U = 0.4875, TAC_V = 0.019;
const tacets = TACETS_DEF.map((d) => {
  const mat = tacetMat();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthTest: false, depthWrite: false }));
  const eyes = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(1.0, 0.72, 0.35), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
  scene.add(sh, mesh, eyes);
  return { ...d, mesh, sh, eyes, mat, Z: Z_FAR * d.zMul, X: d.x0, eyeGlow: 0.25, sx: 0, sy: 0, hpx: 0 };
});
function placeTacet(tc, t) {
  const Z = tc.Z, hpx = TACET_H * PPU / Z, fx = groundX(tc.X, Z), fy = groundY(Z);
  const planeH = hpx * TAC_FRAME_H, planeW = planeH * 16 / 9;
  tc.mesh.scale.set(planeW, planeH, 1); tc.mesh.position.set(fx + (0.5 - TAC_U) * planeW, -fy + (0.5 - TAC_V) * planeH, 0);
  tc.sh.scale.set(hpx * 0.55, hpx * 0.07, 1); tc.sh.position.set(fx, -fy, 0);
  const eg = tc.eyeGlow * (0.8 + 0.2 * Math.sin(t * 7 + tc.phase * 20));
  tc.eyes.scale.set(hpx * 0.075 * (0.7 + eg * 0.5), hpx * 0.028 * (0.7 + eg * 0.5), 1);
  tc.eyes.position.set(fx + hpx * 0.004, -(fy - hpx * 0.925), 0);
  tc.eyes.material.opacity = clamp(eg * 0.8, 0, 1) * tc.mat.uniforms.uOpacity.value;
  tc.sh.material.opacity = tc.mat.uniforms.uOpacity.value;
  tc.sx = fx; tc.sy = fy; tc.hpx = hpx;
  tc.mat.uniforms.uHaze.value = clamp((Z - 3.0) / 25, 0, 0.3);
}

// ---------------------------------------------------------------------------
//  AHERYN (chroma key + veias douradas)
// ---------------------------------------------------------------------------
const AH_FRAG = `uniform sampler2D map; uniform vec2 uKey; uniform float uTime,uVein,uOpacity,uFlash,uEdgeX,uMist,uSharp; varying vec2 vUv; ${NOISE}
  void main(){
    vec4 c = texture2D(map, vUv);
    if (uSharp > 0.0) { vec2 px = vec2(1.0/640.0, 1.0/360.0); vec3 b = (texture2D(map, vUv+vec2(px.x,0.)).rgb + texture2D(map, vUv-vec2(px.x,0.)).rgb + texture2D(map, vUv+vec2(0.,px.y)).rgb + texture2D(map, vUv-vec2(0.,px.y)).rgb)*0.25; c.rgb = clamp(c.rgb + (c.rgb-b)*uSharp, 0.0, 1.0); }
    float s = min(c.g-c.r, c.g-c.b)*255.0;
    float a = 1.0 - smoothstep(uKey.x, uKey.y, s);
    a *= smoothstep(0.0,uEdgeX,vUv.x)*smoothstep(1.0,1.0-uEdgeX,vUv.x)*smoothstep(1.0,0.93,vUv.y)*smoothstep(0.0,0.02,vUv.y);
    vec3 col = c.rgb; col.g = min(col.g, max(col.r, col.b));
    float l = dot(col, vec3(0.3,0.59,0.11));
    float body = (1.0-smoothstep(0.22,0.45,l)) * smoothstep(0.25,0.75,a);
    vec2 p = vUv*vec2(26.0,15.0);
    float n = fbm(p + vec2(0.0,-uTime*0.6)); float vein = pow(1.0-abs(n*2.0-1.0), 22.0);
    float n2 = fbm(p*1.7 + vec2(3.1,-uTime*0.9)); vein = max(vein, pow(1.0-abs(n2*2.0-1.0), 30.0)*0.6);
    col += vec3(1.0,0.66,0.22)*vein*body*uVein*2.0;
    col += vec3(1.0,0.75,0.4)*body*uVein*0.08;
    float mist = (1.0-body)*smoothstep(0.25,0.55,l);
    col = mix(col, vec3(l)*vec3(0.95,1.0,1.04), mist*0.7*uMist);
    col = mix(col, col*vec3(0.9,0.97,1.08), 0.3);
    col += vec3(0.8,0.95,1.0)*uFlash;
    if(a<0.01) discard;
    gl_FragColor=vec4(col, a*uOpacity);
  }`;
const aherynMat = (t, edge = 0.1) => new THREE.ShaderMaterial({
  uniforms: { map: { value: t }, uKey: { value: new THREE.Vector2(...CONFIG.KEY_AHERYN) }, uTime: { value: 0 }, uVein: { value: 0 }, uOpacity: { value: 1 }, uFlash: { value: 0 }, uEdgeX: { value: edge }, uMist: { value: edge > 0.05 ? 1 : 0 }, uSharp: { value: edge > 0.05 ? 0 : 0.55 } },
  vertexShader: VERT, fragmentShader: AH_FRAG, transparent: true, depthTest: false, depthWrite: false,
});
const AH_FRAME_H = 360 / 320, AH_U = 0.5, AH_V = (360 - 346) / 360;
const aCast = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), aherynMat(tex.cast));
const aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(1.0, 0.62, 0.22), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, opacity: 0 }));
const aShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthTest: false, depthWrite: false, opacity: 0.8 }));
aShadow.renderOrder = 12; aura.renderOrder = 13; aCast.renderOrder = 14;
scene.add(aShadow, aura, aCast);
const ah = { fx: groundX(AHERYN.X, AHERYN.Z), fy: groundY(AHERYN.Z), hpx: AHERYN.H * PPU / AHERYN.Z };

// ---------------------------------------------------------------------------
//  CENA B — Aheryn de frente (wingame + win.mp4)
// ---------------------------------------------------------------------------
const BW = 1671, BH = 941;
const plate = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshBasicMaterial({ map: plateTex, depthTest: false, depthWrite: false }));
plate.position.copy(W3(BW / 2, BH / 2)); plate.renderOrder = 0; sceneB.add(plate);
const fogsB = [fogLayer(430, 200, 0.35, 0.03, 2.4, 2, sceneB, BW), fogLayer(900, 160, 0.12, 0.05, 1.6, 30, sceneB, BW)];
const aWin = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), aherynMat(tex.win, 0.04)); aWin.renderOrder = 10; sceneB.add(aWin);
const aWinShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthTest: false, depthWrite: false, opacity: 0.9 })); aWinShadow.renderOrder = 9; sceneB.add(aWinShadow);
{ // mesmo lugar e escala do Aheryn pintado
  const hpx = 470, fx = 760, fy = 900, FH = 360 / 327, U = 0.49, V = 2 / 360;
  const planeH = hpx * FH, planeW = planeH * 16 / 9;
  aWin.scale.set(planeW, planeH, 1); aWin.position.set(fx + (0.5 - U) * planeW, -fy + (0.5 - V) * planeH, 0);
  aWinShadow.scale.set(hpx * 0.55, hpx * 0.07, 1); aWinShadow.position.set(fx, -fy, 0);
}

// ---------------------------------------------------------------------------
//  PARTÍCULAS
// ---------------------------------------------------------------------------
function pointsMaterial(blending) {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 } },
    vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aKind; attribute float aRot;
      varying float vA; varying vec3 vC; varying float vK; varying float vR; uniform float uScale;
      void main(){ vA=aAlpha; vC=aColor; vK=aKind; vR=aRot; gl_PointSize=aSize*uScale; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying float vA; varying vec3 vC; varying float vK; varying float vR;
      void main(){ vec2 p=gl_PointCoord*2.0-1.0; float a;
        if(vK<0.5){ a = smoothstep(1.0,0.0,length(p)); a*=a; }
        else { float cs=cos(vR), sn=sin(vR); vec2 q=vec2(cs*p.x-sn*p.y, sn*p.x+cs*p.y); float d=abs(q.x)*3.2+abs(q.y); a = smoothstep(1.0,0.75,d); }
        if(a*vA<0.003) discard; gl_FragColor=vec4(vC, a*vA); }`,
    transparent: true, depthTest: false, depthWrite: false, blending,
  });
}
class Pool {
  constructor(n, blending, order, target) {
    this.n = n; this.p = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.col = new Float32Array(n * 3); this.kind = new Float32Array(n); this.rot = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1)); g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
    this.geo = g; this.mat = pointsMaterial(blending);
    this.obj = new THREE.Points(g, this.mat); this.obj.frustumCulled = false; this.obj.renderOrder = order; target.add(this.obj);
  }
  spawn(o) { if (this.p.length >= this.n) this.p.shift(); this.p.push({ life: 1, age: 0, rs: 0, g: 0, drag: 0.98, ...o }); }
  clear() { this.p = []; }
  update(dt) {
    const live = [];
    for (const q of this.p) {
      q.age += dt; if (q.age > q.life) continue;
      q.vx *= Math.pow(q.drag, dt * 60); q.vy *= Math.pow(q.drag, dt * 60);
      q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r = (q.r || 0) + q.rs * dt; live.push(q);
    }
    this.p = live;
    for (let i = 0; i < this.n; i++) {
      const q = this.p[i]; if (!q) { this.alpha[i] = 0; continue; }
      const k = q.age / q.life;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = -q.y; this.pos[i * 3 + 2] = 0;
      this.size[i] = q.s * (q.grow ? lerp(1, q.grow, k) : 1);
      this.alpha[i] = q.a * (q.fadeIn ? smooth(clamp(q.age / q.fadeIn, 0, 1)) : 1) * (1 - Math.pow(k, 2));
      this.col[i * 3] = q.c[0]; this.col[i * 3 + 1] = q.c[1]; this.col[i * 3 + 2] = q.c[2]; this.kind[i] = q.kind || 0; this.rot[i] = q.r || 0;
    }
    for (const k of ['position', 'aSize', 'aAlpha', 'aColor', 'aKind', 'aRot']) this.geo.attributes[k].needsUpdate = true;
  }
}
const glowPool = new Pool(900, THREE.AdditiveBlending, 50, scene);
const shardPool = new Pool(500, THREE.NormalBlending, 51, scene);
const glowPoolB = new Pool(400, THREE.AdditiveBlending, 50, sceneB);

const SNOW = IS_TOUCH ? 700 : 1400;
const snowGeo = new THREE.BufferGeometry();
const snowPos = new Float32Array(SNOW * 3), snowSize = new Float32Array(SNOW), snowA = new Float32Array(SNOW), snowC = new Float32Array(SNOW * 3), snowK = new Float32Array(SNOW), snowR = new Float32Array(SNOW);
const snowData = [];
for (let i = 0; i < SNOW; i++) {
  const layer = Math.random(); snowData.push({ x: rand(-100, BW + 100), y: rand(-50, PH + 50), l: layer, ph: rand(0, 6.28) });
  snowSize[i] = lerp(1.6, 7.5, Math.pow(layer, 2.2)); snowA[i] = lerp(0.35, 0.9, layer); snowC.set([0.93, 0.96, 1.0], i * 3);
}
for (const [k, a, n] of [['position', snowPos, 3], ['aSize', snowSize, 1], ['aAlpha', snowA, 1], ['aColor', snowC, 3], ['aKind', snowK, 1], ['aRot', snowR, 1]]) snowGeo.setAttribute(k, new THREE.BufferAttribute(a, n));
const snowMat = pointsMaterial(THREE.NormalBlending);
const snow = new THREE.Points(snowGeo, snowMat); snow.frustumCulled = false; snow.renderOrder = 49; scene.add(snow);
const snowB = new THREE.Points(snowGeo, snowMat); snowB.frustumCulled = false; snowB.renderOrder = 49; sceneB.add(snowB);
let wind = 0;
function updateSnow(dt, t) {
  wind = 30 + Math.sin(t * 0.21) * 25 + Math.sin(t * 0.87) * 10;
  for (let i = 0; i < SNOW; i++) {
    const s = snowData[i], sp = lerp(22, 120, s.l);
    s.y += sp * dt; s.x += (wind * lerp(0.4, 1.4, s.l) + Math.sin(t * 1.3 + s.ph) * 12) * dt;
    if (s.y > PH + 40) { s.y = -40; s.x = rand(-100, BW + 100); }
    if (s.x > BW + 120) s.x = -100;
    snowPos[i * 3] = s.x; snowPos[i * 3 + 1] = -s.y;
  }
  snowGeo.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
//  RUNAS — pensamentos de luz que surgem pela tela (DOM, tocáveis)
// ---------------------------------------------------------------------------
const field = $('#field'), links = $('#links');
const GLYPHS = { // traço geométrico Lúmae de cada tecla (aparece no toque, onde letra não faz sentido)
  Q: 'M50 26 L50 74 M30 40 L70 40', W: 'M30 34 L50 66 L70 34', E: 'M34 30 L66 30 L66 70 L34 70',
  A: 'M30 66 L50 32 L70 66 M40 54 L60 54', S: 'M66 32 L34 44 L66 56 L34 68', D: 'M34 30 L34 70 L62 50 Z',
};
function runeHTML(r) {
  const inner = IS_TOUCH
    ? `<svg class="gl" viewBox="0 0 100 100"><path d="${GLYPHS[r.key]}"/></svg>`
    : `<span class="k">${r.key}</span>`;
  return `<svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/></svg>
    <svg class="fr" viewBox="0 0 100 100">${r.trap
      ? '<path d="M50 4 L66 24 L92 28 L80 50 L92 74 L64 76 L50 96 L36 76 L8 74 L20 50 L8 28 L34 24 Z"/><rect class="eye" x="36" y="62" width="28" height="4" rx="2"/>'
      : '<path d="M50 6 L94 50 L50 94 L6 50 Z"/><path class="in" d="M50 20 L80 50 L50 80 L20 50 Z"/>'}</svg>${inner}${r.chain ? `<i class="ord">${r.order + 1}</i>` : ''}`;
}
let RID = 0;
// teclado de símbolos no toque: é preciso achar o símbolo certo, como no PC se acha a letra certa
const KEYPAD_L = ['Q', 'W', 'E'], KEYPAD_R = ['A', 'S', 'D'];
function buildKeypad() {
  if (!IS_TOUCH || $('#keypad')) return;
  const kp = document.createElement('div'); kp.id = 'keypad';
  const mk = (keys, side) => `<div class="kp ${side}">${keys.map((k) => `<button data-key="${k}" aria-label="${k}"><svg viewBox="0 0 100 100"><path class="kf" d="M50 6 L94 50 L50 94 L6 50 Z"/><path class="kg" d="${GLYPHS[k]}"/></svg></button>`).join('')}</div>`;
  kp.innerHTML = mk(KEYPAD_L, 'l') + mk(KEYPAD_R, 'r');
  document.body.appendChild(kp);
  kp.querySelectorAll('button').forEach((b) => b.addEventListener('pointerdown', (e) => {
    e.preventDefault(); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 110); pressKey(b.dataset.key);
  }));
}
function updateKeypad() {
  const kp = $('#keypad'); if (!kp) return;
  const six = S.charge / 100 >= CONFIG.SIX_KEYS_AT;
  kp.querySelectorAll('button').forEach((b) => b.classList.toggle('off', !six && (b.dataset.key === 'Q' || b.dataset.key === 'E')));
}
function screenToWorld(sx, sy, cam = camera) {
  const v = new THREE.Vector3((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1, 0).unproject(cam);
  return [v.x, -v.y];
}
function worldToScreen(x, y, cam = camera) {
  const v = new THREE.Vector3(x, -y, 0).project(cam);
  return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight];
}
function runeSize() { return clamp(Math.min(innerWidth, innerHeight) * 0.105, 58, 96); }
function freeSpot(avoid = []) {
  const W = innerWidth, H = innerHeight, sz = runeSize();
  const minD = sz * 1.55;
  const [ax, ay] = worldToScreen(ah.sfx || ah.fx, (ah.sfy || ah.fy) - (ah.shpx || ah.hpx) * 0.5);
  for (let i = 0; i < 40; i++) {
    const x = rand(Math.max(sz, W * 0.07), W - Math.max(sz, W * 0.07));
    const y = rand(Math.max(sz * 1.2, H * 0.2), H - Math.max(sz, H * 0.12));
    if (Math.abs(x - ax) < sz * 1.6 && y > ay - sz * 1.4) continue;             // não cobrir Aheryn
    if (x > W - 180 && y < 130) continue;                                   // relógio
    if (IS_TOUCH && y > H - 260 && (x < 260 || x > W - 260)) continue;      // teclado de símbolos
    const all = [...S.runes.filter((r) => !r.dead), ...avoid];
    if (all.every((r) => Math.hypot(r.x - x, r.y - y) > minD)) return [x, y];
  }
  return null;
}
function pickKey(trap) {
  const c = S.charge / 100;
  const pool = c >= CONFIG.SIX_KEYS_AT ? KEYS : ['W', 'A', 'S', 'D'];
  const live = S.runes.filter((r) => !r.dead);
  const banned = new Set(live.filter((r) => r.trap !== trap).map((r) => r.key)); // ouro e bronze nunca dividem letra
  const used = new Set(live.map((r) => r.key));
  let opts = pool.filter((k) => !banned.has(k) && !used.has(k));
  if (!opts.length) opts = pool.filter((k) => !banned.has(k));
  if (!opts.length) return null;
  return opts[Math.floor(Math.random() * opts.length)];
}
function addRune(r) {
  const el = document.createElement('button');
  el.className = 'rune ' + (r.trap ? 'trap' : 'gold') + (r.chain ? ' chain' : '') + (S.charge / 100 >= CONFIG.FRENZY_AT && !r.chain ? ' drift' : '');
  el.style.setProperty('--life', r.life + 's'); el.style.setProperty('--sz', runeSize() + 'px');
  el.style.setProperty('--dx', rand(-1, 1).toFixed(2)); el.style.setProperty('--dy', rand(-1, 1).toFixed(2));
  el.setAttribute('aria-label', r.trap ? `bronze ${r.key}` : r.key);
  el.innerHTML = runeHTML(r);
  if (r.from) { el.style.left = r.from[0] + 'px'; el.style.top = r.from[1] + 'px'; el.classList.add('fly'); requestAnimationFrame(() => requestAnimationFrame(() => { el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; el.classList.remove('fly'); })); }
  else { el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; }
  if (!IS_TOUCH) el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); tapRune(r); });
  field.appendChild(el); r.el = el; r.id = ++RID; r.born = S.playT; r.dead = false;
  S.runes.push(r);
}
function spawn() {
  const c = S.charge / 100;
  const life = curve(CONFIG.LIFE, c);
  const live = S.runes.filter((r) => !r.dead).length;
  // constelação: runas ligadas, em ordem
  if (c >= CONFIG.CHAINS_AT && !S.runes.some((r) => r.chain && !r.dead) && Math.random() < 0.28) {
    const n = c > 0.8 ? 4 : 3;
    const spots = [];
    for (let i = 0; i < n; i++) { const s = freeSpot(spots.map(([x, y]) => ({ x, y }))); if (!s) break; spots.push(s); }
    if (spots.length === n) {
      const cid = ++RID; const keys = [];
      spots.forEach(([x, y], i) => {
        let k = pickKey(false); if (!k) k = 'W';
        keys.push(k);
        addRune({ key: k, trap: false, x, y, life: life * (1.7 + n * 0.25), chain: cid, order: i });
      });
      drawLinks(); Audio.chainSpawn(); return;
    }
  }
  if (live >= Math.round(curve(CONFIG.MAX_ON, c))) return;
  const trap = Math.random() < curve(CONFIG.TRAP, c);
  const key = pickKey(trap); if (!key) return;
  const spot = freeSpot(); if (!spot) return;
  const r = { key, trap, x: spot[0], y: spot[1], life: trap ? life * 1.35 : life };
  if (trap) { const tc = tacets[Math.floor(Math.random() * 3)]; r.from = worldToScreen(tc.sx, tc.sy - tc.hpx * 0.93); tc.eyeGlow = 2.2; Audio.trapSpawn(); }
  else Audio.spawnTick(c);
  addRune(r);
}
function drawLinks() {
  const groups = {};
  S.runes.forEach((r) => { if (r.chain && !r.dead) (groups[r.chain] = groups[r.chain] || []).push(r); });
  let html = '';
  for (const g of Object.values(groups)) {
    g.sort((a, b) => a.order - b.order);
    for (let i = 0; i < g.length - 1; i++) html += `<line x1="${g[i].x}" y1="${g[i].y}" x2="${g[i + 1].x}" y2="${g[i + 1].y}"/>`;
  }
  links.innerHTML = html;
}
function currentChainOrder(cid) { const g = S.runes.filter((r) => r.chain === cid && !r.dead); return g.length ? Math.min(...g.map((r) => r.order)) : -1; }
function killRune(r, cls) {
  if (r.dead) return; r.dead = true; r.el.classList.add(cls);
  const el = r.el; setTimeout(() => el.remove(), 650);
  if (r.chain) drawLinks();
}
function float(x, y, text, cls) {
  const el = document.createElement('div'); el.className = 'judge ' + cls; el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px'; $('#judges').appendChild(el); setTimeout(() => el.remove(), 800);
}
function pressKey(key) {
  if (S.mode !== 'play' || S.restarting > 0) return;
  const live = S.runes.filter((r) => !r.dead && r.key === key);
  const golds = live.filter((r) => !r.trap && (!r.chain || r.order === currentChainOrder(r.chain))).sort((a, b) => a.born - b.born);
  if (golds.length) return hit(golds[0]);
  const trapR = live.find((r) => r.trap); if (trapR) return trap(trapR);
  wrong(live[0]);
}
function tapRune(r) {
  if (S.mode !== 'play' || S.restarting > 0 || r.dead) return;
  if (r.trap) return trap(r);
  if (r.chain && r.order !== currentChainOrder(r.chain)) return wrong(r);
  hit(r);
}
function gainFor(c) { return lerp(CONFIG.GAIN[0], CONFIG.GAIN[1], c) * (1 + 0.12 * (mult() - 1)); }
function hit(r) {
  const c = S.charge / 100;
  S.combo++; S.best = Math.max(S.best, S.combo); S.hits++;
  S.charge = clamp(S.charge + gainFor(c), 0, 100);
  S.score += CONFIG.HIT_POINTS * mult();
  killRune(r, 'hit');
  Audio.chime(S.combo, c);
  const [wx, wy] = screenToWorld(r.x, r.y);
  const tx = ah.sfx, ty = ah.sfy - ah.shpx * 0.62;
  for (let i = 0; i < 14; i++) glowPool.spawn({ x: wx, y: wy, vx: rand(-170, 170), vy: rand(-170, 130), g: 200, s: rand(4, 11), a: 1, c: [1, 0.8, 0.45], life: rand(0.35, 0.8), drag: 0.93 });
  for (let i = 0; i < 6; i++) glowPool.spawn({ x: wx, y: wy, vx: (tx - wx) * rand(1.2, 1.7), vy: (ty - wy) * rand(1.2, 1.7), s: rand(5, 10), a: 0.95, c: [1, 0.76, 0.38], life: 0.6, drag: 0.965 });
  S.pulse = 1;
  if (r.chain) {
    const rest = S.runes.filter((q) => q.chain === r.chain && !q.dead);
    if (!rest.length) { S.charge = clamp(S.charge + CONFIG.CHAIN_BONUS, 0, 100); S.score += 250 * mult(); float(r.x, r.y - 40, T('chain'), 'p'); Audio.mult(); S.flash.set(0.12, 0.09, 0.03); }
  }
  if (S.charge >= 100) win();
  updateHud();
}
function wrong(r) {
  const c = S.charge / 100;
  S.combo = 0; S.charge = clamp(S.charge - lerp(CONFIG.WRONG[0], CONFIG.WRONG[1], c), 0, 100);
  Audio.empty(); S.shake = Math.max(S.shake, 4);
  if (r && r.el) { r.el.classList.remove('nope'); void r.el.offsetWidth; r.el.classList.add('nope'); }
  updateHud();
}
function miss(r) {
  const c = S.charge / 100;
  S.combo = 0; S.misses++;
  S.charge = clamp(S.charge - lerp(CONFIG.MISS[0], CONFIG.MISS[1], c), 0, 100);
  killRune(r, 'fade'); Audio.miss(); float(r.x, r.y, T('miss'), 'm');
  updateHud();
}
function trap(r) {
  if (BOOK && BOOK.bronze && !S.bronzeUsed) {
    S.bronzeUsed = true; killRune(r, 'burst'); Audio.trapSpawn(); S.shake = 8;
    float(r.x, r.y, '✦', 'p'); caption(T('bronze_save'), 3.2, 'gold'); return;
  }
  S.resets++; S.combo = 0; S.charge = 0; S.shown = Math.min(S.shown, 0.35);
  killRune(r, 'burst');
  Audio.trap(); Audio.tapeStop(0.8); S.songLive = false;
  S.shake = 22; S.aberr = 2.2; S.flash.set(0.25, 0.12, 0.02);
  float(r.x, r.y, T('trap'), 't');
  const [wx, wy] = screenToWorld(r.x, r.y);
  for (let i = 0; i < 60; i++) shardPool.spawn({ x: wx, y: wy, vx: rand(-320, 320), vy: rand(-420, -40), g: 800, s: rand(5, 15), a: 1, c: Math.random() < 0.7 ? [0.5, 0.36, 0.18] : [1, 0.55, 0.2], kind: 1, r: rand(0, 6), rs: rand(-12, 12), life: rand(0.6, 1.3), drag: 0.99 });
  // a luz apaga: todas as runas caem
  S.runes.forEach((q) => killRune(q, 'fade')); links.innerHTML = '';
  // estilhaços das rachaduras
  const pts = crackSegs.filter((s) => s.L0 < S.shown * crackTotal).slice(0, 80);
  for (let i = 0; i < 50; i++) { const s = pts.length ? pts[Math.floor(Math.random() * pts.length)].a : { x: ah.fx, y: ah.fy }; shardPool.spawn({ x: s.x, y: s.y, vx: rand(-120, 120), vy: rand(-320, -80), g: 700, s: rand(5, 14), a: 0.95, c: [0.85, 0.95, 1], kind: 1, r: rand(0, 6), rs: rand(-9, 9), life: rand(0.6, 1.2), drag: 0.99 }); }
  document.body.classList.add('hurt'); setTimeout(() => document.body.classList.remove('hurt'), 400);
  S.restarting = CONFIG.RESTART_PAUSE;
  if (S.playT - S.lastTrapVoice > CONFIG.VOICE_TRAP_COOLDOWN) { S.lastTrapVoice = S.playT; setTimeout(() => say('v_apagou', 'c_wrong'), 350); }
  else caption(T('restart'), 1.6, 'cold');
  updateHud();
}
function restartSong() { S.beatIdx = 0; S.lastSpawnT = -9; Audio.startSong(0.5); S.songLive = true; }

// sons próprios desta versão
Object.assign(Audio, {
  chime(combo, c) { const sc = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; const n = sc[combo % sc.length] + (c > 0.5 ? 12 : 0); const f = 392 * Math.pow(2, n / 12); this.tone(f, 0.7, 'sine', 0.09); this.tone(f * 2.01, 0.35, 'sine', 0.03); this.tone(f * 3.99, 0.18, 'triangle', 0.012); },
  spawnTick(c) { this.tone(1800 + c * 800, 0.05, 'sine', 0.012); },
  trapSpawn() { this.tone(110, 0.35, 'sawtooth', 0.05, 0, 1.6); this.noise(0.2, 2500, 4, 0.05); },
  chainSpawn() { this.tone(784, 0.4, 'sine', 0.04); this.tone(988, 0.4, 'sine', 0.035, 0.07); this.tone(1175, 0.5, 'sine', 0.03, 0.14); },
});

// ---------------------------------------------------------------------------
//  GIRO DE 180° EM VOLTA DE AHERYN (vitória)
//  Fundo de costas varre para um lado, fundo de frente entra do outro,
//  e Aheryn gira no próprio eixo: costas → perfil → frente.
// ---------------------------------------------------------------------------
const rtB = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
const sceneT = new THREE.Scene(); sceneT.background = new THREE.Color(0x0c1820);
const cameraT = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
const panMat = new THREE.ShaderMaterial({
  uniforms: { tA: { value: rtA.texture }, tB: { value: rtB.texture }, uT: { value: 0 } }, depthTest: false, depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tA,tB; uniform float uT; varying vec2 vUv;
    vec3 blurS(sampler2D t, vec2 uv, float k){ vec3 c=vec3(0.); for(int i=0;i<16;i++){ float o=(float(i)/15.0-0.5)*k; c+=texture2D(t, vec2(fract(uv.x+o), clamp(uv.y,0.001,0.999))).rgb; } return c/16.0; }
    void main(){
      float e = uT*uT*(3.0-2.0*uT);
      float k = pow(sin(3.14159*uT), 1.5)*0.3;
      float zoom = 1.0 + sin(3.14159*uT)*0.10;
      vec2 uv = (vUv-0.5)/zoom+0.5;
      vec3 a = blurS(tA, vec2(uv.x + e*0.9, uv.y), k);
      vec3 b = blurS(tB, vec2(uv.x + e*0.9 - 0.9, uv.y), k);
      vec3 c = mix(a, b, smoothstep(0.38, 0.62, e));
      c = mix(c, vec3(0.78,0.86,0.93), sin(3.14159*uT)*0.1);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const panQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), panMat); panQuad.renderOrder = 0; sceneT.add(panQuad);
const ahT_A = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), aherynMat(tex.cast)); ahT_A.renderOrder = 2;
const ahT_B = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), aherynMat(tex.win, 0.04)); ahT_B.renderOrder = 2;
const ahT_glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(1, 0.8, 0.5), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, opacity: 0 })); ahT_glow.renderOrder = 3;
sceneT.add(ahT_A, ahT_B, ahT_glow);
function rectOf(mesh, cam) {
  const p = mesh.position, sx = mesh.scale.x, sy = mesh.scale.y;
  const [x0, y0] = worldToScreen(p.x - sx / 2, -(p.y + sy / 2), cam), [x1, y1] = worldToScreen(p.x + sx / 2, -(p.y - sy / 2), cam);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}
const TRANS = { a: null, b: null };
function layoutTransition(u) {
  const W = innerWidth, H = innerHeight;
  cameraT.left = 0; cameraT.right = W; cameraT.top = 0; cameraT.bottom = -H; cameraT.updateProjectionMatrix();
  panQuad.scale.set(W, H, 1); panQuad.position.set(W / 2, -H / 2, 0);
  panMat.uniforms.uT.value = u;
  const e = smooth(u), A = TRANS.a, B = TRANS.b; if (!A || !B) return;
  const cx = lerp(A.cx, B.cx, e), cy = lerp(A.cy, B.cy, e), w = lerp(A.w, B.w, e), h = lerp(A.h, B.h, e);
  const turn = Math.cos(Math.PI * e), sx = Math.max(0.035, Math.abs(turn));
  const m = e < 0.5 ? ahT_A : ahT_B;
  ahT_A.visible = e < 0.5; ahT_B.visible = e >= 0.5;
  m.scale.set(w * sx, h, 1); m.position.set(cx, -cy, 0);
  m.material.uniforms.uFlash.value = (1 - sx) * 0.35;
  m.material.uniforms.uTime.value = S.t;
  ahT_glow.scale.set(h * 0.9, h * 1.1, 1); ahT_glow.position.set(cx, -(cy - h * 0.05), 0); ahT_glow.material.opacity = (1 - sx) * 0.5;
}

// ---------------------------------------------------------------------------
//  ESTADO
// ---------------------------------------------------------------------------
const S = {
  mode: 'title', t: 0, playT: 0, charge: 0, shown: 0, combo: 0, best: 0, score: 0, resets: 0, hits: 0, misses: 0,
  runes: [], restarting: 0, songLive: false, beatIdx: 0, lastSpawnT: -9, frenzy: false, lastFrenzyCap: -99,
  spotted: false, half: false, close: false, lastTrapVoice: -99, pulse: 0,
  shake: 0, flash: new THREE.Vector3(), aberr: 0, endT: 0, camZ: 1, camX: 812, camY: 505, punch: 0, lastStepPhase: 0, ts: 1, winPhase: 0,
};
const mult = () => 1 + Math.min(3, Math.floor(S.combo / 8));
function resetGame() {
  Object.assign(S, { playT: 0, charge: 0, shown: 0, combo: 0, best: 0, score: 0, resets: 0, hits: 0, misses: 0, restarting: 0, songLive: false, beatIdx: 0, lastSpawnT: -9, frenzy: false,
    spotted: false, half: false, close: false, lastTrapVoice: -99, endT: 0, winPhase: 0, endShown: false, loseFlash: false, loseCine: false, bBoom: false, winT: 0, bronzeUsed: false, bonus: null });
  if (BOOK) S.charge = S.shown = BOOK.luz * 0.2; // a Luz acumulada na história já começa acesa
  S.runes.forEach((r) => r.el && r.el.remove()); S.runes = []; links.innerHTML = '';
  document.body.classList.remove('frenzy');
  tacets.forEach((tc) => { tc.Z = Z_FAR * tc.zMul * 1.08; tc.X = tc.x0; tc.eyeGlow = 0.25; tc.mat.uniforms.uOpacity.value = 0; });
  grade.uniforms.uDark.value = 0; grade.uniforms.uDesat.value = 0;
  renderPass.scene = scene; renderPass.camera = camera; whip.enabled = false;
  vids.win.pause(); try { vids.win.currentTime = 0; } catch (e) {}
  buildCracks(); crackShown = -1; crackMat.opacity = 1;
  updateHud(true);
}

// ---------------------------------------------------------------------------
//  HUD
// ---------------------------------------------------------------------------
let capTimer = null;
function caption(text, dur = 3, cls = '') {
  const el = $('#caption'); el.className = 'caption ' + cls; el.textContent = text;
  void el.offsetWidth; el.classList.add('show');
  clearTimeout(capTimer); capTimer = setTimeout(() => el.classList.remove('show'), dur * 1000);
}
function say(key, capKey, dur) { const d = Audio.voice(key); caption(T(capKey), Math.max(dur || 0, (d || 2) + 0.8)); }
const lastHud = {};
function updateHud(force) {
  updateKeypad();
  const m = mult();
  if (force || lastHud.m !== m) { const el = $('#mult'); el.textContent = `×${m}`; el.dataset.m = m; if (!force && m > (lastHud.m || 1)) { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); Audio.mult(); } lastHud.m = m; }
  if (force || lastHud.score !== S.score) { $('#score').textContent = S.score.toLocaleString(LANG === 'pt' ? 'pt-BR' : 'en-US'); lastHud.score = S.score; }
}

// ---------------------------------------------------------------------------
//  FLUXO: título → intro → jogo → vitória / derrota
// ---------------------------------------------------------------------------
function playCine(key, { onEnd, skippable = true, voices = [] } = {}) {
  const v = cineCache[key];
  cineV.src = v.src; cineV.muted = Audio.muted; cineV.volume = 0.9;
  cine.classList.add('show'); cine.classList.toggle('skippable', skippable);
  let timers = [], done = false;
  const finish = () => {
    if (done) return; done = true; timers.forEach(clearTimeout);
    cineV.onended = null; $('#skip').onclick = null; removeEventListener('keydown', keySkip);
    cine.classList.remove('show'); setTimeout(() => cineV.pause(), 600);
    onEnd && onEnd();
  };
  const keySkip = (e) => { if (['Escape', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); finish(); } };
  if (skippable) { $('#skip').onclick = finish; addEventListener('keydown', keySkip); }
  cineV.onended = finish;
  const started = () => { timers = voices.map(([at, fn]) => setTimeout(fn, at * 1000)); timers.push(setTimeout(finish, ((cineV.duration || 12) + 1.5) * 1000)); };
  const p = cineV.play();
  if (p && p.then) p.then(started).catch(() => { cineV.muted = true; cineV.play().then(started).catch(() => setTimeout(finish, 300)); });
  else started();
}
function startGame() {
  // tudo que precisa do gesto do jogador acontece aqui, antes de qualquer espera (iOS)
  Audio.init(); Audio.resume();
  resetGame();
  $('#title').classList.add('hide'); $('#end').classList.add('hide');
  S.mode = 'cine';
  if (BOOK) { caption(T('c_three'), 2.4); Audio.voice('v_tres'); setTimeout(beginIntro, 300); }
  else playCine('intro', { voices: [[2.8, () => say('v_senti', 'c_start')], [5.2, () => say('v_tres', 'c_three')]], onEnd: beginIntro });
  vids.cast.play().catch(() => {}); vids.tacet.play().catch(() => {});
  vids.win.play().then(() => { vids.win.pause(); vids.win.currentTime = 0; }).catch(() => {});
}
function beginIntro() {
  document.body.classList.add('playing');
  S.mode = 'intro'; S.t0 = S.t;
  Audio.startSteps(); Audio.startSong(2.0); S.songLive = true; S.beatIdx = 0;
  $('#hud').classList.add('show'); buildKeypad(); updateKeypad();
}
function win() {
  S.mode = 'win'; S.winT = S.playT; S.endT = 0; S.winPhase = 0;
  { const judged = S.hits + S.misses, acc = judged ? Math.round((S.hits / judged) * 100) : 0;
    const timeB = Math.max(0, Math.round((CONFIG.TIME_LIMIT - S.winT) * CONFIG.TIME_BONUS_PER_S));
    S.bonus = { hits: S.score, time: timeB, win: CONFIG.WIN_BONUS, acc: acc * CONFIG.ACC_BONUS_PER_PCT, resets: S.resets * CONFIG.RESET_PENALTY };
    S.score = Math.max(0, S.score + CONFIG.WIN_BONUS + timeB + acc * CONFIG.ACC_BONUS_PER_PCT - S.resets * CONFIG.RESET_PENALTY); }
  Audio.boom(); S.flash.set(0.5, 0.4, 0.2); S.shake = 10;
  S.runes.forEach((q) => killRune(q, q.trap ? 'fade' : 'hit')); links.innerHTML = '';
  document.body.classList.remove('frenzy');
  $('#hud').classList.remove('show');
  Audio.fadeMusic(CONFIG.MUSIC_DUCK, 1.2); Audio.stopSteps(1.5);
  let best = 0; try { best = parseInt(localStorage.getItem('aheryn_best_score') || '0', 10); } catch (e) {}
  S.newBest = S.score > best; if (S.newBest) try { localStorage.setItem('aheryn_best_score', String(S.score)); } catch (e) {}
}
function startWhip() {
  // fundo de costas, sem o Aheryn
  aCast.visible = false; aura.visible = false; aShadow.visible = false;
  renderer.setRenderTarget(rtA); renderer.render(scene, camera); renderer.setRenderTarget(null);
  aCast.visible = true; aura.visible = true; aShadow.visible = true;
  TRANS.a = rectOf(aCast, camera);
  try { vids.cast.currentTime = 0.4; vids.cast.playbackRate = 1; } catch (e) {}
  S.bZ = 1.0; updateCameraB(0, S.t);
  TRANS.b = rectOf(aWin, cameraB);
  renderPass.scene = sceneT; renderPass.camera = cameraT; layoutTransition(0);
  vids.win.currentTime = 0; vids.win.muted = true; vids.win.play().catch(() => {});
  Audio.whoosh();
}
function renderBackB() { aWin.visible = false; renderer.setRenderTarget(rtB); renderer.render(sceneB, cameraB); renderer.setRenderTarget(null); aWin.visible = true; }
function lose() {
  S.mode = 'lose'; S.endT = 0;
  S.runes.forEach((q) => killRune(q, 'fade')); links.innerHTML = '';
  document.body.classList.remove('frenzy');
  $('#hud').classList.remove('show');
  Audio.tapeStop(1.2); S.songLive = false;
  tacets.forEach((tc) => { tc.eyeGlow = 1.8; });
}
function showEnd(won) {
  const el = $('#end');
  el.classList.toggle('won', won); el.classList.toggle('lost', !won);
  $('#endLine').textContent = won ? T('win_line') : T('lose_line');
  $('#endTip').textContent = won ? '' : T('lose_tip');
  const judged = S.hits + S.misses, acc = judged ? Math.round((S.hits / judged) * 100) : 0;
  let best = 0; try { best = parseInt(localStorage.getItem('aheryn_best_score') || '0', 10); } catch (e) {}
  const loc = LANG === 'pt' ? 'pt-BR' : 'en-US';
  const rows = [[T('s_score'), S.score.toLocaleString(loc) + (won && S.newBest ? ' ✦' : '')]];
  if (won) rows.push([T('s_time'), fmt(S.winT)], [T('s_time_bonus'), '+' + (S.bonus ? S.bonus.time : 0).toLocaleString(loc)]);
  rows.push([T('s_acc'), acc + '%'], [T('s_streak'), String(S.best)], [T('s_dark'), T('times')(S.resets)]);
  if (best && !(won && S.newBest)) rows.push([T('s_best'), best.toLocaleString(loc)]);
  $('#stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const r = $('#rank');
  if (won) {
    const idx = S.resets === 0 && acc >= 92 ? 3 : acc >= 82 && S.resets <= 1 ? 2 : acc >= 65 ? 1 : 0;
    r.innerHTML = `<span>${T('s_title')}</span><strong>${T('ranks')[idx]}</strong>`; r.hidden = false;
  } else r.hidden = true;
  el.classList.remove('hide'); document.body.classList.remove('playing');
  $('#keypad') && $('#keypad').remove();
  if (BOOK) { bookButtons(won); return; }
  prepareBoard(won);
  setTimeout(() => ($('#lbForm').hidden ? $('#again') : $('#lbName')).focus(), 50);
}

// ---------------------------------------------------------------------------
//  PLACAR (Supabase)
// ---------------------------------------------------------------------------
const LB = {
  headers() { return { apikey: CONFIG.SUPABASE_KEY, 'Content-Type': 'application/json' }; },
  async top(n = 10) {
    const r = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/aheryn_scores?select=id,name,score,won&order=score.desc,created_at.asc&limit=${n}`, { headers: this.headers() });
    if (!r.ok) throw new Error(r.status); return r.json();
  },
  async submit(row) {
    const r = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/aheryn_scores`, { method: 'POST', headers: { ...this.headers(), Prefer: 'return=representation' }, body: JSON.stringify(row) });
    if (!r.ok) throw new Error(r.status); const j = await r.json(); return j[0];
  },
};
const esc = (t) => String(t).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
async function renderBoard(meId) {
  const list = $('#lbList'), loc = LANG === 'pt' ? 'pt-BR' : 'en-US';
  try {
    const rows = await LB.top(10);
    list.innerHTML = rows.length ? rows.map((r) => `<li class="${r.id === meId ? 'me' : ''}"><span class="n ${r.won ? 'won' : ''}">${esc(r.name)}</span><span class="s">${Number(r.score).toLocaleString(loc)}</span></li>`).join('') : `<li><span class="n">${T('lb_empty')}</span></li>`;
  } catch (e) { list.innerHTML = ''; $('#lbMsg').textContent = T('lb_err'); }
}
function prepareBoard(won) {
  $('#lbMsg').textContent = ''; $('#lbForm').hidden = S.score <= 0; $('#lbSend').disabled = false;
  let nm = ''; try { nm = localStorage.getItem('aheryn_name') || ''; } catch (e) {}
  $('#lbName').value = nm; S.lastWon = won; S.submitted = false;
  renderBoard();
}
async function submitScore() {
  if (S.submitted) return;
  const name = $('#lbName').value.replace(/\s+/g, ' ').trim().slice(0, 16);
  if (!name) { $('#lbMsg').textContent = T('lb_need'); $('#lbName').focus(); return; }
  try { localStorage.setItem('aheryn_name', name); } catch (e) {}
  $('#lbSend').disabled = true;
  const judged = S.hits + S.misses;
  try {
    const row = await LB.submit({ name, score: Math.round(S.score), won: !!S.lastWon, time_s: Math.round((S.lastWon ? S.winT : S.playT) * 10) / 10, accuracy: judged ? Math.round((S.hits / judged) * 100) : 0, resets: S.resets, lang: LANG });
    S.submitted = true; $('#lbForm').hidden = true; $('#lbMsg').textContent = T('lb_saved');
    renderBoard(row && row.id);
  } catch (e) { $('#lbSend').disabled = false; $('#lbMsg').textContent = T('lb_err'); }
}
$('#lbSend').addEventListener('click', submitScore);
$('#lbName').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') submitScore(); });

// ---------------------------------------------------------------------------
//  CÂMERA
// ---------------------------------------------------------------------------
let viewW = PW, viewH = PH, aspect = 16 / 9;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  rtA.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()); rtB.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  grade.uniforms.uRes.value.set(w, h);
  aspect = w / h;
  if (aspect > PW / PH) { viewW = PW; viewH = PW / aspect; } else { viewH = PH; viewW = PH * aspect; }
  const sc = (h * renderer.getPixelRatio()) / viewH;
  for (const p of [glowPool, shardPool, glowPoolB]) p.mat.uniforms.uScale.value = sc; snowMat.uniforms.uScale.value = sc;
  bloom.resolution.set(w / (IS_TOUCH ? 4 : 2), h / (IS_TOUCH ? 4 : 2));
  document.body.classList.toggle('portrait', h > w);
}
addEventListener('resize', resize); resize();

function updateCamera(dt, t) {
  let prog = S.mode === 'play' ? S.playT / CONFIG.TIME_LIMIT : (S.lastProg || 0);
  if (S.mode === 'play') S.lastProg = prog; if (S.mode === 'title' || S.mode === 'cine') prog = 0;
  // retrato: centraliza no caminho
  const portrait = aspect < 1;
  let targetZ = 1.0 + 0.2 * smooth(clamp(prog, 0, 1)) + S.shown * 0.04;
  let tx = lerp(portrait ? 830 : 812, 850, smooth(prog)), ty = lerp(505, 470, smooth(prog)), rate = 1.5;
  if (S.mode === 'lose') { const k = smooth(clamp(S.endT / 2.0, 0, 1)); targetZ += 0.25 * k; ty = lerp(ty, 520, k); }
  if (S.mode === 'win' && S.winPhase === 0) { const k = smooth(clamp(S.endT / 1.2, 0, 1)); targetZ = lerp(targetZ, 1.9, k); tx = lerp(tx, ah.fx, k); ty = lerp(ty, ah.fy - ah.hpx * 0.6, k); rate = 4; }
  S.camZ += (targetZ - S.camZ) * (1 - Math.exp(-dt * rate));
  S.camX += (tx - S.camX) * (1 - Math.exp(-dt * rate * 0.8)); S.camY += (ty - S.camY) * (1 - Math.exp(-dt * rate * 0.8));
  const z = S.camZ;
  const hw = viewW / 2 / z, hh = viewH / 2 / z;
  let cx = S.camX + Math.sin(t * 0.23) * 4, cy = S.camY + Math.sin(t * 0.31) * 3;
  cx = clamp(cx, hw, PW - hw); cy = clamp(cy, hh, PH - hh);
  S.shake *= Math.exp(-dt * 5);
  cx += (Math.random() - 0.5) * S.shake; cy += (Math.random() - 0.5) * S.shake;
  camera.left = cx - hw; camera.right = cx + hw; camera.top = -(cy - hh); camera.bottom = -(cy + hh); camera.updateProjectionMatrix();
  return { cx, cy, z };
}
function updateCameraB(dt, t) {
  let vw, vh; if (aspect > BW / BH) { vw = BW; vh = BW / aspect; } else { vh = BH; vw = BH * aspect; }
  const tz = S.mode === 'win' && S.winPhase >= 2 ? lerp(1.0, 1.06, smooth(clamp(S.endT / 10, 0, 1))) : 1.0;
  S.bZ += (tz - S.bZ) * (1 - Math.exp(-dt * 1.2));
  const hw = vw / 2 / S.bZ, hh = vh / 2 / S.bZ;
  let cx = clamp(800 + Math.sin(t * 0.2) * 4, hw, BW - hw), cy = clamp(540, hh, BH - hh);
  cx += (Math.random() - 0.5) * S.shake; cy += (Math.random() - 0.5) * S.shake;
  cameraB.left = cx - hw; cameraB.right = cx + hw; cameraB.top = -(cy - hh); cameraB.bottom = -(cy + hh); cameraB.updateProjectionMatrix();
}
function placeAheryn(cam, t) {
  const extra = 1 + (cam.z - 1) * 0.6;
  const fx = cam.cx + (ah.fx - cam.cx) * extra, fy = cam.cy + (ah.fy - cam.cy) * extra, hpx = ah.hpx * extra;
  const planeH = hpx * AH_FRAME_H, planeW = planeH * 16 / 9;
  aCast.scale.set(planeW, planeH, 1); aCast.position.set(fx + (0.5 - AH_U) * planeW, -fy + (0.5 - AH_V) * planeH, 0);
  aShadow.scale.set(hpx * 0.6, hpx * 0.08, 1); aShadow.position.set(fx, -fy + 2, 0);
  S.pulse *= Math.exp(-(1 / 60) * 8);
  const c = S.shown, pulse = 0.85 + 0.15 * Math.sin(t * 5.3) + 0.05 * Math.sin(t * 13.1) + S.pulse * 0.25, r = hpx * (0.9 + c * 1.6) * pulse;
  aura.scale.set(r, r * 1.25, 1); aura.position.set(fx, -(fy - hpx * 0.55), 0);
  aura.material.opacity = (0.03 + c * c * 0.3 + S.pulse * 0.05) * (S.mode === 'lose' ? clamp(1 - S.endT, 0, 1) : 1);
  ah.sfx = fx; ah.sfy = fy; ah.shpx = hpx;
}

// ---------------------------------------------------------------------------
//  LOOP
// ---------------------------------------------------------------------------
let _last = performance.now(), lastTick = -1;
const beats = BEATS.beats;
function frame() {
  const nowMs = performance.now(); const raw = (nowMs - _last) / 1000; _last = nowMs;
  const dt = Math.min(raw, 0.05) * (S.ts || 1);          // animação
  const rdt = Math.min(raw, 0.25) * (S.ts || 1);         // relógio do jogo: tempo real, mesmo com poucos quadros por segundo
  S.t += dt; const t = S.t;

  if (S.mode === 'intro') {
    const k = (t - S.t0) / 2.2;
    tacets.forEach((tc) => { tc.mat.uniforms.uOpacity.value = smooth(clamp(k * 1.4, 0, 1)); tc.Z = lerp(Z_FAR * tc.zMul * 1.08, Z_FAR * tc.zMul, smooth(clamp(k, 0, 1))); });
    if (k >= 1) S.mode = 'play';
  }
  const songT = Audio.songTime();
  if (S.mode === 'play' || S.mode === 'intro') {
    if (S.mode === 'play') S.playT += rdt;
    const f = clamp(S.playT / CONFIG.TIME_LIMIT, 0, 1), sp = CONFIG.SPOTTED_AT;
    const p = f < sp ? f * 0.62 : 0.62 * sp + (f - sp) / (1 - sp) * (1 - 0.62 * sp);
    const c = S.charge / 100;
    if (S.mode === 'play') {
      tacets.forEach((tc) => {
        tc.Z = Math.exp(lerp(Math.log(Z_FAR), Math.log(Z_NEAR), p)) * lerp(tc.zMul, 1 + (tc.zMul - 1) * 0.5, p);
        tc.X = lerp(tc.x0, tc.x1, smooth(p));
        tc.eyeGlow += ((f > sp ? 0.9 : 0.3) + (f > 0.85 ? 0.4 : 0) - tc.eyeGlow) * dt * 2;
      });
      if (!S.spotted && f >= sp) { S.spotted = true; say('v_viu', 'c_spotted', 4); S.shake = 6; }
      if (!S.close && CONFIG.TIME_LIMIT - S.playT < 22) { S.close = true; say('v_perto', 'c_close'); }
      if (!S.half && S.charge >= 50) { S.half = true; say('v_luz', 'c_half'); }
      const fz = c >= CONFIG.FRENZY_AT;
      if (fz !== S.frenzy) { S.frenzy = fz; document.body.classList.toggle('frenzy', fz); if (fz && S.playT - S.lastFrenzyCap > 20) { S.lastFrenzyCap = S.playT; caption(T('frenzy'), 1.8, 'gold'); } }
      // runas: nascem no compasso da música (meia batida), no ritmo que a barra pede
      if (S.restarting > 0) { S.restarting -= rdt; if (S.restarting <= 0) restartSong(); }
      else if (S.songLive && songT > 0) {
        while (S.beatIdx < beats.length * 2 - 2) {
          const i = S.beatIdx >> 1, half = S.beatIdx & 1;
          const tt = half ? (beats[i] + beats[i + 1]) / 2 : beats[i];
          if (tt > songT) break;
          S.beatIdx++;
          if (songT - tt < 0.25 && songT - S.lastSpawnT >= curve(CONFIG.INTERVAL, c) * 0.93) { S.lastSpawnT = songT; spawn(); }
        }
        if (songT > BEATS.end + 2) restartSong(); // música acabou: recomeça, a luz fica
      }
      // runas que se apagam
      for (const r of S.runes) if (!r.dead && S.playT - r.born > r.life) {
        if (r.trap) killRune(r, 'fade');
        else if (r.chain) { S.runes.filter((q) => q.chain === r.chain && !q.dead).forEach((q, i) => { if (i === 0) miss(q); else killRune(q, 'fade'); }); }
        else miss(r);
      }
      S.runes = S.runes.filter((r) => !r.dead || r.el.isConnected);
    }
    const near = clamp((8 - tacets[0].Z) / 6.5, 0, 1);
    Audio.setSteps(0.03 + near * near * 0.85, S.spotted ? 1.22 : 1.0);
    if (S.mode === 'play' && S.playT >= CONFIG.TIME_LIMIT) lose();
    const left = Math.max(0, CONFIG.TIME_LIMIT - S.playT);
    $('#time').textContent = fmt(Math.ceil(left)); $('#time').classList.toggle('danger', left < 22);
    if (left < 10 && S.mode === 'play' && Math.floor(left) !== lastTick) { lastTick = Math.floor(left); Audio.tick(); }
    vids.cast.playbackRate = lerp(0.85, 1.3, c);
    const ph = Math.floor(((vids.tacet.currentTime || 0) % 10) * 1.3);
    if (ph !== S.lastStepPhase) { S.lastStepPhase = ph; S.shake = Math.max(S.shake, near * near * 3); }
  }
  const target = S.charge / 100;
  S.shown += (target - S.shown) * (1 - Math.exp(-dt * (target < S.shown - 0.2 ? 9 : 7)));
  $('#bar').style.setProperty('--v', S.shown.toFixed(4));

  if (S.mode === 'win') {
    S.endT += dt;
    if (S.winPhase === 0) {
      if (S.endT > 1.25) { S.winPhase = 1; startWhip(); S.whipT = 0; }
    } else if (S.winPhase === 1) {
      S.whipT += dt; const u = clamp(S.whipT / 1.5, 0, 1);
      updateCameraB(dt, t); renderBackB(); layoutTransition(u);
      if (u >= 1) { renderPass.scene = sceneB; renderPass.camera = cameraB; S.winPhase = 2; S.endT = 0; setTimeout(() => say('v_win', 'win_line', 4.5), 400); }
    } else if (S.winPhase === 2) {
      const vt = vids.win.currentTime || 0;
      if (!S.bBoom && vt > 5.2) { S.bBoom = true; S.shake = 14; S.flash.set(0.35, 0.4, 0.45); Audio.boom(); for (let i = 0; i < 120; i++) glowPoolB.spawn({ x: 760 + rand(-280, 280), y: 890 + rand(-30, 10), vx: rand(-140, 140), vy: rand(-380, -60), g: 260, s: rand(4, 12), a: 1, c: Math.random() < 0.5 ? [0.8, 0.95, 1] : [1, 0.8, 0.45], life: rand(0.8, 1.8), drag: 0.97 }); }
      if (vt > 8.6 || vids.win.ended || S.endT > 11) {
        S.winPhase = 3; Audio.fadeMusic(0, 1.5);
        playCine('win', { onEnd: () => { S.winPhase = 4; setTimeout(() => showEnd(true), 250); } });
      }
    }
  }
  if (S.mode === 'lose') {
    S.endT += dt;
    const k = smooth(clamp(S.endT / 1.6, 0, 1));
    tacets.forEach((tc) => { tc.Z = lerp(tc.Z, Z_LOSE * (tc.zMul > 1 ? 1.06 : 1), k * 0.08); });
    grade.uniforms.uDesat.value = k * 0.6;
    if (S.endT > 0.8 && !S.loseFlash) { S.loseFlash = true; S.flash.set(0.6, 0.45, 0.25); S.shake = 18; }
    if (S.endT > 1.8 && !S.loseCine) {
      S.loseCine = true; Audio.stopSteps(0.4);
      playCine('over', { skippable: false, voices: [[2.6, () => say('v_lose', 'lose_line', 5)]], onEnd: () => { grade.uniforms.uDark.value = 0.55; setTimeout(() => showEnd(false), 1800); } });
    }
  }

  // cena A
  const cam = updateCamera(dt, t);
  [...tacets].sort((a, b) => b.Z - a.Z).forEach((tc, i) => { placeTacet(tc, t); tc.sh.renderOrder = 5; tc.mesh.renderOrder = 8 + i * 0.1; tc.eyes.renderOrder = 8.05 + i * 0.1; });
  placeAheryn(cam, t);
  aCast.material.uniforms.uTime.value = t;
  aCast.material.uniforms.uVein.value = Math.max(S.shown * S.shown, (mult() - 1) / 3 * 0.7) * (S.mode === 'play' ? 1 : 0.6);
  if (S.mode === 'win' && S.winPhase === 0) drawCracks(Math.min(1, S.shown + S.endT), t);
  else drawCracks(S.mode === 'title' || S.mode === 'cine' ? 0 : S.shown, t);
  crackMat.opacity = S.mode === 'lose' ? clamp(1 - S.endT, 0, 1) : 1;
  if (S.mode === 'play' && Math.random() < S.shown * 0.8) glowPool.spawn({ x: ah.sfx + rand(-ah.shpx * 0.25, ah.shpx * 0.25), y: ah.sfy - ah.shpx * rand(0.1, 0.9), vx: rand(-15, 15) + wind * 0.3, vy: rand(-70, -25), s: rand(3, 8), a: 0.7 * S.shown + 0.2, c: [1, 0.74, 0.34], life: rand(1.2, 2.4), fadeIn: 0.3, drag: 0.995 });

  if (renderPass.scene === sceneB || renderPass.scene === sceneT) {
    updateCameraB(dt, t);
    aWin.material.uniforms.uTime.value = t;
    fogsB.forEach((m) => { m.uniforms.uTime.value = t; });
  }

  S.flash.multiplyScalar(Math.exp(-dt * 4)); S.aberr *= Math.exp(-dt * 4);
  const danger = S.mode === 'play' ? clamp(1 - (CONFIG.TIME_LIMIT - S.playT) / 30, 0, 1) : 0;
  grade.uniforms.uTime.value = t; grade.uniforms.uFlash.value.copy(S.flash);
  grade.uniforms.uAberr.value = S.aberr + danger * 0.3;
  grade.uniforms.uGold.value = renderPass.scene === scene ? S.shown : 0;
  grade.uniforms.uPulse.value = danger * (0.5 + 0.5 * Math.sin(t * (6 + danger * 4)));
  bloom.strength = 0.18 + (renderPass.scene === scene ? S.shown * 0.3 : 0.15);
  bgMat.uniforms.uTime.value = t; smokeMat.uniforms.uTime.value = t; fogs.forEach((m) => { m.uniforms.uTime.value = t; });
  updateSnow(dt, t); glowPool.update(dt); shardPool.update(dt); glowPoolB.update(dt);

  composer.render(dt);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
//  UI / ENTRADA
// ---------------------------------------------------------------------------
function applyLang() {
  document.documentElement.lang = LANG === 'pt' ? 'pt-BR' : 'en';
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = T(el.dataset.t); });
  document.querySelectorAll('[data-ph]').forEach((el) => { el.placeholder = T(el.dataset.ph); });
  $('#lang').textContent = LANG === 'pt' ? 'EN' : 'PT';
}
$('#lang').addEventListener('click', () => { LANG = LANG === 'pt' ? 'en' : 'pt'; try { localStorage.setItem('aheryn_lang', LANG); } catch (e) {} applyLang(); });
$('#mute').addEventListener('click', () => { Audio.setMuted(!Audio.muted); $('#mute').classList.toggle('off', Audio.muted); });
$('#fs').addEventListener('click', () => { const d = document.documentElement; if (!document.fullscreenElement) (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); else (document.exitFullscreen || document.webkitExitFullscreen).call(document); });
$('#start').addEventListener('click', startGame);
$('#again').addEventListener('click', () => { Audio.init(); Audio.resume(); resetGame(); $('#end').classList.add('hide'); caption(T('c_three'), 2); Audio.voice('v_tres'); beginIntro(); });
$('#back').addEventListener('click', () => { Audio.stopSong(0.3); resetGame(); S.mode = 'title'; $('#end').classList.add('hide'); $('#title').classList.remove('hide'); });
addEventListener('keydown', (e) => {
  const k = e.key && e.key.length === 1 ? e.key.toUpperCase() : '';
  if (KEYS.includes(k)) { e.preventDefault(); if (!e.repeat) pressKey(k); return; }
  if ((e.code === 'Enter' || e.code === 'Space') && S.mode === 'title' && !$('#start').disabled) { e.preventDefault(); startGame(); }
});
applyLang();
if (IS_TOUCH) document.body.classList.add('touch');
function bookButtons(won) {
  const row = $('#end .row');
  row.innerHTML = won
    ? `<button class="cta" id="bkGo">${T('book_go')}</button>`
    : `<button class="cta" id="bkRetry">${T('book_retry')}</button><button class="ghost" id="bkSkip">${T('book_skip')}</button>`;
  const send = (w) => parent.postMessage({ type: 'aheryn:fim', won: w, score: S.score, time: Math.round(S.winT || S.playT), resets: S.resets, bronzeUsed: !!S.bronzeUsed }, '*');
  if (won) $('#bkGo').onclick = () => send(true);
  else { $('#bkRetry').onclick = () => { Audio.init(); Audio.resume(); resetGame(); $('#end').classList.add('hide'); caption(T('c_three'), 2); Audio.voice('v_tres'); beginIntro(); }; $('#bkSkip').onclick = () => send(false); }
  $('#lb').hidden = true;
}
if (BOOK) {
  document.body.classList.add('book');
  $('#title .lede').textContent = T('book_lede'); $('#title .lede').removeAttribute('data-t');
  $('#start').dataset.t = 'book_cta';
}

resetGame();
requestAnimationFrame(frame);
vids.cast.play().catch(() => {});
(async () => {
  const bar = $('#load');
  let vp = 0, ap = 0; const upd = () => bar.style.setProperty('--p', ((vp + ap) / 2).toFixed(3));
  const vlist = [...Object.values(vids), ...Object.values(cineCache)];
  let vn = 0;
  const vPromise = Promise.all(vlist.map((v) => waitVideo(v).then(() => { vp = ++vn / vlist.length; upd(); })));
  const aPromise = Audio.loadAll((p) => { ap = p; upd(); });
  document.addEventListener('pointerdown', () => Audio.resume(), { once: true });
  await Promise.all([vPromise, aPromise]);
  vids.cast.play().catch(() => {});
  $('#start').disabled = false; $('#start').dataset.t = BOOK ? 'book_cta' : 'start'; $('#start').textContent = T($('#start').dataset.t);
  document.body.classList.add('ready');
})();
window.__AHERYN = { S, CONFIG, pressKey, win, lose, Audio, tacets, spawn };
