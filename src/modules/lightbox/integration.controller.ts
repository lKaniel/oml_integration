/**
 * Контролер для обробки запитів інтеграції між LightboxTV та OML
 * 
 * Реалізовано в рамках дипломної роботи на тему "ІНТЕГРАЦІЯ МЕДІА ПЛАТФОРМ"
 * Автор: Шевчук Віталій Ігорович
 * 
 * Контролер надає API ендпоінт для публікації рекламних кампаній з LightboxTV
 * до системи Open Media Logic (OML) через інтеграційний сервіс.
 */

import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { 
  IntegrationService, 
  IntegrationResult, 
  LightboxTVCampaign, 
  LightboxTVCreative,
} from './services/integration.service';

/**
 * DTO для публікації кампанії
 * 
 * Структура запиту для публікації рекламної кампанії
 * з LightboxTV до OML через API інтеграційного сервісу.
 * 
 * Конфігурація OML отримується зі змінних оточення.
 */
export class CampaignPublishDto {
  /** Дані рекламної кампанії з LightboxTV */
  campaign!: LightboxTVCampaign;
  
  /** Масив креативів (рекламних матеріалів) */
  creatives!: LightboxTVCreative[];
}

/**
 * Контролер API для інтеграції LightboxTV з OML
 * 
 * Надає ендпоінт для публікації рекламних кампаній 
 * з LightboxTV до системи Open Media Logic.
 */
@Controller('integration')
export class IntegrationController {
  /**
   * Конструктор контролера
   * 
   * @param integrationService Сервіс інтеграції для обробки запитів
   */
  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * Ендпоінт для публікації рекламної кампанії
   * 
   * Приймає дані кампанії з LightboxTV та передає їх до інтеграційного
   * сервісу для створення відповідних сутностей в OML.
   * 
   * Конфігурація OML отримується зі змінних оточення.
   * 
   * @param payload Дані для публікації (кампанія, креативи)
   * @returns Результат інтеграції з детальною інформацією
   */
  @Post('publish-campaign')
  @HttpCode(200)
  async publishCampaign(@Body() payload: CampaignPublishDto): Promise<IntegrationResult> {
    return await this.integrationService.handleCampaignPublish(
      payload.campaign,
      payload.creatives
    );
  }
}
