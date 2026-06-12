/**
 * One-time build-time geocoding via Nominatim (CLAUDE.md §2 allows
 * "Nominatim-Export zur Buildzeit" — never a live API at runtime).
 * Prints corrected coordinates for stations/hospitals/heliports to paste
 * into the data JSONs. Rate-limited to 1 req/s per Nominatim policy.
 *
 * Usage: npx tsx scripts/geocode.ts
 */

const QUERIES: { id: string; q: string }[] = [
  // Krankenhäuser
  { id: 'kh:lkh', q: 'Landeskrankenhaus, Müllner Hauptstraße 48, Salzburg, Österreich' },
  { id: 'kh:cdk', q: 'Christian-Doppler-Klinik, Ignaz-Harrer-Straße 79, Salzburg, Österreich' },
  { id: 'kh:ukh', q: 'Unfallkrankenhaus Salzburg, Dr.-Franz-Rehrl-Platz 5, Salzburg, Österreich' },
  { id: 'kh:ksk', q: 'Kardinal Schwarzenberg Klinikum, Schwarzach im Pongau, Österreich' },
  { id: 'kh:hallein', q: 'Krankenhaus Hallein, Bürgermeisterstraße, Hallein, Österreich' },
  { id: 'kh:zell', q: 'Tauernklinikum, Paracelsusstraße, Zell am See, Österreich' },
  { id: 'kh:mittersill', q: 'Krankenhaus Mittersill, Österreich' },
  { id: 'kh:stveit', q: 'Landesklinik St. Veit im Pongau, Österreich' },
  { id: 'kh:tamsweg', q: 'Krankenhaus Tamsweg, Österreich' },
  { id: 'kh:oberndorf', q: 'Krankenhaus Oberndorf bei Salzburg, Österreich' },
  { id: 'kh:bbr', q: 'Krankenhaus Barmherzige Brüder, Kajetanerplatz, Salzburg, Österreich' },
  { id: 'kh:bkh-stjohann-tirol', q: 'Bezirkskrankenhaus St. Johann in Tirol, Österreich' },
  // Dienststellen (Rotes Kreuz, sonst Ortszentrum)
  { id: 'st:stadt', q: 'Rotes Kreuz, Dr.-Karl-Renner-Straße 7, Salzburg, Österreich' },
  { id: 'st:mattsee', q: 'Rotes Kreuz, Mattsee, Österreich' },
  { id: 'st:hof', q: 'Rotes Kreuz, Hof bei Salzburg, Österreich' },
  { id: 'st:lamprechtshausen', q: 'Rotes Kreuz, Lamprechtshausen, Österreich' },
  { id: 'st:oberndorf', q: 'Rotes Kreuz, Oberndorf bei Salzburg, Österreich' },
  { id: 'st:strasswalchen', q: 'Rotes Kreuz, Straßwalchen, Österreich' },
  { id: 'st:seekirchen', q: 'Rotes Kreuz, Seekirchen am Wallersee, Österreich' },
  { id: 'st:strobl', q: 'Rotes Kreuz, Strobl, Österreich' },
  { id: 'st:hallein', q: 'Rotes Kreuz, Hallein, Österreich' },
  { id: 'st:golling', q: 'Rotes Kreuz, Golling an der Salzach, Österreich' },
  { id: 'st:abtenau', q: 'Rotes Kreuz, Abtenau, Österreich' },
  { id: 'st:zell', q: 'Rotes Kreuz, Zell am See, Österreich' },
  { id: 'st:saalfelden', q: 'Rotes Kreuz, Saalfelden am Steinernen Meer, Österreich' },
  { id: 'st:mittersill', q: 'Rotes Kreuz, Mittersill, Österreich' },
  { id: 'st:stmartin-lofer', q: 'Rotes Kreuz, Sankt Martin bei Lofer, Österreich' },
  { id: 'st:rauris', q: 'Rotes Kreuz, Rauris, Österreich' },
  { id: 'st:saalbach', q: 'Rotes Kreuz, Saalbach-Hinterglemm, Österreich' },
  { id: 'st:wald', q: 'Rotes Kreuz, Wald im Pinzgau, Österreich' },
  { id: 'st:stjohann', q: 'Rotes Kreuz, Sankt Johann im Pongau, Österreich' },
  { id: 'st:schwarzach', q: 'Rotes Kreuz, Schwarzach im Pongau, Österreich' },
  { id: 'st:gastein', q: 'Rotes Kreuz, Bad Hofgastein, Österreich' },
  { id: 'st:werfen', q: 'Rotes Kreuz, Werfen, Österreich' },
  { id: 'st:bischofshofen', q: 'Rotes Kreuz, Bischofshofen, Österreich' },
  { id: 'st:radstadt', q: 'Rotes Kreuz, Radstadt, Österreich' },
  { id: 'st:tamsweg', q: 'Rotes Kreuz, Tamsweg, Österreich' },
  { id: 'st:stmichael', q: 'Rotes Kreuz, Sankt Michael im Lungau, Österreich' },
  { id: 'st:mauterndorf', q: 'Rotes Kreuz, Mauterndorf, Österreich' },
  // Heli-Basen
  { id: 'heli:c6', q: 'Flughafen Salzburg, Innsbrucker Bundesstraße, Salzburg, Österreich' },
  { id: 'heli:stjohann', q: 'Heliport Sankt Johann im Pongau, Österreich' },
  { id: 'heli:zell', q: 'Flugplatz Zell am See, Österreich' },
  { id: 'heli:hinterglemm', q: 'Hinterglemm, Saalbach-Hinterglemm, Österreich' },
]

async function geocode(q: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RLS-SIM-Salzburg build-time geocoder (one-shot)' },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[]
  const hit = data[0]
  if (!hit) return null
  return { lat: Number(hit.lat), lon: Number(hit.lon), name: hit.display_name }
}

for (const { id, q } of QUERIES) {
  const result = await geocode(q)
  if (result) {
    console.log(
      `${id}\t${result.lat.toFixed(5)}\t${result.lon.toFixed(5)}\t${result.name.slice(0, 80)}`,
    )
  } else {
    console.log(`${id}\tMISS\t\t(${q})`)
  }
  await new Promise((r) => setTimeout(r, 1100))
}
