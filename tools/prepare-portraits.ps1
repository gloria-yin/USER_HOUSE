$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = Split-Path $PSScriptRoot -Parent
$portraitRoot = Join-Path $assetRoot 'assets\pets\portraits\shenqibai'
$sourceRoot = Join-Path $portraitRoot 'sources'
[IO.Directory]::CreateDirectory($sourceRoot) | Out-Null
$images = @{
    'IMG_20260909_100530_CocoAI_20260909_100654_4.png' = 'neutral.png'
    'IMG_20260909_100540_CocoAI_20260909_100654_3.png' = 'smile.png'
    'IMG_20260909_100614_CocoAI_20260909_100653_2.png' = 'talk.png'
    'IMG_20260909_100623_CocoAI_20260909_100653_1.png' = 'thoughtful.png'
}
function Resize-SquarePng($source, $destination, $size) {
    $original = [Drawing.Image]::FromFile($source)
    $bitmap = [Drawing.Bitmap]::new($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($original, 0, 0, $size, $size)
        $bitmap.Save($destination, [Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
        $original.Dispose()
    }
}
foreach ($entry in $images.GetEnumerator()) {
    $source = Join-Path $sourceRoot $entry.Key
    $incoming = Join-Path $assetRoot $entry.Key
    if (!(Test-Path -LiteralPath $source)) { Move-Item -LiteralPath $incoming -Destination $source }
    Resize-SquarePng $source (Join-Path $portraitRoot $entry.Value) 128
}
$icon = Join-Path $assetRoot 'assets\game-icons\flappybird.png'
$iconSourceRoot = Join-Path $assetRoot 'assets\game-icons\sources'
[IO.Directory]::CreateDirectory($iconSourceRoot) | Out-Null
$iconSource = Join-Path $iconSourceRoot 'flappybird-original.png'
$oldIconSource = Join-Path $sourceRoot 'flappybird-original.png'
if ((Test-Path -LiteralPath $oldIconSource) -and !(Test-Path -LiteralPath $iconSource)) {
    Move-Item -LiteralPath $oldIconSource -Destination $iconSource
}
if (!(Test-Path -LiteralPath $iconSource)) { Copy-Item -LiteralPath $icon -Destination $iconSource }
Resize-SquarePng $iconSource $icon 256
Write-Output 'Prepared four 128x128 transparent portraits and the 256x256 game icon; originals retained.'
