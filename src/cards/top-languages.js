// @ts-check
import { Card } from "../common/Card.js";
import { getCardColors } from "../common/color.js";
import { formatBytes } from "../common/fmt.js";
import { I18n } from "../common/I18n.js";
import { chunkArray, clampValue, lowercaseTrim } from "../common/ops.js";
import {
  createProgressNode,
  flexLayout,
  measureText,
} from "../common/render.js";
import { langCardLocales } from "../translations.js";

const DEFAULT_CARD_WIDTH = 300;
const MIN_CARD_WIDTH = 280;
const DEFAULT_LANG_COLOR = "#858585";
const CARD_PADDING = 25;
const COMPACT_LAYOUT_BASE_HEIGHT = 90;
const MAXIMUM_LANGS_COUNT = 20;
const NORMAL_LAYOUT_DEFAULT_LANGS_COUNT = 5;
const COMPACT_LAYOUT_DEFAULT_LANGS_COUNT = 6;
const DONUT_LAYOUT_DEFAULT_LANGS_COUNT = 5;
const PIE_LAYOUT_DEFAULT_LANGS_COUNT = 6;
const DONUT_VERTICAL_LAYOUT_DEFAULT_LANGS_COUNT = 6;

/**
 * @typedef {import("../fetchers/types").Lang} Lang
 */

/**
 * Retrieves the programming language whose name is the longest.
 */
const getLongestLang = (arr) =>
  arr.reduce(
    (savedLang, lang) =>
      lang.name.length > savedLang.name.length ? lang : savedLang,
    { name: "", size: 0, color: "" },
  );

/**
 * Convert degrees to radians.
 */
const degreesToRadians = (angleInDegrees) => angleInDegrees * (Math.PI / 180.0);

/**
 * Convert polar coordinates to cartesian coordinates.
 */
const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const rads = degreesToRadians(angleInDegrees);
  return {
    x: centerX + radius * Math.cos(rads),
    y: centerY + radius * Math.sin(rads),
  };
};

/**
 * Calculates length of circle.
 */
const getCircleLength = (radius) => 2 * Math.PI * radius;

/**
 * Height calculations
 */
const calculateCompactLayoutHeight = (totalLangs) =>
  COMPACT_LAYOUT_BASE_HEIGHT + Math.round(totalLangs / 2) * 25;

const calculateNormalLayoutHeight = (totalLangs) =>
  45 + (totalLangs + 1) * 40;

const calculateDonutLayoutHeight = (totalLangs) =>
  215 + Math.max(totalLangs - 5, 0) * 32;

const calculateDonutVerticalLayoutHeight = (totalLangs) =>
  300 + Math.round(totalLangs / 2) * 25;

const calculatePieLayoutHeight = (totalLangs) =>
  300 + Math.round(totalLangs / 2) * 25;

const donutCenterTranslation = (totalLangs) =>
  -45 + Math.max(totalLangs - 5, 0) * 16;

/**
 * Trim top languages (hide certain ones and limit count)
 */
const trimTopLanguages = (topLangs, langs_count, hide) => {
  let langs = Object.values(topLangs);
  const langsToHide = {};
  const langsCount = clampValue(langs_count, 1, MAXIMUM_LANGS_COUNT);

  if (hide) {
    hide.forEach((langName) => {
      langsToHide[lowercaseTrim(langName)] = true;
    });
  }

  langs = langs
    .sort((a, b) => (b.percent || 0) - (a.percent || 0)) // sort by pre-calculated percent
    .filter((lang) => !langsToHide[lowercaseTrim(lang.name)])
    .slice(0, langsCount);

  return { langs };
};

/**
 * Get display value (percentage or bytes)
 */
const getDisplayValue = (lang, format) => {
  const percent = lang.percent ?? 0;
  return format === "bytes"
    ? formatBytes(lang.size)
    : `${percent.toFixed(2)}%`;
};

/**
 * Progress bar + text for normal layout
 */
const createProgressTextNode = ({
  width,
  lang,
  statsFormat,
  index,
}) => {
  const staggerDelay = (index + 3) * 150;
  const paddingRight = 95;
  const progressTextX = width - paddingRight + 10;
  const progressWidth = width - paddingRight;
  const progress = lang.percent ?? 0;
  const displayValue = getDisplayValue(lang, statsFormat);

  return `
    <g class="stagger" style="animation-delay: ${staggerDelay}ms">
      <text data-testid="lang-name" x="2" y="15" class="lang-name">${lang.name}</text>
      <text x="${progressTextX}" y="34" class="lang-name">${displayValue}</text>
      ${createProgressNode({
        x: 0,
        y: 25,
        color: lang.color || DEFAULT_LANG_COLOR,
        width: progressWidth,
        progress,
        progressBarBackgroundColor: "#ddd",
        delay: staggerDelay + 300,
      })}
    </g>
  `;
};

/**
 * Compact layout language item
 */
const createCompactLangNode = ({
  lang,
  hideProgress,
  statsFormat = "percentages",
  index,
}) => {
  const displayValue = hideProgress ? "" : getDisplayValue(lang, statsFormat);
  const staggerDelay = (index + 3) * 150;
  const color = lang.color || DEFAULT_LANG_COLOR;

  return `
    <g class="stagger" style="animation-delay: ${staggerDelay}ms">
      <circle cx="5" cy="6" r="5" fill="${color}" />
      <text data-testid="lang-name" x="15" y="10" class='lang-name'>
        ${lang.name} ${displayValue}
      </text>
    </g>
  `;
};

/**
 * Text list for compact/donut/pie layouts
 */
const createLanguageTextNode = ({
  langs,
  hideProgress,
  statsFormat,
}) => {
  const longestLang = getLongestLang(langs);
  const percentText = hideProgress ? "" : `${(longestLang.percent ?? 0).toFixed(2)}%`;
  const chunked = chunkArray(langs, Math.ceil(langs.length / 2));

  const layouts = chunked.map((array) => {
    const items = array.map((lang, index) =>
      createCompactLangNode({ lang, hideProgress, statsFormat, index })
    );
    return flexLayout({ items, gap: 25, direction: "column" }).join("");
  });

  const minGap = 150;
  const maxGap = 20 + measureText(`${longestLang.name} ${percentText}`, 11);

  return flexLayout({
    items: layouts,
    gap: maxGap < minGap ? minGap : maxGap,
  }).join("");
};

const createDonutLanguagesNode = ({ langs, statsFormat }) => {
  return flexLayout({
    items: langs.map((lang, index) =>
      createCompactLangNode({ lang, hideProgress: false, statsFormat, index })
    ),
    gap: 32,
    direction: "column",
  }).join("");
};

/**
 * Layout renderers
 */
const renderNormalLayout = (langs, width, statsFormat) => {
  return flexLayout({
    items: langs.map((lang, index) =>
      createProgressTextNode({ width, lang, statsFormat, index })
    ),
    gap: 40,
    direction: "column",
  }).join("");
};

const renderCompactLayout = (langs, width, hideProgress, statsFormat) => {
  const paddingRight = 50;
  const offsetWidth = width - paddingRight;
  let progressOffset = 0;

  const compactProgressBar = langs
    .map((lang) => {
      const percentage = (lang.percent ?? 0) / 100 * offsetWidth;
      const progress = percentage < 10 ? percentage + 10 : percentage;
      const output = `
        <rect
          mask="url(#rect-mask)"
          data-testid="lang-progress"
          x="${progressOffset}"
          y="0"
          width="${progress}"
          height="8"
          fill="${lang.color || "#858585"}"
        />
      `;
      progressOffset += percentage;
      return output;
    })
    .join("");

  return `
  ${
    hideProgress
      ? ""
      : `
      <mask id="rect-mask">
          <rect x="0" y="0" width="${offsetWidth}" height="8" fill="white" rx="5"/>
        </mask>
        ${compactProgressBar}
      `
  }
    <g transform="translate(0, ${hideProgress ? "0" : "25"})">
      ${createLanguageTextNode({ langs, hideProgress, statsFormat })}
    </g>
  `;
};

const renderDonutVerticalLayout = (langs, statsFormat) => {
  const radius = 80;
  const totalCircleLength = getCircleLength(radius);
  let indent = 0;
  let startDelayCoefficient = 1;

  const circles = langs.map((lang) => {
    const percentage = lang.percent ?? 0;
    const circleLength = totalCircleLength * (percentage / 100);
    const delay = startDelayCoefficient * 100;
    startDelayCoefficient += 1;

    return `
      <g class="stagger" style="animation-delay: ${delay}ms">
        <circle
          cx="150"
          cy="100"
          r="${radius}"
          fill="transparent"
          stroke="${lang.color || DEFAULT_LANG_COLOR}"
          stroke-width="25"
          stroke-dasharray="${totalCircleLength}"
          stroke-dashoffset="${indent}"
          size="${percentage}"
          data-testid="lang-donut"
        />
      </g>
    `;
    indent += circleLength;
  });

  return `
    <svg data-testid="lang-items">
      <g transform="translate(0, 0)">
        <svg data-testid="donut">${circles.join("")}</svg>
      </g>
      <g transform="translate(0, 220)">
        <svg data-testid="lang-names" x="${CARD_PADDING}">
          ${createLanguageTextNode({ langs, hideProgress: false, statsFormat })}
        </svg>
      </g>
    </svg>
  `;
};

const renderPieLayout = (langs, statsFormat) => {
  const radius = 90;
  const centerX = 150;
  const centerY = 100;
  let startAngle = 0;
  let startDelayCoefficient = 1;
  const paths = [];

  for (const lang of langs) {
    if (langs.length === 1) {
      paths.push(`
        <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${lang.color}" data-testid="lang-pie" size="100"/>
      `);
      break;
    }

    const percentage = lang.percent ?? 0;
    const angle = (percentage / 100) * 360;
    const endAngle = startAngle + angle;
    const startPoint = polarToCartesian(centerX, centerY, radius, startAngle);
    const endPoint = polarToCartesian(centerX, centerY, radius, endAngle);
    const largeArcFlag = angle > 180 ? 1 : 0;
    const delay = startDelayCoefficient * 100;

    paths.push(`
      <g class="stagger" style="animation-delay: ${delay}ms">
        <path
          data-testid="lang-pie"
          size="${percentage}"
          d="M ${centerX} ${centerY} L ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y} Z"
          fill="${lang.color}"
        />
      </g>
    `);

    startAngle = endAngle;
    startDelayCoefficient += 1;
  }

  return `
    <svg data-testid="lang-items">
      <g transform="translate(0, 0)">
        <svg data-testid="pie">${paths.join("")}</svg>
      </g>
      <g transform="translate(0, 220)">
        <svg data-testid="lang-names" x="${CARD_PADDING}">
          ${createLanguageTextNode({ langs, hideProgress: false, statsFormat })}
        </svg>
      </g>
    </svg>
  `;
};

const createDonutPaths = (cx, cy, radius, percentages) => {
  const paths = [];
  let startAngle = 0;

  for (const percent of percentages) {
    const endAngle = startAngle + 3.6 * percent;
    const startPoint = polarToCartesian(cx, cy, radius, endAngle - 90);
    const endPoint = polarToCartesian(cx, cy, radius, startAngle - 90);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

    paths.push({
      percent,
      d: `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 0 ${endPoint.x} ${endPoint.y}`,
    });

    startAngle = endAngle;
  }

  return paths;
};

const renderDonutLayout = (langs, width, statsFormat) => {
  const centerX = width / 3;
  const centerY = width / 3;
  const radius = centerX - 60;
  const strokeWidth = 12;
  const percentages = langs.map((lang) => lang.percent ?? 0);

  const langPaths = createDonutPaths(centerX, centerY, radius, percentages);

  const donutPaths =
    langs.length === 1
      ? `<circle cx="${centerX}" cy="${centerY}" r="${radius}" stroke="${langs[0].color}" fill="none" stroke-width="${strokeWidth}" data-testid="lang-donut" size="100"/>`
      : langPaths
          .map((section, index) => {
            const delay = (index + 3) * 100 + 300;
            return `
              <g class="stagger" style="animation-delay: ${delay}ms">
                <path
                  data-testid="lang-donut"
                  size="${section.percent}"
                  d="${section.d}"
                  stroke="${langs[index].color}"
                  fill="none"
                  stroke-width="${strokeWidth}">
                </path>
              </g>
            `;
          })
          .join("");

  const donut = `<svg width="${width}" height="${width}">${donutPaths}</svg>`;

  return `
    <g transform="translate(0, 0)">
      <g transform="translate(0, 0)">
        ${createDonutLanguagesNode({ langs, statsFormat })}
      </g>
      <g transform="translate(125, ${donutCenterTranslation(langs.length)})">
        ${donut}
      </g>
    </g>
  `;
};

const noLanguagesDataNode = ({ color, text, layout }) => {
  return `
    <text x="${layout === "pie" || layout === "donut-vertical" ? CARD_PADDING : 0}" y="11" class="stat bold" fill="${color}">${text}</text>
  `;
};

const getDefaultLanguagesCountByLayout = ({ layout, hide_progress }) => {
  if (layout === "compact" || hide_progress === true) return COMPACT_LAYOUT_DEFAULT_LANGS_COUNT;
  if (layout === "donut") return DONUT_LAYOUT_DEFAULT_LANGS_COUNT;
  if (layout === "donut-vertical") return DONUT_VERTICAL_LAYOUT_DEFAULT_LANGS_COUNT;
  if (layout === "pie") return PIE_LAYOUT_DEFAULT_LANGS_COUNT;
  return NORMAL_LAYOUT_DEFAULT_LANGS_COUNT;
};

/**
 * Main render function
 */
const renderTopLanguages = (topLangs, options = {}) => {
  const {
    hide_title = false,
    hide_border = false,
    card_width,
    title_color,
    text_color,
    bg_color,
    hide,
    hide_progress,
    theme,
    layout,
    custom_title,
    locale,
    langs_count = getDefaultLanguagesCountByLayout({ layout, hide_progress }),
    border_radius,
    border_color,
    disable_animations,
    stats_format = "percentages",
  } = options;

  const i18n = new I18n({ locale, translations: langCardLocales });

  const { langs } = trimTopLanguages(topLangs, langs_count, hide);

  let width = card_width
    ? isNaN(card_width)
      ? DEFAULT_CARD_WIDTH
      : card_width < MIN_CARD_WIDTH
        ? MIN_CARD_WIDTH
        : card_width
    : DEFAULT_CARD_WIDTH;

  let height = calculateNormalLayoutHeight(langs.length);
  const colors = getCardColors({ title_color, text_color, bg_color, border_color, theme });

  let finalLayout = "";

  if (langs.length === 0) {
    height = COMPACT_LAYOUT_BASE_HEIGHT;
    finalLayout = noLanguagesDataNode({
      color: colors.textColor,
      text: i18n.t("langcard.nodata"),
      layout,
    });
  } else if (layout === "pie") {
    height = calculatePieLayoutHeight(langs.length);
    finalLayout = renderPieLayout(langs, stats_format);
  } else if (layout === "donut-vertical") {
    height = calculateDonutVerticalLayoutHeight(langs.length);
    finalLayout = renderDonutVerticalLayout(langs, stats_format);
  } else if (layout === "compact" || hide_progress) {
    height = calculateCompactLayoutHeight(langs.length) + (hide_progress ? -25 : 0);
    finalLayout = renderCompactLayout(langs, width, hide_progress, stats_format);
  } else if (layout === "donut") {
    height = calculateDonutLayoutHeight(langs.length);
    width = width + 50;
    finalLayout = renderDonutLayout(langs, width, stats_format);
  } else {
    finalLayout = renderNormalLayout(langs, width, stats_format);
  }

  const card = new Card({
    customTitle: custom_title,
    defaultTitle: i18n.t("langcard.title"),
    width,
    height,
    border_radius,
    colors,
  });

  if (disable_animations) card.disableAnimations();
  card.setHideBorder(hide_border);
  card.setHideTitle(hide_title);

  card.setCSS(`
    @keyframes slideInAnimation { from { width: 0; } to { width: calc(100%-100px); } }
    @keyframes growWidthAnimation { from { width: 0; } to { width: 100%; } }
    .stat { font: 600 14px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: ${colors.textColor}; }
    @supports(-moz-appearance: auto) { .stat { font-size:12px; } }
    .bold { font-weight: 700 }
    .lang-name { font: 400 11px "Segoe UI", Ubuntu, Sans-Serif; fill: ${colors.textColor}; }
    .stagger { opacity: 0; animation: fadeInAnimation 0.3s ease-in-out forwards; }
    #rect-mask rect { animation: slideInAnimation 1s ease-in-out forwards; }
    .lang-progress { animation: growWidthAnimation 0.6s ease-in-out forwards; }
  `);

  if (layout === "pie" || layout === "donut-vertical") {
    return card.render(finalLayout);
  }

  return card.render(`
    <svg data-testid="lang-items" x="${CARD_PADDING}">
      ${finalLayout}
    </svg>
  `);
};

export {
  renderTopLanguages,
  MIN_CARD_WIDTH,
  getDefaultLanguagesCountByLayout,
};
