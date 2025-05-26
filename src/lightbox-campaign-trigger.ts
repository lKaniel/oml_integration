/**
 * LightboxTV Campaign Trigger
 *
 * Обробляє подію публікації рекламної кампанії LightboxTV та
 * синхронізує дані з Open Media Logic через OML SDK.
 */
import {Block, Commercial, Mediaplan, OpenMediaLogicClient, Spot} from "oml_sdk";

// Типи для LightboxTV кампанії
interface LightboxTVCampaign {
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

interface LightboxTVPlacement {
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

interface LightboxTVCreative {
    id: number;
    name: string;
    duration: number;
    file_url: string;
    format: string;
    brand_id: number;
    advertiser_id: number;
}

// Інтерфейс для результату інтеграції
interface IntegrationResult {
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

// Інтерфейс для відстеження прогресу інтеграції
interface IntegrationProgress {
    step: string;
    progress: number;
    message: string;
    timestamp: string;
}

// Інтерфейс для конфігурації інтеграційного процесу
interface IntegrationConfig {
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
 * Клас, що обробляє тригер публікації кампанії LightboxTV
 */
export class LightboxCampaignTrigger {
    omlClient: OpenMediaLogicClient;
    private config: IntegrationConfig;
    private mappingCache: Map<string, Map<number, number>> = new Map();

    // Реєстр прогресу інтеграційного процесу
    private progressLog: IntegrationProgress[] = [];

    constructor(config: IntegrationConfig) {
        this.config = config;
        this.omlClient = new OpenMediaLogicClient(config.omlBaseUrl);

        // Ініціалізація кешу маппінгів між LightboxTV та OML
        this.mappingCache.set("advertisers", new Map());
        this.mappingCache.set("brands", new Map());
        this.mappingCache.set("channels", new Map());
        this.mappingCache.set("targetAudiences", new Map());
    }

    /**
     * Основний метод, що обробляє тригер публікації кампанії
     * @param campaign Дані кампанії LightboxTV
     * @param creatives Дані креативів для кампанії
     */
    public async handleCampaignPublish(
        campaign: LightboxTVCampaign,
        creatives: LightboxTVCreative[]
    ): Promise<IntegrationResult> {
        try {
            this.logProgress("start", 0, "Початок інтеграції кампанії");

            // 1. Аутентифікація в OML
            await this.authenticate();
            this.logProgress("authentication", 5, "Аутентифікація в OML успішна");

            // 2. Синхронізація довідників
            await this.syncReferenceDictionaries(campaign, creatives);
            this.logProgress("sync_dictionaries", 15, "Довідники синхронізовано");

            // 3. Пошук оптимальних блоків для розміщення
            // const blocksForPlacement = await this.findBlocksForPlacement(campaign);
            // this.logProgress(
            //     "find_blocks",
            //     30,
            //     `Знайдено ${blocksForPlacement.length} блоків для розміщення`
            // );

            // 4. Підготовка креативів для розміщення
            const commercials = await this.findAndMapCommercials(creatives);
            this.logProgress(
                "map_commercials",
                50,
                `Знайдено відповідність для ${commercials.length} рекламних матеріалів`
            );

            // 5. Бронювання спотів
            const spots = await this.reserveSpots();
            this.logProgress("reserve_spots", 80, `Заброньовано ${spots.length} спотів в OML`);

            // 6. Фіналізація інтеграції
            const result: IntegrationResult = {
                success: true,
                status: "complete",
                commercial_ids: commercials.map((c) => c.id as number),
                spot_ids: spots.map((s) => s.id as number),
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
     * Аутентифікація в OML API
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
     * Синхронізація рекламодавців
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
     * Синхронізація брендів
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
     * Синхронізація каналів
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
     * Синхронізація цільових аудиторій
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
     */
    private async findAndMapCommercials(creatives: LightboxTVCreative[]): Promise<Commercial[]> {
        try {
            const omlCommercials: Commercial[] = [];

            // Шукаємо комерційні матеріали з таким же ім'ям та тривалістю
            const existingCommercials = await this.omlClient.getCommercials();

            if (existingCommercials.data.length > 0) {
                // Використовуємо існуючий комерційний матеріал
                omlCommercials.push(...existingCommercials.data);
            }
            // for (const creative of creatives) {
            //     const omlAdvertiserId = this.getMappedIdOrThrow(
            //         "advertisers",
            //         creative.advertiser_id
            //     );
            //     const omlBrandId = this.getMappedIdOrThrow("brands", creative.brand_id);
            //
            //     // Шукаємо комерційні матеріали з таким же ім'ям та тривалістю
            //     const existingCommercials = await this.omlClient.getCommercials();
            //
            //     if (existingCommercials.data.length > 0) {
            //         // Використовуємо існуючий комерційний матеріал
            //         omlCommercials.push(...existingCommercials.data);
            //     } else {
            //         // У реальному сценарії потрібно створити через API напряму, оскільки метод в SDK відсутній
            //         throw new Error(`Рекламний матеріал ${creative.name} не знайдений в OML`);
            //     }
            // }

            return omlCommercials;
        } catch (error: any) {
            throw new Error(`Помилка при пошуку комерційних матеріалів: ${error.message}`);
        }
    }

    /**
     * Бронювання спотів в OML
     */
    private async reserveSpots(): Promise<Spot[]> {
        try {
            const spots: Spot[] = [];

            const mediaplans = await this.omlClient.getMediaplans({
                per_page: 1000,
            });
            const { commercial, mediaplan, block } = await this.findCommercialForPlacement(
                mediaplans.data
            );
            if (!commercial) {
                console.log("not found commercial");
                return [];
            }

            if (!mediaplan) {
                console.log("not found mediaplan");
                // console.log(this.omlClient.getToken());
                return [];
            }
            console.log("found comercial");
            // Бронюємо спот в блоці
            try {
                const spotData = {
                    commercial_id: commercial.id as number,
                    mediaplan_id: mediaplan?.id as number,
                    position: "1F",
                    priority: 1,
                    auction_coeff: 1.05,
                    force: true,
                };

                // Додавання споту до блоку
                console.log("trying to reserve spot");
                const updatedBlock = await this.omlClient.addSpotToBlock(
                    block?.id as number,
                    spotData,
                    true
                );

                // Знаходимо доданий спот у блоці
                const addedSpot = updatedBlock.spots?.find(
                    (s) => s.commercial_id === commercial.id
                );

                if (addedSpot) {
                    spots.push(addedSpot);
                }

                console.log("Успішно заброньовано спот");
                console.log(addedSpot);
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
                        position: "1F",
                        priority: 1,
                        auction_coeff: 1.05,
                        force: true,
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

    private async fetchLightboxAdvertiser(id: number): Promise<any> {
        return { id, name: `Advertiser ${id}` };
    }

    private async fetchLightboxBrand(id: number): Promise<any> {
        return { id, name: `Brand ${id}`, advertiser_id: 1 };
    }

    private async fetchLightboxChannel(id: number): Promise<any> {
        return { id, name: `Channel ${id}` };
    }

    private async fetchLightboxTargetAudience(id: number): Promise<any> {
        return { id, name: `TargetAudience ${id}` };
    }
}

/**
 * Функція-тригер для обробки події публікації кампанії
 *
 * Ця функція може використовуватися як Cloud Function або
 * як обробник події в API-ендпоінті.
 */
export async function handleLightboxCampaignPublish(
    campaignData: LightboxTVCampaign,
    creatives: LightboxTVCreative[],
    config: IntegrationConfig
): Promise<IntegrationResult> {
    const trigger = new LightboxCampaignTrigger(config);
    return await trigger.handleCampaignPublish(campaignData, creatives);
}

/**
 * Приклад використання тригера публікації кампанії
 */
export async function publishCampaignExample() {
    // Конфігурація інтеграції
    const config: IntegrationConfig = {
        omlBaseUrl: "https://ge-api.omldev.org",
        omlUsername: "victoria.lee",
        omlPassword: "123456789",
        yearId: 2025,
        defaultPlacementTypeId: 1,
        defaultCommercialTypeId: 1,
        defaultCommercialVersionTypeId: 1,
        maxRetries: 3,
        progressCallback: (progress) => {
            console.log(
                `[${progress.timestamp}] ${progress.step} (${progress.progress}%): ${progress.message}`
            );
        },
    };

    // Приклад даних кампанії LightboxTV
    const campaign: LightboxTVCampaign = {
        id: 12345,
        name: "Summer Campaign 2025",
        start_date: "2025-04-24",
        end_date: "2025-04-30",
        budget: 1000000,
        advertiser_id: 101,
        status: "draft",
        creative_ids: [201, 202],
        placements: [
            {
                id: 1001,
                campaign_id: 12345,
                channel_id: 9,
                brand_id: 401,
                target_audience_id: 501,
                start_date: "2025-04-24",
                end_date: "2025-04-30",
                budget: 350000,
                priority: 1,
                creative_ids: [201],
            },
            {
                id: 1002,
                campaign_id: 12345,
                channel_id: 9,
                brand_id: 401,
                target_audience_id: 501,
                start_date: "2025-04-24",
                end_date: "2025-04-30",
                budget: 650000,
                priority: 2,
                creative_ids: [201, 202],
            },
        ],
    };

    // Приклад даних креативів
    const creatives: LightboxTVCreative[] = [
        {
            id: 201,
            name: "Summer Promo 30s",
            duration: 30,
            file_url: "https://storage.lightboxtv.com/creatives/summer_promo_30s.mp4",
            format: "mp4",
            advertiser_id: 101,
            brand_id: 401,
        },
        {
            id: 202,
            name: "Summer Promo 15s",
            duration: 15,
            file_url: "https://storage.lightboxtv.com/creatives/summer_promo_15s.mp4",
            format: "mp4",
            advertiser_id: 101,
            brand_id: 401,
        },
    ];

    // Виклик функції-тригера
    const result = await handleLightboxCampaignPublish(campaign, creatives, config);

    console.log("Результат інтеграції:", result);
    return result;

    // const trigger = new LightboxCampaignTrigger(config);
    // await trigger.authenticate();
    // const mediaplans = await trigger.omlClient.getMediaplans();
    // console.log(
    //     "mediaplans",
    //     mediaplans.data.map((el) => el.commercials)
    // );
}

publishCampaignExample();
