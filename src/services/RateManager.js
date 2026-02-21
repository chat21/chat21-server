
class RateManager {

    constructor(config) {

        if (!config) {
            throw new Error('config is mandatory')
        }

        if (!config.tdCache) {
            throw new Error('config.tdCache is mandatory')
        }

        this.tdCache = config.tdCache;

    
        // Default rates 
        this.defaultRates = {
            webhook: {
                capacity: parseInt(process.env.BUCKET_WH_CAPACITY) || 10,
                refill_rate: (parseInt(process.env.BUCKET_WH_REFILL_RATE_PER_MIN) || 10) / 60
            },
            message: {
                capacity: parseInt(process.env.BUCKET_MSG_CAPACITY) || 30,
                refill_rate: (parseInt(process.env.BUCKET_MSG_REFILL_RATE_PER_MIN) || 30) / 60
            },
            block: {
                capacity: parseInt(process.env.BUCKET_BLK_CAPACITY) || 100,
                refill_rate: (parseInt(process.env.BUCKET_BLK_REFILL_RATE_PER_MIN) || 100) / 60
            }
        }

        console.log("(RateManager) started with rates: ", this.defaultRates);
    }

    async canExecute(id, type) {
        
        if (!type) {
            console.warn("(RateManager) 'type' is not defined! Skip...")
            return true;
        }
        const key = `bucket:${type}:${id}`

        //const config = await this.getRateConfig(type);
        const config = this.defaultRates[type];
        let bucket = await this.getBucket(key, type);
        let current_tokens = bucket.tokens;
        let elapsed = (new Date() - new Date(bucket.timestamp)) / 1000;
        let tokens = Math.min(config.capacity, current_tokens + (elapsed * config.refill_rate));

        if (tokens > 0) {
            tokens -= 1;
            bucket.tokens = tokens;
            bucket.timestamp = new Date();
            this.setBucket(key, bucket)
            return true;
        } else {
            bucket.timestamp = new Date();
            return false;
        }
    }

    async getRateConfig(type) {
        return this.defaultRates[type];
    }

    async setBucket(key, bucket) {
        const bucket_string = JSON.stringify(bucket);
        await this.tdCache.set(key, bucket_string, { EX: 600 });
    }

    async getBucket(key, type) {
        let bucket = await this.tdCache.get(key);
        if (bucket) {
            return JSON.parse(bucket);
        }
        bucket = await this.createBucket(type);
        return bucket;
    }

    async createBucket(type) {
        //const config = await this.getRateConfig(type)
        const config = this.defaultRates[type];
        return {
            tokens: config.capacity,
            timestamp: new Date()
        }
    }

}

module.exports = RateManager;