$ErrorActionPreference = 'Stop'
$targetDirectory = Join-Path $PSScriptRoot '..\public\models'
New-Item -ItemType Directory -Force $targetDirectory | Out-Null
$target = Join-Path $targetDirectory 'synthetic.onnx'
$expected = '7AF799E8443C3D030BB3EF644FFC6E74F5B6FDDCD6A4286EE9ABE9E828CB762E'
if ((Test-Path $target) -and (Get-FileHash $target -Algorithm SHA256).Hash -eq $expected) {
    Write-Output 'Verified synthetic detector already installed.'
    exit 0
}
$download = "$target.download"
curl.exe -L --fail --retry 2 --connect-timeout 20 --max-time 600 'https://huggingface.co/pranjal-pravesh/wav2vec2-large-xlsr-deepfake-audio-classification/resolve/9897e13/model_int8.onnx' -o $download
if ($LASTEXITCODE -ne 0) { throw 'Model download failed. Retry when connected.' }
if ((Get-FileHash $download -Algorithm SHA256).Hash -ne $expected) { throw 'Model checksum mismatch; downloaded file was not installed.' }
Move-Item -LiteralPath $download -Destination $target -Force
Write-Output 'Verified pretrained synthetic-speech detector installed (339 MiB).'
