// Deploy as a Cloudflare Worker, then put its public URL in players.js.
// No API key or packages required. Only Awesomenauts is queried.
export default {
  async fetch(request) {
    const headers = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json; charset=utf-8'};
    if (request.method !== 'GET') return new Response(null,{status:405,headers});
    try {
      const response = await fetch('https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=204300');
      if (!response.ok) throw new Error('Steam unavailable');
      const data = (await response.json()).response;
      if (data?.result !== 1 || !Number.isSafeInteger(data.player_count) || data.player_count < 0) throw new Error('Invalid Steam data');
      return Response.json({players:data.player_count,checkedAt:new Date().toISOString()},{headers:{...headers,'Cache-Control':'public, max-age=300'}});
    } catch {
      return Response.json({error:'Player count unavailable'},{status:502,headers:{...headers,'Cache-Control':'no-store'}});
    }
  }
};
