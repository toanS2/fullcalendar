import { elementClosest, Emitter, PointerDragEvent } from '@fullcalendar/common'

const KEY_META = 'Meta'
// const KEY_CONTROL = 'Control'
const KEY_C = 'c'
const KEY_V = 'v'
const KEY_D = 'd'
const KEY_X = 'x'

const allowKeyboard = [KEY_META, KEY_C, KEY_V, KEY_D, KEY_X]

export class PointerTracking {
  containerEl: EventTarget
  subjectEl: HTMLElement | null = null
  emitter: Emitter<any>

  pressedMetaKey: boolean = false
  listKey = {}
  fixedBehaviorLoop = {}

  lastPoint = null

  isMac = navigator.userAgent.includes('Mac')

  // options that can be directly assigned by caller
  selector: string = '' // will cause subjectEl in all emitted events to be this element
  handleSelector: string = ''
  shouldIgnoreMove: boolean = false
  shouldWatchScroll: boolean = true // for simulating pointermove on scroll

  // internal states
  origPageX: number
  origPageY: number

  constructor(containerEl: EventTarget) {
    this.containerEl = containerEl
    this.emitter = new Emitter()
    containerEl.addEventListener('mousemove', this.handleMouseMove)
    document.body.addEventListener('keydown', this.handleKeyDown, false)
    document.body.addEventListener('keyup', this.handleKeyUp, false)
  }

  destroy() {
    this.containerEl.removeEventListener('mousemove', this.handleMouseMove)
    document.body.removeEventListener('keydown', this.handleKeyDown, false)
    document.body.removeEventListener('keyup', this.handleKeyUp, false)
  }

  tryStart = (ev: UIEvent): boolean => {
    let subjectEl = this.querySubjectEl(ev)
    let downEl = ev.target as HTMLElement

    if (
      subjectEl &&
      (!this.handleSelector || elementClosest(downEl, this.handleSelector))
    ) {
      this.subjectEl = subjectEl
      return true
    }

    return false
  }

  cleanup() {
    this.subjectEl = null
  }

  querySubjectEl(ev: UIEvent): HTMLElement {
    if (this.selector) {
      return elementClosest(ev.target as HTMLElement, this.selector)
    }
    return this.containerEl as HTMLElement
  }

  // Keyboard
  // ----------------------------------------------------------------------------------------------------
  handleKeyDown = (ev: KeyboardEvent) => {
    if (allowKeyboard.includes(ev.key)) {
      this.listKey[ev.code] = ev
    }
    this.checkPrimaryKey()
    this.handleCopyPaste(ev)
  }

  handleKeyUp = (ev: KeyboardEvent) => {
    if (allowKeyboard.includes(ev.key)) {
      delete this.listKey[ev.code]
    }
    this.checkPrimaryKey()
    delete this.fixedBehaviorLoop[ev.key]
    if (ev.key === KEY_META) {
      this.fixedBehaviorLoop = {}
    }
  }

  checkPrimaryKey = () => {
    this.pressedMetaKey = false
    Object.values(this.listKey).forEach((value: KeyboardEvent) => {
      if (value.key === KEY_META) {
        this.pressedMetaKey = true
      }
    })
  }

  handleCopyPaste = (event: KeyboardEvent) => {
    // for MacOS or Window keyboard
    if (this.lastPoint && (this.isMac && this.pressedMetaKey || !this.isMac && event.ctrlKey)) {
      if (event.key === KEY_C) {
        this.handleCopy()
      } else if (event.key === KEY_V) {
        this.handlePaste()
      } else if (event.key === KEY_X) {
        this.handleCut()
      } else if (event.key === KEY_D) {
        this.handleDuplicate()
      }
    }
  }

  handleCopy = () => {
    if (this.fixedBehaviorLoop[KEY_C])
      return

    this.fixedBehaviorLoop[KEY_C] = true

    if (this.tryStart(this.lastPoint)) {
      let pev = this.createEventFromMouse(this.lastPoint, true)
      this.emitter.trigger('pointer-copy', pev)
    }
  }

  handlePaste = () => {
    if (this.fixedBehaviorLoop[KEY_V])
      return

    this.fixedBehaviorLoop[KEY_V] = true
    this.emitter.trigger('pointer-paste', this.createEventFromMouse(this.lastPoint))
  }

  handleCut = () => {
    if (this.fixedBehaviorLoop[KEY_X])
      return

    this.fixedBehaviorLoop[KEY_X] = true

    if (this.tryStart(this.lastPoint)) {
      let pev = this.createEventFromMouse(this.lastPoint, true)
      this.emitter.trigger('pointer-cut', pev)
    }
  }

  handleDuplicate = () => {
    if (this.fixedBehaviorLoop[KEY_D])
      return

    this.fixedBehaviorLoop[KEY_D] = true

    this.emitter.trigger('pointer-duplicate', this.lastPoint)
  }

  handleMouseMove = (ev: MouseEvent) => {
    this.lastPoint = ev
  }

  // Event Normalization
  // ----------------------------------------------------------------------------------------------------

  createEventFromMouse(ev: MouseEvent, isFirst?: boolean): PointerDragEvent {
    let deltaX = 0
    let deltaY = 0

    // TODO: repeat code
    if (isFirst) {
      this.origPageX = ev.pageX
      this.origPageY = ev.pageY
    } else {
      deltaX = ev.pageX - this.origPageX
      deltaY = ev.pageY - this.origPageY
    }

    return {
      origEvent: ev,
      isTouch: false,
      subjectEl: this.subjectEl,
      pageX: ev.pageX,
      pageY: ev.pageY,
      deltaX,
      deltaY
    }
  }

  createEventFromTouch(ev: TouchEvent, isFirst?: boolean): PointerDragEvent {
    let touches = ev.touches
    let pageX
    let pageY
    let deltaX = 0
    let deltaY = 0

    // if touch coords available, prefer,
    // because FF would give bad ev.pageX ev.pageY
    if (touches && touches.length) {
      pageX = touches[0].pageX
      pageY = touches[0].pageY
    } else {
      pageX = (ev as any).pageX
      pageY = (ev as any).pageY
    }

    // TODO: repeat code
    if (isFirst) {
      this.origPageX = pageX
      this.origPageY = pageY
    } else {
      deltaX = pageX - this.origPageX
      deltaY = pageY - this.origPageY
    }

    return {
      origEvent: ev,
      isTouch: true,
      subjectEl: this.subjectEl,
      pageX,
      pageY,
      deltaX,
      deltaY
    }
  }
}