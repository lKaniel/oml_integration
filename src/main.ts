/**
 * Головна точка входу додатку
 * 
 * Реалізовано в рамках дипломної роботи на тему "ІНТЕГРАЦІЯ МЕДІА ПЛАТФОРМ"
 * Автор: Шевчук Віталій Ігорович
 * 
 * Ініціалізує та запускає NestJS додаток з усіма налаштуваннями
 * для інтеграційного сервісу між LightboxTV та OML.
 */

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Функція ініціалізації та запуску додатку
 * 
 * Налаштовує глобальні пайпи, CORS та запускає HTTP сервер
 * на вказаному порту.
 */
async function bootstrap() {
  // Створення інстансу додатку NestJS
  const app = await NestFactory.create(AppModule);
  
  // Додавання ValidationPipe для валідації вхідних запитів
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Автоматична трансформація даних
      whitelist: true, // Видалення зайвих полів
      forbidNonWhitelisted: true, // Заборона невизначених полів
    }),
  );
  
  // Налаштування CORS для можливості отримання запитів з різних джерел
  app.enableCors();
  
  // Запуск HTTP сервера на порту 3000
  await app.listen(3000);
  console.log(`Інтеграційний сервіс запущено на http://localhost:3000`);
}

// Виклик функції bootstrap для запуску додатку
bootstrap();