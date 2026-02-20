/**
 * Wait Helper for E2E Tests
 * Provides custom waiting functions for async operations
 */
import { Page } from 'playwright';

/**
 * Wait for a specific duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for condition with timeout
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const { timeout = 30000, interval = 100, message = 'Condition not met' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
}

/**
 * Wait for element to contain text
 */
export async function waitForText(
  page: Page,
  selector: string,
  text: string,
  timeout: number = 30000
): Promise<void> {
  await page.waitForFunction(
    ({ sel, txt }) => {
      const element = document.querySelector(sel);
      return element && element.textContent?.includes(txt);
    },
    { sel: selector, txt: text },
    { timeout }
  );
}

/**
 * Wait for element to be visible
 */
export async function waitForVisible(
  page: Page,
  selector: string,
  timeout: number = 30000
): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Wait for element to be hidden
 */
export async function waitForHidden(
  page: Page,
  selector: string,
  timeout: number = 30000
): Promise<void> {
  await page.waitForSelector(selector, { state: 'hidden', timeout });
}

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(
  page: Page,
  timeout: number = 30000
): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = 30000
): Promise<any> {
  const response = await page.waitForResponse(
    (response) => {
      if (typeof urlPattern === 'string') {
        return response.url().includes(urlPattern);
      }
      return urlPattern.test(response.url());
    },
    { timeout }
  );
  return response.json();
}

/**
 * Wait for audio processing (longer timeout for STT/TTS)
 */
export async function waitForAudioProcessing(
  page: Page,
  timeout: number = 60000
): Promise<void> {
  await sleep(timeout);
}

/**
 * Retry operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; initialDelay?: number; maxDelay?: number } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000 } = options;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw new Error('Retry failed');
}
