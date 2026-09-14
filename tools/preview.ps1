param([int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$pagePath = Join-Path (Split-Path $PSScriptRoot -Parent) 'index.html'
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $listener.Start()
    Write-Output "Inventory preview ready at http://127.0.0.1:$Port/index.html"
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 3000
            $stream.WriteTimeout = 3000
            $reader = [System.IO.StreamReader]::new($stream)
            $requestLine = $reader.ReadLine()
            $headerCount = 0
            while ($reader.ReadLine()) {
                $headerCount++
                if ($headerCount -gt 100) { throw 'Too many request headers' }
            }
            $status = '404 Not Found'
            $contentType = 'text/plain; charset=utf-8'
            $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
            # Serve only the app, never caches, repository files, or other local paths.
            if ($requestLine -match '^GET /(?:index\.html)?(?:\?[^ ]*)? HTTP/1\.[01]$') {
                $status = '200 OK'
                $contentType = 'text/html; charset=utf-8'
                $body = [System.IO.File]::ReadAllBytes($pagePath)
            }
            $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $bytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Write($body, 0, $body.Length)
        } catch {
            Write-Verbose $_.Exception.Message
        } finally {
            $client.Dispose()
        }
    }
} finally {
    $listener.Stop()
}
