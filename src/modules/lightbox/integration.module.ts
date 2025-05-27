/**
 * Модуль інтеграції LightboxTV з OML
 * 
 * Реалізовано в рамках дипломної роботи на тему "ІНТЕГРАЦІЯ МЕДІА ПЛАТФОРМ"
 * Автор: Шевчук Віталій Ігорович
 * 
 * Модуль об'єднує контролер та сервіс інтеграції між платформами
 * LightboxTV та Open Media Logic (OML).
 */

import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './services/integration.service';

/**
 * Модуль інтеграції
 * 
 * Визначає компоненти, необхідні для роботи інтеграційного
 * сервісу між LightboxTV та OML.
 */
@Module({
  controllers: [IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}