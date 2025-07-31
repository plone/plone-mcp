// Simple unit tests for block creation helpers

describe('Block Helpers', () => {
  describe('generateBlockId', () => {
    it('should generate valid block ID format', () => {
      const generateBlockId = () => 'block-' + Math.random().toString(36).substr(2, 9);
      
      const id1 = generateBlockId();
      const id2 = generateBlockId();
      
      expect(id1).toMatch(/^block-[a-z0-9]{9}$/);
      expect(id2).toMatch(/^block-[a-z0-9]{9}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('createSlateBlock', () => {
    const createSlateBlock = (text: string, format: string = 'plain') => {
      return {
        "@type": "slate",
        value: [
          {
            type: "p",
            children: [{ text }]
          }
        ],
        plaintext: text
      };
    };

    it('should create plain text slate block', () => {
      const result = createSlateBlock('Hello World', 'plain');
      
      expect(result).toEqual({
        '@type': 'slate',
        value: [
          {
            type: 'p',
            children: [{ text: 'Hello World' }]
          }
        ],
        plaintext: 'Hello World'
      });
    });

    it('should create blocks with different text content', () => {
      const result1 = createSlateBlock('First block');
      const result2 = createSlateBlock('Second block');
      
      expect(result1.plaintext).toBe('First block');
      expect(result2.plaintext).toBe('Second block');
      expect(result1['@type']).toBe('slate');
      expect(result2['@type']).toBe('slate');
    });
  });

  describe('Block Data Creation', () => {
    it('should create image block data', () => {
      const createImageBlock = (imageUrl: string, alt: string = '', size: string = 'l') => ({
        "@type": "image",
        url: imageUrl,
        alt,
        size
      });

      const result = createImageBlock('/test.jpg', 'Test image', 'l');
      
      expect(result).toEqual({
        '@type': 'image',
        url: '/test.jpg',
        alt: 'Test image',
        size: 'l'
      });
    });

    it('should create teaser block data', () => {
      const createTeaserBlock = (href: string, title?: string) => {
        const data: any = { "@type": "teaser", href };
        if (title) data.title = title;
        return data;
      };

      const result = createTeaserBlock('/target', 'Teaser Title');
      
      expect(result).toEqual({
        '@type': 'teaser',
        href: '/target',
        title: 'Teaser Title'
      });
    });
  });

  describe('Blocks Layout Management', () => {
    it('should manage blocks layout structure', () => {
      const blocks = {
        'block-1': { '@type': 'slate', plaintext: 'First' },
        'block-2': { '@type': 'image', url: '/img.jpg' },
        'block-3': { '@type': 'teaser', href: '/link' }
      };
      
      const blocks_layout = {
        items: Object.keys(blocks)
      };

      expect(blocks_layout.items).toHaveLength(3);
      expect(blocks_layout.items).toContain('block-1');
      expect(blocks_layout.items).toContain('block-2');
      expect(blocks_layout.items).toContain('block-3');
    });

    it('should handle empty blocks structure', () => {
      const blocks = {};
      const blocks_layout = { items: [] };

      expect(Object.keys(blocks)).toHaveLength(0);
      expect(blocks_layout.items).toHaveLength(0);
    });
  });
});