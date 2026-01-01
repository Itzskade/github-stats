// @ts-check
import { logger } from "../common/log.js";
import { excludeRepositories } from "../common/envs.js";
import { CustomError, MissingParamError } from "../common/error.js";
import { wrapTextMultiline } from "../common/fmt.js";
import { request } from "../common/http.js";

/** @typedef {import("./types").TopLangData} TopLangData */

const fetcher = async (variables, token) => {
  return request(
    {
      query: `
        query userInfo($login: String!) {
          user(login: $login) {
            repositories(ownerAffiliations: OWNER, isFork: false, first: 50) {
              nodes {
                name
                languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
                  edges {
                    size
                    node {
                      color
                      name
                    }
                  }
                }
              }
            }
          }
        }
      `,
      variables,
    },
    {
      Authorization: `token ${token}`,
    }
  );
};

/**
 * Retry helper with exponential backoff
 * @param {function} fn Function to retry
 * @param {number} retries Number of retries
 * @param {number} delayMs Initial delay in ms
 */
const retryWithBackoff = async (fn, retries = 3, delayMs = 500) => {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    logger.warn(`Fetch failed, retrying in ${delayMs}ms... (${retries} retries left)`);
    await new Promise(r => setTimeout(r, delayMs));
    return retryWithBackoff(fn, retries - 1, delayMs * 2); // Exponencial
  }
};

const fetchTopLanguages = async (username, exclude_repo = [], size_weight = 1, count_weight = 0) => {
  if (!username) throw new MissingParamError(["username"]);

  const token = process.env.PAT_1;
  if (!token) throw new CustomError("GitHub token (PAT_1) not found.", CustomError.GRAPHQL_ERROR);

  // Retry fetcher con backoff
  const res = await retryWithBackoff(() => fetcher({ login: username }, token));

  if (res.data.errors) {
    logger.error(res.data.errors);
    throw new CustomError(res.data.errors[0]?.message || "GraphQL API error", CustomError.GRAPHQL_ERROR);
  }

  let repoNodes = res.data.data.user.repositories.nodes;

  const allExcluded = [...excludeRepositories, ...exclude_repo];
  repoNodes = repoNodes.filter(r => !allExcluded.includes(r.name));

  const langMap = {};
  repoNodes.forEach(repo => {
    repo.languages.edges.forEach(edge => {
      const name = edge.node.name;
      if (!langMap[name]) langMap[name] = { name, color: edge.node.color, size: 0, count: 0 };
      langMap[name].size += edge.size;
      langMap[name].count += 1;
    });
  });

  Object.values(langMap).forEach(lang => {
    lang.size = Math.pow(lang.size, size_weight) * Math.pow(lang.count, count_weight);
  });

  const topLangs = Object.values(langMap)
    .sort((a, b) => b.size - a.size)
    .reduce((acc, lang) => {
      acc[lang.name] = lang;
      return acc;
    }, {});

  return topLangs;
};

export { fetchTopLanguages };
export default fetchTopLanguages;
