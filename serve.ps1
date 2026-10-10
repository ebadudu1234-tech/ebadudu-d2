# serve.ps1 — tiny static server for Windows (no Python / Node needed), with Range support for video.
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8000]
param([int]$Port = 8000)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.json' = 'application/json'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.mp4' = 'video/mp4'; '.ico' = 'image/x-icon'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/  (Ctrl+C to stop)"
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
      if ($path -eq '') { $path = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $path))
      if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-store')
        $res.Headers.Add('Accept-Ranges', 'bytes')
        $fs = [IO.File]::OpenRead($file)
        try {
          $len = $fs.Length; $start = 0; $end = $len - 1
          if ($req.Headers['Range'] -match 'bytes=(\d*)-(\d*)') {
            if ($Matches[1]) { $start = [long]$Matches[1] }
            if ($Matches[2]) { $end = [math]::Min([long]$Matches[2], $len - 1) }
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
} finally {
  $listener.Stop()
}
