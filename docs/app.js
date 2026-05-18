const DATA_URL = "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/data.json";
const LOCAL_LOGOS_URL = "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/local-logos/metadata.json";
const LOCAL_LOGO_BASE = "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/local-logos/";

const LOCAL_PROJECT_LOGOS = [
  { slug: "kia", name: "Kia", image: "./assets/logos/kia.svg" },
  { slug: "nissan", name: "Nissan", image: "./assets/logos/nissan.svg" },
  { slug: "renault", name: "Renault", image: "./assets/logos/renault.svg" },
  { slug: "peugeot", name: "Peugeot", image: "./assets/logos/peugeot.svg" },
  { slug: "volkswagen", name: "Volkswagen", image: "./assets/logos/volkswagen.svg" },
  { slug: "byd", name: "BYD", image: "./assets/logos/byd.png" },
  { slug: "xpeng", name: "XPeng", image: "./assets/logos/xpeng.svg" },
  { slug: "xiaomi", name: "Xiaomi", image: "./assets/logos/xiaomi.svg" },
  { slug: "aito", name: "问界", image: "./assets/logos/aito.png" },
  { slug: "luxeed", name: "智界", image: "./assets/logos/zhijie.png" },
  { slug: "stelato", name: "享界", image: "./assets/logos/xiangjie.png" },
  { slug: "shangjie", name: "尚界", image: "./assets/logos/shangjie.png" },
  { slug: "zeekr", name: "ZEEKR", image: "./assets/logos/zeekr.svg" },
  { slug: "li-auto", name: "Li Auto", image: "./assets/logos/liauto.svg" },
  { slug: "nio", name: "NIO", image: "./assets/logos/nio.svg" },
  { slug: "maextro", name: "尊界", image: "./assets/logos/zunjie.png" },
  { slug: "avatr", name: "AVATR", image: "./assets/logos/avatr.png" },
  { slug: "cadillac", name: "Cadillac", image: "./assets/logos/cadillac.svg" },
  { slug: "audi", name: "Audi", image: "./assets/logos/audi.svg" },
  { slug: "bmw", name: "BMW", image: "./assets/logos/bmw.svg" },
  { slug: "jaguar", name: "Jaguar", image: "./assets/logos/jaguar.svg" },
  { slug: "porsche", name: "Porsche", image: "./assets/logos/porsche.svg" },
  { slug: "ferrari", name: "Ferrari", image: "./assets/logos/ferrari.svg" }
];

const LOCAL_PROJECT_LOGO_MAP = new Map(LOCAL_PROJECT_LOGOS.map((logo) => [logo.slug, logo]));
const AXIS_POSITION_STORAGE_KEY = "logoExplorerAxisPositionOverrides";
const AXIS_SIDE_PADDING = 24;
const AXIS_TOP_PADDING = 20;
const AXIS_BOTTOM_PADDING = 64;

const TAXONOMY = {
  regions: ["中国", "德国", "日本", "美国", "法国", "意大利", "英国", "韩国", "北欧", "其他欧洲", "其他亚洲", "其他美洲", "待补充"],
  yearBuckets: ["1900 前", "1900-1949", "1950-1999", "2000-2009", "2010 后", "待补充"],
  content: ["文字/字母", "动物", "星形/天体", "盾徽/纹章", "几何抽象", "翅膀/速度", "地域/旗帜", "人物/神话/物件", "待补充"],
  shapes: ["圆形", "椭圆", "盾形", "横向字标", "竖向标", "菱形", "翼形", "自由轮廓", "待补充"],
  confidence: ["verified", "inferred", "todo"]
};

const CONFIDENCE_LABELS = {
  verified: "已校对",
  inferred: "视觉推断",
  todo: "待补充"
};

const state = {
  logos: [],
  positionOverrides: loadPositionOverrides(),
  query: "",
  sort: "nameAsc",
  filters: {
    region: new Set(),
    year: new Set(),
    content: new Set(),
    shape: new Set(),
    confidence: new Set()
  }
};

const els = {
  search: document.getElementById("searchInput"),
  sort: document.getElementById("sortSelect"),
  grid: document.getElementById("grid"),
  status: document.getElementById("statusMessage"),
  empty: document.getElementById("emptyState"),
  total: document.getElementById("totalCount"),
  visible: document.getElementById("visibleCount"),
  verified: document.getElementById("verifiedCount"),
  todo: document.getElementById("todoCount"),
  activeFilters: document.getElementById("activeFilters"),
  positionAxis: document.getElementById("positionAxis"),
  positionCount: document.getElementById("positionCount"),
  reset: document.getElementById("resetBtn"),
  emptyReset: document.getElementById("emptyResetBtn")
};

function normalizeLogo(rawLogo) {
  const metadata = window.BRAND_METADATA?.[rawLogo.slug] || {};
  const localLogo = LOCAL_PROJECT_LOGO_MAP.get(rawLogo.slug);
  const contentTags = normalizeTags(metadata.contentTags);
  const shapeTags = normalizeTags(metadata.shapeTags);

  return {
    name: rawLogo.name,
    slug: rawLogo.slug,
    image: rawLogo.image,
    localImage: localLogo?.image || null,
    country: metadata.country || "待补充",
    region: metadata.region || "待补充",
    foundedYear: Number.isInteger(metadata.foundedYear) ? metadata.foundedYear : null,
    contentTags: contentTags.length ? contentTags : ["待补充"],
    shapeTags: shapeTags.length ? shapeTags : ["待补充"],
    confidence: metadata.confidence || "todo"
  };
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.filter(Boolean) : [];
}

function yearBucket(year) {
  if (!Number.isInteger(year)) return "待补充";
  if (year < 1900) return "1900 前";
  if (year < 1950) return "1900-1949";
  if (year < 2000) return "1950-1999";
  if (year < 2010) return "2000-2009";
  return "2010 后";
}

function searchableText(logo) {
  return [
    logo.name,
    logo.slug,
    logo.country,
    logo.region,
    ...logo.contentTags,
    ...logo.shapeTags
  ].join(" ").toLowerCase();
}

async function loadLogos() {
  try {
    const [mainResponse, localResponse] = await Promise.all([fetch(DATA_URL), fetch(LOCAL_LOGOS_URL)]);
    if (!mainResponse.ok) throw new Error(`主数据加载失败：${mainResponse.status}`);
    if (!localResponse.ok) throw new Error(`本地补充数据加载失败：${localResponse.status}`);

    const mainLogos = await mainResponse.json();
    const localLogos = await localResponse.json();
    const merged = new Map();

    mainLogos.forEach((item) => merged.set(item.slug, item));
    localLogos.forEach((item) => {
      if (!merged.has(item.slug)) {
        const imageUrl = `${LOCAL_LOGO_BASE}${item.fileName}`;
        merged.set(item.slug, {
          name: item.name,
          slug: item.slug,
          image: {
            source: imageUrl,
            thumb: imageUrl,
            optimized: imageUrl,
            original: imageUrl
          }
        });
      }
    });
    LOCAL_PROJECT_LOGOS.forEach((item) => {
      if (!merged.has(item.slug)) {
        merged.set(item.slug, {
          name: item.name,
          slug: item.slug,
          image: {
            source: item.image,
            thumb: item.image,
            optimized: item.image,
            original: item.image
          }
        });
      }
    });

    state.logos = Array.from(merged.values()).map(normalizeLogo);
    els.status.textContent = `已加载 ${state.logos.length} 个 logo。`;
    els.status.classList.remove("error");
    render();
  } catch (error) {
    state.logos = LOCAL_PROJECT_LOGOS.map((item) => normalizeLogo({
      name: item.name,
      slug: item.slug,
      image: {
        source: item.image,
        thumb: item.image,
        optimized: item.image,
        original: item.image
      }
    }));
    els.status.textContent = `远程数据加载失败，已先显示 ${state.logos.length} 个本地项目 logo。请确认网络可访问 GitHub raw 文件后重试。${error.message}`;
    els.status.classList.add("error");
    render();
  }
}

function renderFilterGroup(containerId, values, type, labelMap = {}) {
  const container = document.getElementById(containerId);
  container.innerHTML = values.map((value) => {
    const id = `${type}-${value}`.replace(/\s+/g, "-");
    const label = labelMap[value] || value;
    return `
      <label class="check-option" for="${id}">
        <input id="${id}" type="checkbox" value="${escapeAttr(value)}" data-filter="${type}" />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }).join("");

  container.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const set = state.filters[type];
    input.checked ? set.add(input.value) : set.delete(input.value);
    render();
  });
}

function initFilters() {
  renderFilterGroup("regionFilters", TAXONOMY.regions, "region");
  renderFilterGroup("yearFilters", TAXONOMY.yearBuckets, "year");
  renderFilterGroup("contentFilters", TAXONOMY.content, "content");
  renderFilterGroup("shapeFilters", TAXONOMY.shapes, "shape");
  renderFilterGroup("confidenceFilters", TAXONOMY.confidence, "confidence", CONFIDENCE_LABELS);

  els.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  els.sort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  els.reset.addEventListener("click", resetFilters);
  els.emptyReset.addEventListener("click", resetFilters);
  initAxisDrag();
}

function resetFilters() {
  Object.values(state.filters).forEach((set) => set.clear());
  state.query = "";
  state.sort = "nameAsc";
  els.search.value = "";
  els.sort.value = "nameAsc";
  document.querySelectorAll(".check-option input").forEach((input) => {
    input.checked = false;
  });
  render();
}

function matchesFilters(logo) {
  if (state.query && !searchableText(logo).includes(state.query)) return false;
  if (state.filters.region.size && !state.filters.region.has(logo.region)) return false;
  if (state.filters.year.size && !state.filters.year.has(yearBucket(logo.foundedYear))) return false;
  if (state.filters.confidence.size && !state.filters.confidence.has(logo.confidence)) return false;
  if (state.filters.content.size && !hasAny(logo.contentTags, state.filters.content)) return false;
  if (state.filters.shape.size && !hasAny(logo.shapeTags, state.filters.shape)) return false;
  return true;
}

function hasAny(values, selected) {
  return values.some((value) => selected.has(value));
}

function sortLogos(logos) {
  return [...logos].sort((a, b) => {
    if (state.sort === "yearAsc") {
      return sortYear(a, b, "asc") || a.name.localeCompare(b.name);
    }
    if (state.sort === "yearDesc") {
      return sortYear(a, b, "desc") || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
}

function sortYear(a, b, direction) {
  const aKnown = Number.isInteger(a.foundedYear);
  const bKnown = Number.isInteger(b.foundedYear);
  if (!aKnown && !bKnown) return 0;
  if (!aKnown) return 1;
  if (!bKnown) return -1;
  return direction === "asc" ? a.foundedYear - b.foundedYear : b.foundedYear - a.foundedYear;
}

function render() {
  const filtered = sortLogos(state.logos.filter(matchesFilters));
  updateStats(filtered);
  renderActiveFilters();
  renderPositionAxis();
  renderGrid(filtered);
}

function updateStats(filtered) {
  const all = state.logos;
  els.total.textContent = all.length || "-";
  els.visible.textContent = filtered.length || "0";
  els.verified.textContent = all.filter((logo) => logo.confidence === "verified").length || "0";
  els.todo.textContent = all.filter((logo) => logo.confidence === "todo").length || "0";
}

function renderActiveFilters() {
  const active = [];
  if (state.query) active.push(`搜索：${state.query}`);
  Object.entries(state.filters).forEach(([type, set]) => {
    set.forEach((value) => active.push(type === "confidence" ? CONFIDENCE_LABELS[value] : value));
  });

  els.activeFilters.innerHTML = active.length
    ? active.map((label) => `<span>${escapeHtml(label)}</span>`).join("")
    : "<span>当前显示全部品牌</span>";
}

function renderGrid(logos) {
  els.empty.hidden = logos.length > 0;
  els.grid.hidden = logos.length === 0;
  els.grid.innerHTML = logos.map(renderCard).join("");
}

function renderCard(logo) {
  const year = Number.isInteger(logo.foundedYear) ? `${logo.foundedYear}` : "待补充";
  const confidenceLabel = CONFIDENCE_LABELS[logo.confidence] || "待补充";
  const imageUrl = getLogoImageUrl(logo);
  const sourceUrl = logo.localImage || logo.image.source || logo.image.original || imageUrl;

  return `
    <article class="logo-card">
      <div class="logo-image-wrap">
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(logo.name)} logo" loading="lazy" />
      </div>
      <div class="card-main">
        <div>
          <h3>${escapeHtml(logo.name)}</h3>
          <p>${escapeHtml(logo.slug)}</p>
        </div>
        <span class="status-pill ${escapeAttr(logo.confidence)}">${escapeHtml(confidenceLabel)}</span>
      </div>
      <dl class="meta-list">
        <div><dt>地区</dt><dd>${escapeHtml(logo.country)} / ${escapeHtml(logo.region)}</dd></div>
        <div><dt>年份</dt><dd>${escapeHtml(year)} · ${escapeHtml(yearBucket(logo.foundedYear))}</dd></div>
      </dl>
      <div class="tag-row">${renderTags(logo.contentTags)}</div>
      <div class="tag-row shape">${renderTags(logo.shapeTags)}</div>
      <a class="source-link" href="${escapeAttr(sourceUrl)}" target="_blank" rel="noreferrer">查看原始来源</a>
    </article>
  `;
}

function renderPositionAxis() {
  const positionData = window.BRAND_POSITIONING || {};
  const items = state.logos
    .map((logo, index) => {
      const positioning = positionData[logo.slug];
      return {
        ...logo,
        positioning,
        axisPosition: positioning ? getAxisPosition(logo.slug, positioning.score, index) : null
      };
    })
    .filter((item) => item.positioning)
    .sort((a, b) => a.axisPosition.x - b.axisPosition.x || a.axisPosition.y - b.axisPosition.y || a.name.localeCompare(b.name));

  els.positionCount.textContent = items.length;
  els.positionAxis.innerHTML = `
    <div class="axis-line"></div>
    ${items.map(renderPositionItem).join("")}
  `;
}

function renderPositionItem(logo, index) {
  const data = logo.positioning;
  const imageUrl = getLogoImageUrl(logo);
  return `
    <article class="position-item" data-slug="${escapeAttr(logo.slug)}" style="--score:${logo.axisPosition.x}; --y:${logo.axisPosition.y};">
      <div class="position-card" title="${escapeAttr(data.note)}">
        <span class="position-dot" aria-hidden="true"></span>
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(logo.name)} logo" loading="lazy" />
        <strong>${escapeHtml(logo.name)}</strong>
        <span>${escapeHtml(data.tier)}</span>
      </div>
    </article>
  `;
}

function getLogoImageUrl(logo) {
  return logo.localImage || logo.image.optimized || logo.image.thumb || logo.image.original || logo.image.source;
}

function initAxisDrag() {
  let dragState = null;

  els.positionAxis.addEventListener("pointerdown", (event) => {
    const item = event.target.closest(".position-item");
    if (!item || event.target.closest("a")) return;
    event.preventDefault();
    item.setPointerCapture(event.pointerId);
    dragState = { item, pointerId: event.pointerId, slug: item.dataset.slug };
    item.classList.add("dragging");
    updateDraggedAxisItem(event, dragState);
  });

  els.positionAxis.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    updateDraggedAxisItem(event, dragState);
  });

  els.positionAxis.addEventListener("pointerup", (event) => {
    if (!dragState) return;
    updateDraggedAxisItem(event, dragState);
    finishAxisDrag(dragState);
    dragState = null;
  });

  els.positionAxis.addEventListener("pointercancel", () => {
    if (!dragState) return;
    finishAxisDrag(dragState);
    dragState = null;
  });
}

function updateDraggedAxisItem(event, dragState) {
  const rect = els.positionAxis.getBoundingClientRect();
  const usableWidth = Math.max(1, rect.width - AXIS_SIDE_PADDING * 2);
  const usableHeight = Math.max(1, rect.height - AXIS_TOP_PADDING - AXIS_BOTTOM_PADDING);
  const x = clamp(event.clientX - rect.left - AXIS_SIDE_PADDING, 0, usableWidth);
  const y = clamp(event.clientY - rect.top - AXIS_TOP_PADDING, 0, usableHeight);
  const xScore = Math.round((x / usableWidth) * 100);
  const yScore = Math.round((y / usableHeight) * 100);
  dragState.item.style.setProperty("--score", xScore);
  dragState.item.style.setProperty("--y", yScore);
  dragState.position = { x: xScore, y: yScore };
}

function finishAxisDrag(dragState) {
  dragState.item.classList.remove("dragging");
  state.positionOverrides[dragState.slug] = dragState.position;
  savePositionOverrides();
  renderPositionAxis();
}

function getAxisPosition(slug, defaultScore, index) {
  const override = state.positionOverrides[slug];
  if (Number.isFinite(override)) {
    return { x: override, y: defaultAxisY(index) };
  }
  if (override && Number.isFinite(override.x) && Number.isFinite(override.y)) {
    return { x: override.x, y: override.y };
  }
  return { x: defaultScore, y: defaultAxisY(index) };
}

function defaultAxisY(index) {
  return 8 + (index % 4) * 20;
}

function loadPositionOverrides() {
  try {
    const rawValue = localStorage.getItem(AXIS_POSITION_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : {};
  } catch {
    return {};
  }
}

function savePositionOverrides() {
  try {
    localStorage.setItem(AXIS_POSITION_STORAGE_KEY, JSON.stringify(state.positionOverrides));
  } catch {
    // Local persistence is optional; dragging still works without storage access.
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderTags(tags) {
  return tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

initFilters();
loadLogos();
