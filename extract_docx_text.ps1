$ErrorActionPreference = "Stop"

param(
    [string]$InputDocx = "",
    [string]$OutputMd = ""
)

function Get-DefaultDocxPath {
    $match = Get-ChildItem -LiteralPath $PSScriptRoot -File |
        Where-Object {
            $_.Extension -eq ".docx" -and
            $_.Name -notlike "~$*" -and
            $_.Name -like "BRAND STRUCTURE*AGA Clean Services.docx"
        } |
        Select-Object -First 1

    if (-not $match) {
        throw "No source DOCX file was found in $PSScriptRoot."
    }

    return $match.FullName
}

if (-not $InputDocx) {
    $InputDocx = Get-DefaultDocxPath
}

$resolvedInput = Resolve-Path -LiteralPath $InputDocx

if (-not $OutputMd) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedInput.Path)
    $OutputMd = Join-Path -Path $PSScriptRoot -ChildPath ($baseName + ".md")
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::OpenRead($resolvedInput.Path)

try {
    $documentEntry = $zip.GetEntry("word/document.xml")

    if (-not $documentEntry) {
        throw "The DOCX file does not contain word/document.xml."
    }

    $reader = New-Object System.IO.StreamReader($documentEntry.Open())
    try {
        $xml = $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
    }
}
finally {
    $zip.Dispose()
}

$text = $xml
$text = [regex]::Replace($text, "</w:p>", "`r`n`r`n")
$text = [regex]::Replace($text, "<w:tab[^>]*/>", "    ")
$text = [regex]::Replace($text, "<w:br[^>]*/>", "`r`n")
$text = [regex]::Replace($text, "<[^>]+>", "")
$text = [System.Net.WebUtility]::HtmlDecode($text)
$text = [regex]::Replace($text, "(\r?\n){3,}", "`r`n`r`n")
$text = $text.Trim()

$header = @(
    "# Extracted DOCX Content",
    "",
    "- Source DOCX: $([System.IO.Path]::GetFileName($resolvedInput.Path))",
    "- Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")",
    ""
) -join "`r`n"

$markdown = $header + "`r`n" + $text + "`r`n"

[System.IO.File]::WriteAllText($OutputMd, $markdown, [System.Text.Encoding]::UTF8)

Write-Output "Markdown file created: $OutputMd"
