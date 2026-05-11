import { composeServices } from '@apollo/composition';

describe('Apollo Federation link compatibility', () => {
  it('composes mixed federation v2.12 and v2.3 subgraphs', () => {
    const { parse } = jest.requireActual<typeof import('graphql')>('graphql');

    const result = composeServices([
      {
        name: 'users',
        url: 'http://users/graphql',
        typeDefs: parse(`
          extend schema
            @link(
              url: "https://specs.apollo.dev/federation/v2.12"
              import: ["@key", "@shareable"]
            )

          type Query {
            user(id: ID!): User
          }

          type User @key(fields: "id") {
            id: ID!
            name: String @shareable
          }
        `),
      },
      {
        name: 'products',
        url: 'http://products/graphql',
        typeDefs: parse(`
          extend schema
            @link(
              url: "https://specs.apollo.dev/federation/v2.3"
              import: ["@key"]
            )

          type Query {
            product(id: ID!): Product
          }

          type Product @key(fields: "id") {
            id: ID!
            title: String
          }
        `),
      },
    ]);

    expect(result.errors).toBeUndefined();
    expect(result.supergraphSdl).toContain('schema');
  });
});
