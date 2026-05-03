import './style.css'
import { getCurrentWindow } from '@tauri-apps/api/window'

// ===== 1. 型定義 =====
// manifest.json / monster json の構造を定義する。
// 画面描画・データ読み込み・キーワード色分けで参照する。

type Manifest = {
  monsters: ManifestMonster[]
}

type ManifestMonster = {
  id: string
  name: string
  path: string
}

type RotationData = {
  version: string
  monsters: Monster[]
}

type Monster = {
  id: string
  name: string
  level?: string
  keywords?: Keyword[]
  phases: Phase[]
}

type Keyword = {
  text: string
  style: string
}

type Phase = {
  id: string
  name: string
  patterns: Pattern[]
}

type Action =
  | string
  | {
      text: string
      mark?: string
    }

type Pattern = {
  id: string
  name: string
  tag: string
  actions: Action[]
}



// ===== 2. DOM / 実行環境 =====
// 画面の描画先を取得する。
// Tauriアプリとして起動している場合だけ body.overlay を付け、オーバーレイ専用CSSを有効化する。
const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('#app が見つかりません')
}

const isTauri = '__TAURI_INTERNALS__' in window

if (isTauri) {
  document.documentElement.classList.add('overlay')
  document.body.classList.add('overlay')
}

const appWindow = isTauri ? getCurrentWindow() : null

// ===== 3. アプリ情報 =====
// 配布時に画面へ表示するアプリ本体のバージョン。
// package.json / tauri.conf.json の version と合わせて更新する。
const APP_VERSION = 'v0.1.2'

let manifest: Manifest | null = null
let rotationData: RotationData | null = null
let selectedManifestMonsterIndex = 0
let selectedMonsterIndex = 0
let selectedPhaseIndex = 0
let selectedPatternIndex = 0
let isSettingsOpen = false
let overlayOpacity = 50
let isVoiceEnabled = false
let isDecorated = true

// ===== 4. 保存設定 localStorage =====
// 現時点では「前回選んだボス」だけ保存する。
// HP段階・ローテは、ボスごとの差異で混乱しやすいため保存しない。

const STORAGE_KEYS = {
  monsterId: 'rotation-sigil:selectedMonsterId',
  overlayOpacity: 'rotation-sigil:overlayOpacity',
  voiceEnabled: 'rotation-sigil:voiceEnabled',
  decorated: 'rotation-sigil:decorated'
}

const getSavedDecorated = () => {
  const saved = localStorage.getItem(STORAGE_KEYS.decorated)

  if (saved === null) {
    return false
  }

  return saved === 'true'
}

const getSavedOverlayOpacity = () => {
  const value = Number(localStorage.getItem(STORAGE_KEYS.overlayOpacity) ?? '50')
  return clampOpacity(value)
}

const getSavedVoiceEnabled = () => {
  return localStorage.getItem(STORAGE_KEYS.voiceEnabled) === 'true'
}

const getSavedMonsterId = () => {
  return localStorage.getItem(STORAGE_KEYS.monsterId)
}

const saveSelectedMonsterId = () => {
  const selectedManifestMonster = manifest?.monsters[selectedManifestMonsterIndex]

  if (!selectedManifestMonster) {
    return
  }

  localStorage.setItem(STORAGE_KEYS.monsterId, selectedManifestMonster.id)
}

const findManifestMonsterIndexById = (monsterId: string | null) => {
  if (!manifest || !monsterId) {
    return 0
  }

  const index = manifest.monsters.findIndex((monster) => monster.id === monsterId)

  return index >= 0 ? index : 0
}

// ===== 5. 表示用ユーティリティ =====
// HTML文字列へ安全に埋め込むためのエスケープ処理と、JSON側のkeywordsに基づく色分け処理。

const escapeHtml = (value: string) => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const highlightKeywords = (value: string, keywords: Keyword[] = []) => {
  let result = escapeHtml(value)

  keywords.forEach(({ text, style }) => {
    const escapedKeyword = escapeHtml(text)
    const className = `keyword-${escapeHtml(style)}`

    result = result.replaceAll(
      escapedKeyword,
      `<span class="keyword ${className}">${escapedKeyword}</span>`,
    )
  })

  return result
}

const getActionText = (action: Action) => {
  if (typeof action === 'string') {
    return action
  }

  return action.text
}

const getActionMark = (action: Action, index: number) => {
  if (typeof action === 'string') {
    return String(index + 1)
  }

  return action.mark ?? String(index + 1)
}

const clampOpacity = (value: number) => {
  return Math.min(100, Math.max(0, value))
}

const applyOverlayOpacity = () => {
  const value = clampOpacity(overlayOpacity)
  const ratio = value / 100

  const shellBg = 0.01 + ratio * 0.17
  const panelBg = 0.04 + ratio * 0.46
  const cardBg = 0.08 + ratio * 0.52
  const rowBg = 0.16 + ratio * 0.68

  const titlebarBg = 0.08 + ratio * 0.42
  const controlBg = 0.16 + ratio * 0.60
  const controlActiveBg = 0.32 + ratio * 0.48
  const controlHoverBg = 0.42 + ratio * 0.42

  document.body.style.setProperty('--overlay-shell-bg', shellBg.toFixed(2))
  document.body.style.setProperty('--overlay-panel-bg', panelBg.toFixed(2))
  document.body.style.setProperty('--overlay-card-bg', cardBg.toFixed(2))
  document.body.style.setProperty('--overlay-row-bg', rowBg.toFixed(2))

  document.body.style.setProperty('--overlay-titlebar-bg', titlebarBg.toFixed(2))
  document.body.style.setProperty('--overlay-control-bg', controlBg.toFixed(2))
  document.body.style.setProperty('--overlay-control-active-bg', controlActiveBg.toFixed(2))
  document.body.style.setProperty('--overlay-control-hover-bg', controlHoverBg.toFixed(2))
}

const applyDecorations = async () => {
  document.body.classList.toggle('decorations-off', !isDecorated)

  if (!appWindow) {
    return
  }

  try {
    await appWindow.setDecorations(isDecorated)
  } catch (error) {
    console.error('標準タイトルバーの切り替えに失敗しました', error)
  }
}

// ===== 6. 現在選択中データの取得 =====
// selected〜Index をもとに、現在表示対象のモンスター・HP段階を取得する。

const getCurrentMonster = () => {
  return rotationData?.monsters[selectedMonsterIndex]
}

const getCurrentPhase = () => {
  const monster = getCurrentMonster()
  return monster?.phases[selectedPhaseIndex]
}

// ===== 7. 描画：ローディング / エラー =====
// 初期読み込み中・データ読み込み失敗時の画面を描画する。

const renderLoading = () => {
  app.innerHTML = `
    <main class="app">
      <header class="app-header">
        <p class="eyebrow">Rotation Sigil</p>
        <p class="subtitle">ローテ表を読み込み中...</p>
      </header>
    </main>
  `
}

const renderError = (message: string) => {
  app.innerHTML = `
    <main class="app">
      <header class="app-header">
        <p class="eyebrow">Rotation Sigil</p>
        <p class="subtitle error">読み込みに失敗しました</p>
      </header>

      <section class="panel">
        <h2>エラー</h2>
        <p>${escapeHtml(message)}</p>
        <p class="hint">
          public/data/manifest.json と public/data/monsters/*.json が存在するか、JSONのカンマ抜けなどがないか確認してください。
        </p>
      </section>
    </main>
  `
}

// ===== 8. 描画：メイン画面 =====
// 現在選択中のボス・HP段階・ローテをもとに、タブ・ローテカード・ボス選択を描画する。
// Web版では一覧表示、スマホ/TauriではCSS側で選択中ローテのみ表示する。

const renderApp = () => {
  if (!rotationData) {
    renderError('rotationData が空です')
    return
  }

  const monster = getCurrentMonster()

  if (!monster) {
    renderError('monster が見つかりません')
    return
  }

  const phase = getCurrentPhase()

  if (!phase) {
    renderError('phase が見つかりません')
    return
  }

  const levelText = monster.level ? ` ${escapeHtml(monster.level)}` : ''

  const monsterOptionsHtml = manifest?.monsters
  .map((manifestMonster, index) => {
    const selected = index === selectedManifestMonsterIndex ? ' selected' : ''

    return `
      <option value="${index}"${selected}>
        ${escapeHtml(manifestMonster.name)}
      </option>
    `
  })
  .join('') ?? ''

  const phaseTabsHtml = monster.phases
    .map((phaseItem, index) => {
      const isActive = index === selectedPhaseIndex ? ' active' : ''
      const phaseClass = ` phase-${phaseItem.id}`

      return `
        <button class="tab phase-tab${phaseClass}${isActive}" type="button" data-phase-index="${index}">
          ${escapeHtml(phaseItem.name)}
        </button>
      `
    })
    .join('')

  const rotationCardsHtml = phase.patterns
    .map((pattern, patternIndex) => {
      const isActive = patternIndex === selectedPatternIndex ? ' active' : ''
      const isSpecial = patternIndex >= 3 || pattern.id === 'prison' ? ' special' : ''

  const actionsHtml = pattern.actions
    .map((action, actionIndex) => {
      const actionMark = getActionMark(action, actionIndex)
      const actionText = getActionText(action)

      return `
        <li>
          <span class="action-index">${escapeHtml(actionMark)}</span>
          <span class="action-text">${highlightKeywords(actionText, monster.keywords)}</span>
        </li>
      `
    })
    .join('')

      return `
        <article class="rotation-card${isActive}${isSpecial}" data-pattern-card-index="${patternIndex}">
          <div class="rotation-card-header">
            <span class="tab-id">${escapeHtml(pattern.id)}</span>
            <h4>${escapeHtml(pattern.name)}</h4>
          </div>

          <ol class="action-list compact">
            ${actionsHtml}
          </ol>
        </article>
      `
    })
    .join('')

const settingsPanelHtml = isSettingsOpen
  ? `
    <section class="settings-panel">
      <div class="settings-header">
        <h3>設定</h3>
        <button class="settings-close-button" type="button" data-settings-close>
          ×
        </button>
      </div>

      <div class="settings-body">
        <p class="settings-note">
          Rotation Sigil ${APP_VERSION}
        </p>
        <label class="settings-field">
          <span>不透明度</span>
          <input
            type="range"
            min="0"
            max="100"
            value="${overlayOpacity}"
            data-opacity-slider
          >
      </label>

      <label class="settings-check">
        <input
          type="checkbox"
          ${isDecorated ? 'checked' : ''}
          data-decorations-toggle
        >
        <span>標準タイトルバーを表示（非常用）</span>
      </label>

        <p class="settings-note">
            標準タイトルバー表示は、自作バーで移動・終了ができなくなった場合の退避用です。
        </p>
      </div>
    </section>
  `
  : ''

  app.innerHTML = `
    <main class="app">
  ${!isDecorated ? `
    <div class="custom-titlebar">
      <div class="custom-titlebar-drag" data-custom-titlebar data-tauri-drag-region>
        <span class="custom-titlebar-title">Rotation Sigil</span>
      </div>

      <div class="custom-titlebar-tools">
        <select class="custom-titlebar-select" data-monster-select>
          ${monsterOptionsHtml}
        </select>

        <button
          class="custom-titlebar-icon-button"
          type="button"
          data-settings-open
          aria-label="設定"
        >
          ⚙
        </button>

        <button
          class="custom-titlebar-icon-button"
          type="button"
          data-window-minimize
          aria-label="最小化"
        >
          −
        </button>

        <button
          class="custom-titlebar-icon-button custom-titlebar-close-button"
          type="button"
          data-window-close
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
    </div>
  ` : ''}

      <header class="app-header">
        <p class="eyebrow">Rotation Sigil</p>
        <p class="subtitle">ボスローテーション確認ツール / ${APP_VERSION}</p>
      </header>

      <section class="panel">
        <div class="monster-header">
          <div>
            <h2>${escapeHtml(monster.name)}${levelText}</h2>
            <p class="version">Data version: ${escapeHtml(rotationData.version)}</p>
          </div>

          ${isDecorated ? `
          <div class="monster-tools">
            <label class="monster-select-label">
              <span>ボス選択</span>
              <select class="monster-select" data-monster-select>
                ${monsterOptionsHtml}
              </select>
            </label>

            <button class="settings-open-button" type="button" data-settings-open>
              ⚙ 設定
            </button>
          </div>
        ` : ''}
        </div>
        <section class="list-panel">
          <div class="list-header phase-header">
            <div class="tabs phase-tabs phase-tabs-inline">
              ${phaseTabsHtml}
            </div>
          </div>

          <div class="rotation-list-grid">
            ${rotationCardsHtml}
          </div>
        </section>

        ${settingsPanelHtml}

      </section>
    </main>
  `

  bindEvents()
}

// ===== 9. スマホ用スクロール補助 =====
// スマホ表示でローテ切替時に表示位置を補正する。
// Tauri overlayでは位置固定を優先するため、必要に応じて無効化する。

const scrollToRotationPanel = () => {
  if (!window.matchMedia('(max-width: 720px)').matches) {
    return
  }

  const panel = document.querySelector<HTMLElement>('.list-panel')

  if (!panel) {
    return
  }

  panel.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

// ===== 9.5 ショートカット ======
const movePhase = (direction: 1 | -1) => {
  const monster = getCurrentMonster()

  if (!monster) {
    return
  }

  selectedPhaseIndex =
    (selectedPhaseIndex + direction + monster.phases.length) % monster.phases.length

  selectedPatternIndex = 0

  renderApp()
}

const movePattern = (direction: 1 | -1) => {
  const phase = getCurrentPhase()

  if (!phase) {
    return
  }

  selectedPatternIndex =
    (selectedPatternIndex + direction + phase.patterns.length) % phase.patterns.length

  renderApp()
}

window.addEventListener('keydown', async (event) => {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    isDecorated = !isDecorated
    localStorage.setItem(STORAGE_KEYS.decorated, String(isDecorated))
    await applyDecorations()
    renderApp()
    return
  }

  const target = event.target

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return
  }

  if (event.ctrlKey && event.key === ',') {
    event.preventDefault()
    isSettingsOpen = !isSettingsOpen
    renderApp()
    return
  }

  if (event.key === '@') {
    event.preventDefault()
    movePhase(-1)
    return
  }

  if (event.key === '[') {
    event.preventDefault()
    movePhase(1)
    return
  }

  if (event.key === ',') {
    event.preventDefault()
    movePattern(-1)
    return
  }

  if (event.key === '.') {
    event.preventDefault()
    movePattern(1)
  }
})

// ===== 10. イベント設定 =====
// HP段階ボタン、ローテボタン、ローテカード、ボス選択セレクトの操作を設定する。

const bindEvents = () => {
  const phaseButtons = document.querySelectorAll<HTMLButtonElement>('[data-phase-index]')
  const patternButtons = document.querySelectorAll<HTMLButtonElement>('[data-pattern-index]')
  const patternCards = document.querySelectorAll<HTMLElement>('[data-pattern-card-index]')
  const monsterSelect = document.querySelector<HTMLSelectElement>('[data-monster-select]')
  const settingsOpenButton = document.querySelector<HTMLButtonElement>('[data-settings-open]')
  const settingsCloseButton = document.querySelector<HTMLButtonElement>('[data-settings-close]')
  const opacitySlider = document.querySelector<HTMLInputElement>('[data-opacity-slider]')
  const voiceToggle = document.querySelector<HTMLInputElement>('[data-voice-toggle]')
  const decorationsToggle = document.querySelector<HTMLInputElement>('[data-decorations-toggle]')
  const windowMinimizeButton = document.querySelector<HTMLButtonElement>('[data-window-minimize]')
  const windowCloseButton = document.querySelector<HTMLButtonElement>('[data-window-close]')

  windowMinimizeButton?.addEventListener('click', async () => {
    await appWindow?.minimize()
  })

  windowCloseButton?.addEventListener('click', async () => {
    await appWindow?.close()
  })

  decorationsToggle?.addEventListener('change', async () => {
    isDecorated = decorationsToggle.checked
    localStorage.setItem(STORAGE_KEYS.decorated, String(isDecorated))
    await applyDecorations()
  })

  opacitySlider?.addEventListener('input', () => {
    overlayOpacity = clampOpacity(Number(opacitySlider.value))
    localStorage.setItem(STORAGE_KEYS.overlayOpacity, String(overlayOpacity))
    applyOverlayOpacity()
  })

  voiceToggle?.addEventListener('change', () => {
    isVoiceEnabled = voiceToggle.checked
    localStorage.setItem(STORAGE_KEYS.voiceEnabled, String(isVoiceEnabled))
  })

  settingsOpenButton?.addEventListener('click', () => {
    isSettingsOpen = true
    renderApp()
  })

  settingsCloseButton?.addEventListener('click', () => {
    isSettingsOpen = false
    renderApp()
  })
  phaseButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const phaseIndex = Number(button.dataset.phaseIndex)

      if (Number.isNaN(phaseIndex)) {
        return
      }

      selectedPhaseIndex = phaseIndex
      selectedPatternIndex = 0
      renderApp()
    })
  })

  patternButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const patternIndex = Number(button.dataset.patternIndex)

      if (Number.isNaN(patternIndex)) {
        return
      }

      selectedPatternIndex = patternIndex
      renderApp()
      setTimeout(scrollToRotationPanel, 0)
    })
  })

  patternCards.forEach((card) => {
    card.addEventListener('click', () => {
      const patternIndex = Number(card.dataset.patternCardIndex)

      if (Number.isNaN(patternIndex)) {
        return
      }

      selectedPatternIndex = patternIndex
      renderApp()
    })
  })

  monsterSelect?.addEventListener('change', async () => {
    const nextIndex = Number(monsterSelect.value)

    if (Number.isNaN(nextIndex)) {
      return
    }

    selectedManifestMonsterIndex = nextIndex
    selectedMonsterIndex = 0
    selectedPhaseIndex = 0
    selectedPatternIndex = 0
    saveSelectedMonsterId()

    await loadSelectedMonster()
  })
}

// ===== 11. データ読み込み：選択中ボス =====
// manifest の selectedManifestMonsterIndex をもとに、対象ボスのJSONを読み込む。

const loadSelectedMonster = async () => {
  if (!manifest) {
    renderError('manifest が読み込まれていません')
    return
  }

  const selectedManifestMonster = manifest.monsters[selectedManifestMonsterIndex]

  if (!selectedManifestMonster) {
    renderError('選択されたボスが見つかりません')
    return
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${selectedManifestMonster.path}`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = (await response.json()) as RotationData

    if (!data.monsters || data.monsters.length === 0) {
      throw new Error('monsters が空です')
    }

    rotationData = data
    selectedMonsterIndex = 0
    selectedPhaseIndex = 0
    selectedPatternIndex = 0

    renderApp()
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラー'
    renderError(message)
  }
}

// ===== 12. データ読み込み：manifest =====
// ボス一覧 manifest.json を読み込み、前回保存されたモンスターIDがあればそれを初期選択にする。

const loadRotationData = async () => {
  renderLoading()

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/manifest.json`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = (await response.json()) as Manifest

    if (!data.monsters || data.monsters.length === 0) {
      throw new Error('manifest の monsters が空です')
    }

    manifest = data
    selectedManifestMonsterIndex = findManifestMonsterIndexById(getSavedMonsterId())

    await loadSelectedMonster()
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラー'
    renderError(message)
  }
}

// ===== 13. 起動 =====
// アプリ起動時にmanifest読み込みを開始する。

overlayOpacity = getSavedOverlayOpacity()
isVoiceEnabled = getSavedVoiceEnabled()
isDecorated = getSavedDecorated()

applyOverlayOpacity()
applyDecorations()
loadRotationData()
