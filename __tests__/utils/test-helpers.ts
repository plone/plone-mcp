import nock from "nock";

export const Nock = nock;

export const cleanupNock = () => nock.cleanAll();
export const isNockDone = () => nock.isDone();
export const getPendingNocks = () => nock.pendingMocks();

export class PloneMockServer {
  private baseUrl: string;
  private defaultReqHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  constructor(baseUrl = "https://test.plone.com") {
    this.baseUrl = baseUrl;
  }

  private normalizePath(path: string): string {
    if (!path || path === "/") {
      return "";
    }
    return path.startsWith("/") ? path : `/${path}`;
  }

  mockSiteRoot(
    response: Record<string, unknown> = {
      "@type": "Plone Site",
      id: "plone",
      title: "Test Site",
    },
  ) {
    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .get("/++api++")
      .reply(200, response as nock.ReplyBody);
  }

  mockContentGet(path: string, response: Record<string, unknown>) {
    const normalizedPath = this.normalizePath(path);
    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .get(`/++api++${normalizedPath}`)
      .reply(200, response as nock.ReplyBody);
  }

  mockContentCreate(
    path: string,
    requestMatcher: nock.RequestBodyMatcher | Record<string, unknown>,
    responseOrStatus: Record<string, unknown> | number,
    maybeBody?: string | Record<string, unknown>,
  ) {
    const normalizedPath = this.normalizePath(path);
    const { status, body } =
      typeof responseOrStatus === "number"
        ? { status: responseOrStatus, body: maybeBody }
        : { status: 201, body: responseOrStatus };

    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .post(
        `/++api++${normalizedPath}`,
        requestMatcher as nock.RequestBodyMatcher,
      )
      .reply(status, body as nock.ReplyBody);
  }

  mockContentUpdate(
    path: string,
    requestMatcher: nock.RequestBodyMatcher | Record<string, unknown>,
    responseOrStatus: Record<string, unknown> | number,
    maybeBody?: string | Record<string, unknown>,
  ) {
    const normalizedPath = this.normalizePath(path);
    const { status, body } =
      typeof responseOrStatus === "number"
        ? { status: responseOrStatus, body: maybeBody }
        : { status: 200, body: responseOrStatus };

    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .patch(
        `/++api++${normalizedPath}`,
        requestMatcher as nock.RequestBodyMatcher,
      )
      .reply(status, body as nock.ReplyBody);
  }

  mockContentDelete(
    path: string,
    status = 204,
    body?: string | Record<string, unknown>,
  ) {
    const normalizedPath = this.normalizePath(path);
    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .delete(`/++api++${normalizedPath}`)
      .reply(status, body as nock.ReplyBody);
  }

  mockSearch(
    query: Record<string, string | string[] | number>,
    response: Record<string, unknown>,
  ) {
    const queryParams: string[] = [];

    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          queryParams.push(`${key}[]=${encodeURIComponent(item)}`);
        });
      } else if (typeof value === "number") {
        queryParams.push(`${key}=${encodeURIComponent(value.toString())}`);
      } else {
        queryParams.push(`${key}=${encodeURIComponent(value)}`);
      }
    });

    const queryString = queryParams.join("&");

    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .get("/++api++/@search")
      .query(queryString)
      .reply(200, response as nock.ReplyBody);
  }

  mockWorkflow(path: string, response: Record<string, unknown>) {
    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .get(`/++api++${path}/@workflow`)
      .reply(200, response as nock.ReplyBody);
  }

  mockWorkflowTransition(
    path: string,
    transition: string,
    response: Record<string, unknown>,
    bodyMatcher?: nock.RequestBodyMatcher,
  ) {
    const scope = nock(this.baseUrl, {
      reqheaders: this.defaultReqHeaders,
    });

    if (bodyMatcher !== undefined) {
      return scope
        .post(`/++api++${path}/@workflow/${transition}`, bodyMatcher)
        .reply(200, response as nock.ReplyBody);
    }

    return scope
      .post(`/++api++${path}/@workflow/${transition}`)
      .reply(200, response as nock.ReplyBody);
  }

  mockWorkingCopyGet(path: string, response: Record<string, unknown>) {
    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .get(`/++api++${path}/@workingcopy`)
      .reply(200, response as nock.ReplyBody);
  }

  mockLockGet(path: string, response: Record<string, unknown>) {
    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .get(`/++api++${path}/@lock`)
      .reply(200, response as nock.ReplyBody);
  }

  mockWorkingCopyCreate(path: string, response: Record<string, unknown>) {
    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .post(`/++api++${path}/@workingcopy`)
      .reply(201, response as nock.ReplyBody);
  }

  mockWorkingCopyCheckin(path: string, status = 204) {
    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .patch(`/++api++${path}/@workingcopy`)
      .reply(status);
  }

  mockWorkingCopyCancel(path: string, status = 204) {
    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .delete(`/++api++${path}/@workingcopy`)
      .reply(status);
  }

  mockTypes(response: Record<string, unknown>) {
    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .get("/++api++/@types")
      .reply(200, response as nock.ReplyBody);
  }

  mockVocabularies(vocabulary: string, response: Record<string, unknown>) {
    return nock(this.baseUrl, { reqheaders: this.defaultReqHeaders })
      .get(`/++api++/@vocabularies/${vocabulary}`)
      .reply(200, response as nock.ReplyBody);
  }
}

export const sampleDocument = {
  "@type": "Document",
  "@id": "https://test.plone.com/test-document",
  id: "test-document",
  title: "Test Document",
  description: "A test document",
  blocks: {
    "block-1": {
      "@type": "slate",
      value: [
        {
          type: "p",
          children: [{ text: "This is a test paragraph." }],
        },
      ],
      plaintext: "This is a test paragraph.",
    },
  },
  blocks_layout: {
    items: ["block-1"],
  },
};

export const sampleSearchResults = {
  "@id": "https://test.plone.com/++api++/@search",
  items: [
    {
      "@id": "https://test.plone.com/document1",
      "@type": "Document",
      title: "Document 1",
      description: "First document",
    },
    {
      "@id": "https://test.plone.com/document2",
      "@type": "Document",
      title: "Document 2",
      description: "Second document",
    },
  ],
  items_total: 2,
  batching: {
    "@id": "https://test.plone.com/++api++/@search",
    first: "https://test.plone.com/++api++/@search?b_start=0",
    last: "https://test.plone.com/++api++/@search?b_start=0",
  },
};

export const sampleWorkingCopyInfo = {
  working_copy: {
    "@id": "https://test.plone.com/copy_of_test-document",
    created: "1995-07-31T13:45:00+00:00",
    creator_name: "admin",
    title: "Test Document",
  },
  working_copy_of: null,
};

export const sampleLockInfo = {
  locked: true,
  stealable: true,
  creator: "admin",
  created: "1995-07-31T13:45:00+00:00",
  timeout: 600,
  token: "cef6a5f0-d1b5-4a2c-9e1c-9c9ae1c1a1b1",
  name: "plone.locking.stealable",
};

export const sampleWorkflowInfo = {
  "@id": "https://test.plone.com/test-document/@workflow",
  history: [],
  transitions: [
    {
      "@id": "https://test.plone.com/test-document/@workflow/publish",
      title: "Publish",
    },
  ],
  state: {
    id: "private",
    title: "Private",
  },
};
