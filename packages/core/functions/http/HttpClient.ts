import axios, {AxiosHeaders, AxiosRequestConfig, AxiosRequestHeaders, AxiosResponse} from 'axios';
import {BaseFunction} from '../../block/BlockFunction.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {isDataMap} from '../../util/DataTypes.ts';
import {escapedObject} from '../../util/NoSerialize.ts';
import {
  AuthorizationRequiredError,
  authUrl,
  clientAuthApi,
  clientAuthCommands,
  isBearerToken,
  oauthProfiles,
  resourceOriginOf,
  type OAuthProfileState,
} from '../auth/OAuthProfile.ts';

export interface HttpClientRequest extends AxiosRequestConfig {
  authContext?: unknown;
}

export interface HttpClient {
  request(config: HttpClientRequest): Promise<Pick<AxiosResponse, 'data' | 'status' | 'statusText' | 'headers'>>;
}

function adjustRequestHeaders(config: AxiosRequestConfig) {
  if (config.data) {
    if (!(config.headers?.['Content-Type'] || config.headers?.['content-type'])) {
      const headers = {...config.headers};
      if (typeof config.data === 'string') {
        headers['content-type'] = 'text/plain';
      } else if (typeof config.data === 'object') {
        if (config.data instanceof Uint8Array) {
          headers['content-type'] = 'application/octet-stream';
        } else {
          headers['content-type'] = 'application/json';
        }
      }
      return {...config, headers};
    }
  }
  return config;
}

export function httpRequest(config: HttpClientRequest) {
  if (config.authContext !== undefined) {
    const {authContext: _authContext, ...request} = config;
    return axios(adjustRequestHeaders(request));
  }
  return axios(adjustRequestHeaders(config));
}

export const axiosClient: HttpClient = {
  request(config: AxiosRequestConfig) {
    return httpRequest(config);
  },
};

class HttpClientObject implements HttpClient {
  readonly baseUrl: string;
  readonly headers?: AxiosRequestHeaders;
  readonly optionalHeaders?: AxiosRequestHeaders;

  constructor(
    baseUrl: unknown,
    headers?: unknown,
    optionalHeaders?: unknown,
    private readonly auth?: OAuthProfileState
  ) {
    if (typeof baseUrl === 'string') {
      this.baseUrl = baseUrl;
    }
    if (isDataMap(headers)) {
      this.headers = headers as AxiosRequestHeaders;
    }
    if (isDataMap(optionalHeaders)) {
      this.optionalHeaders = optionalHeaders as AxiosRequestHeaders;
    }
  }

  async request(config: HttpClientRequest) {
    const base = this.auth ? authUrl(this.baseUrl) : new URL(this.baseUrl);
    const target = new URL(config.url.replace(/^\/+/, ''), base);
    const prefix = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
    if (target.origin !== base.origin || (target.pathname !== base.pathname && !target.pathname.startsWith(prefix))) {
      throw new Error('HTTP destination is outside the configured API');
    }
    if (this.auth) return this.requestWithOAuth(authUrl(target.href), config);
    // Existing clients can also pin a URL prefix that includes credentials or a query.
    if (!target.href.startsWith(this.baseUrl)) throw new Error('HTTP destination is outside the configured API');
    let headers = config.headers;
    if (this.headers || this.optionalHeaders) {
      headers = {...this.optionalHeaders, ...headers, ...this.headers};
    }

    return httpRequest({...config, url: target.href, headers});
  }

  private async requestWithOAuth(target: URL, config: HttpClientRequest) {
    if (!this.auth?.ready) throw new AuthorizationRequiredError(this.auth?.reason);
    if (resourceOriginOf(target) !== this.auth.origin) {
      throw new Error('HTTP OAuth destination is outside the configured API');
    }
    const headers = AxiosHeaders.from({...this.optionalHeaders, ...config.headers, ...this.headers});
    if (headers.has('Authorization') || config.auth) throw new Error('HTTP OAuth manages the Authorization header');
    const {accessToken} = await this.auth.token(config.authContext);
    if (!isBearerToken(accessToken)) throw new Error('Invalid OAuth access token');
    headers.set('Authorization', `Bearer ${accessToken}`);
    const {method, params, data, responseType, signal} = config;
    const response = await httpRequest({
      url: target.href,
      headers,
      method,
      params,
      data,
      responseType,
      signal,
      adapter: 'fetch',
      withCredentials: false,
      fetchOptions: {redirect: 'error'},
      validateStatus: () => true,
    }).catch(() => {
      if (signal?.aborted) throw new axios.CanceledError();
      throw new Error('OAuth HTTP request failed');
    });
    const result = {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    };
    if (response.status < 200 || response.status >= 300) throw {response: result};
    return result;
  }
}

class HttpClientFunction extends BaseFunction {
  run(): any {
    const url = this._data.getValue('url');
    const headers = this._data.getValue('headers');
    const optionalHeaders = this._data.getValue('optionalHeaders');
    const authValue = this._data.getValue('auth');
    let profile: OAuthProfileState | undefined;
    if (authValue != null) {
      profile = oauthProfiles.get(authValue as object);
      if (!profile) {
        this._data.output(undefined);
        throw new Error('Unsupported HTTP auth profile');
      }
      if (!profile.ready) {
        this._data.output(undefined);
        throw new Error(profile.reason ?? 'Authentication is not ready');
      }
    }
    const client = new HttpClientObject(url, headers, optionalHeaders, profile);
    this._data.output(profile ? escapedObject('http:oauth-client', {request: client.request.bind(client)}) : client);
  }

  cleanup() {
    this._data.output(undefined);
  }
}

globalFunctions.addFactory(
  HttpClientFunction,
  {
    name: 'client',
    useFullName: true,
    icon: 'svg:file-arrow-down',
    mode: 'onLoad',
    priority: 1,
    commands: clientAuthCommands,
    properties: [
      {name: 'url', type: 'string', pinned: true},
      {name: 'auth', type: 'object', create: ['auth:oauth'], disableObjectTools: true},
      {name: 'headers', type: 'object', create: 'http:create-headers'},
      {name: 'optionalHeaders', type: 'object', create: 'http:create-headers'},
      {name: '#output', type: 'object', readonly: true, pinned: true},
    ],
    tags: ['http-client', 'context-service'],
  },
  'http',
  clientAuthApi
);
