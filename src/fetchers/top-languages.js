const fetchTopLanguages = async (
  username,
  exclude_repo = [],
  size_weight = 1,
  count_weight = 0
) => {
  if (!username) throw new MissingParamError(["username"]);

  const token = process.env.PAT_1;
  if (!token)
    throw new CustomError(
      "GitHub token (PAT_1) not found.",
      CustomError.GRAPHQL_ERROR
    );

  // Validar y sanitizar weights
  size_weight = parseFloat(size_weight);
  if (isNaN(size_weight) || size_weight < 0) size_weight = 1;

  count_weight = parseFloat(count_weight);
  if (isNaN(count_weight) || count_weight < 0) count_weight = 0;

  const res = await retryWithBackoff(() => fetcher({ login: username }, token));

  if (res.data.errors) {
    logger.error(res.data.errors);
    throw new CustomError(
      res.data.errors[0]?.message || "GraphQL API error",
      CustomError.GRAPHQL_ERROR
    );
  }

  let repoNodes = res.data.data.user.repositories.nodes || [];

  // Filtrar repos excluidos
  const allExcluded = [...excludeRepositories, ...exclude_repo];
  repoNodes = repoNodes.filter((r) => !allExcluded.includes(r.name));

  // Si no quedan repos, devolver objeto vacío
  if (repoNodes.length === 0) {
    return {};
  }

  const langMap = {};

  repoNodes.forEach((repo) => {
    if (!repo.languages?.edges?.length) return; // Repo sin lenguajes

    repo.languages.edges.forEach((edge) => {
      const name = edge.node.name;
      const size = edge.size || 0;

      if (!langMap[name]) {
        langMap[name] = {
          name,
          color: edge.node.color || "#000000",
          size: 0,
          count: 0,
        };
      }
      langMap[name].size += size;
      langMap[name].count += 1;
    });
  });

  // Si no se detectó ningún lenguaje en ningún repo
  if (Object.keys(langMap).length === 0) {
    return {};
  }

  // Aplicar pesos de forma segura
  Object.values(langMap).forEach((lang) => {
    let weightedSize = lang.size;
    let weightedCount = lang.count;

    // Math.pow(0, 0) = 1 en JS, pero si el exponente es negativo da Infinity
    if (size_weight !== 0) {
      weightedSize = Math.pow(lang.size || 1, size_weight); // usar 1 si size=0 para evitar 0^neg
    } else {
      weightedSize = 1;
    }

    if (count_weight !== 0) {
      weightedCount = Math.pow(lang.count || 1, count_weight);
    } else {
      weightedCount = 1;
    }

    lang.size = weightedSize * weightedCount;
  });

  // Calcular total seguro
  const totalSize = Object.values(langMap).reduce(
    (sum, lang) => sum + (lang.size || 0),
    0
  );

  // Si por algún motivo totalSize es 0 (muy raro con las correcciones), asignar 100% igualitario
  const finalTotal = totalSize > 0 ? totalSize : 1;

  Object.values(langMap).forEach((lang) => {
    lang.percent = (lang.size / finalTotal) * 100;
    // Opcional: redondear a 2 decimales
    lang.percent = Math.round(lang.percent * 100) / 100;
  });

  // Ordenar por tamaño ponderado y devolver
  const topLangs = Object.values(langMap)
    .sort((a, b) => b.size - a.size)
    .reduce((acc, lang) => {
      acc[lang.name] = lang;
      return acc;
    }, {});

  return topLangs;
};
