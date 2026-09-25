interface McpToolDefinition {
  name: string;
  description: string;
  /** Human-facing one-liner (fleet #1967). Optional; consumers fall back to
   *  description. Kept in step with shared/src/types.ts — scripts/lib/
   *  check-inlined-types.mjs reports drift at publish time. */
  summary?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    anyOf?: Array<{ required: string[] }>;
    oneOf?: Array<{ required: string[] }>;
    allOf?: Array<{ required: string[] }>;
  };
  outputSchema?: Record<string, unknown>;
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * HTTP status code reference MCP.
 *
 * Keyless, offline reference: look up an HTTP status code's name, category and
 * meaning, or list the codes in a class. Inlined from the IANA registry / RFCs.
 */


const STATUS: Record<number, [string, string]> = {
  100: ['Continue', 'The client should continue with its request.'],
  101: ['Switching Protocols', 'The server is switching protocols per the Upgrade header.'],
  102: ['Processing', 'The server has received and is processing the request (WebDAV).'],
  103: ['Early Hints', 'Return some response headers before the final response.'],
  200: ['OK', 'The request succeeded.'],
  201: ['Created', 'The request succeeded and a new resource was created.'],
  202: ['Accepted', 'The request was accepted for processing but not yet completed.'],
  203: ['Non-Authoritative Information', 'Returned metadata is from a copy, not the origin.'],
  204: ['No Content', 'Success, with no body to return.'],
  205: ['Reset Content', 'Success; the client should reset the document view.'],
  206: ['Partial Content', 'Partial resource delivered per a Range request.'],
  207: ['Multi-Status', 'Multiple independent status codes (WebDAV).'],
  208: ['Already Reported', 'Members already enumerated (WebDAV).'],
  226: ['IM Used', 'Response is the result of instance-manipulations.'],
  300: ['Multiple Choices', 'The request has more than one possible response.'],
  301: ['Moved Permanently', 'The resource has permanently moved to a new URL.'],
  302: ['Found', 'The resource is temporarily at a different URL.'],
  303: ['See Other', 'Get the resource at another URL with GET.'],
  304: ['Not Modified', 'The cached version is still valid.'],
  307: ['Temporary Redirect', 'Temporary redirect; keep the same method.'],
  308: ['Permanent Redirect', 'Permanent redirect; keep the same method.'],
  400: ['Bad Request', 'The server cannot process the request due to a client error.'],
  401: ['Unauthorized', 'Authentication is required and has failed or not been provided.'],
  402: ['Payment Required', 'Reserved for future/paid use.'],
  403: ['Forbidden', 'The server understood the request but refuses to authorize it.'],
  404: ['Not Found', 'The requested resource could not be found.'],
  405: ['Method Not Allowed', 'The HTTP method is not supported for this resource.'],
  406: ['Not Acceptable', 'No representation matches the Accept headers.'],
  407: ['Proxy Authentication Required', 'Authentication with the proxy is required.'],
  408: ['Request Timeout', 'The server timed out waiting for the request.'],
  409: ['Conflict', 'The request conflicts with the current state of the resource.'],
  410: ['Gone', 'The resource is permanently gone.'],
  411: ['Length Required', 'The Content-Length header is required.'],
  412: ['Precondition Failed', 'A precondition in the request headers failed.'],
  413: ['Content Too Large', 'The request body is larger than the server will process.'],
  414: ['URI Too Long', 'The request URI is longer than the server will interpret.'],
  415: ['Unsupported Media Type', 'The request media type is not supported.'],
  416: ['Range Not Satisfiable', 'The requested range cannot be fulfilled.'],
  417: ['Expectation Failed', 'The Expect header could not be met.'],
  418: ["I'm a teapot", 'An April Fools joke code (RFC 2324).'],
  421: ['Misdirected Request', 'The request was directed at a server that cannot respond.'],
  422: ['Unprocessable Content', 'The request is well-formed but semantically invalid.'],
  423: ['Locked', 'The resource is locked (WebDAV).'],
  424: ['Failed Dependency', 'The request failed due to a previous failed request (WebDAV).'],
  425: ['Too Early', 'The server is unwilling to risk processing a replayed request.'],
  426: ['Upgrade Required', 'The client should switch to a different protocol.'],
  428: ['Precondition Required', 'The origin requires the request to be conditional.'],
  429: ['Too Many Requests', 'The client has sent too many requests (rate limited).'],
  431: ['Request Header Fields Too Large', 'Header fields are too large.'],
  451: ['Unavailable For Legal Reasons', 'Access denied for legal reasons.'],
  500: ['Internal Server Error', 'A generic server error occurred.'],
  501: ['Not Implemented', 'The server does not support the functionality required.'],
  502: ['Bad Gateway', 'An upstream server returned an invalid response.'],
  503: ['Service Unavailable', 'The server is overloaded or down for maintenance.'],
  504: ['Gateway Timeout', 'An upstream server did not respond in time.'],
  505: ['HTTP Version Not Supported', 'The HTTP version is not supported.'],
  506: ['Variant Also Negotiates', 'A content-negotiation configuration error.'],
  507: ['Insufficient Storage', 'The server cannot store the representation (WebDAV).'],
  508: ['Loop Detected', 'An infinite loop was detected (WebDAV).'],
  510: ['Not Extended', 'Further extensions to the request are required.'],
  511: ['Network Authentication Required', 'The client must authenticate to gain network access.'],
};

function category(code: number): string {
  return code < 200 ? 'Informational (1xx)' : code < 300 ? 'Success (2xx)' : code < 400 ? 'Redirection (3xx)' : code < 500 ? 'Client Error (4xx)' : 'Server Error (5xx)';
}

const tools: McpToolExport['tools'] = [
  {
    name: 'http_status',
    description: 'Look up an HTTP status code (100-599): its reason phrase, category, and meaning. Keyless, offline.',
    inputSchema: { type: 'object', properties: { code: { type: 'number', description: 'An HTTP status code, e.g. 404.' } }, required: ['code'] },
  },
  {
    name: 'list_http_statuses',
    description: 'List HTTP status codes, optionally filtered to a class (1, 2, 3, 4 or 5 for 1xx…5xx).',
    inputSchema: { type: 'object', properties: { class: { type: 'number', description: 'Optional leading digit 1-5 to filter (e.g. 4 for 4xx).' } } },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'http_status': {
      const code = typeof args.code === 'number' ? args.code : Number(args.code);
      if (!Number.isInteger(code)) throw new Error('Required argument "code" must be a number, e.g. 404.');
      const s = STATUS[code];
      if (!s) return { code, known: false, category: code >= 100 && code < 600 ? category(code) : 'Invalid', reason: 'Not a standard registered status code.' };
      return { code, known: true, name: s[0], category: category(code), description: s[1] };
    }
    case 'list_http_statuses': {
      const cls = typeof args.class === 'number' ? args.class : undefined;
      const rows = Object.entries(STATUS).map(([c, [n]]) => ({ code: +c, name: n, category: category(+c) })).filter((r) => cls === undefined || Math.floor(r.code / 100) === cls);
      return { count: rows.length, statuses: rows };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
