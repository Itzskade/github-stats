// @ts-check
import { renderTopLanguages } from "../src/cards/top-languages.js";
import { guardAccess } from "../src/common/access.js";
import { parseArray, parseBoolean } from "../src/common/ops.js";
import { setCacheHeaders, resolveCacheSeconds, setErrorCacheHeaders, CACHE_TTL } from "../src/common/cache.js";
import { renderError } from "../src/common/render.js";
import { fetchTopLanguages } from "../src/fetchers/top-languages.js";
import { isLocaleAvailable } from "../src/translations.js";

export default async (req, res) => {
  const { username, hide, hide_title, hide_border, card_width, title_color, text_color, bg_color, theme, cache_seconds, layout, langs_count, border_radius, border_color, locale, disable_animations, hide_progress, stats_format, custom_title } = req.query;

  res.setHeader("Content-Type", "image/svg+xml");

  // Guard
  const access = guardAccess({ res, id: username, type: "username", colors: { title_color, text_color, bg_color, border_color, theme } });
  if (!access.isPassed) return access.result;

  // Locale check
  if (locale && !isLocaleAvailable(locale)) {
    return res.send(renderError({ message: "Locale not found", renderOptions: { title_color, text_color, bg_color, border_color, theme } }));
  }

  try {
    // Fetch top languages
    const topLangs = await fetchTopLanguages(username, parseArray(req.query.exclude_repo), parseFloat(req.query.size_weight), parseFloat(req.query.count_weight));

    const cacheSeconds = resolveCacheSeconds({ requested: parseInt(cache_seconds, 10), def: CACHE_TTL.TOP_LANGS_CARD.DEFAULT, min: CACHE_TTL.TOP_LANGS_CARD.MIN, max: CACHE_TTL.TOP_LANGS_CARD.MAX });
    setCacheHeaders(res, cacheSeconds);

    return res.send(renderTopLanguages(topLangs, {
      custom_title,
      hide_title: parseBoolean(hide_title),
      hide_border: parseBoolean(hide_border),
      card_width: parseInt(card_width, 10),
      hide: parseArray(hide),
      title_color,
      text_color,
      bg_color,
      theme,
      layout,
      langs_count,
      border_radius,
      border_color,
      locale: locale?.toLowerCase(),
      disable_animations: parseBoolean(disable_animations),
      hide_progress: parseBoolean(hide_progress),
      stats_format
    }));
  } catch (err) {
    setErrorCacheHeaders(res);
    return res.send(renderError({ message: err.message, renderOptions: { title_color, text_color, bg_color, border_color, theme } }));
  }
};
