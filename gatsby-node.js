const path = require('path');

const { createFilePath } = require('gatsby-source-filesystem');

const TEMPLATE_DIR = 'src/templates/';

const hasOwnProperty = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj, key);

exports.onCreateNode = ({ node, getNode, actions }) => {
  if (
    node.internal.type === 'Mdx' ||
    (node.internal.type === 'MarkdownRemark' &&
      node.fileAbsolutePath.includes('src/content'))
  ) {
    const { createNodeField } = actions;

    createNodeField({
      node,
      name: 'slug',
      value: createFilePath({ node, getNode, trailingSlash: false }),
    });
  }
};

exports.createPages = async ({ actions, graphql, reporter }) => {
  const { createPage } = actions;

  // NOTE: update 1,000 magic number
  const { data, errors } = await graphql(`
    query {
      allMarkdownRemark(
        filter: { fileAbsolutePath: { regex: "/src/content/" } }
      ) {
        edges {
          node {
            frontmatter {
              template
            }
            fields {
              slug
            }
          }
        }
      }

      allMdx(
        limit: 1000
        filter: { fileAbsolutePath: { regex: "/src/content/" } }
      ) {
        edges {
          node {
            fields {
              fileRelativePath
              slug
            }
            frontmatter {
              template
            }
          }
        }
      }
    }
  `);

  if (errors) {
    reporter.panicOnBuild(`Error while running GraphQL query.`);
    return;
  }

  const { allMarkdownRemark, allMdx } = data;

  allMdx.edges.forEach(({ node }) => {
    const { frontmatter, fields } = node;
    const { fileRelativePath, slug } = fields;

    if (process.env.NODE_ENV === 'development' && !frontmatter.template) {
      createPage({
        path: slug,
        component: path.resolve(TEMPLATE_DIR, 'dev/missingTemplate.js'),
        context: {
          fileRelativePath,
          layout: 'basic',
        },
      });
    } else {
      createPage({
        path: slug,
        component: path.resolve(`${TEMPLATE_DIR}${frontmatter.template}.js`),
        context: {
          fileRelativePath,
          slug,
        },
      });
    }
  });

  allMarkdownRemark.edges.forEach(({ node }) => {
    const {
      frontmatter: { template },
      fields: { slug },
    } = node;

    createPage({
      path: slug,
      component: path.resolve(`${TEMPLATE_DIR}${template}.js`),
      context: {
        slug,
      },
    });
  });
};

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions;

  const typeDefs = `
  type NavYaml implements Node @dontInfer {
    id: ID!
    title: String!
    path: String
    icon: String
    pages: [NavYaml!]!
    rootNav: Boolean!
  }
  `;

  createTypes(typeDefs);
};

exports.createResolvers = ({ createResolvers }) => {
  createResolvers({
    NavYaml: {
      pages: {
        resolve: (source) => {
          return source.pages || [];
        },
      },
      rootNav: {
        resolve: (source) =>
          hasOwnProperty(source, 'rootNav') ? source.rootNav : true,
      },
    },
  });
};

exports.onCreatePage = ({ page, actions }) => {
  const { createPage } = actions;

  if (page.path.match(/404/)) {
    page.context.layout = 'basic';

    createPage(page);
  }

  if (!page.context.fileRelativePath) {
    page.context.fileRelativePath = getFileRelativePath(page.componentPath);

    createPage(page);
  }
};

const getFileRelativePath = (path) => path.replace(`${process.cwd()}/`, '');
