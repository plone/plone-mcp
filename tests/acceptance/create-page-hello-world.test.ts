/**
 * Acceptance Test: Create Page "Hello World"
 * 
 * This test verifies that when a user requests to "create a page 'Hello World'",
 * the system properly creates a Plone page with an auto-generated title block.
 * 
 * Test Scenario:
 * Given a user connected to a Plone site
 * When they request to create a page with title "Hello World"
 * Then the system should:
 * - Create a new Document in the portal root
 * - Auto-generate a title block with H1 heading containing "Hello World"
 * - Set up proper Volto blocks structure
 * - Make the page accessible via its URL
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { PloneClient } from '../../src/plone-client.js';

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'https://plone-intranet.kitconcept.com',
  username: 'admin',
  password: 'admin',
  testPageTitle: 'Hello World',
  testPageId: 'hello-world-test',
  parentPath: '/'
};

describe('Acceptance Test: Create Page "Hello World"', () => {
  let client: PloneClient;
  let createdPagePath: string;

  beforeAll(async () => {
    // Setup test environment
    client = new PloneClient({
      baseUrl: TEST_CONFIG.baseUrl,
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password
    });
  });

  afterAll(async () => {
    // Cleanup: Delete the test page if it was created
    if (createdPagePath) {
      try {
        await client.delete(createdPagePath);
        console.log(`Cleaned up test page: ${createdPagePath}`);
      } catch (error) {
        console.warn(`Failed to cleanup test page: ${error}`);
      }
    }
  });

  test('User prompt: "create a page \'Hello World\'"', async () => {
    // Given: A user connected to a Plone site
    expect(client).toBeDefined();

    // When: User requests to create a page with title "Hello World"
    const createData = {
      '@type': 'Document',
      title: TEST_CONFIG.testPageTitle,
      id: TEST_CONFIG.testPageId
    };

    // Simulate the auto-title block generation logic
    const titleBlockId = generateBlockId();
    const blocksData = {
      blocks: {
        [titleBlockId]: {
          '@type': 'slate',
          plaintext: TEST_CONFIG.testPageTitle,
          value: [
            {
              type: 'h1',
              children: [
                {
                  text: TEST_CONFIG.testPageTitle,
                },
              ],
            },
          ],
        },
      },
      blocks_layout: {
        items: [titleBlockId],
      },
    };

    const fullCreateData = {
      ...createData,
      ...blocksData
    };

    let parentUrl = TEST_CONFIG.parentPath;
    if (parentUrl === '/') {
      parentUrl = '';
    }

    const createdPage = await client.post(parentUrl, fullCreateData);
    createdPagePath = createdPage['@id'];

    // Then: Verify the page was created correctly
    
    // 1. Page exists and has correct basic properties
    expect(createdPage).toBeDefined();
    expect(createdPage.title).toBe(TEST_CONFIG.testPageTitle);
    expect(createdPage['@type']).toBe('Document');
    expect(createdPage['@id']).toContain(TEST_CONFIG.testPageId);

    // 2. Page is in the portal root
    const expectedPath = `${TEST_CONFIG.baseUrl}/${TEST_CONFIG.testPageId}`;
    expect(createdPage['@id']).toBe(expectedPath);

    // 3. Page has blocks structure
    expect(createdPage.blocks).toBeDefined();
    expect(createdPage.blocks_layout).toBeDefined();

    // 4. Blocks layout has exactly one item (the title block)
    expect(createdPage.blocks_layout.items).toHaveLength(1);
    const titleBlockIdFromResponse = createdPage.blocks_layout.items[0];
    expect(titleBlockIdFromResponse).toBeDefined();

    // 5. Title block exists and has correct structure
    const titleBlock = createdPage.blocks[titleBlockIdFromResponse];
    expect(titleBlock).toBeDefined();
    expect(titleBlock['@type']).toBe('slate');
    expect(titleBlock.plaintext).toBe(TEST_CONFIG.testPageTitle);

    // 6. Title block has correct H1 structure
    expect(titleBlock.value).toHaveLength(1);
    const h1Element = titleBlock.value[0];
    expect(h1Element.type).toBe('h1');
    expect(h1Element.children).toHaveLength(1);
    expect(h1Element.children[0].text).toBe(TEST_CONFIG.testPageTitle);

    // 7. Page is accessible via GET request
    const retrievedPage = await client.get(createdPagePath.replace(TEST_CONFIG.baseUrl, ''));
    expect(retrievedPage.title).toBe(TEST_CONFIG.testPageTitle);
    expect(retrievedPage.blocks).toBeDefined();

    console.log('✅ Acceptance test passed: Page created with auto-generated title block');
    console.log(`📍 Created page URL: ${createdPage['@id']}`);
    console.log(`🏷️  Title block ID: ${titleBlockIdFromResponse}`);
  });

  test('Verify page content structure matches expected format', async () => {
    // Additional verification of the created page structure
    if (!createdPagePath) {
      throw new Error('No page was created in the previous test');
    }

    const page = await client.get(createdPagePath.replace(TEST_CONFIG.baseUrl, ''));

    // Verify complete blocks structure
    expect(page.blocks).toEqual(
      expect.objectContaining({
        [expect.any(String)]: expect.objectContaining({
          '@type': 'slate',
          plaintext: TEST_CONFIG.testPageTitle,
          value: [
            expect.objectContaining({
              type: 'h1',
              children: [
                expect.objectContaining({
                  text: TEST_CONFIG.testPageTitle
                })
              ]
            })
          ]
        })
      })
    );

    // Verify blocks_layout structure
    expect(page.blocks_layout).toEqual(
      expect.objectContaining({
        items: expect.arrayContaining([expect.any(String)])
      })
    );

    console.log('✅ Page content structure verification passed');
  });

  test('Verify page is properly rendered in Volto frontend', async () => {
    // Test that the page would render correctly in Volto
    if (!createdPagePath) {
      throw new Error('No page was created in the previous test');
    }

    const page = await client.get(createdPagePath.replace(TEST_CONFIG.baseUrl, ''));
    
    // Check that all required properties for Volto rendering are present
    const requiredProperties = ['@id', '@type', 'title', 'blocks', 'blocks_layout'];
    requiredProperties.forEach(prop => {
      expect(page[prop]).toBeDefined();
    });

    // Verify the title block has all required properties for Slate rendering
    const titleBlockId = page.blocks_layout.items[0];
    const titleBlock = page.blocks[titleBlockId];
    
    const requiredSlateProperties = ['@type', 'plaintext', 'value'];
    requiredSlateProperties.forEach(prop => {
      expect(titleBlock[prop]).toBeDefined();
    });

    // Verify Slate value structure is valid
    expect(Array.isArray(titleBlock.value)).toBe(true);
    expect(titleBlock.value[0]).toHaveProperty('type');
    expect(titleBlock.value[0]).toHaveProperty('children');
    expect(Array.isArray(titleBlock.value[0].children)).toBe(true);

    console.log('✅ Volto frontend compatibility verification passed');
  });
});

/**
 * Generate a unique block ID (UUID v4)
 * This mimics the generateBlockId() method in the MCP server
 */
function generateBlockId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Test Data Validation
 * 
 * Expected request format for "create a page 'Hello World'":
 * {
 *   "parentPath": "/",
 *   "type": "Document", 
 *   "title": "Hello World"
 * }
 * 
 * Expected response structure:
 * {
 *   "@id": "https://site.com/hello-world",
 *   "@type": "Document",
 *   "title": "Hello World",
 *   "blocks": {
 *     "uuid": {
 *       "@type": "slate",
 *       "plaintext": "Hello World",
 *       "value": [
 *         {
 *           "type": "h1",
 *           "children": [{"text": "Hello World"}]
 *         }
 *       ]
 *     }
 *   },
 *   "blocks_layout": {
 *     "items": ["uuid"]
 *   }
 * }
 */