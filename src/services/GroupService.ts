import { logger } from '../tiledesk-logger';

class GroupService {
  chatdb: any;
  tdcache: any;
  redis_enabled: boolean;

  constructor(options: any = {}) {
    this.chatdb = options.chatdb;
    this.tdcache = options.tdcache;
    this.redis_enabled = options.redis_enabled;
  }

  async getGroup(group_id, callback?: any) {
    logger.log("**** getGroup:", group_id);
    try {
      const group = await this.groupFromCache(group_id);
      if (group) {
        logger.log("--GROUP", group_id, "FOUND IN CACHE:", group);
        if (callback) callback(null, group);
        return group;
      } else {
        logger.log("--GROUP", group_id, "NO CACHE! GET FROM DB...");
        let dbGroup = await this.chatdb.getGroup(group_id);
        if (!dbGroup && !group_id.startsWith('group-')) {
          const prefixed_group_id = 'group-' + group_id;
          logger.log("--GROUP", group_id, "NOT FOUND IN DB. TRYING WITH PREFIX:", prefixed_group_id);
          dbGroup = await this.chatdb.getGroup(prefixed_group_id);
        }
        if (dbGroup) {
          this.saveGroupInCache(dbGroup, group_id);
        }
        logger.log("group from db:", dbGroup);
        if (callback) callback(null, dbGroup);
        return dbGroup;
      }
    } catch (err) {
      if (callback) callback(err);
      throw err;
    }
  }

  async groupFromCache(group_id, callback?: any) {
    if (this.redis_enabled && this.tdcache) {
      const group_key = "chat21:messages:groups:" + group_id;
      try {
        const group = await this.tdcache.get(group_key);
        const parsedGroup = group ? JSON.parse(group) : null;
        if (callback) callback(parsedGroup);
        return parsedGroup;
      } catch (err) {
        logger.error("Error during groupFromCache():", err);
        if (callback) callback(null);
        return null;
      }
    } else {
      if (callback) callback(null);
      return null;
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

  async saveGroup(group, callback?: any) {
    logger.log("**** saveGroup:", group.uid);
    try {
      const savedGroup = await this.chatdb.saveOrUpdateGroup(group);
      this.saveGroupInCache(group, group.uid);
      if (callback) callback(null, savedGroup);
      return savedGroup;
    } catch (err) {
      if (callback) callback(err);
      throw err;
    }
  }
}

export default GroupService;
