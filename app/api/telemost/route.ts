// app/api/telemost/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const token = process.env.YANDEX_TELEMOST_TOKEN;

    const response = await fetch('https://cloud-api.yandex.net/v1/telemost-api/conferences', {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${token}`,
        'Content-Type': 'application/json',
      },
      // Передаем пустой объект или базовые настройки
      body: JSON.stringify({
        access_level: 'PUBLIC' 
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Yandex Raw Error:', errorData); // Посмотрите это в консоли терминала
      return NextResponse.json(
        { message: `Яндекс ответил ошибкой: ${errorData}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}