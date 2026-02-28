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
        console.log("[GS_CACHE_HIT] Group found in CACHE:", group_id, "members:", group.members ? Object.keys(group.members) : "NONE", "full members object:", JSON.stringify(group.members));
        logger.log("--GROUP", group_id, "FOUND IN CACHE:", group);
        if (callback) callback(null, group);
        return group;
      } else {
        console.log("[GS_CACHE_MISS] Group NOT in cache, fetching from DB:", group_id);
        logger.log("--GROUP", group_id, "NO CACHE! GET FROM DB...");
        let dbGroup = await this.chatdb.getGroup(group_id);
        if (!dbGroup && !group_id.startsWith('group-')) {
          const prefixed_group_id = 'group-' + group_id;
          console.log("[GS_DB_RETRY] Not found, retrying with prefix:", prefixed_group_id);
          logger.log("--GROUP", group_id, "NOT FOUND IN DB. TRYING WITH PREFIX:", prefixed_group_id);
          dbGroup = await this.chatdb.getGroup(prefixed_group_id);
        }
        if (dbGroup) {
          console.log("[GS_DB_HIT] Group found in DB:", group_id, "members:", dbGroup.members ? Object.keys(dbGroup.members) : "NONE", "full members object:", JSON.stringify(dbGroup.members), "appId:", dbGroup.appId);
          this.saveGroupInCache(dbGroup, group_id);
        } else {
          console.log("[GS_DB_MISS] Group NOT found in DB:", group_id);
        }
        logger.log("group from db:", dbGroup);
        if (callback) callback(null, dbGroup);
        return dbGroup;
      }
    } catch (err) {
      console.log("[GS_ERROR] Error in getGroup:", group_id, err);
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
    console.log("[GS_SAVE] Saving group:", group.uid, "with members:", group.members ? Object.keys(group.members) : "NONE", "full group:", JSON.stringify(group));
    try {
      const savedGroup = await this.chatdb.saveOrUpdateGroup(group);
      console.log("[GS_SAVED] Group saved to DB:", group.uid, "members:", group.members ? Object.keys(group.members) : "NONE");
      this.saveGroupInCache(group, group.uid);
      if (callback) callback(null, savedGroup);
      return savedGroup;
    } catch (err) {
      console.log("[GS_SAVE_ERROR] Error saving group:", group.uid, err);
      if (callback) callback(err);
      throw err;
    }
  }
}

export default GroupService;
