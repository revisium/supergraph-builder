export type SubGraphEntry = {
  name: string;
  url: string;
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

function parseValueToNumber(raw: string, defaultValue: number = 0): number {
  const num = Number(raw);
  if (Number.isNaN(num) || num < 0) {
    return defaultValue;
  }
  return num;
}

export function getProjectsFromEnvironment(): ProjectConfig[] {
  const projectsMap: Record<string, ProjectConfig> = {};

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

  return Object.values(projectsMap);
}
