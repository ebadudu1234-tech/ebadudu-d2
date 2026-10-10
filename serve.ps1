# serve.ps1 — tiny static server for Windows (no Python / Node needed), with Range support for video.
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8000]
# Without -Port it uses $env:PORT (set by the preview launcher), else 8000.
# Requests are served in parallel (a pool of runspaces) and video is sent in 2MB pieces, so a
# half-watched video never holds up the next page.
param([int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8000 }))

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/  (Ctrl+C to stop)"

$handle = {
  param($ctx, $root)
  $types = @{
    '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
    '.js' = 'text/javascript; charset=utf-8'; '.json' = 'application/json'; '.svg' = 'image/svg+xml'
    '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.mp4' = 'video/mp4'; '.ico' = 'image/x-icon'
  }
  $CHUNK = 2MB
  $req = $ctx.Request; $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if ($path -eq '') { $path = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    if ($file.StartsWith($root) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Accept-Ranges', 'bytes')
      # always revalidate, but answer 304 when nothing changed (pages come back instantly)
      $res.Headers.Add('Cache-Control', 'no-cache')
      $stamp = [IO.File]::GetLastWriteTimeUtc($file).ToString('R')
      $res.Headers.Add('Last-Modified', $stamp)
      if (-not $req.Headers['Range'] -and $req.Headers['If-Modified-Since'] -eq $stamp) {
        $res.StatusCode = 304
        return
      }
      $fs = [IO.File]::Open($file, 'Open', 'Read', 'ReadWrite')
      try {
        $len = $fs.Length; $start = 0; $end = $len - 1
        if ($req.Headers['Range'] -match 'bytes=(\d*)-(\d*)') {
          if ($Matches[1]) { $start = [long]$Matches[1] }
          $end = if ($Matches[2]) { [math]::Min([long]$Matches[2], $len - 1) } else { [math]::Min($start + $CHUNK - 1, $len - 1) }
          $res.StatusCode = 206
          $res.Headers.Add('Content-Range', "bytes $start-$end/$len")
        }
        $res.ContentLength64 = $end - $start + 1
        if ($req.HttpMethod -ne 'HEAD') {
          $fs.Position = $start; $left = $end - $start + 1; $buf = New-Object byte[] 65536
          while ($left -gt 0) {
            $n = $fs.Read($buf, 0, [int][math]::Min($buf.Length, $left)); if ($n -le 0) { break }
            $res.OutputStream.Write($buf, 0, $n); $left -= $n
          }
        }
      } finally { $fs.Dispose() }
    } else {
      $res.StatusCode = 404
    }
  } catch {
    # browsers abort video range requests all the time; that's not an error worth logging
  } finally {
    try { $res.Close() } catch {}
  }
}

$pool = [RunspaceFactory]::CreateRunspacePool(1, 16)
$pool.Open()
$jobs = New-Object System.Collections.ArrayList
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $ps = [PowerShell]::Create().AddScript($handle).AddArgument($ctx).AddArgument($root)
    $ps.RunspacePool = $pool
    [void]$jobs.Add(@{ ps = $ps; ar = $ps.BeginInvoke() })
    # tidy up finished handlers
    foreach ($j in @($jobs | Where-Object { $_.ar.IsCompleted })) {
      try { $j.ps.EndInvoke($j.ar) } catch {}
      $j.ps.Dispose(); $jobs.Remove($j)
    }
  }
} finally {
  $listener.Stop(); $pool.Close()
}
