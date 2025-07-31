import '../functional-setup';
import { PloneClient } from '../../src/plone-client';

describe('Live Plone Connection Tests', () => {
  // These tests run against a real Plone instance
  // Set environment variables to enable: PLONE_TEST_URL, PLONE_TEST_USER, PLONE_TEST_PASS
  const PLONE_URL = process.env.PLONE_TEST_URL;
  const PLONE_USER = process.env.PLONE_TEST_USER;
  const PLONE_PASS = process.env.PLONE_TEST_PASS;

  const skipMessage = 'Functional test environment not configured. Set PLONE_TEST_URL, PLONE_TEST_USER, PLONE_TEST_PASS';

  beforeAll(() => {
    if (!PLONE_URL || !PLONE_USER || !PLONE_PASS) {
      console.log('⚠️  Functional tests require environment variables:');
      console.log('   PLONE_TEST_URL="https://your-plone-site.com"');
      console.log('   PLONE_TEST_USER="admin"');  
      console.log('   PLONE_TEST_PASS="password"');
    }
  });

  describe('Real Plone Instance', () => {
    it('should connect to live Plone instance', async () => {
      if (!PLONE_URL || !PLONE_USER || !PLONE_PASS) {
        return;
        return;
      }

      const client = new PloneClient({
        baseUrl: PLONE_URL,
        username: PLONE_USER,
        password: PLONE_PASS
      });

      const result = await client.get('/');
      
      expect(result).toBeDefined();
      expect(result['@type']).toBeDefined();
      console.log(`✅ Connected to Plone site: ${result.title || result['@type']}`);
    });

    it('should get site information from live instance', async () => {
      if (!PLONE_URL || !PLONE_USER || !PLONE_PASS) {
        return;
        return;
      }

      const client = new PloneClient({
        baseUrl: PLONE_URL,
        username: PLONE_USER,
        password: PLONE_PASS
      });

      const siteInfo = await client.get('/');
      
      expect(siteInfo['@type']).toBeDefined();
      expect(siteInfo).toHaveProperty('@id');
      
      console.log(`✅ Site Type: ${siteInfo['@type']}`);
      console.log(`✅ Site ID: ${siteInfo['@id']}`);
      if (siteInfo.title) {
        console.log(`✅ Site Title: ${siteInfo.title}`);
      }
    });

    it('should search for content in live instance', async () => {
      if (!PLONE_URL || !PLONE_USER || !PLONE_PASS) {
        return;
        return;
      }

      const client = new PloneClient({
        baseUrl: PLONE_URL,
        username: PLONE_USER,
        password: PLONE_PASS
      });

      const searchResults = await client.get('/@search', {
        portal_type: ['Document', 'Folder'],
        b_size: 5
      });

      expect(searchResults).toBeDefined();
      expect(searchResults.items).toBeDefined();
      expect(Array.isArray(searchResults.items)).toBe(true);
      
      console.log(`✅ Found ${searchResults.items.length} items in search results`);
      console.log(`✅ Total items: ${searchResults.items_total || 'unknown'}`);
    });
  });

  describe('Authentication Tests', () => {
    it('should work with correct credentials', async () => {
      if (!PLONE_URL || !PLONE_USER || !PLONE_PASS) {
        return;
        return;
      }

      const client = new PloneClient({
        baseUrl: PLONE_URL,
        username: PLONE_USER,
        password: PLONE_PASS
      });

      const result = await client.get('/');
      expect(result).toBeDefined();
      console.log('✅ Authentication with correct credentials works');
    });
  });
});