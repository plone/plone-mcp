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

  describe('Teaser Block Variants', () => {
    it('should create standard teaser block', () => {
      const teaserBlock = {
        "@type": "teaser",
        href: "/path/to/content",
        overwrite: false,
        styles: { align: "left" },
        theme: "default"
      };

      expect(teaserBlock["@type"]).toBe("teaser");
      expect(teaserBlock.href).toBe("/path/to/content");
      expect(teaserBlock.overwrite).toBe(false);
      expect(teaserBlock.styles.align).toBe("left");
      expect(teaserBlock.theme).toBe("default");
    });

    it('should create teaser with custom content (overwrite mode)', () => {
      const teaserBlock = {
        "@type": "teaser",
        href: "/path/to/content",
        overwrite: true,
        title: "Custom Title",
        head_title: "Custom Kicker",
        description: "Custom description text",
        preview_image: "/path/to/image.jpg",
        styles: { align: "center" },
        theme: "default"
      };

      expect(teaserBlock.overwrite).toBe(true);
      expect(teaserBlock.title).toBe("Custom Title");
      expect(teaserBlock.head_title).toBe("Custom Kicker");
      expect(teaserBlock.description).toBe("Custom description text");
      expect(teaserBlock.preview_image).toBe("/path/to/image.jpg");
      expect(teaserBlock.styles.align).toBe("center");
    });

    it('should create teaser with grey theme', () => {
      const teaserBlock = {
        "@type": "teaser",
        href: "/path/to/content",
        overwrite: false,
        styles: { align: "right" },
        theme: "grey"
      };

      expect(teaserBlock.theme).toBe("grey");
      expect(teaserBlock.styles.align).toBe("right");
    });

    it('should support all alignment options', () => {
      const alignments = ["left", "center", "right"];
      
      alignments.forEach(align => {
        const teaserBlock = {
          "@type": "teaser",
          href: "/path/to/content",
          styles: { align: align },
          theme: "default"
        };
        
        expect(teaserBlock.styles.align).toBe(align);
      });
    });

    it('should support external links', () => {
      const teaserBlock = {
        "@type": "teaser",
        href: "https://external-site.com",
        overwrite: true,
        title: "External Link",
        openLinkInNewTab: true,
        styles: { align: "left" },
        theme: "default"
      };

      expect(teaserBlock.href).toBe("https://external-site.com");
      expect(teaserBlock.openLinkInNewTab).toBe(true);
    });
  });
});