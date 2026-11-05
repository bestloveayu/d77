param([string]$SdkRoot = "", [string]$JavaHome = "", [string]$Version = '0.3.1', [int]$VersionCode = 4)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (!$SdkRoot) { $SdkRoot = Join-Path (Split-Path $root) '.android-tools/sdk' }
if (!$JavaHome) { $JavaHome = 'C:/Program Files/JetBrains/PyCharm 2025.3.3/jbr' }
$env:JAVA_HOME = $JavaHome
$env:PATH = "$JavaHome/bin;$env:PATH"
$tools = Join-Path $SdkRoot 'build-tools/35.0.0'
$platform = Join-Path $SdkRoot 'platforms/android-35/android.jar'
$build = Join-Path $root 'build'
New-Item -ItemType Directory -Force -Path $build, "$build/generated", "$build/classes", "$build/dex", "$root/dist", "$root/.signing" | Out-Null
function Check { if ($LASTEXITCODE -ne 0) { throw "Build command failed: $LASTEXITCODE" } }
& "$tools/aapt2.exe" compile --dir "$root/res" -o "$build/resources.zip"
Check
& "$tools/aapt2.exe" link -o "$build/base.apk" -I $platform --manifest "$root/AndroidManifest.xml" --java "$build/generated" --min-sdk-version 26 --target-sdk-version 35 --version-code $VersionCode --version-name $Version "$build/resources.zip"
Check
$sources = @((Get-ChildItem "$root/src" -Recurse -Filter '*.java').FullName) + @((Get-ChildItem "$build/generated" -Recurse -Filter '*.java').FullName)
& "$JavaHome/bin/javac.exe" -encoding UTF-8 --release 8 -classpath $platform -d "$build/classes" @sources
Check
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath "$build/classes.jar") { Remove-Item -LiteralPath "$build/classes.jar" }
[System.IO.Compression.ZipFile]::CreateFromDirectory("$build/classes", "$build/classes.jar")
& "$tools/d8.bat" --lib $platform --min-api 26 --output "$build/dex" "$build/classes.jar"
Check
Copy-Item -LiteralPath "$build/base.apk" -Destination "$build/unsigned.apk" -Force
$zip = [System.IO.Compression.ZipFile]::Open("$build/unsigned.apk", [System.IO.Compression.ZipArchiveMode]::Update)
try { [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$build/dex/classes.dex", 'classes.dex') | Out-Null } finally { $zip.Dispose() }
& "$tools/zipalign.exe" -f -p 4 "$build/unsigned.apk" "$build/aligned.apk"
Check
$key = Join-Path $root '.signing/widget-test.jks'
if (!(Test-Path -LiteralPath $key)) {
  & "$JavaHome/bin/keytool.exe" -genkeypair -keystore $key -storepass android -keypass android -alias widget-test -keyalg RSA -keysize 3072 -validity 3650 -dname 'CN=D77 Widget Local Test,O=D77,C=TW'
  Check
}
& "$tools/apksigner.bat" sign --ks $key --ks-key-alias widget-test --ks-pass pass:android --key-pass pass:android --out "$root/dist/東77桌面小工具_${Version}_測試版.apk" "$build/aligned.apk"
Check
& "$tools/apksigner.bat" verify --verbose "$root/dist/東77桌面小工具_${Version}_測試版.apk"
Check
& "$JavaHome/bin/javac.exe" -encoding UTF-8 --release 8 -d "$build/tests" "$root/src/tw/d77/widget/LayoutMetrics.java" "$root/tests/LayoutMetricsTest.java"
Check
& "$JavaHome/bin/java.exe" -cp "$build/tests" LayoutMetricsTest
Check
Get-FileHash -Algorithm SHA256 -LiteralPath "$root/dist/東77桌面小工具_${Version}_測試版.apk"
