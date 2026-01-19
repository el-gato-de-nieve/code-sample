import { Injectable, NotFoundException } from '@nestjs/common';
import { ResourceMappingEntity } from '@libs/core-workflow/resource/entities/resource-mapping.entity';
import { ResourceMappingRepository } from '@libs/core-workflow/resource/repositories/resource-mapping.repository';
import { ResourceContent } from '@libs/core-workflow/resource/models';
import { ResourceService } from '@libs/core-workflow/resource/services/resource.service';
import * as _ from 'lodash';

type PlainObject = Record<string, unknown>;

@Injectable()
export class ResourceMappingService {
  constructor(
    private readonly resourceMappingRepository: ResourceMappingRepository,
    private readonly resourceService: ResourceService,
  ) {}

  public async map(
    originResourceContent: ResourceContent,
    mapping: ResourceMappingEntity,
  ): Promise<ResourceContent> {
    return this.transformData(originResourceContent, mapping) as Promise<ResourceContent>;
  }

  /**
   * Основная логика трансформации данных по схеме
   */
  public async transformData(
    source: PlainObject,
    mapping: ResourceMappingEntity,
  ): Promise<PlainObject> {
    const target: PlainObject = {};

    // Оптимизация: получаем схему ОДИН раз для всех полей
    const resourceSchema = await this.resourceService.getResourceSchemaVersionByKey(
      mapping.targetSchema.key,
    );
    
    const schemaRoot = resourceSchema?.currentResourceSchemaVersion?.schema;
    if (!schemaRoot) {
      throw new NotFoundException('Target schema definition not found');
    }

    for (const [targetPath, sourcePath] of Object.entries(mapping.value)) {
      const rawValue = _.get(source, sourcePath);

      if (rawValue !== undefined) {
        const schemaDefinition = this.getSchemaDefinition(schemaRoot, targetPath);
        const castedValue = this.castValue(rawValue, schemaDefinition?.type);
        
        _.set(target, targetPath, castedValue);
      }
    }

    return target;
  }

  /**
   * Слияние контента с приоритетом исходного объекта
   */
  public merge(content: ResourceContent, additionalContent: ResourceContent): ResourceContent {
    return this.deepMergeSafe(content as PlainObject, additionalContent as PlainObject) as ResourceContent;
  }

  // --- Приватные утилиты ---

  private castValue(value: unknown, type?: string): unknown {
    if (type === 'string' && value !== null) return String(value);
    if (type === 'number' && value !== null) return Number(value);
    return value;
  }

  private isPlainObject(v: unknown): v is PlainObject {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  private deepMergeSafe(target: PlainObject, source: PlainObject): PlainObject {
    const out: PlainObject = { ...target };
    const keys = new Set([...Object.keys(target), ...Object.keys(source)]);

    for (const key of keys) {
      const tVal = target[key];
      const sVal = source[key];

      if (Array.isArray(tVal) && Array.isArray(sVal)) {
        out[key] = Array.from(new Set([...tVal, ...sVal]));
      } else if (this.isPlainObject(tVal) && this.isPlainObject(sVal)) {
        out[key] = this.deepMergeSafe(tVal, sVal);
      } else {
        out[key] = tVal ?? sVal;
      }
    }

    return out;
  }

  private getSchemaDefinition(schemaRoot: any, path: string): any {
    const keys = path.split('.');
    let current = schemaRoot;

    for (const key of keys) {
      if (!current) return undefined;

      // Логика обхода JSON Schema (properties или items для массивов)
      if (current.properties?.[key]) {
        current = current.properties[key];
      } else if (key.includes('[')) {
        const cleanKey = key.split('[')[0];
        const arrayNode = current.properties?.[cleanKey];
        current = arrayNode?.items;
      } else {
        current = current[key];
      }
    }
    return current;
  }
}
