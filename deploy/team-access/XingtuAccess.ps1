param(
    [ValidateSet('Setup','Connect','Worker','Status','Stop','AutoStart','NoAutoStart','Backend','PrepareBackend','Web','Graph')]
    [string]$Action = 'Connect',
    [string]$Repo,
    [string]$StateRoot = (Join-Path $env:USERPROFILE '.xingtu-access'),
    [string]$EnrollmentFile,
    [switch]$PrepareOnly
)
$ErrorActionPreference = 'Stop'
$ConfigPath = Join-Path $StateRoot 'server-public.json'
$Self = Join-Path $StateRoot 'XingtuAccess.ps1'
$StopFile = Join-Path $StateRoot 'stop'
$StatusFile = Join-Path $StateRoot 'status.json'
$SshConfig = Join-Path $StateRoot 'ssh_config'
$KeyPath = Join-Path $StateRoot 'id_ed25519'
$Ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
$PowerShell = Join-Path $PSHOME 'powershell.exe'
if (-not (Test-Path -LiteralPath $PowerShell)) { $PowerShell = 'powershell.exe' }

function Protect-Directory {
    New-Item -ItemType Directory -Path $StateRoot -Force | Out-Null
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    & icacls.exe $StateRoot /inheritance:r /grant:r ('*'+$sid.Value+':(OI)(CI)F') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not protect local access directory.' }
    foreach ($entry in @((Get-Acl -LiteralPath $StateRoot).Access)) {
        $entrySid = $entry.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier])
        if ($entrySid.Value -ne $sid.Value) {
            & icacls.exe $StateRoot /remove ('*'+$entrySid.Value) | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not remove an extra directory permission.' }
        }
    }
}
function Write-State($state, $sshPid = 0) {
    $json = @{ state=$state; workerPid=$PID; sshPid=$sshPid; updated=(Get-Date).ToString('o') } | ConvertTo-Json
    $temporary = $StatusFile+'.tmp'
    [IO.File]::WriteAllText($temporary,$json,(New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temporary -Destination $StatusFile -Force
}
function Port-Open([int]$port) {
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $tcp.ConnectAsync('127.0.0.1', $port)
        return ($task.Wait(500) -and $tcp.Connected)
    } catch { return $false } finally { $tcp.Dispose() }
}
function Ready {
    if (-not (Test-Path -LiteralPath $StatusFile)) { return $false }
    try {
        $s = Get-Content -LiteralPath $StatusFile -Raw | ConvertFrom-Json
        if ($s.state -ne 'connected' -or -not (Get-Process -Id $s.workerPid -ErrorAction SilentlyContinue)) { return $false }
        $response = Invoke-WebRequest 'http://127.0.0.1:13000/api/health' -UseBasicParsing -TimeoutSec 3
        return ($response.StatusCode -eq 200 -and ($response.Content | ConvertFrom-Json).service -eq 'xingtu-api')
    } catch { return $false }
}
function Quote-Arg([string]$value) { return '"' + $value.Replace('"','\"') + '"' }
function Start-Connection {
    if (-not (Test-Path -LiteralPath $KeyPath) -or -not (Test-Path -LiteralPath $SshConfig)) { throw 'Run Setup.cmd once on this computer first.' }
    if (Ready) { Write-Host 'XINGTU is connected.'; return }
    Remove-Item -LiteralPath $StopFile -Force -ErrorAction SilentlyContinue
    $requested = Get-Date
    $args = '-NoProfile -ExecutionPolicy Bypass -File ' + (Quote-Arg $Self) + ' -Action Worker -StateRoot ' + (Quote-Arg $StateRoot)
    Start-Process -FilePath $PowerShell -ArgumentList $args -WindowStyle Hidden | Out-Null
    for ($i=0; $i -lt 25; $i++) {
        Start-Sleep -Milliseconds 800
        if (Ready) { Write-Host 'XINGTU connected: web 13000, API 18081, MySQL 13308, Neo4j 17474/17687, MongoDB 37017.'; return }
        if (Test-Path -LiteralPath $StatusFile) {
            $s = Get-Content -LiteralPath $StatusFile -Raw | ConvertFrom-Json
            if ($s.state -eq 'port-conflict' -and [DateTime]$s.updated -ge $requested) { throw 'A required local port is already in use. Close the previous tunnel or application; no process was killed.' }
        }
    }
    throw "Connection is not ready. See $StateRoot\ssh-error.log and status.json. The background worker will retry."
}
function Shortcut([string]$name,[string]$mode,[string]$directory) {
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut((Join-Path $directory ($name+'.lnk')))
    $link.TargetPath = $PowerShell
    $link.Arguments = '-NoProfile -ExecutionPolicy Bypass -File ' + (Quote-Arg $Self) + ' -Action '+$mode+' -StateRoot '+(Quote-Arg $StateRoot)
    $link.WorkingDirectory = $StateRoot
    $link.WindowStyle = 7
    $link.Save()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
}
function Backend-Python {
    $path = Join-Path $StateRoot 'venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $path)) { throw 'Prepare the local backend once with -Action PrepareBackend -Repo <repository path>.' }
    return $path
}
function Backend-Stamp([string]$repository) {
    return (Get-FileHash -LiteralPath (Join-Path $repository 'backend\requirements.txt') -Algorithm SHA256).Hash + ':' +
        (Get-FileHash -LiteralPath (Join-Path $repository 'backend\runtime-constraints.txt') -Algorithm SHA256).Hash
}

switch ($Action) {
    'Setup' {
        Protect-Directory
        if ([IO.Path]::GetFullPath($PSScriptRoot) -ne [IO.Path]::GetFullPath($StateRoot)) {
            Copy-Item -LiteralPath $PSCommandPath -Destination $Self -Force
            Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'server-public.json') -Destination $ConfigPath -Force
        }
        $cfg = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
        $sha = [Security.Cryptography.SHA256]::Create()
        $fingerprint = 'SHA256:'+[Convert]::ToBase64String($sha.ComputeHash([Convert]::FromBase64String($cfg.hostKey))).TrimEnd('=')
        if ($fingerprint -cne $cfg.fingerprint) { throw 'Public host identity is inconsistent.' }
        $known = Join-Path $StateRoot 'known_hosts'
        ($cfg.host+' '+$cfg.hostKeyType+' '+$cfg.hostKey) | Set-Content -LiteralPath $known -Encoding ASCII
        if (-not (Test-Path -LiteralPath $KeyPath)) {
            $keygen = (Get-Command ssh-keygen.exe -ErrorAction Stop).Source
            $proc = Start-Process -FilePath $keygen -ArgumentList ('-q -t ed25519 -N "" -f '+(Quote-Arg $KeyPath)) -NoNewWindow -PassThru -Wait
            if ($proc.ExitCode -ne 0) { throw 'Key generation failed.' }
        }
        $config = @('Host xingtu-data', ('  HostName '+$cfg.host), ('  Port '+$cfg.port), ('  User '+$cfg.user),
            ('  IdentityFile "'+$KeyPath.Replace('\','/')+'"'), ('  UserKnownHostsFile "'+$known.Replace('\','/')+'"'),
            '  StrictHostKeyChecking yes',('  HostKeyAlgorithms '+$cfg.hostKeyType),'  IdentitiesOnly yes','  BatchMode yes',
            '  ExitOnForwardFailure yes','  ServerAliveInterval 10','  ServerAliveCountMax 3','  ConnectTimeout 10','  ConnectionAttempts 1')
        foreach ($p in $cfg.forwards.PSObject.Properties) { $config += '  LocalForward 127.0.0.1:'+$p.Name+' 127.0.0.1:'+$p.Value }
        [IO.File]::WriteAllLines($SshConfig, [string[]]$config, (New-Object Text.UTF8Encoding($false)))
        if ($Repo) { [IO.Path]::GetFullPath($Repo) | Set-Content -LiteralPath (Join-Path $StateRoot 'repository.txt') -Encoding UTF8 }
        if ($PrepareOnly) { Write-Host 'Prepared local device key and pinned config; enrollment still required.'; break }
        $device = ([Environment]::MachineName+'_'+$env:USERNAME) -replace '[^A-Za-z0-9_-]', '_'
        $device = $device.Substring(0,[Math]::Min(64,$device.Length))
        if ($EnrollmentFile) {
            $result = Get-Content -LiteralPath $EnrollmentFile -Raw
        } else {
            Write-Host 'First setup: enter the server administrator password at the SSH prompt. It is not saved.'
            $result = Get-Content -LiteralPath ($KeyPath+'.pub') | & $Ssh -F NUL -o StrictHostKeyChecking=yes -o ("UserKnownHostsFile=$known") -o ('HostKeyAlgorithms='+$cfg.hostKeyType) -o PreferredAuthentications=password -o PubkeyAuthentication=no ('root@'+$cfg.host) ('python3 /usr/local/sbin/xingtu-team-access.py enroll '+$device)
            if ($LASTEXITCODE -ne 0) { throw 'Device enrollment failed.' }
        }
        try { $private = ($result -join "`n") | ConvertFrom-Json } catch { throw 'Invalid enrollment response; no connection configuration was saved.' }
        if (-not $private.DATABASE_URL -or -not $private.NEO4J_PASSWORD -or -not $private.MONGO_PASSWORD) { throw 'Incomplete enrollment response.' }
        $random = New-Object byte[] 48
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($random)
        $private | Add-Member NoteProperty JWT_SECRET ([Convert]::ToBase64String($random))
        $lines = foreach ($p in $private.PSObject.Properties) {
            # dotenv quotes, including literal apostrophes and non-ASCII characters.
            $escaped = ([string]$p.Value).Replace('\','\\').Replace('"','\"').Replace("`n",'\n').Replace("`r",'\r')
            $p.Name+'="'+$escaped+'"'
        }
        [IO.File]::WriteAllLines((Join-Path $StateRoot 'backend.env'), [string[]]$lines, (New-Object Text.UTF8Encoding($false)))
        $private = $null; $result = $null
        $desktop = [Environment]::GetFolderPath('Desktop')
        Shortcut 'XINGTU Connect' 'Connect' $desktop
        Shortcut 'XINGTU Web' 'Web' $desktop
        Shortcut 'XINGTU Graph' 'Graph' $desktop
        Shortcut 'XINGTU Stop' 'Stop' $desktop
        Shortcut 'XINGTU Backend' 'Backend' $desktop
        Start-Connection
        Write-Host 'Setup complete. Optional automatic login connection: run with -Action AutoStart.'
    }
    'Worker' {
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $mutex = New-Object Threading.Mutex($false, ('Local\XingtuAccess-'+$sid))
        $owned = $false; $child = $null
        try {
            try { $owned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned = $true }
            if (-not $owned) { return }
            $cfg = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
            while (-not (Test-Path -LiteralPath $StopFile)) {
                $busy = @($cfg.forwards.PSObject.Properties | Where-Object { Port-Open ([int]$_.Name) })
                if ($busy.Count -gt 0) { Write-State 'port-conflict'; return }
                Write-State 'connecting'
                $err = Join-Path $StateRoot 'ssh-error.log'
                $child = Start-Process -FilePath $Ssh -ArgumentList ('-F '+(Quote-Arg $SshConfig)+' -N xingtu-data') -WindowStyle Hidden -RedirectStandardError $err -PassThru
                while (-not $child.WaitForExit(1000)) {
                    if (Test-Path -LiteralPath $StopFile) { $child.Kill(); $child.WaitForExit(); break }
                    $allOpen = @($cfg.forwards.PSObject.Properties | Where-Object { -not (Port-Open ([int]$_.Name)) }).Count -eq 0
                    if ($allOpen) { Write-State 'connected' $child.Id }
                }
                if (-not (Test-Path -LiteralPath $StopFile)) {
                    Write-State 'reconnecting'
                    for ($i=0;$i -lt 5;$i++) { if (Test-Path -LiteralPath $StopFile) { break }; Start-Sleep -Seconds 1 }
                }
            }
        } finally {
            if ($owned) {
                if ($child -and -not $child.HasExited) { $child.Kill(); $child.WaitForExit() }
                if ((Test-Path -LiteralPath $StopFile)) { Write-State 'stopped' }
                $mutex.ReleaseMutex()
            }
            $mutex.Dispose()
        }
    }
    'Connect' { Start-Connection }
    'Status' {
        if (Ready) { Write-Host 'Connected' } else { Write-Host 'Not ready' }
        if (Test-Path -LiteralPath $StatusFile) { Get-Content -LiteralPath $StatusFile }
    }
    'Stop' {
        New-Item -ItemType File -Path $StopFile -Force | Out-Null
        for ($i=0;$i -lt 20;$i++) {
            if (-not (Test-Path -LiteralPath $StatusFile)) { break }
            $s = Get-Content -LiteralPath $StatusFile -Raw | ConvertFrom-Json
            if ($s.state -eq 'stopped' -or -not (Get-Process -Id $s.workerPid -ErrorAction SilentlyContinue)) { break }
            Start-Sleep -Milliseconds 500
        }
        Write-Host 'Disconnect requested. Server services continue running.'
    }
    'AutoStart' { Shortcut 'XINGTU Auto Connect' 'Connect' ([Environment]::GetFolderPath('Startup')); Write-Host 'Login auto-connect enabled.' }
    'NoAutoStart' {
        $path = Join-Path ([Environment]::GetFolderPath('Startup')) 'XINGTU Auto Connect.lnk'
        Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        Write-Host 'Login auto-connect disabled.'
    }
    'Web' { Start-Connection; Start-Process 'http://127.0.0.1:13000' }
    'Graph' { Start-Connection; Start-Process 'http://127.0.0.1:17474/browser/' }
    'PrepareBackend' {
        if (-not $Repo) { $Repo = (Get-Content -LiteralPath (Join-Path $StateRoot 'repository.txt') -Raw).Trim() }
        if (-not (Test-Path -LiteralPath (Join-Path $Repo 'backend\requirements.txt'))) { throw 'Repository backend requirements are missing.' }
        $python = Join-Path $StateRoot 'venv\Scripts\python.exe'
        if (-not (Test-Path -LiteralPath $python)) {
            $bootstrap = (Get-Command python.exe -ErrorAction Stop).Source
            & $bootstrap -c 'import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)'
            if ($LASTEXITCODE -ne 0) { throw 'Python 3.12+ is required.' }
            & $bootstrap -m venv (Join-Path $StateRoot 'venv')
            if ($LASTEXITCODE -ne 0) { throw 'Python 3.12+ and venv are required.' }
        }
        & $python -m pip install -r (Join-Path $Repo 'backend\requirements.txt') -c (Join-Path $Repo 'backend\runtime-constraints.txt')
        if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed; existing project files were not changed.' }
        (Backend-Stamp $Repo) | Set-Content -LiteralPath (Join-Path $StateRoot 'backend-ready') -Encoding ASCII
        [IO.Path]::GetFullPath($Repo) | Set-Content -LiteralPath (Join-Path $StateRoot 'repository.txt') -Encoding UTF8
        Write-Host 'Local backend environment prepared. Existing backend/.env was not changed.'
    }
    'Backend' {
        Start-Connection
        if (-not $Repo) { $Repo = (Get-Content -LiteralPath (Join-Path $StateRoot 'repository.txt') -Raw).Trim() }
        $envFile = Join-Path $StateRoot 'backend.env'
        if (-not (Test-Path -LiteralPath $envFile)) { throw 'Run the full Setup once to obtain the private backend configuration.' }
        $stamp = Join-Path $StateRoot 'backend-ready'
        if (-not (Test-Path -LiteralPath $stamp) -or (Get-Content -LiteralPath $stamp -Raw).Trim() -ne (Backend-Stamp $Repo)) {
            & $Self -Action PrepareBackend -Repo $Repo -StateRoot $StateRoot
        }
        $python = Backend-Python
        Push-Location (Join-Path $Repo 'backend')
        try {
            & $python -m uvicorn main:app --env-file $envFile --host 127.0.0.1 --port 8081 --reload
            if ($LASTEXITCODE -ne 0) { throw 'Local backend exited with an error. Check installed dependencies and local external-service settings.' }
        } finally { Pop-Location }
    }
}
