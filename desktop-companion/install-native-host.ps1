param([switch]$Uninstall)
$ErrorActionPreference='Stop'
$hostName='com.xingtu.companion'
$extensionRoot=Join-Path $PSScriptRoot '..\browser-companion'
$extensionId=(Get-Content -LiteralPath (Join-Path $extensionRoot 'extension-id.json') -Raw | ConvertFrom-Json).id
$manifestPath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'native\com.xingtu.companion.json'))
$executable=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'native\xingtu-native-host.exe'))
$keys=@("HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName","HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName")
if($Uninstall){
 foreach($key in $keys){if((Test-Path -LiteralPath $key) -and (Get-Item -LiteralPath $key).GetValue('') -eq $manifestPath){Remove-Item -LiteralPath $key}}
 Write-Output '已移除本目录的浏览器联动注册；程序、个人偏好和独立桌宠均保留。'
 exit
}
if(!(Test-Path -LiteralPath $executable)){throw '请先构建或使用完整的星图小星联动交付包。'}
$manifest=@{name=$hostName;description='星图小星桌面陪伴';path=$executable;type='stdio';allowed_origins=@("chrome-extension://$extensionId/")}
[IO.File]::WriteAllText($manifestPath,($manifest|ConvertTo-Json -Depth 4),(New-Object Text.UTF8Encoding($false)))
$backups=@{}
foreach($key in $keys){if(Test-Path -LiteralPath $key){$backups[$key]=(Get-Item -LiteralPath $key).GetValue('')}}
if($backups.Count){$data=Join-Path $PSScriptRoot '.local-data';New-Item -ItemType Directory -Path $data -Force|Out-Null;$backupFile=Join-Path $data ('native-registration-before-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json');$backups|ConvertTo-Json|Set-Content -LiteralPath $backupFile -Encoding utf8}
foreach($key in $keys){New-Item -Path $key -Force|Out-Null;Set-Item -LiteralPath $key -Value $manifestPath}
Write-Output '本地宿主已注册到当前用户。请在Edge或Chrome扩展页加载以下文件夹：'
Write-Output ([IO.Path]::GetFullPath($extensionRoot))
