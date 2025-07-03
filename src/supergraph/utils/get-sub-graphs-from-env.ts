export function getSubGraphsFromEnvironment(): Array<{
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
