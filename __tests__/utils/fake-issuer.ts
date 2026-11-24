import { createServer, type Server } from "node:http";
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type CryptoKey,
  type JWK,
} from "jose";
import type { AddressInfo } from "node:net";

export const TEST_CLIENT_ID = "plone-mcp-inspector";

export interface TestKey {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  jwk: JWK;
}

export interface FakeSite {
  discoveryStatus?: number;
  discoveryIssuer?: string;
  jwksStatus?: number;
  userinfoStatus?: number;
  keys: JWK[];
  jwksFetches: number;
}

export interface SignOptions {
  key?: TestKey;
  kid?: string;
  typ?: string;
  aud?: string;
  sub?: string | null;
  expiresIn?: string | number;
}

async function newKey(kid: string): Promise<TestKey> {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  return {
    privateKey,
    publicKey,
    jwk: { ...(await exportJWK(publicKey)), kid },
  };
}

/**
 * A stand-in for Plone's authorization server: discovery, JWKS and userinfo on a local
 * port. Each site lives at its own path, so the verifier's module-level key
 * cache never carries over between tests.
 */
export class FakeIssuer {
  origin = "";
  key1!: TestKey;
  key2!: TestKey;
  private sites = new Map<string, FakeSite>();
  private count = 0;
  private server?: Server;

  async start() {
    this.key1 = await newKey("key-1");
    this.key2 = await newKey("key-2");
    this.server = createServer((request, response) => {
      const [, name, ...rest] = (request.url ?? "").split("/");
      const site = this.sites.get(name);
      const path = rest.join("/");
      if (site && path === ".well-known/openid-configuration") {
        response.writeHead(site.discoveryStatus ?? 200, {
          "Content-Type": "application/json",
        });
        response.end(
          JSON.stringify({
            issuer: site.discoveryIssuer ?? `${this.origin}/${name}`,
            jwks_uri: `${this.origin}/${name}/@@oauth-jwks`,
            userinfo_endpoint: `${this.origin}/${name}/@@oauth-userinfo`,
          }),
        );
      } else if (site && path === "@@oauth-jwks") {
        site.jwksFetches++;
        response.writeHead(site.jwksStatus ?? 200, {
          "Content-Type": "application/json",
        });
        response.end(JSON.stringify({ keys: site.keys }));
      } else if (site && path === "@@oauth-userinfo") {
        response.writeHead(site.userinfoStatus ?? 200).end("{}");
      } else {
        response.writeHead(404).end();
      }
    });
    const server = this.server;
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    this.origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  close() {
    this.server?.close();
  }

  addSite(overrides: Partial<FakeSite> = {}) {
    const name = `site${++this.count}`;
    const site: FakeSite = {
      keys: [this.key1.jwk],
      jwksFetches: 0,
      ...overrides,
    };
    this.sites.set(name, site);
    return { site, issuer: `${this.origin}/${name}` };
  }

  sign(
    issuer: string,
    {
      key = this.key1,
      kid = key.jwk.kid,
      typ = "at+jwt",
      aud = TEST_CLIENT_ID,
      sub = "mcp-editor",
      expiresIn = "15m",
    }: SignOptions = {},
  ) {
    const jwt = new SignJWT({ scope: "openid profile" })
      .setProtectedHeader({ alg: "RS256", typ, kid })
      .setIssuer(issuer)
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime(expiresIn);
    if (sub !== null) {
      jwt.setSubject(sub);
    }
    return jwt.sign(key.privateKey);
  }
}
