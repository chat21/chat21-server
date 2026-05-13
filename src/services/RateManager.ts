import { TdCache } from '../TdCache';
import { RateBucket } from '../types';

interface BucketRate {
  capacity: number;
  /** Tokens replenished per second */
  refill_rate: number;
}

interface DefaultRates {
  webhook: BucketRate;
  message: BucketRate;
  block: BucketRate;
  [key: string]: BucketRate;
}

export interface RateManagerConfig {
  tdCache: TdCache;
}

class RateManager {
  private tdCache: TdCache;
  private defaultRates: DefaultRates;

  constructor(config: RateManagerConfig) {
    if (!config) {
      throw new Error('config is mandatory');
    }
    if (!config.tdCache) {
      throw new Error('config.tdCache is mandatory');
    }

    this.tdCache = config.tdCache;

    this.defaultRates = {
      webhook: {
        capacity: parseInt(process.env.BUCKET_WH_CAPACITY ?? '10') || 10,
        refill_rate: (parseInt(process.env.BUCKET_WH_REFILL_RATE_PER_MIN ?? '10') || 10) / 60,
      },
      message: {
        capacity: parseInt(process.env.BUCKET_MSG_CAPACITY ?? '30') || 30,
        refill_rate: (parseInt(process.env.BUCKET_MSG_REFILL_RATE_PER_MIN ?? '30') || 30) / 60,
      },
      block: {
        capacity: parseInt(process.env.BUCKET_BLK_CAPACITY ?? '100') || 100,
        refill_rate: (parseInt(process.env.BUCKET_BLK_REFILL_RATE_PER_MIN ?? '100') || 100) / 60,
      },
    };

    console.log('(RateManager) started with rates: ', this.defaultRates);
  }

  async canExecute(id: string, type: string): Promise<boolean> {
    if (!type) {
      console.warn("(RateManager) 'type' is not defined! Skip...");
      return true;
    }
    const key = `bucket:${type}:${id}`;
    const config = this.defaultRates[type];
    const bucket = await this.getBucket(key, type);
    const current_tokens = bucket.tokens;
    const elapsed = (new Date().getTime() - new Date(bucket.timestamp).getTime()) / 1000;
    let tokens = Math.min(config.capacity, current_tokens + elapsed * config.refill_rate);

    if (tokens > 0) {
      tokens -= 1;
      bucket.tokens = tokens;
      bucket.timestamp = new Date();
      // Fire-and-forget: the write-back persists state for the NEXT request only.
      this.setBucket(key, bucket).catch((err) => console.error('(RateManager) setBucket error:', err));
      return true;
    } else {
      bucket.timestamp = new Date();
      return false;
    }
  }

  getRateConfig(type: string): BucketRate {
    return this.defaultRates[type];
  }

  async setBucket(key: string, bucket: RateBucket): Promise<void> {
    const bucket_string = JSON.stringify(bucket);
    await this.tdCache.set(key, bucket_string, { EX: 600 });
  }

  async getBucket(key: string, type: string): Promise<RateBucket> {
    const bucket = await this.tdCache.get(key);
    if (bucket) {
      return JSON.parse(bucket) as RateBucket;
    }
    return this.createBucket(type);
  }

  createBucket(type: string): RateBucket {
    const config = this.defaultRates[type];
    return {
      tokens: config.capacity,
      timestamp: new Date(),
    };
  }
}

export default RateManager;
