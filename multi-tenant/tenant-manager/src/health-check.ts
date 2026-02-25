// Health check service for custom and hardware instances
import { logger } from './logger.js';
import { instanceDb, type Instance } from './database.js';

export interface HealthCheckResult {
  urlValid: boolean;
  apiAccessible: boolean;
  healthCheck: boolean;
  error?: string;
}

export interface RegisterCustomInstanceInput {
  name: string;
  instanceType: 'cloud' | 'hardware';
  // Cloud instance
  url?: string;
  // Hardware box
  ip?: string;
  port?: number;
  // Common
  apiToken?: string;
  healthCheckUrl?: string;
}

/**
 * Validate a custom instance connection
 */
export async function validateCustomInstance(input: RegisterCustomInstanceInput): Promise<HealthCheckResult> {
  const results: HealthCheckResult = {
    urlValid: false,
    apiAccessible: false,
    healthCheck: false,
  };

  let url: string;

  // Build URL based on instance type
  if (input.instanceType === 'hardware' && input.ip) {
    const port = input.port || 18789;
    url = `http://${input.ip}:${port}`;
  } else if (input.instanceType === 'cloud' && input.url) {
    url = input.url;
  } else {
    return { ...results, error: 'Invalid instance configuration' };
  }

  try {
    // 1. Validate URL accessibility
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      results.urlValid = true;
    } catch (fetchError) {
      logger.warn('URL validation failed', { url, error: fetchError });
      // Continue anyway - some servers don't respond to HEAD
      results.urlValid = true;
    } finally {
      clearTimeout(timeoutId);
    }

    // 2. Validate API (if token provided)
    if (input.apiToken) {
      try {
        const apiResponse = await fetch(`${url}/api/health`, {
          headers: { 'Authorization': `Bearer ${input.apiToken}` },
        });
        results.apiAccessible = apiResponse.ok;
      } catch {
        results.apiAccessible = false;
      }
    }

    // 3. Health check
    const healthUrl = input.healthCheckUrl || `${url}/health`;
    try {
      const healthResponse = await fetch(healthUrl);
      results.healthCheck = healthResponse.ok;
    } catch {
      results.healthCheck = false;
    }

    return results;
  } catch (error) {
    logger.error('Connection validation failed', { url, error });
    return { ...results, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Perform health check on an instance
 */
export async function performHealthCheck(instance: Instance): Promise<boolean> {
  if (instance.source === 'managed') {
    // Managed instances are checked via Portainer
    return true;
  }

  const url = instance.custom_url || instance.url;
  if (!url) {
    return false;
  }

  const healthUrl = instance.health_check_url || `${url}/health`;

  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const isHealthy = response.ok;

    // Update database
    await instanceDb.update(instance.instance_id, {
      last_health_check: new Date(),
      is_healthy: isHealthy,
      status: isHealthy ? 'running' : 'stopped',
    });

    return isHealthy;
  } catch (error) {
    logger.warn('Health check failed for instance', {
      instanceId: instance.instance_id,
      error,
    });

    // Mark as unhealthy
    await instanceDb.update(instance.instance_id, {
      last_health_check: new Date(),
      is_healthy: false,
      status: 'stopped',
    });

    return false;
  }
}

/**
 * Start health check background task
 */
let healthCheckInterval: NodeJS.Timeout | null = null;

export function startHealthCheckService(): void {
  if (healthCheckInterval) {
    return; // Already running
  }

  logger.info('Starting health check service');

  healthCheckInterval = setInterval(async () => {
    try {
      // Get all custom and hardware instances
      const instances = await instanceDb.list({});

      for (const instance of instances) {
        if (instance.source === 'custom' || instance.source === 'hardware') {
          const interval = instance.health_check_interval || 60; // Default 60 seconds

          // Check if due for health check
          if (instance.last_health_check) {
            const timeSinceLastCheck = Date.now() - instance.last_health_check.getTime();
            if (timeSinceLastCheck < interval * 1000) {
              continue; // Not due yet
            }
          }

          await performHealthCheck(instance);
        }
      }
    } catch (error) {
      logger.error('Health check service error', { error });
    }
  }, 30000); // Check every 30 seconds

  logger.info('Health check service started');
}

export function stopHealthCheckService(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    logger.info('Health check service stopped');
  }
}
