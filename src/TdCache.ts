import * as redis from 'redis';

export class TdCache {
    redis_host: string;
    redis_port: number;
    redis_password?: string;
    client: any;

    constructor(config: any) {
        this.redis_host = config.host;
        this.redis_port = config.port;
        this.redis_password = config.password;
        this.client = null;
    }

    async connect() {
        let redisUrl = 'redis://';
        if (this.redis_password) {
            redisUrl += `:${this.redis_password}@`;
        }
        redisUrl += `${this.redis_host}:${this.redis_port}`;

        this.client = redis.createClient({
            url: redisUrl
        });

        this.client.on('error', err => {
            console.error('Redis Client Error', err);
        });

        await this.client.connect();
    }

    async set(key: string, value: any, options?: any) {
        let redisOptions: any = {};
        if (options && options.EX) {
            redisOptions.EX = options.EX;
        }

        try {
            await this.client.set(key, value, redisOptions);
            if (options && options.callback) {
                options.callback();
            }
        } catch (error) {
            console.error("Redis set error", error);
            throw error;
        }
    }

    async incr(key: string) {
        try {
            return await this.client.incr(key);
        } catch (error) {
            console.error("Redis incr error:", error);
            throw error;
        }
    }

    async hset(dict_key: string, key: string, value: any, options?: any) {
        try {
            await this.client.hSet(dict_key, key, value);
            if (options && options.EX) {
                await this.client.expire(dict_key, options.EX);
            }
            if (options && options.callback) {
                options.callback();
            }
        } catch (error) {
            console.error("Redis hset error", error);
            throw error;
        }
    }

    async hdel(dict_key: string, key: string, options?: any) {
        try {
            await this.client.hDel(dict_key, key);
            if (options && options.callback) {
                options.callback();
            }
        } catch (error) {
            console.error("Redis hdel error", error);
            throw error;
        }
    }

    async setJSON(key: string, value: any, options?: any) {
        const _string = JSON.stringify(value);
        return await this.set(key, _string, options);
    }

    async get(key: string, callback?: any) {
        try {
            const value = await this.client.get(key);
            if (callback) {
                callback(value);
            }
            return value;
        } catch (error) {
            console.error("Redis get error", error);
            throw error;
        }
    }

    async hgetall(dict_key: string, callback?: any) {
        try {
            const value = await this.client.hGetAll(dict_key);
            if (callback) {
                callback(null, value);
            }
            return value;
        } catch (error) {
            if (callback) {
                callback(error, null);
            }
            console.error("Redis hgetall error", error);
            throw error;
        }
    }

    async hget(dict_key: string, key: string, callback?: any) {
        try {
            const value = await this.client.hGet(dict_key, key);
            if (callback) {
                callback(null, value);
            }
            return value;
        } catch (error) {
            if (callback) {
                callback(error, null);
            }
            console.error("Redis hget error", error);
            throw error;
        }
    }

    async getJSON(key: string) {
        const value = await this.get(key);
        if (!value) return null;
        try {
            return JSON.parse(value);
        } catch (e) {
            return null;
        }
    }

    async del(key: string, callback?: any) {
        try {
            await this.client.del(key);
            if (callback) {
                callback();
            }
        } catch (error) {
            console.error("Redis del error", error);
            throw error;
        }
    }
}

