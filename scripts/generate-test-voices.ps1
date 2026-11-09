param(
    [string]$OutputDirectory = "$(Split-Path -Parent $PSScriptRoot)\test-voices"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$outputPath = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft Zira Desktop')
$synth.Rate = 0
$synth.Volume = 90

$samples = @(
    @{ File = '01_genuine_everyday.wav'; Label = 'Genuine-style benign control'; Text = 'Hi, I am checking that the usual payment arrived. Please let me know when you have a moment.' },
    @{ File = '02_genuine_noisy_context.wav'; Label = 'Genuine-style benign control'; Text = 'I am calling from a busy place, so the connection may sound a little unclear. I can call back later.' },
    @{ File = '03_scam_urgency.wav'; Label = 'Scam-script synthetic speech'; Text = 'This is the bank security team. Your account is at risk. Transfer the money immediately to this safe account.' },
    @{ File = '04_scam_secrecy.wav'; Label = 'Scam-script synthetic speech'; Text = 'Do not tell anyone about this request. Keep the transfer secret until our investigation is complete.' },
    @{ File = '05_scam_credential_request.wav'; Label = 'Scam-script synthetic speech'; Text = 'Read your one time passcode aloud so I can stop the suspicious payment right now.' },
    @{ File = '06_scam_authority.wav'; Label = 'Scam-script synthetic speech'; Text = 'I am a bank manager. Move your funds to the temporary security account before the alert expires.' },
    @{ File = '07_benign_quoted_scam.wav'; Label = 'Benign quoted scam-language control'; Text = 'The message said, do not tell anyone and transfer immediately. I think it may be a scam, so I did not send anything.' },
    @{ File = '08_scam_combined_pressure.wav'; Label = 'Scam-script synthetic speech'; Text = 'This is the bank security team. Transfer the money to the safe account immediately, and do not tell anyone.' }
)

try {
    foreach ($sample in $samples) {
        $destination = Join-Path $outputPath $sample.File
        $synth.SetOutputToWaveFile($destination)
        $synth.Speak($sample.Text)
        $synth.SetOutputToNull()
    }
}
finally {
    $synth.Dispose()
}

$manifest = [ordered]@{
    title = 'SpectraGuard synthetic voice smoke-test clips'
    generatedLocally = $true
    generator = 'Windows System.Speech, Microsoft Zira Desktop'
    intendedUse = 'Manual local UI smoke tests only. Not training data or validation evidence.'
    samples = @($samples | ForEach-Object {
        [ordered]@{ file = $_.File; label = $_.Label; script = $_.Text }
    })
    caveat = 'One built-in synthetic voice. No deepfake, replay, channel, microphone-injection, speaker, or linguistic diversity coverage.'
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputPath 'manifest.json') -Encoding utf8
Write-Output "Created $($samples.Count) synthetic voice clips in $outputPath"
