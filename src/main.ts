import './style.css'

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

type Pattern = {
  id: string
  name: string
  actions: string[]
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('#app が見つかりません')
}

let manifest: Manifest | null = null
let rotationData: RotationData | null = null
let selectedManifestMonsterIndex = 0
let selectedMonsterIndex = 0
let selectedPhaseIndex = 0
let selectedPatternIndex = 0

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

const getCurrentMonster = () => {
  return rotationData?.monsters[selectedMonsterIndex]
}

const getCurrentPhase = () => {
  const monster = getCurrentMonster()
  return monster?.phases[selectedPhaseIndex]
}

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
          
        </p>public/data/manifest.json と public/data/monsters/*.json が存在するか、JSONのカンマ抜けなどがないか確認してください。
      </section>
    </main>
  `
}

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

  const patternTabsHtml = phase.patterns
    .map((patternItem, index) => {
      const isActive = index === selectedPatternIndex ? ' active' : ''

      return `
        <button class="tab pattern-tab${isActive}" type="button" data-pattern-index="${index}">
          <span class="tab-id">${escapeHtml(patternItem.id)}</span>
          ${escapeHtml(patternItem.name)}
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
          return `
            <li>
              <span class="action-index">${actionIndex + 1}</span>
              <span class="action-text">${highlightKeywords(action, monster.keywords)}</span>
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

  app.innerHTML = `
    <main class="app">
      <header class="app-header">
        <p class="eyebrow">Rotation Sigil</p>
        <p class="subtitle">ボスローテーション確認ツール</p>
      </header>

      <section class="panel">
        <div class="monster-header">
          <div>
            <h2>${escapeHtml(monster.name)}${levelText}</h2>
            <p class="version">Data version: ${escapeHtml(rotationData.version)}</p>
          </div>

          <label class="monster-select-label">
            <span>ボス選択</span>
            <select class="monster-select" data-monster-select>
              ${monsterOptionsHtml}
            </select>
          </label>
        </div>

        <section class="control-section">
          <h3>HP段階</h3>
          <div class="tabs phase-tabs">
            ${phaseTabsHtml}
          </div>
        </section>

        <section class="control-section">
          <h3>ローテ / モード</h3>
          <div class="tabs pattern-tabs">
            ${patternTabsHtml}
          </div>
        </section>

        <section class="list-panel">
          <div class="list-header">
            <p class="current-phase">${escapeHtml(phase.name)}</p>
            <h3>
              <span class="desktop-title">一覧モード</span>
              <span class="mobile-title">選択中ローテ</span>
            </h3>
          </div>

          <div class="rotation-list-grid">
            ${rotationCardsHtml}
          </div>
        </section>
      </section>
    </main>
  `

  bindEvents()
}

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

const bindEvents = () => {
  const phaseButtons = document.querySelectorAll<HTMLButtonElement>('[data-phase-index]')
  const patternButtons = document.querySelectorAll<HTMLButtonElement>('[data-pattern-index]')
  const patternCards = document.querySelectorAll<HTMLElement>('[data-pattern-card-index]')
  const monsterSelect = document.querySelector<HTMLSelectElement>('[data-monster-select]')

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

    await loadSelectedMonster()
  })
}

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
    selectedManifestMonsterIndex = 0

    await loadSelectedMonster()
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラー'
    renderError(message)
  }
}

loadRotationData()