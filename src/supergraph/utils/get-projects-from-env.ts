export type SubGraphEntry = {
  name: string;
  url: string;
  headers?: Record<string, string>;
};

export type ProjectConfig = {
  project: string;
  subGraphs: SubGraphEntry[];
  system: {
    POLL_INTERVAL_S: number;
    HIVE_TARGET: string;
    HIVE_ACCESS_TOKEN: string;
    HIVE_AUTHOR: string;
    MAX_RUNTIME_ERRORS: number;
  };
};

type RESERVED_KEYS = 'POLL_INTERVAL_S' | 'MAX_RUNTIME_ERRORS';

const RESERVED_KEYS_DEFAULT_VALUES: Record<RESERVED_KEYS, string> = {
  POLL_INTERVAL_S: '60',
  MAX_RUNTIME_ERRORS: '5',
};

const HEADER_MARKER = '__HEADER_';
const VALID_HEADER_NAME = /^[a-z0-9-]+$/;

function parseValueToNumber(raw: string, defaultValue: number = 0): number {
  const num = Number(raw);
  if (Number.isNaN(num) || num < 0) {
    return defaultValue;
  }
  return num;
}

type PendingHeader = {
  project: string;
  subGraphKey: string;
  headerName: string;
  value: string;
};

function tryParseHeader(
  settingKey: string,
  envVal: string,
  projectKey: string,
): PendingHeader | null {
  const markerIndex = settingKey.indexOf(HEADER_MARKER);
  if (markerIndex < 0) return null;

  const subGraphKey = settingKey.slice(0, markerIndex);
  const rawHeaderName = settingKey.slice(markerIndex + HEADER_MARKER.length);

  if (!subGraphKey || !rawHeaderName) return null;

  const headerName = rawHeaderName.toLowerCase().replaceAll('_', '-');
  if (!VALID_HEADER_NAME.test(headerName)) return null;

  return {
    project: projectKey,
    subGraphKey: subGraphKey.toLowerCase(),
    headerName,
    value: envVal,
  };
}

export function getProjectsFromEnvironment(): ProjectConfig[] {
  const projectsMap: Record<string, ProjectConfig> = {};
  const pendingHeaders: PendingHeader[] = [];

  Object.entries(process.env).forEach(([envKey, envVal]) => {
    if (!envKey.startsWith('SUBGRAPH_') || !envVal) return;

    const parts = envKey.split('_');
    if (parts.length < 3) return;

    const projectKey = parts[1].toLowerCase();
    const settingKey = parts.slice(2).join('_');

    if (!projectsMap[projectKey]) {
      projectsMap[projectKey] = {
        project: projectKey,
        subGraphs: [],
        system: {
          POLL_INTERVAL_S: parseValueToNumber(
            RESERVED_KEYS_DEFAULT_VALUES.POLL_INTERVAL_S,
            60,
          ),
          HIVE_TARGET: '',
          HIVE_ACCESS_TOKEN: '',
          HIVE_AUTHOR: '',
          MAX_RUNTIME_ERRORS: parseValueToNumber(
            RESERVED_KEYS_DEFAULT_VALUES.MAX_RUNTIME_ERRORS,
            5,
          ),
        },
      };
    }

    const cfg = projectsMap[projectKey];

    const headerMatch = tryParseHeader(settingKey, envVal, projectKey);
    if (headerMatch) {
      pendingHeaders.push(headerMatch);
      return;
    }

    if (settingKey === 'POLL_INTERVAL_S') {
      cfg.system.POLL_INTERVAL_S = parseValueToNumber(envVal, 60);
    } else if (settingKey === 'MAX_RUNTIME_ERRORS') {
      cfg.system.MAX_RUNTIME_ERRORS = parseValueToNumber(envVal, 5);
    } else if (
      settingKey === 'HIVE_TARGET' ||
      settingKey === 'HIVE_ACCESS_TOKEN' ||
      settingKey === 'HIVE_AUTHOR'
    ) {
      cfg.system[settingKey] = envVal;
    } else {
      const name = settingKey.toLowerCase();
      cfg.subGraphs.push({ name, url: envVal });
    }
  });

  for (const pending of pendingHeaders) {
    const project = projectsMap[pending.project];
    if (!project) continue;
    const subGraph = project.subGraphs.find(
      (s) => s.name === pending.subGraphKey,
    );
    if (!subGraph) continue;
    subGraph.headers ??= {};
    subGraph.headers[pending.headerName] = pending.value;
  }

  return Object.values(projectsMap).filter((p) => p.subGraphs.length > 0);
}
