#Requires -Version 5.1
<#
SiYuan MindMap v0.5.0-dev.2 - PowerShell build + optional deployment.
This script does NOT change mind-map engine, editor, or runtime plugin code.
Usage:
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\思源笔记插件制作程序\siyuan-思维导图\build-and-deploy.ps1"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\思源笔记插件制作程序\siyuan-思维导图\build-and-deploy.ps1" -BuildOnly
#>
[CmdletBinding()]
param(
    [switch]$BuildOnly,
    [string]$TargetPluginDir = 'D:\思源笔记数据-\设置模板\data\plugins\siyuan-mindmap'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
$releaseDir = Join-Path $project 'build\siyuan-mindmap'
$buildDir = Join-Path $project 'build'
$packageZip = Join-Path $buildDir 'package.zip'

function Assert-ValidPluginFolder([string]$path) {
    # Never deploy into data\plugins itself or an unrelated folder.
    $full = [System.IO.Path]::GetFullPath($path).TrimEnd('\','/')
    if ([System.IO.Path]::GetFileName($full) -ine 'siyuan-mindmap') {
        throw "Invalid target folder name (must be siyuan-mindmap): $full"
    }
    $pluginsDir = [System.IO.Path]::GetDirectoryName($full)
    if ([System.IO.Path]::GetFileName($pluginsDir) -ine 'plugins') {
        throw "Target must be directly inside data\plugins: $full"
    }
    if ([System.IO.Path]::GetFileName([System.IO.Path]::GetDirectoryName($pluginsDir)) -ine 'data') {
        throw "Target is not under data\plugins: $full"
    }
    return $full
}

function Read-PluginJson([string]$manifestPath) {
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Missing plugin manifest: $manifestPath"
    }
    return (Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Assert-PluginRelease([string]$folder, [string]$expectedVersion) {
    $manifest = Read-PluginJson (Join-Path $folder 'plugin.json')
    if ($manifest.name -ne 'siyuan-mindmap' -or $manifest.version -ne $expectedVersion) {
        throw "Plugin name/version mismatch in $folder (expected siyuan-mindmap $expectedVersion)"
    }
    foreach ($relative in @('index.js','index.css','editor\index.html','editor\bridge.js','editor\dist\js\app.js')) {
        if (-not (Test-Path -LiteralPath (Join-Path $folder $relative) -PathType Leaf)) {
            throw "Missing compiled plugin file: $relative"
        }
    }
}

function Write-PortableZip([string]$folder, [string]$destination, [string]$expectedVersion) {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $source = [System.IO.Path]::GetFullPath($folder).TrimEnd('\','/')
    $base = $source + [System.IO.Path]::DirectorySeparatorChar
    $temp = $destination + '.tmp-' + [guid]::NewGuid().ToString('N')
    $zip = $null
    try {
        $zip = [System.IO.Compression.ZipFile]::Open($temp, [System.IO.Compression.ZipArchiveMode]::Create)
        $files = @(Get-ChildItem -LiteralPath $source -File -Recurse -Force)
        foreach ($file in $files) {
            $name = $file.FullName.Substring($base.Length).Replace('\', '/')
            if ([string]::IsNullOrWhiteSpace($name) -or $name.StartsWith('/') -or $name.Contains('\') -or $name -match '(^|/)\.\.(/|$)') {
                throw "Unsafe ZIP member path: $name"
            }
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $file.FullName, $name, [System.IO.Compression.CompressionLevel]::Optimal
            )
        }
    }
    finally {
        if ($null -ne $zip) { $zip.Dispose() }
    }
    try {
        # Reopen and verify the archive before replacing any previous package.zip.
        $reader = [System.IO.Compression.ZipFile]::OpenRead($temp)
        try {
            $entries = @($reader.Entries)
            $names = @($entries | ForEach-Object { $_.FullName })
            if ($names.Count -lt 10 -or $names -notcontains 'plugin.json' -or $names -notcontains 'index.js' -or $names -notcontains 'editor/index.html') {
                throw 'ZIP validation failed: missing required entries.'
            }
            $seen = @{}
            foreach ($entry in $entries) {
                $entryName = $entry.FullName
                if ($entryName.Contains('\') -or $entryName.StartsWith('/') -or $entryName -match '(^|/)\.\.(/|$)' -or $seen.ContainsKey($entryName)) {
                    throw "ZIP validation failed: invalid or duplicate entry: $entryName"
                }
                $seen[$entryName] = $true
            }
            $manifestEntry = $reader.GetEntry('plugin.json')
            $stream = $manifestEntry.Open()
            $sr = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            try { $packedManifest = $sr.ReadToEnd() | ConvertFrom-Json }
            finally { $sr.Dispose() }
            if ($packedManifest.name -ne 'siyuan-mindmap' -or $packedManifest.version -ne $expectedVersion) {
                throw 'ZIP validation failed: plugin version does not match source.'
            }
            Write-Host ('Portable package.zip verified: {0} files.' -f $names.Count)
        }
        finally { $reader.Dispose() }
        [System.IO.File]::Copy($temp, $destination, $true)
        [System.IO.File]::Delete($temp)
    }
    finally {
        if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
    }
}

function Assert-SiyuanStopped {
    $running = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessName -match '^(?i:siyuan|siyuan-kernel)$'
    })
    if ($running.Count -gt 0) {
        throw 'SiYuan is still running. Close SiYuan completely before deployment.'
    }
}

function Invoke-BuildAndDeploy {
    if (-not (Test-Path -LiteralPath (Join-Path $project 'scripts\build.mjs') -PathType Leaf)) {
        throw "This script must live at the root of the v0.5.0 source project: $project"
    }
    $sourcePkg = Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $pluginPkg = Read-PluginJson (Join-Path $project 'plugin\plugin.json')
    if ($sourcePkg.name -ne 'siyuan-mindmap-source' -or $pluginPkg.name -ne 'siyuan-mindmap' -or $pluginPkg.version -ne $sourcePkg.version) {
        throw 'Source/package version mismatch. Use a clean v0.5.0 source folder.'
    }
    $version = [string]$sourcePkg.version
    Write-Host '================================================'
    Write-Host "SiYuan MindMap - PowerShell Build & Deploy ($version)"
    Write-Host '================================================'
    Write-Host '[1/4] Checking build environment...'
    $npm = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
    if ($null -eq $npm) {
        # User's known portable Node.js installation; does not change system PATH permanently.
        if (Test-Path -LiteralPath 'S:\node\npm.cmd' -PathType Leaf) {
            $env:PATH = 'S:\node;' + $env:PATH
            $npm = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
        }
    }
    if ($null -eq $npm) { throw 'npm.cmd not found. Check Node.js installation (previously S:\node).' }
    $npmPath = $npm.Source
    $cli = Join-Path $project 'web\node_modules\.bin\vue-cli-service.cmd'
    $engineModules = Join-Path $project 'engine\node_modules'
    # The local SimpleMindMap engine lives OUTSIDE the web folder. npm install
    # --prefix web does not reliably install engine's own dependencies.
    # Check the exact packages required by the original v0.5.0 engine source.
    $enginePackageFiles = @(
        '@svgdotjs\svg.js\package.json',
        'jszip\package.json',
        'mdast-util-from-markdown\package.json',
        'parchment\package.json',
        'pdf-lib\package.json',
        'quill\package.json',
        'quill-delta\package.json',
        'xml-js\package.json'
    )
    Push-Location $project
    try {
        $missingEnginePackages = @($enginePackageFiles | Where-Object {
            -not (Test-Path -LiteralPath (Join-Path $engineModules $_) -PathType Leaf)
        })
        if ($missingEnginePackages.Count -gt 0) {
            Write-Host ('Installing v0.5.0 engine dependencies ({0} packages missing)...' -f $missingEnginePackages.Count)
            & $npmPath 'install' '--prefix' 'engine' '--legacy-peer-deps' '--no-audit' '--no-fund'
            if ($LASTEXITCODE -ne 0) { throw "Engine npm install failed (exit code $LASTEXITCODE). No plugin was replaced." }
            foreach ($relative in $enginePackageFiles) {
                if (-not (Test-Path -LiteralPath (Join-Path $engineModules $relative) -PathType Leaf)) {
                    throw "Engine dependency still missing after installation: $relative. No plugin was replaced."
                }
            }
        }
        if (-not (Test-Path -LiteralPath $cli -PathType Leaf)) {
            Write-Host 'First-time setup: installing the v0.5.0 web build dependencies...'
            & $npmPath 'install' '--prefix' 'web' '--legacy-peer-deps' '--no-audit' '--no-fund'
            if ($LASTEXITCODE -ne 0) { throw "Web npm install failed (exit code $LASTEXITCODE). No plugin was replaced." }
        }
        Write-Host '[2/4] Compiling v0.5.0 source...'
        & $npmPath 'run' 'build'
        if ($LASTEXITCODE -ne 0) { throw "Build failed (exit code $LASTEXITCODE). No plugin was replaced." }
    }
    finally { Pop-Location }

    Assert-PluginRelease $releaseDir $version
    if (-not (Test-Path -LiteralPath $buildDir -PathType Container)) { throw 'Build output folder was not generated.' }
    Write-Host '[3/4] Creating verified build\package.zip...'
    Write-PortableZip $releaseDir $packageZip $version
    Write-Host "Package ready: $packageZip"
    if ($BuildOnly) {
        Write-Host 'BUILD SUCCESS. -BuildOnly specified: installation was not changed.'
        return
    }

    Write-Host '[4/4] Backing up and deploying plugin...'
    Assert-SiyuanStopped
    $target = Assert-ValidPluginFolder $TargetPluginDir
    $parent = [System.IO.Path]::GetDirectoryName($target)
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        throw "SiYuan data\plugins directory does not exist: $parent"
    }
    $oldExists = Test-Path -LiteralPath $target
    if ($oldExists) {
        if (-not (Test-Path -LiteralPath $target -PathType Container)) { throw 'Plugin target exists but is not a directory.' }
        $oldManifest = Read-PluginJson (Join-Path $target 'plugin.json')
        if ($oldManifest.name -ne 'siyuan-mindmap') { throw 'Existing target is not the expected plugin. Refusing to overwrite it.' }
        $targetInfo = Get-Item -LiteralPath $target -Force
        if (($targetInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Plugin destination is a symlink. Refusing to overwrite.' }
    }
    $id = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
    $stage = Join-Path $parent ('.siyuan-mindmap-new-' + $id)
    $retired = Join-Path $parent ('.siyuan-mindmap-previous-' + $id)
    $backup = Join-Path $buildDir ('deploy-backups\siyuan-mindmap-' + $id)
    $movedOld = $false
    $installedNew = $false
    try {
        # Stage entirely before changing the installed plugin.
        New-Item -ItemType Directory -Path $stage -ErrorAction Stop | Out-Null
        Get-ChildItem -LiteralPath $releaseDir -Force | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force
        }
        Copy-Item -LiteralPath $packageZip -Destination (Join-Path $stage 'package.zip') -Force
        Assert-PluginRelease $stage $version
        if ($oldExists) {
            $backupParent = Split-Path -Path $backup -Parent
            [void][System.IO.Directory]::CreateDirectory($backupParent)
            Copy-Item -LiteralPath $target -Destination $backup -Recurse -Force
            if (-not (Test-Path -LiteralPath (Join-Path $backup 'plugin.json') -PathType Leaf)) {
                throw 'Backup could not be verified; deployment stopped.'
            }
            Write-Host "Previous plugin backed up: $backup"
        }
        Assert-SiyuanStopped
        if ($oldExists) {
            [System.IO.Directory]::Move($target, $retired)
            $movedOld = $true
        }
        [System.IO.Directory]::Move($stage, $target)
        $installedNew = $true
        Assert-PluginRelease $target $version
        if (-not (Test-Path -LiteralPath (Join-Path $target 'package.zip') -PathType Leaf)) {
            throw 'Deployment verification failed: package.zip not found in installed plugin.'
        }
        Write-Host 'DEPLOY SUCCESS.'
        Write-Host "Installed plugin: $target"
        Write-Host "Installed package.zip: $(Join-Path $target 'package.zip')"
        if ($movedOld -and (Test-Path -LiteralPath $retired)) {
            try { Remove-Item -LiteralPath $retired -Recurse -Force }
            catch { Write-Warning "Old working directory could not be removed. Backup remains safe. $retired" }
        }
    }
    catch {
        $originalError = $_
        # If the swap started, restore the previous version instead of leaving it missing.
        if ($movedOld -and (Test-Path -LiteralPath $retired)) {
            try {
                if (Test-Path -LiteralPath $target) {
                    $failed = Join-Path $parent ('.siyuan-mindmap-failed-' + $id)
                    [System.IO.Directory]::Move($target, $failed)
                }
                [System.IO.Directory]::Move($retired, $target)
                Write-Warning 'Deployment failed; previous plugin was restored.'
            }
            catch { Write-Warning "Automatic rollback failed. Previous plugin still located at: $retired" }
        }
        elseif ($installedNew -and (Test-Path -LiteralPath $target)) {
            try {
                $failed = Join-Path $parent ('.siyuan-mindmap-failed-' + $id)
                [System.IO.Directory]::Move($target, $failed)
                Write-Warning "New installation failed validation and was moved aside: $failed"
            }
            catch { Write-Warning "Could not move failed new installation aside: $target" }
        }
        throw $originalError
    }
    finally {
        if (Test-Path -LiteralPath $stage) {
            try { Remove-Item -LiteralPath $stage -Recurse -Force }
            catch { Write-Warning "Unremoved staging folder: $stage" }
        }
    }
}

try {
    Invoke-BuildAndDeploy
    exit 0
}
catch {
    Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Build/deployment stopped. Check the message above; do not delete existing backups.'
    exit 1
}
