import { useEffect } from 'react'
import { TUTORIAL_STEPS, useTutorialStore } from '../state/tutorialStore.ts'
import './tutorial-overlay.css'

export function TutorialOverlay() {
  const active = useTutorialStore((s) => s.active)
  const stepIndex = useTutorialStore((s) => s.stepIndex)
  const step = TUTORIAL_STEPS[stepIndex]

  // auto-advance when the step condition is met
  useEffect(() => {
    if (!active || !step?.done) return
    const timer = setInterval(() => {
      if (step.done!()) useTutorialStore.getState().next()
    }, 400)
    return () => clearInterval(timer)
  }, [active, step])

  if (!active || !step) return null

  return (
    <div className="tutorial-overlay" role="status" data-testid="tutorial-overlay">
      <div className="tutorial-progress mono">
        Tutorial {stepIndex + 1}/{TUTORIAL_STEPS.length}
      </div>
      <p className="tutorial-text">{step.text}</p>
      <div className="tutorial-actions">
        {!step.done && (
          <button className="tutorial-next" onClick={() => useTutorialStore.getState().next()}>
            {stepIndex === TUTORIAL_STEPS.length - 1 ? 'Tutorial abschließen' : 'Weiter'}
          </button>
        )}
        {step.done && <span className="tutorial-waiting">… warte auf deine Aktion</span>}
        <button onClick={() => useTutorialStore.getState().stop()}>Tutorial beenden</button>
      </div>
    </div>
  )
}
