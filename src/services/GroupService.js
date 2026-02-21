const logger = require('../tiledesk-logger').logger;

class GroupService {
  constructor(options = {}) {
    this.chatdb = options.chatdb;
    this.tdcache = options.tdcache;
    this.redis_enabled = options.redis_enabled;
  }

  getGroup(group_id, callback) {
    logger.log("**** getGroup:", group_id);
    this.groupFromCache(group_id, (group) => {
      if (group) {
        logger.log("--GROUP", group_id, "FOUND IN CACHE:", group);
        callback(null, group);
      } else {
        logger.log("--GROUP", group_id, "NO CACHE! GET FROM DB...");
        this.chatdb.getGroup(group_id, (err, group) => {
          if (!err && group) {
            this.saveGroupInCache(group, group_id);
          }
          logger.log("group from db:", group);
          callback(err, group);
        });
      }
    });
  }

  groupFromCache(group_id, callback) {
    if (this.redis_enabled && this.tdcache && this.tdcache.client) {
      const group_key = "chat21:messages:groups:" + group_id;
      this.tdcache.client.get(group_key, (err, group) => {
        if (err) {
          logger.error("Error during groupFromCache():", err);
          callback(null);
        } else {
          callback(group ? JSON.parse(group) : null);
        }
      });
    } else {
      callback(null);
    }
  }

  async saveGroupInCache(group, group_id) {
    if (this.redis_enabled && this.tdcache) {
      const group_key = "chat21:messages:groups:" + group_id;
      try {
        await this.tdcache.set(group_key, JSON.stringify(group), { EX: 86400 });
      } catch (err) {
        logger.error("Error saving group in cache:", err);
      }
    }
  }
}

module.exports = GroupService;
