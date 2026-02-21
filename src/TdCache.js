const redis = require('redis');

class TdCache {

    constructor(config) {
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

    async set(key, value, options) {
        let redisOptions = {};
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

    async incr(key) {
        try {
            return await this.client.incr(key);
        } catch (error) {
            console.error("Redis incr error:", error);
            throw error;
        }
    }

    async hset(dict_key, key, value, options) {
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

    async hdel(dict_key, key, options) {
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

    async setJSON(key, value, options) {
      const _string = JSON.stringify(value);
      return await this.set(key, _string, options);
    }

    async get(key, callback) {
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

    async hgetall(dict_key, callback) {
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

    async hget(dict_key, key, callback) {
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

    async getJSON(key) {
      const value = await this.get(key);
      if (!value) return null;
      try {
          return JSON.parse(value);
      } catch (e) {
          return null;
      }
    }

    async del(key, callback) {
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

module.exports = { TdCache };

