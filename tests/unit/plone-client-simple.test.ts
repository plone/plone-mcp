import nock from 'nock';
import { PloneClient, ConfigSchema } from '../../src/plone-client';

describe('PloneClient', () => {
  const config = {
    baseUrl: 'https://test.plone.com',
    username: 'admin',
    password: 'secret'
  };

  let client: PloneClient;

  beforeEach(() => {
    client = new PloneClient(config);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Configuration', () => {
    it('should validate config schema', () => {
      const validConfig = {
        baseUrl: 'https://valid.com',
        username: 'user',
        password: 'pass'
      };
      
      expect(() => ConfigSchema.parse(validConfig)).not.toThrow();
    });

    it('should reject invalid config', () => {
      const invalidConfig = {
        baseUrl: 'not-a-url',
        username: 'user'
      };
      
      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('HTTP Methods', () => {
    it('should make GET requests correctly', async () => {
      const mockResponse = { '@type': 'Plone Site', id: 'plone' };
      
      nock('https://test.plone.com')
        .get('/++api++/')
        .reply(200, mockResponse);

      const result = await client.get('/');
      expect(result).toEqual(mockResponse);
    });

    it('should make POST requests correctly', async () => {
      const requestData = { '@type': 'Document', title: 'Test' };
      const mockResponse = { ...requestData, id: 'test-document' };
      
      nock('https://test.plone.com')
        .post('/++api++/folder', requestData)
        .reply(201, mockResponse);

      const result = await client.post('/folder', requestData);
      expect(result).toEqual(mockResponse);
    });

    it('should handle DELETE requests correctly', async () => {
      nock('https://test.plone.com')
        .delete('/++api++/test')
        .reply(204);

      const result = await client.delete('/test');
      expect(result).toBeUndefined();
    });
  });
});