import { Howl } from 'howler'

/**
 * Rotation Sigil / ルベランギス専用タイマー
 *
 * 元データ:
 * RubeTimer v2.4.1 (Build 2026-08-30)
 *
 * このファイルは旧ルベタイマーから「時間計算・Lv2/Lv3データ・音声再生」だけを
 * 切り出したモジュールです。画面DOMや旧タイマーのボタン描画には依存しません。
 *
 * 音声ファイルは public/audio/ 配下に置く前提です。
 */

export type RuberangisLevel = 2 | 3
export type CalamityMode = 'circle' | 'grand'

type VoicePart = {
  text: string
  kana: string
  file: string
}

type TimerPhase = {
  currentText: string
  noteText: string
  leadParts: string[]
  nextParts: string[]
}

type TimerModeConfig = {
  key: CalamityMode
  label: string
  initialDelayMs: number
  loopLapMs: number[]
  phases: TimerPhase[]
}

type LevelConfig = Record<CalamityMode, TimerModeConfig>

type TimerState = {
  level: RuberangisLevel
  mode: CalamityMode | null
  phaseIndex: number
  lapIndex: number
  running: boolean
  targetPerfMs: number
  rafId: number
  nextAnnounceTimeoutId: number
  leadFired: boolean
  countdown3Fired: boolean
  fiveSecondsVoiceFired: boolean
  lastMetronomeTenths: number | null
}

export type RuberangisTimerOptions = {
  leadSeconds?: 7 | 10
  playNextVoice?: boolean
  metronomeInterval?: 0 | 5 | 10
  voiceVolume?: number
  seVolume?: number
  audioBasePath?: string
}

export type RuberangisTimerSnapshot = {
  level: RuberangisLevel
  mode: CalamityMode | null
  running: boolean
  phaseIndex: number
  remainingMs: number
  phase: TimerPhase | null
}

const NEXT_ANNOUNCE_DELAY_MS = 6500
const ADJUST_STEP_MS = 500

const VOICE_PARTS: Record<string, VoicePart> = {
  "s_tsugi": {
    "text": "次、",
    "kana": "つぎ、",
    "file": "s_tsugi"
  },
  "s_loop": {
    "text": "初回にループします",
    "kana": "しょかいにループします",
    "file": "s_loop"
  },
  "s_osoi": {
    "text": "遅い",
    "kana": "おそい",
    "file": "s_osoi"
  },
  "s_5sec": {
    "text": "5秒前",
    "kana": "ごびょうまえ",
    "file": "s_5sec"
  },
  "c_senjo_osoto": {
    "text": "線上・大外です",
    "kana": "せんじょう、おおそとです",
    "file": "c_senjo_osoto"
  },
  "c_center_large_senjo": {
    "text": "中央大・線上です",
    "kana": "ちゅうおう だい、せんじょうです",
    "file": "c_center_large_senjo"
  },
  "c_center_ami_soto": {
    "text": "中央・網・外です",
    "kana": "ちゅうおう、あみ、そとです",
    "file": "c_center_ami_soto"
  },
  "c_center_large_soto": {
    "text": "中央大・外です",
    "kana": "ちゅうおう だい、そとです",
    "file": "c_center_large_soto"
  },
  "c_anchi_senjo_osoto": {
    "text": "線上・大外が安置です",
    "kana": "せんじょう、おおそとがあんちです",
    "file": "c_anchi_senjo_osoto"
  },
  "c_anchi_center_large_senjo": {
    "text": "中央大・線上が安置です",
    "kana": "ちゅうおう だい、せんじょうがあんちです",
    "file": "c_anchi_center_large_senjo"
  },
  "c_anchi_center_ami_soto": {
    "text": "中央・網・外が安置です",
    "kana": "ちゅうおう、あみ、そとがあんちです",
    "file": "c_anchi_center_ami_soto"
  },
  "c_anchi_center_large_soto": {
    "text": "中央大・外が安置です",
    "kana": "ちゅうおう だい、そとがあんちです",
    "file": "c_anchi_center_large_soto"
  },
  "g_niji": {
    "text": "虹床です",
    "kana": "にじゆかです",
    "file": "g_niji"
  },
  "g_amisen_osoto": {
    "text": "網と線上、大外です",
    "kana": "あみとせんじょう、おおそとです",
    "file": "g_amisen_osoto"
  },
  "g_amisen_soto": {
    "text": "網と線上、外です",
    "kana": "あみとせんじょう、そとです",
    "file": "g_amisen_soto"
  },
  "g_center_amisen": {
    "text": "中央、網と線上です",
    "kana": "ちゅうおう、あみとせんじょうです",
    "file": "g_center_amisen"
  },
  "g_center_large_soto": {
    "text": "中央大、外です",
    "kana": "ちゅうおう だい、そとです",
    "file": "g_center_large_soto"
  },
  "g_center_senjo_soto": {
    "text": "中央大・線上と外です",
    "kana": "ちゅうおうだい、せんじょうとそとです",
    "file": "g_center_senjo_soto"
  }
} as Record<string, VoicePart>

const LEVELS: Record<RuberangisLevel, LevelConfig> = {
  "2": {
    "circle": {
      "key": "circle",
      "label": "サークル",
      "initialDelayMs": 6000,
      "loopLapMs": [
        19150
      ],
      "phases": [
        {
          "currentText": "-",
          "noteText": "サークル床",
          "leadParts": [],
          "nextParts": []
        }
      ]
    },
    "grand": {
      "key": "grand",
      "label": "グランド",
      "initialDelayMs": 6800,
      "loopLapMs": [
        17750,
        17750,
        17750
      ],
      "phases": [
        {
          "currentText": "-",
          "noteText": "虹床",
          "leadParts": [
            "g_niji"
          ],
          "nextParts": [
            "s_tsugi",
            "g_niji"
          ]
        },
        {
          "currentText": "-",
          "noteText": "虹床",
          "leadParts": [
            "g_niji"
          ],
          "nextParts": [
            "s_tsugi",
            "g_niji"
          ]
        },
        {
          "currentText": "溝（安置）",
          "noteText": "黄色床",
          "leadParts": [],
          "nextParts": []
        }
      ]
    }
  },
  "3": {
    "circle": {
      "key": "circle",
      "label": "サークル",
      "initialDelayMs": 5750,
      "loopLapMs": [
        23750,
        20750,
        23250,
        21000,
        25000,
        20750
      ],
      "phases": [
        {
          "currentText": "➀線上・大外",
          "noteText": "-",
          "leadParts": [
            "c_senjo_osoto"
          ],
          "nextParts": [
            "s_tsugi",
            "c_senjo_osoto",
            "s_loop"
          ]
        },
        {
          "currentText": "➁中央大・線上",
          "noteText": "遅い",
          "leadParts": [
            "s_osoi",
            "c_center_large_senjo"
          ],
          "nextParts": [
            "s_tsugi",
            "c_center_large_senjo"
          ]
        },
        {
          "currentText": "➂中央・網・外",
          "noteText": "-",
          "leadParts": [
            "c_center_ami_soto"
          ],
          "nextParts": [
            "s_tsugi",
            "c_center_ami_soto"
          ]
        },
        {
          "currentText": "➃線上・大外",
          "noteText": "遅い",
          "leadParts": [
            "s_osoi",
            "c_senjo_osoto"
          ],
          "nextParts": [
            "s_tsugi",
            "c_senjo_osoto"
          ]
        },
        {
          "currentText": "➄中央大・外",
          "noteText": "-",
          "leadParts": [
            "c_center_large_soto"
          ],
          "nextParts": [
            "s_tsugi",
            "c_center_large_soto"
          ]
        },
        {
          "currentText": "➅中央・網・外",
          "noteText": "遅い",
          "leadParts": [
            "s_osoi",
            "c_center_ami_soto"
          ],
          "nextParts": [
            "s_tsugi",
            "c_center_ami_soto"
          ]
        }
      ]
    },
    "grand": {
      "key": "grand",
      "label": "グランド",
      "initialDelayMs": 6750,
      "loopLapMs": [
        22000,
        24500,
        22250,
        24000,
        22750,
        23500,
        23250,
        23500,
        23250,
        23000,
        23750,
        22500
      ],
      "phases": [
        {
          "currentText": "-",
          "noteText": "虹床",
          "leadParts": [
            "g_niji"
          ],
          "nextParts": [
            "s_tsugi",
            "g_niji",
            "s_loop"
          ]
        },
        {
          "currentText": "外の外（安置）",
          "noteText": "網上・大外",
          "leadParts": [
            "g_amisen_osoto"
          ],
          "nextParts": [
            "s_tsugi",
            "g_amisen_osoto"
          ]
        },
        {
          "currentText": "-",
          "noteText": "虹床",
          "leadParts": [
            "g_niji"
          ],
          "nextParts": [
            "s_tsugi",
            "g_niji"
          ]
        },
        {
          "currentText": "外の外（安置）",
          "noteText": "中央大・外",
          "leadParts": [
            "g_center_large_soto"
          ],
          "nextParts": [
            "s_tsugi",
            "g_center_large_soto"
          ]
        },
        {
          "currentText": "-",
          "noteText": "虹床",
          "leadParts": [
            "g_niji"
          ],
          "nextParts": [
            "s_tsugi",
            "g_niji"
          ]
        },
        {
          "currentText": "大外（ずっと安置）",
          "noteText": "中央、網と線の上",
          "leadParts": [
            "g_center_amisen"
          ],
          "nextParts": [
            "s_tsugi",
            "g_center_amisen"
          ]
        },
        {
          "currentText": "-",
          "noteText": "虹床",
          "leadParts": [
            "g_niji"
          ],
          "nextParts": [
            "s_tsugi",
            "g_niji"
          ]
        },
        {
          "currentText": "線上（安置）",
          "noteText": "網上・大外",
          "leadParts": [
            "g_amisen_osoto"
          ],
          "nextParts": [
            "s_tsugi",
            "g_amisen_osoto"
          ]
        },
        {
          "currentText": "-",
          "noteText": "虹床",
          "leadParts": [
            "g_niji"
          ],
          "nextParts": [
            "s_tsugi",
            "g_niji"
          ]
        },
        {
          "currentText": "網上（安置）",
          "noteText": "網上・線上・外",
          "leadParts": [
            "g_amisen_soto"
          ],
          "nextParts": [
            "s_tsugi",
            "g_amisen_soto"
          ]
        },
        {
          "currentText": "-",
          "noteText": "虹床",
          "leadParts": [
            "g_niji"
          ],
          "nextParts": [
            "s_tsugi",
            "g_niji"
          ]
        },
        {
          "currentText": "外（安置）",
          "noteText": "中央大・線上と外",
          "leadParts": [
            "g_center_senjo_soto"
          ],
          "nextParts": [
            "s_tsugi",
            "g_center_senjo_soto"
          ]
        }
      ]
    }
  }
} as unknown as Record<RuberangisLevel, LevelConfig>

const state: TimerState = {
  level: 3,
  mode: null,
  phaseIndex: -1,
  lapIndex: -1,
  running: false,
  targetPerfMs: 0,
  rafId: 0,
  nextAnnounceTimeoutId: 0,
  leadFired: false,
  countdown3Fired: false,
  fiveSecondsVoiceFired: false,
  lastMetronomeTenths: null,
}

const options = {
  leadSeconds: 7 as 7 | 10,
  playNextVoice: true,
  metronomeInterval: 0 as 0 | 5 | 10,
  voiceVolume: 0.7,
  seVolume: 0.85,
  audioBasePath: '/audio/',
}

let onTickCallback: ((snapshot: RuberangisTimerSnapshot) => void) | null = null
let activeVoiceHowl: Howl | null = null
let activeSeHowl: Howl | null = null
let activeSequenceToken = 0
const howlPool = new Map<string, Howl>()

const nowPerfMs = () => performance.now()

const normalizeBasePath = (value: string) => (
  value.endsWith('/') ? value : `${value}/`
)

const audioPath = (fileName: string) => (
  `${normalizeBasePath(options.audioBasePath)}${fileName}`
)

const getHowl = (src: string, volume = 1) => {
  let sound = howlPool.get(src)

  if (!sound) {
    sound = new Howl({
      src: [src],
      preload: true,
      volume,
    })
    howlPool.set(src, sound)
  }

  return sound
}

const stopAudioPlayback = () => {
  activeSequenceToken += 1

  activeVoiceHowl?.stop()
  activeVoiceHowl = null

  activeSeHowl?.stop()
  activeSeHowl = null
}

const clearTimerLoop = () => {
  if (state.rafId) {
    window.cancelAnimationFrame(state.rafId)
    state.rafId = 0
  }
}

const clearNextAnnounceTimeout = () => {
  if (state.nextAnnounceTimeoutId) {
    window.clearTimeout(state.nextAnnounceTimeoutId)
    state.nextAnnounceTimeoutId = 0
  }
}

const resetAnnouncementFlags = () => {
  state.leadFired = false
  state.countdown3Fired = false
  state.fiveSecondsVoiceFired = false
  state.lastMetronomeTenths = null
}

const getModeConfig = () => {
  if (!state.mode) return null
  return LEVELS[state.level][state.mode]
}

const getPhase = (phaseIndex = state.phaseIndex) => {
  const mode = getModeConfig()
  if (!mode || phaseIndex < 0) return null
  return mode.phases[phaseIndex % mode.phases.length] ?? null
}

const buildAudioFiles = (parts: string[]) => (
  parts
    .map((key) => VOICE_PARTS[key]?.file)
    .filter((file): file is string => Boolean(file))
    .map((file) => audioPath(`${file}.wav`))
)

const playSingleHowl = (src: string, volume: number) => (
  new Promise<void>((resolve) => {
    const sound = getHowl(src, volume)
    activeVoiceHowl = sound

    const id = sound.play()
    sound.volume(volume, id)

    sound.once('end', () => resolve(), id)
    sound.once('playerror', () => resolve(), id)
    sound.once('loaderror', () => resolve(), id)
  })
)

const playHowlSequence = async (files: string[]) => {
  const token = ++activeSequenceToken

  for (const src of files) {
    if (token !== activeSequenceToken) return
    await playSingleHowl(src, options.voiceVolume)
  }

  if (token === activeSequenceToken) {
    activeVoiceHowl = null
  }
}

const playTimeSignal = () => {
  const src = audioPath('timeSignal.mp3')
  const sound = getHowl(src, options.seVolume)
  activeSeHowl = sound
  const id = sound.play()
  sound.volume(options.seVolume, id)
}

const playMetronomeBeep = () => {
  const src = audioPath('metronomeBeep.mp3')
  const volume = options.seVolume * 0.45
  const sound = getHowl(src, volume)
  activeSeHowl = sound
  const id = sound.play()
  sound.volume(volume, id)
}

const playMetronomeChime = () => {
  const src = audioPath('metronomeChime.mp3')
  const volume = options.seVolume * 0.65
  const sound = getHowl(src, volume)
  activeSeHowl = sound
  const id = sound.play()
  sound.volume(volume, id)
}

const handleMetronome = (remainingMs: number) => {
  if (remainingMs <= 3000) return

  const intervalSec = options.metronomeInterval
  if (intervalSec <= 0) return

  const safeMs = Math.max(0, remainingMs)
  const currentTenths = Math.floor(safeMs / 100)

  if (state.lastMetronomeTenths === currentTenths) return
  state.lastMetronomeTenths = currentTenths

  // 整数秒の瞬間だけ鳴らす。
  if (currentTenths % 10 !== 0) return

  const wholeSeconds = currentTenths / 10

  if (wholeSeconds % intervalSec === 0) {
    playMetronomeChime()
    return
  }

  playMetronomeBeep()
}

const playLeadVoice = (phase: TimerPhase | null) => {
  if (!phase) return
  void playHowlSequence(buildAudioFiles(phase.leadParts))
}

const playNextVoice = (phase: TimerPhase | null) => {
  if (!phase || !options.playNextVoice) return
  void playHowlSequence(buildAudioFiles(phase.nextParts))
}

const playFiveSecondsVoice = () => {
  void playHowlSequence(buildAudioFiles(['s_5sec']))
}

const emitTick = (remainingMs: number) => {
  onTickCallback?.({
    level: state.level,
    mode: state.mode,
    running: state.running,
    phaseIndex: state.phaseIndex,
    remainingMs: Math.max(0, remainingMs),
    phase: getPhase(),
  })
}

const goToNextPhase = () => {
  const mode = getModeConfig()
  if (!mode) return

  state.phaseIndex = (state.phaseIndex + 1) % mode.phases.length
  state.lapIndex = (state.lapIndex + 1) % mode.loopLapMs.length

  const durationMs = mode.loopLapMs[state.lapIndex] ?? 0
  state.targetPerfMs = nowPerfMs() + durationMs

  resetAnnouncementFlags()
  emitTick(durationMs)

  state.rafId = window.requestAnimationFrame(tick)
}

function tick() {
  clearTimerLoop()

  if (!state.running || !state.mode) return

  const remainingMs = state.targetPerfMs - nowPerfMs()
  const current = getPhase()

  emitTick(remainingMs)
  handleMetronome(remainingMs)

  const leadMs = options.leadSeconds * 1000
  if (!state.leadFired && remainingMs <= leadMs && remainingMs > 0) {
    playLeadVoice(current)
    state.leadFired = true
  }

  // 旧v2.4.1と同じく「10秒前設定」の時だけ5秒前音声を追加
  if (
    options.leadSeconds === 10 &&
    !state.fiveSecondsVoiceFired &&
    remainingMs <= 5000 &&
    remainingMs > 4000
  ) {
    playFiveSecondsVoice()
    state.fiveSecondsVoiceFired = true
  }

  if (!state.countdown3Fired && remainingMs <= 3000 && remainingMs > 0) {
    playTimeSignal()
    state.countdown3Fired = true
  }

  if (remainingMs <= 0) {
    const mode = getModeConfig()
    const nextIndex = mode
      ? (state.phaseIndex + 1) % mode.phases.length
      : 0

    const nextPhase = mode?.phases[nextIndex] ?? null

    clearNextAnnounceTimeout()

    if (nextPhase && options.playNextVoice) {
      state.nextAnnounceTimeoutId = window.setTimeout(() => {
        playNextVoice(nextPhase)
      }, NEXT_ANNOUNCE_DELAY_MS)
    }

    goToNextPhase()
    return
  }

  state.rafId = window.requestAnimationFrame(tick)
}

/**
 * ルベランギスの強さを変更。
 * タイマー動作中なら安全のため停止してから切り替える。
 */
export const setRuberangisTimerLevel = (level: RuberangisLevel) => {
  if (state.level === level) return
  stopRuberangisTimer()
  state.level = level
}

/**
 * サークル / グランドのタイマーを初回床から開始。
 */
export const startRuberangisTimer = (
  mode: CalamityMode,
  level?: RuberangisLevel,
) => {
  if (level) {
    state.level = level
  }

  stopRuberangisTimer()

  const modeConfig = LEVELS[state.level][mode]

  state.mode = mode
  state.phaseIndex = 0
  state.lapIndex = -1
  state.running = true
  state.targetPerfMs = nowPerfMs() + modeConfig.initialDelayMs

  resetAnnouncementFlags()
  emitTick(modeConfig.initialDelayMs)
  tick()
}

/**
 * タイマー停止・音声停止・内部状態リセット。
 */
export const stopRuberangisTimer = () => {
  clearNextAnnounceTimeout()
  clearTimerLoop()
  stopAudioPlayback()

  state.mode = null
  state.phaseIndex = -1
  state.lapIndex = -1
  state.running = false
  state.targetPerfMs = 0

  resetAnnouncementFlags()
  emitTick(0)
}

/**
 * タイマーを±0.5秒補正。
 * direction=1 で+0.5秒、-1で-0.5秒。
 */
export const adjustRuberangisTimer = (direction: 1 | -1) => {
  if (!state.running) return
  state.targetPerfMs += ADJUST_STEP_MS * direction
}

/**
 * Rotation Sigil側で表示更新したくなった時用。
 * 現段階では表示を作らなくても利用可能。
 */
export const onRuberangisTimerTick = (
  callback: ((snapshot: RuberangisTimerSnapshot) => void) | null,
) => {
  onTickCallback = callback
}

/**
 * 音量・予告秒数などを後から設定画面につなぐための入口。
 */
export const configureRuberangisTimer = (
  next: RuberangisTimerOptions,
) => {
  if (next.leadSeconds !== undefined) {
    options.leadSeconds = next.leadSeconds
  }

  if (next.playNextVoice !== undefined) {
    options.playNextVoice = next.playNextVoice
  }

  if (next.metronomeInterval !== undefined) {
    options.metronomeInterval = next.metronomeInterval
    state.lastMetronomeTenths = null
  }

  if (next.voiceVolume !== undefined) {
    options.voiceVolume = Math.min(1, Math.max(0, next.voiceVolume))
  }

  if (next.seVolume !== undefined) {
    options.seVolume = Math.min(1, Math.max(0, next.seVolume))
  }

  if (next.audioBasePath !== undefined) {
    options.audioBasePath = next.audioBasePath
  }
}

/**
 * 現在状態の取得。
 */
export const getRuberangisTimerSnapshot = (): RuberangisTimerSnapshot => {
  const remainingMs = state.running
    ? state.targetPerfMs - nowPerfMs()
    : 0

  return {
    level: state.level,
    mode: state.mode,
    running: state.running,
    phaseIndex: state.phaseIndex,
    remainingMs: Math.max(0, remainingMs),
    phase: getPhase(),
  }
}
