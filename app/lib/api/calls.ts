// app/lib/api/vk-calls.ts
"use server";

import { VK } from 'vk-io';

const vk = new VK({
  token: String(process.env.VK_SERVICE_TOKEN),
  apiVersion: '5.131'
});

export interface VKCallResponse {
  call_id: string;
  join_link: string;
  expires_in: number;
}

// Создание звонка
export async function createVKCall(
  chatId: string,
  userId: string,
  type: 'audio' | 'video' = 'video'
): Promise<VKCallResponse> {
  try {
    console.log('Creating VK call with params:', { chatId, userId, type });
    
    // Проверяем наличие токена
    if (!process.env.VK_SERVICE_TOKEN) {
      throw new Error('VK_SERVICE_TOKEN is not configured');
    }
    
    const response = await vk.api.call('calls.create', {
      chat_id: chatId,
      user_id: userId,
      type: type === 'video' ? 'video' : 'audio'
    });
    
    console.log('VK call created successfully:', response);
    
    return {
      call_id: response.call_id,
      join_link: response.join_link,
      expires_in: response.expires_in
    };
  } catch (error: any) {
    console.error('Error creating VK call:', error);
    
    // Детальная обработка ошибок
    if (error.code) {
      switch (error.code) {
        case 5:
          throw new Error('Ошибка авторизации VK. Проверьте токен доступа.');
        case 6:
          throw new Error('Слишком много запросов. Попробуйте позже.');
        case 9:
          throw new Error('Превышен лимит запросов. Попробуйте позже.');
        case 10:
          throw new Error('Внутренняя ошибка сервера VK. Попробуйте позже.');
        case 100:
          throw new Error('Неверные параметры запроса.');
        case 113:
          throw new Error('Пользователь не найден в VK.');
        default:
          throw new Error(`Ошибка VK API: ${error.message || 'Неизвестная ошибка'}`);
      }
    }
    
    throw new Error('Не удалось создать звонок. Проверьте подключение к интернету.');
  }
}

// Получение информации о звонке
export async function getVKCallInfo(callId: string) {
  try {
    const response = await vk.api.call('calls.get', {
      call_id: callId
    });
    
    return {
      id: response.id,
      status: response.status,
      participants: response.participants,
      started_at: response.started_at,
      ended_at: response.ended_at
    };
  } catch (error: any) {
    console.error('Error getting call info:', error);
    return null;
  }
}

// Завершение звонка
export async function endVKCall(callId: string) {
  try {
    await vk.api.call('calls.end', {
      call_id: callId
    });
    return { success: true };
  } catch (error) {
    console.error('Error ending call:', error);
    return { success: false };
  }
}

// Присоединение к звонку
export async function joinVKCall(callId: string, userId: string) {
  try {
    const response = await vk.api.call('calls.join', {
      call_id: callId,
      user_id: userId
    });
    
    return {
      join_link: response.join_link,
      success: true
    };
  } catch (error) {
    console.error('Error joining call:', error);
    return { success: false };
  }
}

export interface TelemostResponse {
  join_link: string;
  conference_id: string;
}

/**
 * Создает встречу в Яндекс Телемосте.
 * Для работы требуется OAuth токен с правами на Телемост.
 */
// app/lib/api/calls.ts

const getBaseUrl = () => {
  // Если мы в браузере, используем относительный путь
  if (typeof window !== 'undefined') return ''; 
  
  // Если на сервере (например, в Server Action или SSR)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  
  // Локальная разработка
  return 'http://localhost:3000'; 
};

export async function createYandexCall() {
  const baseUrl = getBaseUrl();
  
  // Теперь URL будет полным: http://localhost:3000/api/telemost
  const response = await fetch(`${baseUrl}/api/telemost`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Ошибка сервера');
  }

  return response.json();
}