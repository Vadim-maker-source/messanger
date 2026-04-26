export async function POST(req: Request) {
    try {
      const { code } = await req.json();
  
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.CLIENT_ID!,
        client_secret: process.env.CLIENT_SECRET!,
      });
  
      const res = await fetch('https://oauth.yandex.ru/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
  
      const data = await res.json();
  
      console.log('YANDEX RESPONSE:', data);
  
      return Response.json(data);
    } catch (err) {
      console.error('API ERROR:', err);
      return Response.json({ error: 'internal_error' }, { status: 500 });
    }
  }