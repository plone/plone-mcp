import axios, { AxiosInstance } from "axios";
import { z } from "zod";

// Configuration schema
export const ConfigSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export class PloneClient {
  private axios: AxiosInstance;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    
    // Remove trailing slash from baseUrl if present
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    
    this.axios = axios.create({
      baseURL: `${baseUrl}/++api++`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Set up authentication
    if (config.token) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${config.token}`;
    } else if (config.username && config.password) {
      this.axios.defaults.auth = {
        username: config.username,
        password: config.password,
      };
    }
  }

  async get(path: string, params?: Record<string, any>): Promise<any> {
    const response = await this.axios.get(path, { params });
    return response.data;
  }

  async post(path: string, data?: any): Promise<any> {
    const response = await this.axios.post(path, data);
    return response.data;
  }

  async patch(path: string, data?: any): Promise<any> {
    const response = await this.axios.patch(path, data);
    return response.data;
  }

  async delete(path: string): Promise<any> {
    const response = await this.axios.delete(path);
    return response.status === 204 ? undefined : response.data;
  }
}