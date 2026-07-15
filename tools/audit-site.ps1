$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$SkipDirFragments = @(
  "\.git\",
  "\node_modules\",
  "\.next\",
  "\dist\",
  "\build\",
  "\.cache\",
  "\.cert\",
  "\.windsurf\"
)

function Test-SkipPath {
  param([string]$FullName)
  foreach ($frag in $SkipDirFragments) {
    if ($FullName -like "*$frag*") { return $true }
  }
  return $false
}

function Get-HtmlFiles {
  $files = Get-ChildItem -Path $ProjectRoot -Recurse -File -Filter "*.html" -ErrorAction SilentlyContinue |
    Where-Object { -not (Test-SkipPath $_.FullName) } |
    Where-Object { $_.Name -notmatch "backup" }
  return $files
}

function Read-Text {
  param([string]$FilePath)
  return [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
}

function Strip-QueryAndHash {
  param([string]$Url)
  $u = [string]$Url
  $hashIdx = $u.IndexOf("#")
  $queryIdx = $u.IndexOf("?")
  $cut = $u.Length
  if ($hashIdx -ge 0) { $cut = [Math]::Min($cut, $hashIdx) }
  if ($queryIdx -ge 0) { $cut = [Math]::Min($cut, $queryIdx) }
  $base = $u.Substring(0, $cut)
  $hash = ""
  if ($hashIdx -ge 0) { $hash = $u.Substring($hashIdx + 1) }
  return @{ base = $base; hash = $hash }
}

function Normalize-Url {
  param([string]$Url)
  $u = ([string]$Url).Trim()
  if (-not $u) { return $null }
  if ($u -eq "#") { return $null }
  $lower = $u.ToLowerInvariant()
  if ($lower.StartsWith("mailto:") -or $lower.StartsWith("tel:") -or $lower.StartsWith("sms:") -or $lower.StartsWith("javascript:") -or $lower.StartsWith("data:")) { return $null }

  $parts = Strip-QueryAndHash $u
  $base = $parts.base
  $hash = $parts.hash
  if (-not $base -and $hash) { return @{ type = "anchor-only"; path = ""; hash = $hash } }

  $lowerBase = ([string]$base).ToLowerInvariant()
  if ($lowerBase.StartsWith("http://") -or $lowerBase.StartsWith("https://")) {
    $normalized = $base -replace "^https?://taxiconil\.es", ""
    if ($normalized -ne $base) { return @{ type = "internal"; path = ($normalized -ne "" ? $normalized : "/"); hash = $hash } }
    return @{ type = "external"; url = $u }
  }
  if ($base.StartsWith("//")) { return @{ type = "external"; url = $u } }
  if ($base.StartsWith("/")) { return @{ type = "internal"; path = ($base -ne "" ? $base : "/"); hash = $hash } }
  return @{ type = "relative"; path = $base; hash = $hash }
}

function Parse-Redirects {
  $redirectsPath = Join-Path $ProjectRoot "_redirects"
  $rewrites = @{}
  if (-not (Test-Path $redirectsPath)) { return $rewrites }
  $raw = Read-Text $redirectsPath
  foreach ($line in ($raw -split "`r?`n")) {
    $trimmed = $line.Trim()
    if (-not $trimmed) { continue }
    if ($trimmed.StartsWith("#")) { continue }
    $parts = $trimmed -split "\s+"
    if ($parts.Count -lt 3) { continue }
    $from = $parts[0]
    $to = $parts[1]
    $statusStr = $parts[2] -replace "!", ""
    $statusNum = 0
    if (-not [int]::TryParse($statusStr, [ref]$statusNum)) { continue }
    if ($statusNum -eq 200 -and ($from -notmatch ":splat") -and ($from -notmatch "\*")) {
      $rewrites[$from] = $to
    }
  }
  return $rewrites
}

function Resolve-InternalTarget {
  param(
    [string]$FromFile,
    [string]$LinkPath,
    [hashtable]$Rewrites
  )

  $cleaned = ([string]$LinkPath).Replace("\", "/")
  $abs = $null
  if ($cleaned.StartsWith("/")) {
    $abs = Join-Path $ProjectRoot (".{0}" -f $cleaned)
  } else {
    $abs = (Resolve-Path (Join-Path (Split-Path -Parent $FromFile) $cleaned) -ErrorAction SilentlyContinue)
    if ($abs) { $abs = $abs.Path } else { $abs = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $FromFile) $cleaned)) }
  }

  if (Test-Path $abs -PathType Container) {
    $idx = Join-Path $abs "index.html"
    if (Test-Path $idx -PathType Leaf) { return @{ filePath = $idx; resolvedAs = "dir-index" } }
    return @{ filePath = $abs; resolvedAs = "dir-missing-index"; missing = $true }
  }

  $ext = [System.IO.Path]::GetExtension($abs)
  if ($ext) { return @{ filePath = $abs; resolvedAs = "explicit-ext" } }

  if (Test-Path $abs -PathType Leaf) { return @{ filePath = $abs; resolvedAs = "no-ext-existing" } }

  $htmlCandidate = "$abs.html"
  if (Test-Path $htmlCandidate -PathType Leaf) { return @{ filePath = $htmlCandidate; resolvedAs = "clean-url-to-html" } }

  if ($cleaned.StartsWith("/")) {
    if ($Rewrites.ContainsKey($cleaned)) {
      $rewriteTarget = [string]$Rewrites[$cleaned]
      $rewriteTarget = ($rewriteTarget -replace "\?.*$", "") -replace "#.*$", ""
      $rewriteAbs = Join-Path $ProjectRoot (".{0}" -f $rewriteTarget)
      return @{ filePath = $rewriteAbs; resolvedAs = "redirects-rewrite"; rewriteFrom = $cleaned; rewriteTo = $rewriteTarget }
    }
  }

  return @{ filePath = $htmlCandidate; resolvedAs = "missing"; missing = $true }
}

function Extract-Links {
  param([string]$Html)

  $out = New-Object System.Collections.Generic.List[object]

  $patterns = @(
    @{ kind = "a"; re = '<a\b[^>]*\bhref\s*=\s*["'']([^"''>]+)["'']' },
    @{ kind = "link"; re = '<link\b[^>]*\bhref\s*=\s*["'']([^"''>]+)["'']' },
    @{ kind = "script"; re = '<script\b[^>]*\bsrc\s*=\s*["'']([^"''>]+)["'']' },
    @{ kind = "img"; re = '<img\b[^>]*\bsrc\s*=\s*["'']([^"''>]+)["'']' },
    @{ kind = "source"; re = '<source\b[^>]*\bsrcset\s*=\s*["'']([^"''>]+)["'']' }
  )

  foreach ($p in $patterns) {
    $matches = [regex]::Matches($Html, $p.re, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($m in $matches) {
      $raw = $m.Groups[1].Value
      if (-not $raw) { continue }
      if ($p.kind -eq "source") {
        $parts = $raw -split "," | ForEach-Object { ($_.Trim() -split "\s+")[0] } | Where-Object { $_ }
        foreach ($part in $parts) { $out.Add(@{ kind = $p.kind; url = $part }) }
      } else {
        $out.Add(@{ kind = $p.kind; url = $raw })
      }
    }
  }

  return $out
}

function Extract-Footer {
  param([string]$Html)
  $lower = $Html.ToLowerInvariant()
  $start = $lower.IndexOf("<footer")
  if ($start -lt 0) { return $null }
  $end = $lower.IndexOf("</footer>", $start)
  if ($end -lt 0) { return $null }
  return $Html.Substring($start, ($end - $start) + 9)
}

function Detect-Lang {
  param([string]$FilePath)
  $rel = [System.IO.Path]::GetRelativePath($ProjectRoot, $FilePath).Replace("\", "/")
  if ($rel.StartsWith("en/")) { return "en" }
  if ($rel.StartsWith("de/")) { return "de" }
  if ($rel.StartsWith("fr/")) { return "fr" }
  if ($rel.StartsWith("es/")) { return "es-folder" }
  return "root"
}

function Find-Anchors {
  param([string]$Html)
  $set = New-Object System.Collections.Generic.HashSet[string]
  $matches = [regex]::Matches($Html, '\b(id|name)\s*=\s*["'']([^"''>]+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  foreach ($m in $matches) {
    $v = $m.Groups[2].Value.Trim()
    if ($v) { [void]$set.Add($v) }
  }
  return $set
}

$Rewrites = Parse-Redirects
$HtmlFiles = Get-HtmlFiles

$Issues = New-Object System.Collections.Generic.List[object]
$FooterDiffs = New-Object System.Collections.Generic.List[object]
$AnchorCache = @{}
$FooterBaseline = @{}

foreach ($f in $HtmlFiles) {
  $filePath = $f.FullName
  $html = Read-Text $filePath
  $links = Extract-Links $html
  $localAnchors = Find-Anchors $html
  $AnchorCache[$filePath] = $localAnchors

  foreach ($l in $links) {
    $info = Normalize-Url $l.url
    if (-not $info) { continue }
    if ($info.type -eq "external") { continue }

    if ($info.type -eq "anchor-only") {
      $anchor = $info.hash
      if ($anchor -and (-not $localAnchors.Contains($anchor))) {
        $Issues.Add(@{ filePath = $filePath; type = "missing-anchor"; kind = $l.kind; url = $l.url; target = $filePath; anchor = $anchor })
      }
      continue
    }

    $resolved = Resolve-InternalTarget -FromFile $filePath -LinkPath $info.path -Rewrites $Rewrites
    $targetPath = [string]$resolved.filePath

    if (-not (Test-Path $targetPath)) {
      $Issues.Add(@{ filePath = $filePath; type = "missing-target"; kind = $l.kind; url = $l.url; resolvedAs = $resolved.resolvedAs; target = $targetPath })
      continue
    }

    if ($l.kind -eq "a") {
      $hasExt = [System.IO.Path]::GetExtension([string]$info.path)
      $needsRewrite = $false
      if ($info.path.StartsWith("/") -and (-not $hasExt)) {
        $diskPath = Join-Path $ProjectRoot (".{0}" -f $info.path)
        if ((Test-Path $diskPath -PathType Container)) {
          $needsRewrite = $false
        } else {
          $needsRewrite = $true
        }
      }
      if ($needsRewrite -and (-not $Rewrites.ContainsKey($info.path)) -and (-not (Test-Path (Join-Path $ProjectRoot (".{0}.html" -f $info.path))))) {
        $Issues.Add(@{ filePath = $filePath; type = "missing-cleanurl-rewrite"; kind = $l.kind; url = $l.url; cleanUrl = $info.path })
      }
    }

    if ($info.hash -and $targetPath.ToLowerInvariant().EndsWith(".html")) {
      if (-not $AnchorCache.ContainsKey($targetPath)) {
        $AnchorCache[$targetPath] = Find-Anchors (Read-Text $targetPath)
      }
      $tAnchors = $AnchorCache[$targetPath]
      if (-not $tAnchors.Contains([string]$info.hash)) {
        $Issues.Add(@{ filePath = $filePath; type = "missing-anchor"; kind = $l.kind; url = $l.url; target = $targetPath; anchor = $info.hash })
      }
    }
  }

  $footer = Extract-Footer $html
  if (-not $footer) {
    $Issues.Add(@{ filePath = $filePath; type = "missing-footer" })
  } else {
    $footerLinks = (Extract-Links $footer | Where-Object { $_.kind -eq "a" } | ForEach-Object { $_.url }) | Where-Object { $_ }
    $normalized = @()
    foreach ($u in $footerLinks) {
      $parsed = Normalize-Url $u
      if (-not $parsed) { continue }
      if ($parsed.type -eq "external") { $normalized += $u; continue }
      $p = $parsed.path
      $a = $parsed.hash
      $normalized += ($a ? ("{0}#{1}" -f $p, $a) : $p)
    }
    $normalized = $normalized | Sort-Object
    $lang = Detect-Lang $filePath
    if (-not $FooterBaseline.ContainsKey($lang)) {
      $FooterBaseline[$lang] = @{ filePath = $filePath; links = $normalized }
    } else {
      $base = $FooterBaseline[$lang]
      $baseSet = New-Object System.Collections.Generic.HashSet[string]
      foreach ($x in $base.links) { [void]$baseSet.Add([string]$x) }
      $curSet = New-Object System.Collections.Generic.HashSet[string]
      foreach ($x in $normalized) { [void]$curSet.Add([string]$x) }
      $missing = @($base.links | Where-Object { -not $curSet.Contains([string]$_) })
      $extra = @($normalized | Where-Object { -not $baseSet.Contains([string]$_) })
      if ($missing.Count -gt 0 -or $extra.Count -gt 0) {
        $FooterDiffs.Add(@{ lang = $lang; filePath = $filePath; baseline = $base.filePath; missing = $missing; extra = $extra })
      }
    }
  }
}

$ByType = @{}
foreach ($i in $Issues) {
  $t = [string]$i.type
  if (-not $ByType.ContainsKey($t)) { $ByType[$t] = 0 }
  $ByType[$t]++
}

$summary = @{
  scannedHtmlFiles = $HtmlFiles.Count
  totalIssues = $Issues.Count
  byType = $ByType
  footerDiffsCount = $FooterDiffs.Count
}

$report = @{
  summary = $summary
  issues = $Issues
  footerDiffs = $FooterDiffs
}

$jsonPath = Join-Path $ProjectRoot "audit-report.json"
($report | ConvertTo-Json -Depth 10) | Set-Content -Path $jsonPath -Encoding UTF8

$mdLines = New-Object System.Collections.Generic.List[string]
$mdLines.Add("# Auditoría automática")
$mdLines.Add("")
$mdLines.Add(("- Archivos HTML analizados: {0}" -f $summary.scannedHtmlFiles))
$mdLines.Add(("- Issues detectados: {0}" -f $summary.totalIssues))
$mdLines.Add(("- Diffs de footer: {0}" -f $summary.footerDiffsCount))
$mdLines.Add("")
$mdLines.Add("## Issues por tipo")
foreach ($kv in ($summary.byType.GetEnumerator() | Sort-Object -Property Value -Descending)) {
  $mdLines.Add(("- {0}: {1}" -f $kv.Key, $kv.Value))
}
$mdLines.Add("")
$mdLines.Add("## Issues (detalle)")
foreach ($it in $Issues) {
  $rel = [System.IO.Path]::GetRelativePath($ProjectRoot, [string]$it.filePath).Replace("\", "/")
  $parts = New-Object System.Collections.Generic.List[string]
  $parts.Add(("- {0}" -f $it.type))
  $parts.Add(("file={0}" -f $rel))
  if ($it.url) { $parts.Add(("url={0}" -f $it.url)) }
  if ($it.cleanUrl) { $parts.Add(("cleanUrl={0}" -f $it.cleanUrl)) }
  if ($it.target) {
    $tgt = [string]$it.target
    if ($tgt.StartsWith($ProjectRoot)) {
      $tgt = [System.IO.Path]::GetRelativePath($ProjectRoot, $tgt).Replace("\", "/")
    }
    $parts.Add(("target={0}" -f $tgt))
  }
  if ($it.anchor) { $parts.Add(("anchor={0}" -f $it.anchor)) }
  if ($it.resolvedAs) { $parts.Add(("resolvedAs={0}" -f $it.resolvedAs)) }
  $mdLines.Add(($parts -join " | "))
}
$mdLines.Add("")
$mdLines.Add("## Footer diffs")
foreach ($d in $FooterDiffs) {
  $rel = [System.IO.Path]::GetRelativePath($ProjectRoot, [string]$d.filePath).Replace("\", "/")
  $baseRel = [System.IO.Path]::GetRelativePath($ProjectRoot, [string]$d.baseline).Replace("\", "/")
  $mdLines.Add(("- lang={0} | file={1} | baseline={2}" -f $d.lang, $rel, $baseRel))
  if ($d.missing.Count -gt 0) { $mdLines.Add(("  - missing: {0}" -f ($d.missing -join ", "))) }
  if ($d.extra.Count -gt 0) { $mdLines.Add(("  - extra: {0}" -f ($d.extra -join ", "))) }
}
$mdLines.Add("")
$mdLines.Add("(Ver audit-report.json para más detalle.)")
$mdLines.Add("")

$mdPath = Join-Path $ProjectRoot "audit-report.md"
$mdLines | Set-Content -Path $mdPath -Encoding UTF8

Write-Output ("OK audit-report.md generado. Issues: {0}" -f $summary.totalIssues)

