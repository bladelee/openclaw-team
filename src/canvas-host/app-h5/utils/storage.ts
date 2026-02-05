/**
 * 本地存储工具
 */

export const storage = {
  /**
   * 获取存储的值
   */
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  /**
   * 设置值
   */
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('存储失败:', error);
    }
  },

  /**
   * 删除值
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('删除失败:', error);
    }
  },

  /**
   * 清空所有存储
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('清空失败:', error);
    }
  }
};
