import { Test, TestingModule } from '@nestjs/testing';
import { ResourceMappingService } from './resource-mapping.service';
import { ResourceMappingRepository } from '@libs/core-workflow/resource/repositories/resource-mapping.repository';
import { ResourceService } from '@libs/core-workflow/resource/services/resource.service';

describe('ResourceMappingService', () => {
  let service: ResourceMappingService;


  const mockRepository = {};
  const mockResourceService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourceMappingService,
        { provide: ResourceMappingRepository, useValue: mockRepository },
        { provide: ResourceService, useValue: mockResourceService },
      ],
    }).compile();

    service = module.get<ResourceMappingService>(ResourceMappingService);
  });

  describe('merge()', () => {
    it('should deeply merge two objects and handle unique arrays', () => {

      const target = {
        id: 1,
        meta: { tags: ['old'], version: 1 },
        settings: { theme: 'dark' },
      };
      const source = {
        meta: { tags: ['new'], author: 'admin' },
        settings: { theme: 'light', notifications: true },
      };


      const result = service.merge(target as any, source as any);


      expect(result).toEqual({
        id: 1,
        meta: {
          tags: ['old', 'new'], 
          version: 1,
          author: 'admin',      
        settings: {
          theme: 'dark',        
          notifications: true,
        },
      });
    });

    it('should handle undefined values by picking the available one', () => {
      const target = { a: undefined, b: 2 };
      const source = { a: 1, b: undefined };

      const result = service.merge(target as any, source as any);

      expect(result.a).toBe(1);
      expect(result.b).toBe(2);
    });

    it('should prevent duplicate items in merged arrays', () => {
      const target = { list: [1, 2] };
      const source = { list: [2, 3] };

      const result = service.merge(target as any, source as any);

      expect(result.list).toEqual([1, 2, 3]); 
    });
  });
});
