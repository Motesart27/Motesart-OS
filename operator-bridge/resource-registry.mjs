// Tracks every timer, child process, and abort controller a worker creates so
// that every exit path — success, failure, signal, timeout, abnormal — leaves
// no live handle behind. cleanup() is idempotent and returns what it closed
// so the counts can be recorded in exit evidence.

export class ResourceRegistry {
  constructor({ clock = () => Date.now() } = {}) {
    this.clock = clock
    this.timers = new Set()
    this.children = new Set()
    this.controllers = new Set()
    this._cleaned = false
  }

  trackTimer(timer) {
    if (this._cleaned) {
      clearTimeout(timer)
      clearInterval(timer)
      return timer
    }
    this.timers.add(timer)
    return timer
  }

  untrackTimer(timer) {
    this.timers.delete(timer)
  }

  trackChild(child) {
    if (!child || typeof child.kill !== 'function') throw new TypeError('INVALID_CHILD_HANDLE')
    if (this._cleaned) {
      child.kill('SIGKILL')
      return child
    }
    this.children.add(child)
    child.once?.('close', () => this.children.delete(child))
    return child
  }

  untrackChild(child) {
    this.children.delete(child)
  }

  trackController(controller) {
    if (this._cleaned) {
      controller.abort()
      return controller
    }
    this.controllers.add(controller)
    return controller
  }

  untrackController(controller) {
    this.controllers.delete(controller)
  }

  counts() {
    return {
      timers: this.timers.size,
      children: this.children.size,
      controllers: this.controllers.size,
    }
  }

  async cleanup({ killGraceMs = 1_000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
    const cleared = { timers_cleared: 0, children_terminated: 0, controllers_aborted: 0 }
    for (const timer of this.timers) {
      clearTimeout(timer)
      clearInterval(timer)
      cleared.timers_cleared += 1
    }
    this.timers.clear()
    for (const controller of this.controllers) {
      try {
        controller.abort()
        cleared.controllers_aborted += 1
      } catch { /* already settled */ }
    }
    this.controllers.clear()
    const liveChildren = [...this.children].filter((child) => child.exitCode === null && child.signalCode === null)
    for (const child of liveChildren) {
      try {
        child.kill('SIGTERM')
      } catch { /* already gone */ }
    }
    if (liveChildren.length && killGraceMs > 0) await sleep(killGraceMs)
    for (const child of [...this.children]) {
      if (child.exitCode === null && child.signalCode === null) {
        try {
          child.kill('SIGKILL')
        } catch { /* already gone */ }
      }
      this.children.delete(child)
      cleared.children_terminated += 1
    }
    this._cleaned = true
    return cleared
  }
}
