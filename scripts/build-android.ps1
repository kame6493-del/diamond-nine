param([switch]$Unsigned)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$buildRoot = Join-Path $env:LOCALAPPDATA 'DiamondNineBuild'
# Codex runs packaged, so its LOCALAPPDATA is redirected into the package cache.
# Other shells must use that same folder, or a second upload key gets generated.
$codexRoot = Join-Path $env:LOCALAPPDATA 'Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\DiamondNineBuild'
if (!(Test-Path "$buildRoot/signing/diamond-nine-upload.jks") -and (Test-Path "$codexRoot/signing/diamond-nine-upload.jks")) { $buildRoot = $codexRoot }
$env:JAVA_HOME = (Get-ChildItem "$buildRoot/java" -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME = "$buildRoot/android-sdk"
if (!(Test-Path "$env:JAVA_HOME/bin/java.exe")) { throw 'JDK 21 is required in DiamondNineBuild/java' }
if (!(Test-Path "$env:ANDROID_HOME/platforms/android-36")) { throw 'Android SDK API 36 is required' }
# Android Gradle rejects non-ASCII workspace paths on Windows. Stage in an ASCII
# build directory. Do not move or delete the original project or user files.
$stage = Join-Path $buildRoot 'project'
New-Item -ItemType Directory -Force $stage | Out-Null
& robocopy "$repo/mobile/android" "$stage/android" /E /XD .gradle build /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'Android staging failed' }
& robocopy "$repo/mobile/node_modules" "$stage/node_modules" /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'Dependencies staging failed' }
if (!$Unsigned) {
 $secretDir = Join-Path $buildRoot 'signing'
 New-Item -ItemType Directory -Force $secretDir | Out-Null
 $env:DIAMOND_UPLOAD_STORE = Join-Path $secretDir 'diamond-nine-upload.jks'
 $passwordFile = Join-Path $secretDir 'upload-password.dpapi'
 if (!(Test-Path $env:DIAMOND_UPLOAD_STORE)) {
  if (Test-Path $passwordFile) { throw 'Password exists without key; recover signing material instead of replacing it' }
  $password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(36))
  $password | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Set-Content $passwordFile
  $env:DIAMOND_UPLOAD_PASSWORD = $password
  & "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -keystore $env:DIAMOND_UPLOAD_STORE -storetype JKS -alias diamond-nine-upload -keyalg RSA -keysize 3072 -validity 10000 -storepass:env DIAMOND_UPLOAD_PASSWORD -keypass:env DIAMOND_UPLOAD_PASSWORD -dname 'CN=DIAMOND NINE, O=DIAMOND NINE, C=JP' -noprompt
  if ($LASTEXITCODE -ne 0) { throw 'Signing key creation failed' }
 } else {
  $secure = Get-Content $passwordFile | ConvertTo-SecureString
  $env:DIAMOND_UPLOAD_PASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
 }
}
Push-Location "$stage/android"
try {
 & ./gradlew.bat :app:assembleDebug :app:assembleRelease :app:bundleRelease --console=plain
 if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
 $out = Join-Path $repo 'mobile/releases'
 New-Item -ItemType Directory -Force $out | Out-Null
 Copy-Item 'app/build/outputs/apk/debug/app-debug.apk' "$out/diamond-nine-test.apk" -Force
 Copy-Item 'app/build/outputs/bundle/release/app-release.aab' "$out/diamond-nine-release.aab" -Force
 if (!$Unsigned) { Copy-Item 'app/build/outputs/apk/release/app-release.apk' "$out/diamond-nine-release.apk" -Force }
 Write-Output "Android artifacts: $out"
} finally {
 Pop-Location
 Remove-Item Env:DIAMOND_UPLOAD_PASSWORD,Env:DIAMOND_UPLOAD_STORE -ErrorAction SilentlyContinue
}
