/** Format a game-time in seconds-since-midnight as HH:MM:SS (24h, de-AT). */
export function formatGameTime(secondsSinceMidnight: number): string {
  const s = Math.floor(((secondsSinceMidnight % 86400) + 86400) % 86400)
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Format seconds as M:SS countdown (e.g. Hilfsfrist timer). */
export function formatCountdown(seconds: number): string {
  const neg = seconds < 0
  const s = Math.abs(Math.floor(seconds))
  const mm = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${neg ? '-' : ''}${mm}:${ss}`
}

/**
 * Short radio call sign without the federal-state prefix "5.".
 * GAME_DATA §10c: spoken form is "20-322", not "5.20-322".
 */
export function shortCallSign(funkrufname: string): string {
  return funkrufname.replace(/^5\./, '')
}
