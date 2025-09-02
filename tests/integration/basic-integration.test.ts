import nock from 'nock';
import { PloneClient } from '../../src/index';

describe('Basic Integration Tests', () => {
  const baseUrl = 'https://test.plone.com';
  let client: PloneClient;

  beforeEach(() => {
    client = new PloneClient({
      baseUrl,
      username: 'admin',
      password: 'secret'
    });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Site Connection', () => {
    it('should connect to Plone site successfully', async () => {
      const mockResponse = { '@type': 'Plone Site', id: 'plone', title: 'Test Site' };
      
      nock(baseUrl)
        .get('/++api++/')
        .reply(200, mockResponse);

      const result = await client.get('/');
      expect(result['@type']).toBe('Plone Site');
      expect(result.title).toBe('Test Site');
    });

    it('should handle connection errors', async () => {
      nock(baseUrl)
        .get('/++api++/')
        .reply(500, { error: 'Server Error' });

      await expect(client.get('/')).rejects.toThrow();
    });
  });

  describe('Content Creation Workflow', () => {
    it('should create and retrieve content', async () => {
      const createData = {
        '@type': 'Document',
        title: 'Test Document'
      };

      const createdResponse = {
        ...createData,
        id: 'test-document',
        '@id': `${baseUrl}/test-document`
      };

      // Mock content creation
      nock(baseUrl)
        .post('/++api++/', createData)
        .reply(201, createdResponse);

      // Mock content retrieval
      nock(baseUrl)
        .get('/++api++/test-document')
        .reply(200, createdResponse);

      // Create content
      const createResult = await client.post('/', createData);
      expect(createResult.title).toBe('Test Document');
      expect(createResult.id).toBe('test-document');

      // Retrieve content
      const getResult = await client.get('/test-document');
      expect(getResult.title).toBe('Test Document');
    });
  });

  describe('Search Operations', () => {
    it('should perform search queries', async () => {
      const searchResults = {
        '@id': `${baseUrl}/++api++/@search`,
        items: [
          { '@id': `${baseUrl}/doc1`, title: 'Document 1', '@type': 'Document' }
        ],
        items_total: 1
      };

      nock(baseUrl)
        .get('/++api++/@search')
        .query({ SearchableText: 'test' })
        .reply(200, searchResults);

      const result = await client.get('/@search', { SearchableText: 'test' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Document 1');
    });
  });
});