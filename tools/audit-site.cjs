const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  '.cache',
  '.cert',
  '.windsurf'
]);

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function isHtmlFile(filePath) {
  return filePath.toLowerCase().endsWith('.html');
}

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.startsWith('.')) {
      if (SKIP_DIRS.has(ent.name)) continue;
    } else if (SKIP_DIRS.has(ent.name)) {
      continue;
    }

    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walk(full));
    } else if (ent.isFile() && isHtmlFile(full)) {
      if (ent.name.toLowerCase().includes('backup')) continue;
      out.push(full);
    }
  }
  return out;
}

function parseRedirects() {
  const redirectsPath = path.join(PROJECT_ROOT, '_redirects');
  const rewrites = new Map();
  if (!fs.existsSync(redirectsPath)) return rewrites;
  const raw = readText(redirectsPath);
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;
    const from = parts[0];
    const to = parts[1];
    const status = parts[2];
    const statusNum = Number.parseInt(String(status).replace(/!$/, ''), 10);
    if (statusNum === 200 && !from.includes(':splat') && !from.includes('*')) {
      rewrites.set(from, to);
    }
  }
  return rewrites;
}

function stripQueryAndHash(url) {
  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');
  let cut = url.length;
  if (hashIdx !== -1) cut = Math.min(cut, hashIdx);
  if (queryIdx !== -1) cut = Math.min(cut, queryIdx);
  const base = url.slice(0, cut);
  const hash = hashIdx !== -1 ? url.slice(hashIdx + 1) : '';
  return { base, hash };
}

function normalizeUrlToInternalPath(urlStr) {
  const u = String(urlStr || '').trim();
  if (!u) return null;
  if (u.startsWith('mailto:') || u.startsWith('tel:') || u.startsWith('sms:')) return null;
  if (u.startsWith('javascript:')) return null;
  if (u.startsWith('data:')) return null;
  if (u === '#') return null;

  const { base, hash } = stripQueryAndHash(u);
  if (!base && hash) return { type: 'anchor-only', path: '', hash };

  const lowerBase = base.toLowerCase();
  if (lowerBase.startsWith('http://') || lowerBase.startsWith('https://')) {
    const normalized = base.replace(/^https?:\/\/taxiconil\.es/i, '');
    if (normalized !== base) return { type: 'internal', path: normalized || '/', hash };
    return { type: 'external', url: u };
  }

  if (base.startsWith('//')) return { type: 'external', url: u };

  if (base.startsWith('/')) return { type: 'internal', path: base || '/', hash };

  return { type: 'relative', path: base, hash };
}

function resolveInternalTarget(fromFile, linkPath, redirectsRewrites) {
  const cleaned = linkPath.replace(/\\/g, '/');
  let abs;
  if (cleaned.startsWith('/')) {
    abs = path.join(PROJECT_ROOT, `.${cleaned}`);
  } else {
    abs = path.resolve(path.dirname(fromFile), cleaned);
  }

  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    const idx = path.join(abs, 'index.html');
    if (fs.existsSync(idx)) return { filePath: idx, resolvedAs: 'dir-index' };
    return { filePath: abs, resolvedAs: 'dir-missing-index', missing: true };
  }

  const ext = path.extname(abs);
  if (ext) {
    return { filePath: abs, resolvedAs: 'explicit-ext' };
  }

  if (fs.existsSync(abs)) return { filePath: abs, resolvedAs: 'no-ext-existing' };

  const htmlCandidate = `${abs}.html`;
  if (fs.existsSync(htmlCandidate)) return { filePath: htmlCandidate, resolvedAs: 'clean-url-to-html' };

  const internalCleanPath = cleaned.startsWith('/') ? cleaned : null;
  if (internalCleanPath) {
    const rewrite = redirectsRewrites.get(internalCleanPath);
    if (rewrite) {
      const rewriteTarget = rewrite.replace(/\?.*$/, '').replace(/#.*$/, '');
      const rewriteAbs = path.join(PROJECT_ROOT, `.${rewriteTarget}`);
      return { filePath: rewriteAbs, resolvedAs: 'redirects-rewrite', rewriteFrom: internalCleanPath, rewriteTo: rewriteTarget };
    }
  }

  return { filePath: htmlCandidate, resolvedAs: 'missing', missing: true };
}

function extractLinks(html) {
  const links = [];
  const patterns = [
    { kind: 'a', re: /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi },
    { kind: 'link', re: /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi },
    { kind: 'script', re: /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi },
    { kind: 'img', re: /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi },
    { kind: 'source', re: /<source\b[^>]*\bsrcset\s*=\s*["']([^"']+)["']/gi }
  ];

  for (const { kind, re } of patterns) {
    let m;
    while ((m = re.exec(html))) {
      const raw = m[1];
      if (!raw) continue;
      if (kind === 'source') {
        const parts = String(raw)
          .split(',')
          .map((p) => p.trim().split(/\s+/)[0])
          .filter(Boolean);
        for (const part of parts) links.push({ kind, url: part });
      } else {
        links.push({ kind, url: raw });
      }
    }
  }

  return links;
}

function extractFooter(html) {
  const startIdx = html.toLowerCase().indexOf('<footer');
  if (startIdx === -1) return null;
  const endIdx = html.toLowerCase().indexOf('</footer>', startIdx);
  if (endIdx === -1) return null;
  return html.slice(startIdx, endIdx + '</footer>'.length);
}

function detectLanguageFromPath(filePath) {
  const rel = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
  if (rel.startsWith('en/')) return 'en';
  if (rel.startsWith('de/')) return 'de';
  if (rel.startsWith('fr/')) return 'fr';
  if (rel.startsWith('es/')) return 'es-folder';
  return 'root';
}

function findAnchors(html) {
  const ids = new Set();
  const re = /\b(id|name)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const v = String(m[2] || '').trim();
    if (v) ids.add(v);
  }
  return ids;
}

function main() {
  const rewrites = parseRedirects();
  const htmlFiles = walk(PROJECT_ROOT);

  const issues = [];
  const perFile = [];

  const anchorCache = new Map();
  const footerLinksByLangBaseline = new Map();
  const footerDiffs = [];

  for (const filePath of htmlFiles) {
    const html = readText(filePath);
    const links = extractLinks(html);

    const fileIssues = [];

    const localAnchors = findAnchors(html);
    anchorCache.set(filePath, localAnchors);

    for (const link of links) {
      const info = normalizeUrlToInternalPath(link.url);
      if (!info) continue;

      if (info.type === 'external') {
        continue;
      }

      if (info.type === 'anchor-only') {
        const anchor = info.hash;
        if (!anchor) continue;
        if (!localAnchors.has(anchor)) {
          fileIssues.push({ type: 'missing-anchor', kind: link.kind, url: link.url, target: filePath, anchor });
        }
        continue;
      }

      const resolved = resolveInternalTarget(filePath, info.path, rewrites);
      const targetPath = resolved.filePath;
      const isResource = link.kind !== 'a';

      if (!fs.existsSync(targetPath)) {
        fileIssues.push({ type: 'missing-target', kind: link.kind, url: link.url, resolvedAs: resolved.resolvedAs, target: targetPath });
        continue;
      }

      if (link.kind === 'a') {
        const basePath = info.path.startsWith('/') ? info.path : null;
        const hasExt = path.extname(info.path || '');
        const isDir = fs.existsSync(path.join(PROJECT_ROOT, `.${info.path}`)) && fs.statSync(path.join(PROJECT_ROOT, `.${info.path}`)).isDirectory();
        const needsRewrite = basePath && !hasExt && !isDir;
        if (needsRewrite && !rewrites.has(basePath) && !fs.existsSync(path.join(PROJECT_ROOT, `.${basePath}.html`))) {
          fileIssues.push({ type: 'missing-cleanurl-rewrite', kind: link.kind, url: link.url, cleanUrl: basePath });
        }
      }

      if (info.hash && isHtmlFile(targetPath)) {
        let anchors = anchorCache.get(targetPath);
        if (!anchors) {
          const targetHtml = readText(targetPath);
          anchors = findAnchors(targetHtml);
          anchorCache.set(targetPath, anchors);
        }
        if (!anchors.has(info.hash)) {
          fileIssues.push({ type: 'missing-anchor', kind: link.kind, url: link.url, target: targetPath, anchor: info.hash });
        }
      }

      if (isResource && fs.statSync(targetPath).isDirectory()) {
        fileIssues.push({ type: 'resource-points-to-directory', kind: link.kind, url: link.url, target: targetPath });
      }
    }

    const footer = extractFooter(html);
    if (!footer) {
      fileIssues.push({ type: 'missing-footer' });
    } else {
      const footerLinks = extractLinks(footer)
        .filter((l) => l.kind === 'a')
        .map((l) => l.url)
        .filter(Boolean);
      const normalized = footerLinks
        .map((u) => {
          const parsed = normalizeUrlToInternalPath(u);
          if (!parsed) return null;
          if (parsed.type === 'external') return u;
          const p = parsed.type === 'relative' ? parsed.path : parsed.path;
          const anchor = parsed.hash ? `#${parsed.hash}` : '';
          return `${p}${anchor}`;
        })
        .filter(Boolean)
        .sort();

      const lang = detectLanguageFromPath(filePath);
      if (!footerLinksByLangBaseline.has(lang)) {
        footerLinksByLangBaseline.set(lang, { filePath, links: normalized });
      } else {
        const base = footerLinksByLangBaseline.get(lang);
        const baseSet = new Set(base.links);
        const curSet = new Set(normalized);
        const missing = base.links.filter((x) => !curSet.has(x));
        const extra = normalized.filter((x) => !baseSet.has(x));
        if (missing.length || extra.length) {
          footerDiffs.push({ lang, filePath, baseline: base.filePath, missing, extra });
        }
      }
    }

    if (fileIssues.length) {
      issues.push(...fileIssues.map((i) => ({ filePath, ...i })));
    }
    perFile.push({ filePath, issueCount: fileIssues.length });
  }

  const summary = {
    scannedHtmlFiles: htmlFiles.length,
    totalIssues: issues.length,
    byType: issues.reduce((acc, it) => {
      const k = it.type || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
    footerDiffsCount: footerDiffs.length
  };

  const report = { summary, issues, footerDiffs };

  const jsonPath = path.join(PROJECT_ROOT, 'audit-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const lines = [];
  lines.push(`# Auditoría automática`);
  lines.push(``);
  lines.push(`- Archivos HTML analizados: ${summary.scannedHtmlFiles}`);
  lines.push(`- Issues detectados: ${summary.totalIssues}`);
  lines.push(`- Diffs de footer: ${summary.footerDiffsCount}`);
  lines.push(``);
  lines.push(`## Issues por tipo`);
  for (const [k, v] of Object.entries(summary.byType).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push(``);
  lines.push(`## Issues (detalle)`);
  for (const it of issues) {
    const rel = path.relative(PROJECT_ROOT, it.filePath).replace(/\\/g, '/');
    const parts = [`- ${it.type}`, `file=${rel}`];
    if (it.url) parts.push(`url=${it.url}`);
    if (it.cleanUrl) parts.push(`cleanUrl=${it.cleanUrl}`);
    if (it.target && typeof it.target === 'string') {
      const tgt = it.target.startsWith(PROJECT_ROOT) ? path.relative(PROJECT_ROOT, it.target).replace(/\\/g, '/') : it.target;
      parts.push(`target=${tgt}`);
    }
    if (it.anchor) parts.push(`anchor=${it.anchor}`);
    if (it.resolvedAs) parts.push(`resolvedAs=${it.resolvedAs}`);
    lines.push(parts.join(' | '));
  }
  lines.push(``);
  lines.push(`## Footer diffs`);
  for (const d of footerDiffs) {
    const rel = path.relative(PROJECT_ROOT, d.filePath).replace(/\\/g, '/');
    const baseRel = path.relative(PROJECT_ROOT, d.baseline).replace(/\\/g, '/');
    lines.push(`- lang=${d.lang} | file=${rel} | baseline=${baseRel}`);
    if (d.missing.length) lines.push(`  - missing: ${d.missing.join(', ')}`);
    if (d.extra.length) lines.push(`  - extra: ${d.extra.join(', ')}`);
  }
  lines.push(``);
  lines.push(`(Ver audit-report.json para más detalle.)`);
  lines.push(``);

  const mdPath = path.join(PROJECT_ROOT, 'audit-report.md');
  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');

  const topTypes = Object.entries(summary.byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  process.stdout.write(`OK audit-report.md generado. Issues: ${summary.totalIssues}. Top: ${topTypes}\n`);
}

main();

