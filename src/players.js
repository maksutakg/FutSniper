export function findPlayersUrl(resourceUrls) {
  return resourceUrls.find((u) => /\/players\.json(\?|$)/.test(u)) ?? null;
}

export function parsePlayersJson(json) {
  const all = [...(json.LegendsPlayers ?? []), ...(json.Players ?? [])];
  return all.map((p) => ({ id: p.id, name: p.c ?? `${p.f} ${p.l}`, rating: p.r }));
}

function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase();
}

export function searchPlayers(players, query, limit = 10) {
  const q = normalize(query.trim());
  if (q.length < 2) return [];
  return players
    .filter((p) => normalize(p.name).includes(q))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}
