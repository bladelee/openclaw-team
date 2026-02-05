/**
 * A2UI Message Adapter
 * Processes A2UI messages and manages surface state
 */

import type {
  A2uiBeginRendering,
  A2uiSurfaceUpdate,
  A2uiDataModelUpdate,
  A2uiDeleteSurface,
  Surface,
  A2uiComponentData,
  A2uiComponentType,
  DataModel,
  ComponentAction,
  ComponentContextValue
} from '../types';

/** Component type set */
const COMPONENT_TYPES = new Set<A2uiComponentType>([
  'AudioPlayer',
  'Button',
  'Card',
  'Column',
  'Container',
  'Divider',
  'Image',
  'Markdown',
  'Modal',
  'Progress',
  'Row',
  'Text',
  'TextField',
  'VideoPlayer'
]);

/**
 * A2UI Message Adapter
 * Processes A2UI v0.8 messages and manages surface state
 */
export class A2uiMessageAdapter {
  private surfaces = new Map<string, Surface>();
  private listeners = new Set<(surfaces: Map<string, Surface>) => void>();

  /**
   * Process A2UI messages
   */
  async applyMessages(messages: unknown[]): Promise<{ ok: boolean; surfaces: string[] }> {
    try {
      if (!Array.isArray(messages)) {
        throw new Error('A2UI: 期望消息数组');
      }

      for (const msg of messages) {
        await this.processMessage(msg);
      }

      this.notifyListeners();

      return {
        ok: true,
        surfaces: Array.from(this.surfaces.keys())
      };
    } catch (error) {
      console.error('[A2UI] 消息处理失败:', error);
      return { ok: false, surfaces: [] };
    }
  }

  /**
   * Process a single A2UI message
   */
  private async processMessage(msg: unknown): Promise<void> {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
      throw new Error('无效的消息格式');
    }

    const record = msg as Record<string, unknown>;
    const keys = Object.keys(record);

    if (keys.length !== 1) {
      throw new Error('消息必须包含且仅包含一个操作键');
    }

    const action = keys[0];

    switch (action) {
      case 'beginRendering':
        await this.handleBeginRendering(record.beginRendering as A2uiBeginRendering);
        break;
      case 'surfaceUpdate':
        await this.handleSurfaceUpdate(record.surfaceUpdate as A2uiSurfaceUpdate);
        break;
      case 'dataModelUpdate':
        await this.handleDataModelUpdate(record.dataModelUpdate as A2uiDataModelUpdate);
        break;
      case 'deleteSurface':
        await this.handleDeleteSurface(record.deleteSurface as A2uiDeleteSurface);
        break;
      default:
        throw new Error(`未知的操作类型: ${action}`);
    }
  }

  /**
   * Handle beginRendering action
   */
  private async handleBeginRendering(data: A2uiBeginRendering): Promise<void> {
    const { surfaceId, root } = data;

    // Get or create surface
    let surface = this.surfaces.get(surfaceId);
    if (!surface) {
      surface = {
        id: surfaceId,
        components: new Map(),
        dataModel: {}
      };
      this.surfaces.set(surfaceId, surface);
    }

    // Set root component
    surface.rootComponentId = root;
  }

  /**
   * Handle surfaceUpdate action
   */
  private async handleSurfaceUpdate(data: A2uiSurfaceUpdate): Promise<void> {
    const { surfaceId, components } = data;

    // Get or create surface
    let surface = this.surfaces.get(surfaceId);
    if (!surface) {
      surface = {
        id: surfaceId,
        components: new Map(),
        dataModel: {}
      };
      this.surfaces.set(surfaceId, surface);
    }

    // Clear existing components and add new ones
    surface.components.clear();

    for (const comp of components) {
      const componentData = this.parseComponent(comp);
      surface.components.set(componentData.id, componentData);
    }
  }

  /**
   * Handle dataModelUpdate action
   */
  private async handleDataModelUpdate(data: A2uiDataModelUpdate): Promise<void> {
    const { surfaceId, path, contents } = data;

    const surface = this.surfaces.get(surfaceId);
    if (!surface) {
      throw new Error(`Surface 不存在: ${surfaceId}`);
    }

    // Update data model
    if (!path || path === '/') {
      // Replace entire data model
      surface.dataModel = {};
      for (const entry of contents) {
        surface.dataModel[entry.key] = this.parseDataValue(entry);
      }
    } else {
      // Update specific path
      // For simplicity, we'll implement flat updates only
      for (const entry of contents) {
        const fullPath = path.startsWith('/')
          ? `${path.slice(1)}/${entry.key}`
          : `${path}/${entry.key}`;
        this.setNestedValue(surface.dataModel, fullPath, this.parseDataValue(entry));
      }
    }
  }

  /**
   * Handle deleteSurface action
   */
  private async handleDeleteSurface(data: A2uiDeleteSurface): Promise<void> {
    const { surfaceId } = data;
    this.surfaces.delete(surfaceId);
  }

  /**
   * Parse component from A2UI format
   */
  private parseComponent(comp: unknown): A2uiComponentData {
    if (!comp || typeof comp !== 'object' || Array.isArray(comp)) {
      throw new Error('无效的组件格式');
    }

    const record = comp as Record<string, unknown>;

    if (!record.id || typeof record.id !== 'string') {
      throw new Error('组件缺少 id');
    }

    if (!record.component || typeof record.component !== 'object' || Array.isArray(record.component)) {
      throw new Error('组件缺少 component 属性');
    }

    const componentRecord = record.component as Record<string, unknown>;
    const typeKeys = Object.keys(componentRecord).filter(k => COMPONENT_TYPES.has(k as A2uiComponentType));

    if (typeKeys.length !== 1) {
      throw new Error(`组件必须包含且仅包含一个类型键: ${record.id}`);
    }

    const type = typeKeys[0] as A2uiComponentType;
    const props = componentRecord[type] as Record<string, unknown>;

    return {
      id: record.id,
      type,
      props,
      weight: typeof record.weight === 'number' ? record.weight : undefined,
      action: this.parseAction(props.action)
    };
  }

  /**
   * Parse action from props
   */
  private parseAction(action: unknown): ComponentAction | undefined {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      return undefined;
    }

    const record = action as Record<string, unknown>;

    if (!record.name || typeof record.name !== 'string') {
      return undefined;
    }

    if (!record.surfaceId || typeof record.surfaceId !== 'string') {
      return undefined;
    }

    return {
      name: record.name,
      surfaceId: record.surfaceId,
      context: this.parseContext(record.context)
    };
  }

  /**
   * Parse context array
   */
  private parseContext(context: unknown): ComponentContextValue[] | undefined {
    if (!Array.isArray(context)) {
      return undefined;
    }

    return context.map((ctx) => {
      if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) {
        return { literalString: '' };
      }

      const record = ctx as Record<string, unknown>;

      if ('literalString' in record && typeof record.literalString === 'string') {
        return { literalString: record.literalString };
      }
      if ('literalNumber' in record && typeof record.literalNumber === 'number') {
        return { literalNumber: record.literalNumber };
      }
      if ('literalBoolean' in record && typeof record.literalBoolean === 'boolean') {
        return { literalBoolean: record.literalBoolean };
      }
      if ('path' in record && typeof record.path === 'string') {
        return { path: record.path };
      }

      return { literalString: '' };
    });
  }

  /**
   * Parse data value from data entry
   */
  private parseDataValue(entry: Record<string, unknown>): unknown {
    if ('valueString' in entry && typeof entry.valueString === 'string') {
      return entry.valueString;
    }
    if ('valueNumber' in entry && typeof entry.valueNumber === 'number') {
      return entry.valueNumber;
    }
    if ('valueBoolean' in entry && typeof entry.valueBoolean === 'boolean') {
      return entry.valueBoolean;
    }
    if ('valueObject' in entry && typeof entry.valueObject === 'object' && entry.valueObject !== null && !Array.isArray(entry.valueObject)) {
      return entry.valueObject;
    }
    if ('valueArray' in entry && Array.isArray(entry.valueArray)) {
      return entry.valueArray;
    }
    if ('valueNull' in entry && entry.valueNull === null) {
      return null;
    }

    return null;
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: DataModel, path: string, value: unknown): void {
    const parts = path.split('/');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part])) {
        current[part] = {};
      }
      current = current[part] as DataModel;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Reset all surfaces
   */
  reset(): { ok: boolean } {
    this.surfaces.clear();
    this.notifyListeners();
    return { ok: true };
  }

  /**
   * Get surface IDs
   */
  getSurfaces(): string[] {
    return Array.from(this.surfaces.keys());
  }

  /**
   * Get all surfaces
   */
  getAllSurfaces(): Map<string, Surface> {
    return this.surfaces;
  }

  /**
   * Subscribe to surface changes
   */
  subscribe(listener: (surfaces: Map<string, Surface>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(new Map(this.surfaces)));
  }

  /**
   * Resolve path value from data model
   * @param surfaceId Surface ID
   * @param path Path to resolve (e.g., "/user/name" or "user.name")
   * @returns Resolved value or undefined
   */
  resolvePathValue(surfaceId: string, path: string): unknown {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) {
      return undefined;
    }

    // Normalize path (remove leading slash and dots)
    const normalizedPath = path.replace(/^\//, '').replace(/\./g, '/');

    if (!normalizedPath) {
      return undefined;
    }

    const parts = normalizedPath.split('/');
    let value: unknown = surface.dataModel;

    for (const part of parts) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Resolve all path contexts to actual values
   * @param surfaceId Surface ID
   * @param context Context array with path values
   * @returns Resolved context object
   */
  resolveContextValues(surfaceId: string, context?: ComponentContextValue[]): Record<string, unknown> {
    if (!context) {
      return {};
    }

    const resolved: Record<string, unknown> = {};

    for (const ctx of context) {
      const { key, value } = ctx;

      if ('path' in value) {
        // Resolve from data model
        resolved[key] = this.resolvePathValue(surfaceId, value.path);
      } else if ('literalString' in value) {
        resolved[key] = value.literalString;
      } else if ('literalNumber' in value) {
        resolved[key] = value.literalNumber;
      } else if ('literalBoolean' in value) {
        resolved[key] = value.literalBoolean;
      }
    }

    return resolved;
  }
}
