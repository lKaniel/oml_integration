/**
 * Конфігурація змінних оточення
 * 
 * Реалізовано в рамках дипломної роботи на тему "ІНТЕГРАЦІЯ МЕДІА ПЛАТФОРМ"
 * Автор: Шевчук Віталій Ігорович
 * 
 * Цей модуль забезпечує доступ до змінних оточення для
 * конфігурації інтеграційного сервісу.
 */

/**
 * Клас для доступу до змінних оточення
 * 
 * Забезпечує отримання значень змінних оточення з
 * валідацією та значеннями за замовчуванням.
 */
export class EnvConfig {
  /**
   * Отримати значення змінної оточення
   * 
   * @param key Ключ змінної оточення
   * @param defaultValue Значення за замовчуванням
   * @returns Значення змінної оточення або значення за замовчуванням
   */
  static get(key: string, defaultValue: string = ''): string {
    return process.env[key] || defaultValue;
  }

  /**
   * Отримати числове значення змінної оточення
   * 
   * @param key Ключ змінної оточення
   * @param defaultValue Значення за замовчуванням
   * @returns Числове значення змінної оточення або значення за замовчуванням
   */
  static getNumber(key: string, defaultValue: number = 0): number {
    const value = process.env[key];
    return value ? parseInt(value, 10) : defaultValue;
  }

  /**
   * Отримати булеве значення змінної оточення
   * 
   * @param key Ключ змінної оточення
   * @param defaultValue Значення за замовчуванням
   * @returns Булеве значення змінної оточення або значення за замовчуванням
   */
  static getBoolean(key: string, defaultValue: boolean = false): boolean {
    const value = process.env[key];
    if (value === undefined) {
      return defaultValue;
    }
    return value.toLowerCase() === 'true';
  }

  /**
   * Отримати конфігурацію OML
   * 
   * @returns Об'єкт з конфігурацією OML API
   */
  static getOmlConfig() {
    return {
      omlBaseUrl: this.get('OML_BASE_URL', 'https://ge-api.omldev.org'),
      omlUsername: this.get('OML_USERNAME'),
      omlPassword: this.get('OML_PASSWORD'),
      yearId: this.getNumber('OML_YEAR_ID', 2025),
      defaultPlacementTypeId: this.getNumber('OML_DEFAULT_PLACEMENT_TYPE_ID', 1),
      defaultCommercialTypeId: this.getNumber('OML_DEFAULT_COMMERCIAL_TYPE_ID', 1),
      defaultCommercialVersionTypeId: this.getNumber('OML_DEFAULT_COMMERCIAL_VERSION_TYPE_ID', 1),
      maxRetries: this.getNumber('OML_MAX_RETRIES', 3),
      progressCallback: (progress) => {
        console.log(
            `[${progress.timestamp}] ${progress.step} (${progress.progress}%): ${progress.message}`
        );
      },
    };
  }
}
