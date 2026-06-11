/**
 * TTS via Web Speech API (AI_CALLER_TECH §TTS Stufe 1): prefers a de-AT voice,
 * falls back to any German voice. No-ops when speechSynthesis is unavailable.
 */

let enabled = false

export function setTtsEnabled(v: boolean) {
  enabled = v
  if (!v && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

export function isTtsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!isTtsAvailable()) return null
  const voices = speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === 'de-AT') ??
    voices.find((v) => v.lang.startsWith('de')) ??
    null
  )
}

export function speakCaller(text: string) {
  if (!enabled || !isTtsAvailable()) return
  const utterance = new SpeechSynthesisUtterance(text.replace(/[☎🎧ℹ()]/gu, ''))
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  utterance.lang = voice?.lang ?? 'de-AT'
  utterance.rate = 1.05
  speechSynthesis.speak(utterance)
}
