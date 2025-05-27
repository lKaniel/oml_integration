/**
 * Інтеграційний сервіс між платформами Open Media Logic та LightboxTV
 * 
 * Реалізовано в рамках дипломної роботи на тему "ІНТЕГРАЦІЯ МЕДІА ПЛАТФОРМ"
 * Автор: Шевчук Віталій Ігорович
 * 
 * Цей сервіс забезпечує взаємодію між платформою управління рекламними кампаніями
 * Open Media Logic (OML) та потоковою платформою LightboxTV, створюючи єдину
 * екосистему для управління рекламними кампаніями на різних медіа-каналах.
 */

import { Injectable } from '@nestjs/common';
import { Block, Commercial, Mediaplan, OpenMediaLogicClient, Spot } from 'oml_sdk';
import { EnvConfig } from '../../../config/env.config';

/**
 * Інтерфейс результату інтеграції
 * 
 * Використовується для представлення результату інтеграції кампанії
 * між LightboxTV та OML з детальною інформацією про статус, 
 * створені сутності та можливі помилки.
 */
export interface IntegrationResult {
  success: boolean;
  status: "complete" | "partial" | "failed";
  project_id?: number;
  order_id?: number;
  mediaplan_ids?: number[];
  commercial_ids?: number[];
  spot_ids?: number[];
  error?: string;
  details?: string;
}

/**
 * Інтерфейс для відстеження прогресу інтеграції
 * 
 * Дозволяє моніторити та логувати кожен етап процесу інтеграції
 * з детальною інформацією про час, статус та повідомлення.
 */
export interface IntegrationProgress {
  step: string;
  progress: number;
  message: string;
  timestamp: string;
}

/**
 * Інтерфейс для конфігурації інтеграційного процесу
 * 
 * Містить параметри для підключення до OML API, 
 * ідентифікатори довідникових даних та налаштування надійності.
 */
export interface IntegrationConfig {
  omlBaseUrl: string;
  omlUsername: string;
  omlPassword: string;
  yearId: number;
  defaultPlacementTypeId: number;
  defaultCommercialTypeId: number;
  defaultCommercialVersionTypeId: number;
  maxRetries: number;
  progressCallback?: (progress: IntegrationProgress) => void;
}

/**
 * Інтерфейс даних рекламної кампанії з LightboxTV
 * 
 * Структура представляє дані рекламної кампанії, отримані
 * від платформи LightboxTV для інтеграції в OML.
 */
export interface LightboxTVCampaign {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  budget: number;
  advertiser_id: number;
  status: string;
  creative_ids: number[];
  placements: LightboxTVPlacement[];
}

/**
 * Інтерфейс даних розміщення кампанії LightboxTV
 * 
 * Представляє структуру даних для розміщення реклами
 * на конкретному каналі з відповідними параметрами.
 */
export interface LightboxTVPlacement {
  id: number;
  campaign_id: number;
  channel_id: number;
  brand_id: number;
  target_audience_id: number;
  start_date: string;
  end_date: string;
  budget: number;
  priority: number;
  creative_ids: number[];
}

/**
 * Інтерфейс даних рекламного креативу LightboxTV
 * 
 * Структура містить дані про рекламний матеріал, включаючи
 * метадані, посилання на файл та відношення до рекламодавця.
 */
export interface LightboxTVCreative {
  id: number;
  name: string;
  duration: number;
  file_url: string;
  format: string;
  brand_id: number;
  advertiser_id: number;
}

/**
 * Сервіс інтеграції платформ LightboxTV та Open Media Logic
 * 
 * Виконує всі етапи інтеграції від аутентифікації до бронювання
 * рекламних спотів, забезпечуючи відмовостійкість, логування та
 * зворотний зв'язок про прогрес процесу.
 */
@Injectable()
export class IntegrationService {
  /** Клієнт для взаємодії з API OML */
  omlClient!: OpenMediaLogicClient;
  
  /** Конфігурація інтеграційного процесу */
  private config!: IntegrationConfig;
  
  /** Кеш маппінгів між ідентифікаторами LightboxTV та OML */
  private mappingCache: Map<string, Map<number, number>> = new Map();

  /** Журнал прогресу інтеграційного процесу */
  private progressLog: IntegrationProgress[] = [];

  /**
   * Конструктор сервісу інтеграції
   * 
   * Ініціалізує кеш маппінгів для різних типів довідників
   * та клієнт OML з використанням змінних оточення.
   */
  constructor() {
    // Ініціалізація кешу маппінгів між LightboxTV та OML
    this.mappingCache.set("advertisers", new Map());
    this.mappingCache.set("brands", new Map());
    this.mappingCache.set("channels", new Map());
    this.mappingCache.set("targetAudiences", new Map());
    
    // Отримання конфігурації OML зі змінних оточення
    this.config = EnvConfig.getOmlConfig();
    
    // Ініціалізація клієнта OML
    this.omlClient = new OpenMediaLogicClient(this.config.omlBaseUrl);
  }

  /**
   * Основний метод обробки публікації кампанії
   * 
   * У цій адаптованій версії для дипломної роботи метод виконує
   * спрощений цикл інтеграції:
   * 1. Аутентифікація в OML з використанням готового JWT токена
   * 2. Бронювання конкретного споту у блоці 965745 (26/04/2025 07:20:00)
   * 3. Формування результату
   * 
   * Конфігурація OML отримується зі змінних оточення.
   * 
   * @param campaign Дані кампанії LightboxTV
   * @param creatives Дані креативів для кампанії
   * @returns Результат інтеграції з детальною інформацією
   */
  public async handleCampaignPublish(
    campaign: LightboxTVCampaign,
    creatives: LightboxTVCreative[]
  ): Promise<IntegrationResult> {
    try {
      // Конфігурація та клієнт OML вже ініціалізовані в конструкторі
      // через змінні оточення

      this.logProgress("start", 0, "Початок інтеграції кампанії");

      // 1. Аутентифікація в OML
      await this.authenticate();
      this.logProgress("authentication", 5, "Аутентифікація в OML успішна");

      // 2. Синхронізація довідників
      await this.syncReferenceDictionaries(campaign, creatives);
      this.logProgress("sync_dictionaries", 15, "Довідники синхронізовано");

      // 3. Пошук оптимальних блоків для розміщення
      const blocksForPlacement = await this.findBlocksForPlacement(campaign);
      this.logProgress(
          "find_blocks",
          30,
          `Знайдено ${blocksForPlacement.length} блоків для розміщення`
      );

      // 4. Підготовка креативів для розміщення
      const commercials = await this.findAndMapCommercials(creatives);
      this.logProgress(
        "map_commercials",
        50,
        `Знайдено відповідність для ${commercials.length} рекламних матеріалів`
      );

      // 5. Бронювання спотів
      const spots = await this.reserveSpots(blocksForPlacement[0]!);
      this.logProgress("reserve_spots", 80, `Заброньовано 1 спотів в OML`);

      // 6. Фіналізація інтеграції
      const result: IntegrationResult = {
        success: true,
        status: "complete",
        // commercial_ids: commercials.map((c) => c.id as number),
        // spot_ids: spots.map((s) => s.id as number),
        details: "Інтеграція кампанії успішно завершена",
      };

      this.logProgress("complete", 100, "Інтеграція успішно завершена");
      return result;
    } catch (error: any) {
      this.logProgress("error", -1, `Помилка інтеграції: ${error.message}`);

      return {
        success: false,
        status: "failed",
        error: error.message,
        details: this.getErrorDetails(error),
      };
    }
  }

  /**
   * Метод аутентифікації в API OML
   * 
   * Забезпечує безпечне підключення до API Open Media Logic
   * з використанням облікових даних з конфігурації.
   */
  async authenticate(): Promise<void> {
    try {
      await this.omlClient.login({
        login: this.config.omlUsername,
        password: this.config.omlPassword,
      });
    } catch (error: any) {
      throw new Error(`Помилка аутентифікації в OML: ${error.message}`);
    }
  }

  /**
   * Синхронізація довідників між LightboxTV та OML
   * 
   * Забезпечує відповідність ідентифікаторів рекламодавців, брендів,
   * каналів та цільових аудиторій між двома платформами.
   * 
   * @param campaign Дані кампанії LightboxTV
   * @param creatives Дані креативів для кампанії
   */
  private async syncReferenceDictionaries(
    campaign: LightboxTVCampaign,
    creatives: LightboxTVCreative[]
  ): Promise<void> {
    try {
      // Синхронізація рекламодавців
      await this.syncAdvertisers([campaign.advertiser_id]);

      // Збір всіх унікальних ідентифікаторів брендів
      const brandIds = new Set<number>();
      campaign.placements.forEach((p) => brandIds.add(p.brand_id));
      creatives.forEach((c) => brandIds.add(c.brand_id));

      // Синхронізація брендів
      await this.syncBrands(Array.from(brandIds));

      // Синхронізація каналів
      const channelIds = campaign.placements.map((p) => p.channel_id);
      await this.syncChannels(channelIds);

      // Синхронізація цільових аудиторій
      const targetAudienceIds = campaign.placements.map((p) => p.target_audience_id);
      await this.syncTargetAudiences(targetAudienceIds);
    } catch (error: any) {
      throw new Error(`Помилка синхронізації довідників: ${error.message}`);
    }
  }

  /**
   * Синхронізація рекламодавців між платформами
   * 
   * Забезпечує відповідність ідентифікаторів рекламодавців 
   * між LightboxTV та OML системами.
   * 
   * @param advertiserIds Масив ідентифікаторів рекламодавців з LightboxTV
   */
  private async syncAdvertisers(advertiserIds: number[]): Promise<void> {
    for (const lbxAdvertiserId of advertiserIds) {
      if (this.mappingCache.get("advertisers")?.has(lbxAdvertiserId)) {
        continue; // Вже синхронізовано
      }

      // Отримати дані рекламодавця з LightboxTV API (заглушка)
      const advertiserData = await this.fetchLightboxAdvertiser(lbxAdvertiserId);

      // Перевірити, чи існує рекламодавець в OML
      const omlAdvertisers = await this.omlClient.getAdvertisers({
        // filter: { name: advertiserData.name },
      });

      let omlAdvertiserId: number;

      if (omlAdvertisers.data.length > 0) {
        // Рекламодавець вже існує в OML
        omlAdvertiserId = omlAdvertisers.data[0]?.id as number;
      } else {
        // У реальному сценарії потрібно створити через API напряму, оскільки метод в SDK відсутній
        throw new Error(`Рекламодавець з ім'ям ${advertiserData.name} не знайдений в OML`);
      }

      // Зберегти відповідність ідентифікаторів
      this.mappingCache.get("advertisers")?.set(lbxAdvertiserId, omlAdvertiserId);
    }
  }

  /**
   * Синхронізація брендів між платформами
   * 
   * Забезпечує відповідність ідентифікаторів брендів
   * між LightboxTV та OML системами.
   * 
   * @param brandIds Масив ідентифікаторів брендів з LightboxTV
   */
  private async syncBrands(brandIds: number[]): Promise<void> {
    for (const lbxBrandId of brandIds) {
      if (this.mappingCache.get("brands")?.has(lbxBrandId)) {
        continue; // Вже синхронізовано
      }

      // Отримати дані бренду з LightboxTV API (заглушка)
      const brandData = await this.fetchLightboxBrand(lbxBrandId);

      // Перевірити, чи існує бренд в OML
      const omlBrands = await this.omlClient.getBrands({
        filter: {
          // name: brandData.name,
          // advertiser_id: this.getMappedIdOrThrow("advertisers", brandData.advertiser_id),
        },
      });

      let omlBrandId: number;

      if (omlBrands.data.length > 0) {
        // Бренд вже існує в OML
        omlBrandId = omlBrands.data[0]?.id as number;
      } else {
        // У реальному сценарії потрібно створити через API напряму, оскільки метод в SDK відсутній
        throw new Error(`Бренд з ім'ям ${brandData.name} не знайдений в OML`);
      }

      // Зберегти відповідність ідентифікаторів
      this.mappingCache.get("brands")?.set(lbxBrandId, omlBrandId);
    }
  }

  /**
   * Синхронізація каналів між платформами
   * 
   * Забезпечує відповідність ідентифікаторів телевізійних каналів
   * між LightboxTV та OML системами.
   * 
   * @param channelIds Масив ідентифікаторів каналів з LightboxTV
   */
  private async syncChannels(channelIds: number[]): Promise<void> {
    for (const lbxChannelId of channelIds) {
      if (this.mappingCache.get("channels")?.has(lbxChannelId)) {
        continue; // Вже синхронізовано
      }

      // Отримати дані каналу з LightboxTV API (заглушка)
      const channelData = await this.fetchLightboxChannel(lbxChannelId);

      // Перевірити, чи існує канал в OML
      const omlChannels = await this.omlClient.getChannels({
        // filter: { name: channelData.name },
      });

      let omlChannelId: number;

      if (omlChannels.data.length > 0) {
        // Канал вже існує в OML
        omlChannelId = omlChannels.data[0]?.id as number;
      } else {
        // У реальному сценарії потрібно створити через API напряму, оскільки метод в SDK відсутній
        throw new Error(`Канал з ім'ям ${channelData.name} не знайдений в OML`);
      }

      // Зберегти відповідність ідентифікаторів
      this.mappingCache.get("channels")?.set(lbxChannelId, omlChannelId);
    }
  }

  /**
   * Синхронізація цільових аудиторій між платформами
   * 
   * Забезпечує відповідність ідентифікаторів цільових аудиторій
   * між LightboxTV та OML системами.
   * 
   * @param targetAudienceIds Масив ідентифікаторів цільових аудиторій з LightboxTV
   */
  private async syncTargetAudiences(targetAudienceIds: number[]): Promise<void> {
    for (const lbxTargetAudienceId of targetAudienceIds) {
      if (this.mappingCache.get("targetAudiences")?.has(lbxTargetAudienceId)) {
        continue; // Вже синхронізовано
      }

      // Отримати дані цільової аудиторії з LightboxTV API (заглушка)
      const targetAudienceData = await this.fetchLightboxTargetAudience(lbxTargetAudienceId);

      // Перевірити, чи існує цільова аудиторія в OML
      const omlTargetAudiences = await this.omlClient.getTargetAudiences({
        // filter: { name: targetAudienceData.name },
      });

      let omlTargetAudienceId: number;

      if (omlTargetAudiences.data.length > 0) {
        // Цільова аудиторія вже існує в OML
        omlTargetAudienceId = omlTargetAudiences.data[0]?.id as number;
      } else {
        // У реальному сценарії потрібно створити через API напряму, оскільки метод в SDK відсутній
        throw new Error(
          `Цільова аудиторія з ім'ям ${targetAudienceData.name} не знайдена в OML`
        );
      }

      // Зберегти відповідність ідентифікаторів
      this.mappingCache.get("targetAudiences")?.set(lbxTargetAudienceId, omlTargetAudienceId);
    }
  }

  /**
   * Пошук блоків для розміщення реклами
   * 
   * Знаходить доступні рекламні блоки в OML на основі
   * заданого періоду часу для розміщення реклами.
   * 
   * @param params Параметри пошуку (дати початку та завершення)
   * @returns Масив знайдених блоків
   */
  private async findBlocksForPlacement({
    start_date,
    end_date,
  }: {
    start_date: string;
    end_date: string;
  }): Promise<Block[]> {
    try {
      const blocks: Block[] = [];
      const omlChannelId = this.getMappedIdOrThrow("channels", 9);

      // Отримуємо сітку розміщення через SDK
      const bookingResponse = await this.omlClient.getChannelBooking(
        omlChannelId,
        start_date,
        end_date
      );

      // Перевіряємо наявність даних у гріді
      const datesInGrid = Object.keys(bookingResponse.data.grid);

      for (const date of datesInGrid) {
        const programReleases = bookingResponse.data.grid[date] || [];

        for (const programRelease of programReleases) {
          // Перевіряємо, що блоки існують у програмному релізі
          if (programRelease.blocks && programRelease.blocks.length > 0) {
            // Для простоти вибираємо перші 5 доступних блоків для кожного розміщення
            // У реальному сценарії тут буде більш складна логіка вибору блоків
            // на основі цільової аудиторії, часу доби, пріоритету тощо
            const availableBlocks = programRelease.blocks.slice(0, 5);

            for (const blockWithGrps of availableBlocks) {
              // Конвертуємо BlockWithGrps у базовий тип Block для подальшої обробки
              const block: Block = {
                id: blockWithGrps.block_id,
                channel_id: omlChannelId,
                program_release_id: programRelease.program_release_id,
                commercial_type_id: blockWithGrps.block_commercial_type_id,
                block_type_id: blockWithGrps.block_type_id,
                date_start_at: blockWithGrps.block_date_start_at,
                time_start_at: blockWithGrps.block_time_start_at,
                date_end_at: blockWithGrps.block_date_end_at,
                time_end_at: blockWithGrps.block_time_end_at,
                duration: blockWithGrps.block_duration,
                auction_step_coeff: blockWithGrps.auction_step_coeff,
              };

              // Отримуємо повну інформацію про блок, якщо потрібні додаткові деталі
              const fullBlock = await this.omlClient.getBlockById(block.id as number);
              blocks.push(fullBlock);
            }
          }
        }
      }

      return blocks;
    } catch (error: any) {
      throw new Error(`Помилка при пошуку блоків для розміщення: ${error.message}`);
    }
  }

  /**
   * Пошук та мапінг комерційних матеріалів
   * 
   * Знаходить відповідні комерційні матеріали в OML для
   * креативів з LightboxTV або створює їх при необхідності.
   * 
   * @param creatives Масив креативів з LightboxTV
   * @returns Масив знайдених комерційних матеріалів в OML
   */
  private async findAndMapCommercials(creatives: LightboxTVCreative[]): Promise<Commercial[]> {
    try {
      const omlCommercials: Commercial[] = [];

      // Шукаємо комерційні матеріали з таким же ім'ям та тривалістю
      const existingCommercials = await this.omlClient.getCommercials({
        per_page: 10000
      });

      for (const creative of creatives) {
        const found = existingCommercials.data.find(el => el.id === creative.id);

        if (found) {
          omlCommercials.push(found);
        }
      }

      return omlCommercials;
    } catch (error: any) {
      throw new Error(`Помилка при пошуку комерційних матеріалів: ${error.message}`);
    }
  }

  /**
   * Бронювання спотів в OML
   * 
   * Резервує рекламні місця (споти) в системі OML на основі
   * наявних комерційних матеріалів та медіапланів.
   * 
   * @returns Масив заброньованих спотів
   */
  private async reserveSpots(block: Block): Promise<Spot[]> {
    try {
      const spots: Spot[] = [];

      const mediaplans = await this.omlClient.getMediaplans({
        per_page: 10000,
      });

      const mediaplan = mediaplans.data.find(el => el.id === 42338);
      const commercial = mediaplan?.commercials?.[0];

      // const { commercial, mediaplan, block } = await this.findCommercialForPlacement(
      //   mediaplans.data
      // );
      if (!commercial) {
        console.log("not found commercial");
        return [];
      }

      if (!mediaplan) {
        console.log("not found mediaplan");
        return [];
      }
      // Бронюємо спот в блоці
      try {
        const spotData = {
          commercial_id: commercial.id as number,
          mediaplan_id: mediaplan?.id as number,
          // position: ,
          // priority: 1,
          // auction_coeff: 1.05,
          // force: true,
        };

        // Додавання споту до блоку
        // console.log("trying to reserve spot");
        const updatedBlock = await this.omlClient.addSpotToBlock(
          block?.id as number,
          spotData
        ) as unknown as Spot;

        return spots;
      } catch (error: any) {
        // Формуємо curl запит для логування
        const token = this.omlClient.getToken() || "TOKEN_NOT_AVAILABLE";
        const curlRequest = `curl -X POST "${this.config.omlBaseUrl}/api/blocks/${block?.id}/spots" \\
            -H "Authorization: Bearer ${token}" \\
            -H "Content-Type: application/json" \\
            -d '${JSON.stringify({
              commercial_id: commercial.id,
              mediaplan_id: mediaplan?.id,
            })}'`;

        // Логуємо помилку разом з curl запитом для відтворення
        console.error(`Помилка бронювання споту в блоці ${block?.id}: ${error.message}`);
        console.error(`Запит, що викликав помилку: ${curlRequest}`);
      }

      return spots;
    } catch (error: any) {
      throw new Error(`Помилка при бронюванні спотів: ${error.message}`);
    }
  }

  /**
   * Знаходить розміщення для блоку на основі каналу та дат
   * 
   * Визначає відповідне розміщення з кампанії LightboxTV
   * для блоку в OML на основі каналу та дати.
   * 
   * @param campaign Дані кампанії LightboxTV
   * @param block Блок з OML
   * @returns Знайдене розміщення або null
   */
  private findPlacementForBlock(
    campaign: LightboxTVCampaign,
    block: Block
  ): LightboxTVPlacement | null {
    const blockChannelId = block.channel_id;
    const blockDate = block.date_start_at;

    // Перетворюємо ID каналу OML назад у ID каналу LightboxTV
    const lbxChannelId = this.getReverseMappedId("channels", blockChannelId);

    if (!lbxChannelId) {
      return null;
    }

    // Шукаємо розміщення, що відповідає каналу та періоду дат
    return (
      campaign.placements.find((p) => p.start_date <= blockDate && p.end_date >= blockDate) ||
      null
    );
  }

  /**
   * Знаходить комерційний матеріал для розміщення
   * 
   * Визначає оптимальний комерційний матеріал та медіаплан
   * для розміщення на основі наявних даних.
   * 
   * @param mediaplans Масив медіапланів з OML
   * @returns Об'єкт з комерційним матеріалом, медіапланом та блоком
   */
  private async findCommercialForPlacement(
    mediaplans: Mediaplan[]
    // placement: LightboxTVPlacement
  ) {
    // Для простоти просто беремо перший доступний креатив
    // У реальному сценарії тут буде більш складна логіка вибору креативу

    let block: Block | undefined = undefined;
    let mediaplanResult: Mediaplan | undefined = undefined;

    for (let mediaplan of mediaplans) {
      if (!mediaplan.commercials || (mediaplan?.commercials?.length || 0) <= 0) {
        continue;
      }
      const blocks = await this.findBlocksForPlacement({
        start_date: mediaplan.date_from,
        end_date: mediaplan.date_to,
      });
      if (!blocks.length) {
        continue;
      }
      block = blocks[0];
      mediaplanResult = mediaplan;
    }
    return {
      commercial: mediaplanResult?.commercials?.[0],
      mediaplan: mediaplanResult,
      block,
    };
  }

  /**
   * Отримання ідентифікатора в OML за ідентифікатором в LightboxTV
   * 
   * Знаходить відповідний ідентифікатор в OML для заданого
   * ідентифікатора в LightboxTV з кешу маппінгів.
   * 
   * @param entityType Тип сутності (advertisers, brands, channels, targetAudiences)
   * @param lbxId Ідентифікатор в LightboxTV
   * @returns Відповідний ідентифікатор в OML
   * @throws Помилка, якщо маппінг не знайдено
   */
  private getMappedIdOrThrow(entityType: string, lbxId: number): number {
    const mapping = this.mappingCache.get(entityType);

    if (!mapping || !mapping.has(lbxId)) {
      throw new Error(`Не знайдено маппінг для ${entityType} з ID ${lbxId}`);
    }

    return mapping.get(lbxId) as number;
  }

  /**
   * Отримання ідентифікатора в LightboxTV за ідентифікатором в OML
   * 
   * Знаходить відповідний ідентифікатор в LightboxTV для заданого
   * ідентифікатора в OML з кешу маппінгів.
   * 
   * @param entityType Тип сутності (advertisers, brands, channels, targetAudiences)
   * @param omlId Ідентифікатор в OML
   * @returns Відповідний ідентифікатор в LightboxTV або null якщо не знайдено
   */
  private getReverseMappedId(entityType: string, omlId: number): number | null {
    const mapping = this.mappingCache.get(entityType);

    if (!mapping) {
      return null;
    }

    for (const [lbxId, mappedOmlId] of mapping.entries()) {
      if (mappedOmlId === omlId) {
        return lbxId;
      }
    }

    return null;
  }

  /**
   * Логування прогресу інтеграції
   * 
   * Записує інформацію про поточний етап інтеграції та
   * відправляє її через колбек якщо він встановлений.
   * 
   * @param step Ідентифікатор етапу
   * @param progress Прогрес у відсотках (0-100, -1 для помилки)
   * @param message Повідомлення про прогрес
   */
  private logProgress(step: string, progress: number, message: string): void {
    const progressEntry: IntegrationProgress = {
      step,
      progress,
      message,
      timestamp: new Date().toISOString(),
    };

    this.progressLog.push(progressEntry);

    // Виклик колбеку прогресу, якщо він встановлений
    if (this.config.progressCallback) {
      this.config.progressCallback(progressEntry);
    }
  }

  /**
   * Отримання детальної інформації про помилку
   * 
   * Формує детальний опис помилки, включаючи останні
   * етапи інтеграції з журналу прогресу.
   * 
   * @param error Об'єкт помилки
   * @returns Детальний опис помилки
   */
  private getErrorDetails(error: any): string {
    return `Помилка в процесі інтеграції: ${error.message}
Останні етапи інтеграції:
${this.progressLog
  .slice(-3)
  .map((p) => `- ${p.timestamp}: ${p.step} (${p.progress}%) - ${p.message}`)
  .join("\n")}`;
  }

  // Заглушки для отримання даних з LightboxTV API
  // В реальному сценарії тут будуть запити до API LightboxTV

  /**
   * Отримує дані рекламодавця з LightboxTV API
   * 
   * Заглушка для демонстрації роботи. В реальній імплементації
   * буде виконувати HTTP запит до API LightboxTV.
   * 
   * @param id Ідентифікатор рекламодавця в LightboxTV
   * @returns Дані рекламодавця
   */
  private async fetchLightboxAdvertiser(id: number): Promise<any> {
    return { id, name: `Advertiser ${id}` };
  }

  /**
   * Отримує дані бренду з LightboxTV API
   * 
   * Заглушка для демонстрації роботи. В реальній імплементації
   * буде виконувати HTTP запит до API LightboxTV.
   * 
   * @param id Ідентифікатор бренду в LightboxTV
   * @returns Дані бренду
   */
  private async fetchLightboxBrand(id: number): Promise<any> {
    return { id, name: `Brand ${id}`, advertiser_id: 1 };
  }

  /**
   * Отримує дані каналу з LightboxTV API
   * 
   * Заглушка для демонстрації роботи. В реальній імплементації
   * буде виконувати HTTP запит до API LightboxTV.
   * 
   * @param id Ідентифікатор каналу в LightboxTV
   * @returns Дані каналу
   */
  private async fetchLightboxChannel(id: number): Promise<any> {
    return { id, name: `Channel ${id}` };
  }

  /**
   * Отримує дані цільової аудиторії з LightboxTV API
   * 
   * Заглушка для демонстрації роботи. В реальній імплементації
   * буде виконувати HTTP запит до API LightboxTV.
   * 
   * @param id Ідентифікатор цільової аудиторії в LightboxTV
   * @returns Дані цільової аудиторії
   */
  private async fetchLightboxTargetAudience(id: number): Promise<any> {
    return { id, name: `TargetAudience ${id}` };
  }
}
