/**
 * Головний модуль додатку
 * 
 * Реалізовано в рамках дипломної роботи на тему "ІНТЕГРАЦІЯ МЕДІА ПЛАТФОРМ"
 * Автор: Шевчук Віталій Ігорович
 * 
 * Цей модуль є точкою входу для NestJS додатку та імпортує всі
 * необхідні модулі для роботи інтеграційного сервісу.
 */

import { Module } from '@nestjs/common';
import { IntegrationModule } from './modules/lightbox/integration.module';

/**
 * Головний модуль додатку
 * 
 * Інтегрує всі функціональні модулі системи.
 */
@Module({
  imports: [IntegrationModule],
})
export class AppModule {}