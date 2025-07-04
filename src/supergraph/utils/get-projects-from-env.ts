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
  };
};

type RESERVED_KEYS = 'POLL_INTERVAL_S';

const RESERVED_KEYS_DEFAULT_VALUES: Record<RESERVED_KEYS[number], string> = {
  POLL_INTERVAL_S: '60',
};

function parseValueToNumber(raw: string): number {
  const num = Number(raw);
  return Number.isNaN(num) ? 0 : num;
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
          ),
          HIVE_TARGET: '',
          HIVE_ACCESS_TOKEN: '',
          HIVE_AUTHOR: '',
        },
      };
    }

    const cfg = projectsMap[projectKey];

    if (settingKey === 'POLL_INTERVAL_S') {
      cfg.system.POLL_INTERVAL_S = parseValueToNumber(envVal);
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

export function getSubGraphsFromEnvironmentOld(): Array<{
  name: string;
  url: string;
}> {
  const subGraphs: Array<{ name: string; url: string }> = [];

  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('SUBGRAPH_')) {
      const subgraphName = key.replace('SUBGRAPH_', '').toLowerCase();
      const subgraphUrl = process.env[key];

      if (subgraphUrl) {
        subGraphs.push({
          name: subgraphName,
          url: subgraphUrl,
        });
      }
    }
  });

  return subGraphs;
}
